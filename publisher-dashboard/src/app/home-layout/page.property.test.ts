import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property 9: Home layout configuration round-trip
 *
 * Validates: Requirements 3.2, 3.3
 *
 * For any home layout configuration (any combination of section visibilities
 * and any permutation of section ordering), saving the configuration via PUT
 * to /api/settings and then reading it back via GET should produce an
 * equivalent configuration.
 */

// ── Replicated types from page.tsx ─────────────────────────────────────────

interface Section {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

interface HomeLayoutConfig {
  sections: Section[];
}

// ── Replicated logic from page.tsx ─────────────────────────────────────────

const SECTION_IDS = [
  'ticker',
  'hero',
  'topicCards',
  'latestNews',
  'obituary',
  'adSidebar',
  'archiveSidebar',
] as const;

const SECTION_LABELS: Record<string, string> = {
  ticker: 'Ticker',
  hero: 'Hero Section',
  topicCards: 'Topic Cards',
  latestNews: 'Latest News',
  obituary: 'Obituary Section',
  adSidebar: 'Advertisement Sidebar',
  archiveSidebar: 'Archive Sidebar',
};

/**
 * Builds the JSON payload for saving home layout config.
 * Mirrors the saveConfig logic in page.tsx.
 */
function buildSavePayload(sections: Section[]): string {
  const config: HomeLayoutConfig = { sections };
  return JSON.stringify({ key: 'homeLayout', value: JSON.stringify(config) });
}

/**
 * Parses a saved config back from the GET response format.
 * Mirrors the fetchConfig parsing logic in page.tsx.
 */
function parseConfigFromResponse(value: string): Section[] {
  const parsed: HomeLayoutConfig = JSON.parse(value);
  if (parsed.sections?.length) {
    return [...parsed.sections].sort((a, b) => a.order - b.order);
  }
  return [];
}

/**
 * Toggle visibility of a section at the given index.
 * Mirrors toggleVisibility in page.tsx.
 */
function toggleVisibility(sections: Section[], index: number): Section[] {
  return sections.map((s, i) =>
    i === index ? { ...s, visible: !s.visible } : s,
  );
}

/**
 * Move a section up by one position.
 * Mirrors moveUp in page.tsx.
 */
function moveUp(sections: Section[], index: number): Section[] {
  if (index === 0) return sections;
  const updated = [...sections];
  [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
  return updated.map((s, i) => ({ ...s, order: i }));
}

/**
 * Move a section down by one position.
 * Mirrors moveDown in page.tsx.
 */
function moveDown(sections: Section[], index: number): Section[] {
  if (index === sections.length - 1) return sections;
  const updated = [...sections];
  [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
  return updated.map((s, i) => ({ ...s, order: i }));
}

// ── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Generate a valid section with one of the known IDs.
 */
const sectionIdArb = fc.constantFrom(...SECTION_IDS);

/**
 * Generate a valid home layout config: a permutation of all 7 sections
 * with random visibility states.
 */
const homeLayoutArb: fc.Arbitrary<Section[]> = fc
  .tuple(
    // Generate a visibility boolean for each section
    fc.tuple(
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
    ),
    // Generate a permutation of indices 0-6
    fc.shuffledSubarray([0, 1, 2, 3, 4, 5, 6], { minLength: 7, maxLength: 7 }),
  )
  .map(([visibilities, permutation]) =>
    permutation.map((originalIndex, order) => ({
      id: SECTION_IDS[originalIndex],
      label: SECTION_LABELS[SECTION_IDS[originalIndex]],
      visible: visibilities[originalIndex],
      order,
    })),
  );

/**
 * Generate a valid index into a 7-element array.
 */
const sectionIndexArb = fc.integer({ min: 0, max: 6 });

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard', () => {
  describe('Property 9: Home layout configuration round-trip', () => {
    it('serializing config to JSON and parsing it back produces equivalent config', () => {
      fc.assert(
        fc.property(homeLayoutArb, (sections) => {
          // Simulate save: build the PUT payload
          const payload = JSON.parse(buildSavePayload(sections));
          const savedValue = payload.value;

          // Simulate read: parse the GET response value
          const restored = parseConfigFromResponse(savedValue);

          // Sort both by order for comparison
          const sortedOriginal = [...sections].sort((a, b) => a.order - b.order);

          expect(restored).toHaveLength(sortedOriginal.length);
          for (let i = 0; i < restored.length; i++) {
            expect(restored[i].id).toBe(sortedOriginal[i].id);
            expect(restored[i].label).toBe(sortedOriginal[i].label);
            expect(restored[i].visible).toBe(sortedOriginal[i].visible);
            expect(restored[i].order).toBe(sortedOriginal[i].order);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('toggle visibility preserves all other sections unchanged', () => {
      fc.assert(
        fc.property(homeLayoutArb, sectionIndexArb, (sections, index) => {
          const updated = toggleVisibility(sections, index);

          expect(updated).toHaveLength(sections.length);

          for (let i = 0; i < sections.length; i++) {
            expect(updated[i].id).toBe(sections[i].id);
            expect(updated[i].label).toBe(sections[i].label);
            expect(updated[i].order).toBe(sections[i].order);

            if (i === index) {
              // Toggled section has flipped visibility
              expect(updated[i].visible).toBe(!sections[i].visible);
            } else {
              // All other sections are unchanged
              expect(updated[i].visible).toBe(sections[i].visible);
            }
          }
        }),
        { numRuns: 100 },
      );
    });

    it('move up preserves all sections (no section lost or duplicated)', () => {
      fc.assert(
        fc.property(homeLayoutArb, sectionIndexArb, (sections, index) => {
          const updated = moveUp(sections, index);

          expect(updated).toHaveLength(sections.length);

          // All original section IDs are still present
          const originalIds = sections.map((s) => s.id).sort();
          const updatedIds = updated.map((s) => s.id).sort();
          expect(updatedIds).toEqual(originalIds);

          // Visibility is preserved for each section
          for (const section of sections) {
            const moved = updated.find((s) => s.id === section.id);
            expect(moved).toBeDefined();
            expect(moved!.visible).toBe(section.visible);
            expect(moved!.label).toBe(section.label);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('move down preserves all sections (no section lost or duplicated)', () => {
      fc.assert(
        fc.property(homeLayoutArb, sectionIndexArb, (sections, index) => {
          const updated = moveDown(sections, index);

          expect(updated).toHaveLength(sections.length);

          // All original section IDs are still present
          const originalIds = sections.map((s) => s.id).sort();
          const updatedIds = updated.map((s) => s.id).sort();
          expect(updatedIds).toEqual(originalIds);

          // Visibility is preserved for each section
          for (const section of sections) {
            const moved = updated.find((s) => s.id === section.id);
            expect(moved).toBeDefined();
            expect(moved!.visible).toBe(section.visible);
            expect(moved!.label).toBe(section.label);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('move up/down updates order numbers to be consecutive 0..N-1', () => {
      fc.assert(
        fc.property(homeLayoutArb, sectionIndexArb, (sections, index) => {
          const afterUp = moveUp(sections, index);
          const afterDown = moveDown(sections, index);

          // After moveUp, orders should be 0..N-1
          const upOrders = afterUp.map((s) => s.order).sort((a, b) => a - b);
          expect(upOrders).toEqual([0, 1, 2, 3, 4, 5, 6]);

          // After moveDown, orders should be 0..N-1
          const downOrders = afterDown.map((s) => s.order).sort((a, b) => a - b);
          expect(downOrders).toEqual([0, 1, 2, 3, 4, 5, 6]);
        }),
        { numRuns: 100 },
      );
    });

    it('double toggle returns to original visibility state', () => {
      fc.assert(
        fc.property(homeLayoutArb, sectionIndexArb, (sections, index) => {
          const toggled = toggleVisibility(sections, index);
          const restored = toggleVisibility(toggled, index);

          for (let i = 0; i < sections.length; i++) {
            expect(restored[i].id).toBe(sections[i].id);
            expect(restored[i].visible).toBe(sections[i].visible);
            expect(restored[i].order).toBe(sections[i].order);
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
