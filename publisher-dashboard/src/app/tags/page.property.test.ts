import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property tests for the Tags admin page.
 *
 * These tests replicate the exact data-transformation and logic functions
 * from tags/page.tsx to verify correctness properties without React rendering.
 */

// ── Replicated types from page.tsx ─────────────────────────────────────────

interface Tag {
  id: string;
  name: string;
  slug: string;
}

// ── Replicated logic from page.tsx ─────────────────────────────────────────

/**
 * Builds the API payload for creating a tag.
 * Mirrors the handleCreate body construction in page.tsx:
 *   body: JSON.stringify({ name })
 */
function buildCreateTagPayload(form: { name: string }): Record<string, unknown> {
  return { name: form.name };
}

/**
 * Builds the API request for inline editing a tag.
 * Mirrors the saveEdit logic in page.tsx:
 *   adminFetch(`/tags/${editingId}`, { method: 'PUT', body: JSON.stringify({ name: editName.trim() }) })
 */
function buildInlineEditRequest(tagId: string, editName: string) {
  return {
    url: `/tags/${tagId}`,
    method: 'PUT' as const,
    body: { name: editName.trim() },
  };
}

// ── Arbitraries ────────────────────────────────────────────────────────────

const idArb = fc.uuid();

const tagNameArb = fc.string({ minLength: 1, maxLength: 50 });

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard', () => {
  /**
   * Property 1: CRUD form submission produces correct API payload (tag entity)
   * Validates: Requirements 7.2, 7.3
   *
   * For any valid tag form data, submitting the create form should produce
   * a POST request with correct payload shape, and inline edit should produce
   * a PUT request with correct payload shape.
   */
  describe('Property 1: CRUD form submission produces correct API payload', () => {
    it('create payload should contain only the name field', () => {
      fc.assert(
        fc.property(tagNameArb, (name) => {
          const payload = buildCreateTagPayload({ name });

          expect(payload.name).toBe(name);

          // Payload should only contain the name key
          const keys = Object.keys(payload);
          expect(keys).toEqual(['name']);
        }),
        { numRuns: 100 },
      );
    });

    it('create payload should be JSON-serializable', () => {
      fc.assert(
        fc.property(tagNameArb, (name) => {
          const payload = buildCreateTagPayload({ name });
          const serialized = JSON.stringify(payload);
          const deserialized = JSON.parse(serialized);
          expect(deserialized).toEqual(payload);
        }),
        { numRuns: 100 },
      );
    });

    it('inline edit request should produce PUT to /tags/:id with trimmed name', () => {
      fc.assert(
        fc.property(idArb, tagNameArb, (tagId, editName) => {
          const request = buildInlineEditRequest(tagId, editName);

          expect(request.url).toBe(`/tags/${tagId}`);
          expect(request.method).toBe('PUT');
          expect(request.body).toEqual({ name: editName.trim() });

          // Body should only contain the name key
          const keys = Object.keys(request.body);
          expect(keys).toEqual(['name']);
        }),
        { numRuns: 100 },
      );
    });

    it('inline edit trims whitespace from name', () => {
      fc.assert(
        fc.property(
          idArb,
          fc.tuple(
            fc.nat({ max: 3 }),
            fc.string({ minLength: 1, maxLength: 30 }),
            fc.nat({ max: 3 }),
          ),
          (tagId, [leadingCount, core, trailingCount]) => {
            const nameWithSpaces = ' '.repeat(leadingCount) + core + ' '.repeat(trailingCount);
            const request = buildInlineEditRequest(tagId, nameWithSpaces);

            // The trimmed name should have no leading/trailing spaces
            expect(request.body.name).toBe(nameWithSpaces.trim());
            expect(request.body.name).not.toMatch(/^\s/);
            expect(request.body.name).not.toMatch(/\s$/);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('inline edit payload should be JSON-serializable', () => {
      fc.assert(
        fc.property(idArb, tagNameArb, (tagId, editName) => {
          const request = buildInlineEditRequest(tagId, editName);
          const serialized = JSON.stringify(request.body);
          const deserialized = JSON.parse(serialized);
          expect(deserialized).toEqual({ name: editName.trim() });
        }),
        { numRuns: 100 },
      );
    });
  });
});
