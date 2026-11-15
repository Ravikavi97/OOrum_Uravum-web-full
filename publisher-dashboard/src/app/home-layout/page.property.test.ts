import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  DEFAULT_HOME_LAYOUT_SECTIONS,
  HOME_LAYOUT_GROUPS,
  mergeHomeLayoutSections,
  moveHomeLayoutSection,
} from '@/lib/home-layout';
import type { HomeLayoutSection } from '@/lib/home-layout';

const sectionIds = DEFAULT_HOME_LAYOUT_SECTIONS.map((section) => section.id);

const homeLayoutArb: fc.Arbitrary<HomeLayoutSection[]> = fc
  .tuple(
    fc.array(fc.boolean(), { minLength: sectionIds.length, maxLength: sectionIds.length }),
    fc.shuffledSubarray(sectionIds.map((_, index) => index), {
      minLength: sectionIds.length,
      maxLength: sectionIds.length,
    }),
  )
  .map(([visibilities, permutation]) => permutation.map((sectionIndex, order) => ({
    ...DEFAULT_HOME_LAYOUT_SECTIONS[sectionIndex],
    visible: visibilities[sectionIndex],
    order,
  })));

describe('homepage layout configuration', () => {
  it('provides dashboard controls for every homepage component exactly once', () => {
    const groupedIds = HOME_LAYOUT_GROUPS.flatMap((group) => group.sectionIds);
    expect(groupedIds.sort()).toEqual(sectionIds.slice().sort());
  });

  it('round-trips visibility and order for every configured section', () => {
    fc.assert(
      fc.property(homeLayoutArb, (sections) => {
        const saved = JSON.stringify({ sections });
        const restored = mergeHomeLayoutSections(JSON.parse(saved).sections);

        expect(restored).toEqual([...sections].sort((a, b) => a.order - b.order));
      }),
      { numRuns: 100 },
    );
  });

  it('preserves legacy visibility while adding newly managed sections as visible', () => {
    const legacySections = DEFAULT_HOME_LAYOUT_SECTIONS.slice(0, 8)
      .map((section, order) => ({ ...section, visible: false, order }));

    const merged = mergeHomeLayoutSections(legacySections);

    expect(merged).toHaveLength(DEFAULT_HOME_LAYOUT_SECTIONS.length);
    expect(merged.slice(0, 8).every((section) => !section.visible)).toBe(true);
    expect(merged.slice(8).every((section) => section.visible)).toBe(true);
    expect(new Set(merged.map((section) => section.id)).size).toBe(merged.length);
  });

  it('only reorders sections inside the selected group', () => {
    fc.assert(
      fc.property(homeLayoutArb, (sections) => {
        const groupIds = ['obituary', 'latestNews'];
        const beforeGroup = sections
          .filter((section) => groupIds.includes(section.id))
          .sort((a, b) => a.order - b.order)
          .map((section) => section.id);
        const beforeOthers = sections
          .filter((section) => !groupIds.includes(section.id))
          .sort((a, b) => a.order - b.order)
          .map((section) => section.id);
        const sectionToMove = beforeGroup[beforeGroup.length - 1];

        const moved = moveHomeLayoutSection(sections, sectionToMove, groupIds, -1);
        const afterGroup = moved.filter((section) => groupIds.includes(section.id)).map((section) => section.id);
        const afterOthers = moved.filter((section) => !groupIds.includes(section.id)).map((section) => section.id);

        expect(afterGroup).toEqual([...beforeGroup].reverse());
        expect(afterOthers).toEqual(beforeOthers);
        expect(moved.map((section) => section.order)).toEqual(sectionIds.map((_, index) => index));
      }),
      { numRuns: 100 },
    );
  });

  it('does not move a section beyond a group boundary', () => {
    const sections = mergeHomeLayoutSections([]);

    expect(moveHomeLayoutSection(sections, 'obituary', ['obituary', 'latestNews'], -1)).toEqual(sections);
    expect(moveHomeLayoutSection(sections, 'latestNews', ['obituary', 'latestNews'], 1)).toEqual(sections);
  });
});
