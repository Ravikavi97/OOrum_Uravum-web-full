import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property tests for the Categories admin page.
 *
 * These tests replicate the exact data-transformation and logic functions
 * from categories/page.tsx to verify correctness properties without React rendering.
 */

// ── Replicated types from page.tsx ─────────────────────────────────────────

interface ParentCategory {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parent: ParentCategory | null;
  _count: { articles: number };
}

// ── Replicated logic from page.tsx ─────────────────────────────────────────

/**
 * Builds the API payload for creating/updating a category.
 * Mirrors the handleSubmit body construction in page.tsx.
 */
function buildCategoryPayload(form: {
  name: string;
  description: string;
  parentId: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: form.name,
    description: form.description || undefined,
    parentId: form.parentId || undefined,
  };
  return body;
}

/**
 * Populates form fields from a category entity.
 * Mirrors the openEditForm logic in page.tsx.
 */
function populateEditForm(cat: Category) {
  return {
    editingId: cat.id,
    name: cat.name,
    description: cat.description || '',
    parentId: cat.parentId || '',
  };
}

// ── Arbitraries ────────────────────────────────────────────────────────────

const idArb = fc.uuid();

const slugArb = fc
  .stringMatching(/^[a-z0-9][a-z0-9\-]{0,30}[a-z0-9]$/)
  .filter((s) => s.length >= 2);

const parentCategoryArb = fc.record({
  id: idArb,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  slug: slugArb,
});

const categoryArb: fc.Arbitrary<Category> = fc.record({
  id: idArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  slug: slugArb,
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  parentId: fc.option(idArb, { nil: null }),
  parent: fc.option(parentCategoryArb, { nil: null }),
  _count: fc.record({ articles: fc.nat({ max: 1000 }) }),
});

// Ensure parentId matches parent.id when both are present
const consistentCategoryArb = categoryArb.chain((cat) => {
  if (cat.parent && cat.parentId) {
    return fc.constant({ ...cat, parentId: cat.parent.id });
  }
  if (cat.parent && !cat.parentId) {
    return fc.constant({ ...cat, parentId: cat.parent.id });
  }
  if (!cat.parent && cat.parentId) {
    return fc.constant({ ...cat, parentId: null });
  }
  return fc.constant(cat);
});

const formDataArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  parentId: fc.oneof(idArb, fc.constant('')),
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard', () => {
  /**
   * Property 1: CRUD form submission produces correct API payload (category entity)
   * Validates: Requirements 2.3
   *
   * For any valid category form data, submitting the create form should produce
   * a POST request with correct payload shape.
   */
  describe('Property 1: CRUD form submission produces correct API payload', () => {
    it('should produce a payload with required fields and correct optional handling', () => {
      fc.assert(
        fc.property(formDataArb, (form) => {
          const payload = buildCategoryPayload(form);

          // name is always present
          expect(payload.name).toBe(form.name);

          // description: included only when non-empty, otherwise undefined
          if (form.description) {
            expect(payload.description).toBe(form.description);
          } else {
            expect(payload.description).toBeUndefined();
          }

          // parentId: included only when non-empty, otherwise undefined
          if (form.parentId) {
            expect(payload.parentId).toBe(form.parentId);
          } else {
            expect(payload.parentId).toBeUndefined();
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should produce JSON-serializable payload', () => {
      fc.assert(
        fc.property(formDataArb, (form) => {
          const payload = buildCategoryPayload(form);
          const serialized = JSON.stringify(payload);
          const deserialized = JSON.parse(serialized);

          // undefined values are dropped by JSON.stringify, so compare after round-trip
          expect(deserialized.name).toBe(form.name);
          if (form.description) {
            expect(deserialized.description).toBe(form.description);
          } else {
            expect(deserialized).not.toHaveProperty('description');
          }
          if (form.parentId) {
            expect(deserialized.parentId).toBe(form.parentId);
          } else {
            expect(deserialized).not.toHaveProperty('parentId');
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should only contain expected keys', () => {
      fc.assert(
        fc.property(formDataArb, (form) => {
          const payload = buildCategoryPayload(form);
          const keys = Object.keys(payload);
          const allowedKeys = ['name', 'description', 'parentId'];
          for (const key of keys) {
            expect(allowedKeys).toContain(key);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 2: Edit form population matches fetched entity data (category entity)
   * Validates: Requirements 2.4
   *
   * For any category fetched from API, populating the edit form and reading back
   * should match the original category's editable fields.
   */
  describe('Property 2: Edit form population matches fetched entity data', () => {
    it('should populate form fields matching the category data', () => {
      fc.assert(
        fc.property(consistentCategoryArb, (cat) => {
          const form = populateEditForm(cat);

          expect(form.editingId).toBe(cat.id);
          expect(form.name).toBe(cat.name);
          expect(form.description).toBe(cat.description || '');
          expect(form.parentId).toBe(cat.parentId || '');
        }),
        { numRuns: 100 },
      );
    });

    it('should produce a round-trip: populate form then build payload preserves data', () => {
      fc.assert(
        fc.property(consistentCategoryArb, (cat) => {
          const form = populateEditForm(cat);
          const payload = buildCategoryPayload({
            name: form.name,
            description: form.description,
            parentId: form.parentId,
          });

          // name always matches
          expect(payload.name).toBe(cat.name);

          // description: if original had one, payload should too
          if (cat.description) {
            expect(payload.description).toBe(cat.description);
          } else {
            expect(payload.description).toBeUndefined();
          }

          // parentId: if original had one, payload should too
          if (cat.parentId) {
            expect(payload.parentId).toBe(cat.parentId);
          } else {
            expect(payload.parentId).toBeUndefined();
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
