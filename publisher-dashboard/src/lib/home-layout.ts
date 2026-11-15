export interface HomeLayoutSection {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export const DEFAULT_HOME_LAYOUT_SECTIONS: HomeLayoutSection[] = [
  { id: 'ticker', label: 'Ticker', visible: true, order: 0 },
  { id: 'videoHero', label: 'Video Hero Section', visible: true, order: 1 },
  { id: 'hero', label: 'Text News Hero Section', visible: true, order: 2 },
  { id: 'obituary', label: 'Obituary / Tributes', visible: true, order: 3 },
  { id: 'topicCards', label: 'Topic Cards', visible: true, order: 4 },
  { id: 'latestNews', label: 'Latest News', visible: true, order: 5 },
  { id: 'adSidebar', label: 'Advertisement Sidebar', visible: true, order: 6 },
  { id: 'archiveSidebar', label: 'Archive Sidebar', visible: true, order: 7 },
  { id: 'welcome', label: 'Welcome Header and Breadcrumb', visible: true, order: 8 },
  { id: 'featuredHub', label: 'Featured Hub', visible: true, order: 9 },
  { id: 'sponsoredSidebar', label: 'Featured Advertising', visible: true, order: 10 },
  { id: 'categoryCards', label: 'Category Cards', visible: true, order: 11 },
];

export const HOME_LAYOUT_GROUPS = [
  {
    id: 'fixed',
    label: 'Fixed homepage sections',
    description: 'Toggle these sections; their positions are part of the homepage design.',
    sectionIds: ['ticker', 'welcome', 'featuredHub', 'sponsoredSidebar', 'categoryCards'],
    reorderable: false,
  },
  {
    id: 'upper-content',
    label: 'Upper content order',
    description: 'Use the arrows to reorder these sections below the featured area.',
    sectionIds: ['videoHero', 'hero', 'topicCards'],
    reorderable: true,
  },
  {
    id: 'news-feed',
    label: 'News feed order',
    description: 'Choose whether tributes or latest news appears first.',
    sectionIds: ['obituary', 'latestNews'],
    reorderable: true,
  },
  {
    id: 'sidebars',
    label: 'Sidebar widgets',
    description: 'When both are enabled, arrows switch their left/right positions.',
    sectionIds: ['adSidebar', 'archiveSidebar'],
    reorderable: true,
  },
] as const;

function isHomeLayoutSection(value: unknown): value is HomeLayoutSection {
  if (typeof value !== 'object' || value === null) return false;
  const section = value as Record<string, unknown>;
  return typeof section.id === 'string'
    && typeof section.label === 'string'
    && typeof section.visible === 'boolean'
    && typeof section.order === 'number'
    && Number.isFinite(section.order);
}

export function mergeHomeLayoutSections(savedSections: unknown): HomeLayoutSection[] {
  const uniqueSavedSections = new Map<string, HomeLayoutSection>();
  if (Array.isArray(savedSections)) {
    for (const section of savedSections) {
      if (isHomeLayoutSection(section) && !uniqueSavedSections.has(section.id)) {
        uniqueSavedSections.set(section.id, section);
      }
    }
  }

  const saved = [...uniqueSavedSections.values()].sort((a, b) => a.order - b.order);
  const savedIds = new Set(saved.map((section) => section.id));
  const missingDefaults = DEFAULT_HOME_LAYOUT_SECTIONS.filter((section) => !savedIds.has(section.id));

  return [...saved, ...missingDefaults].map((section, order) => ({ ...section, order }));
}

export function moveHomeLayoutSection(
  sections: readonly HomeLayoutSection[],
  sectionId: string,
  groupIds: readonly string[],
  direction: -1 | 1,
): HomeLayoutSection[] {
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const groupIndices = ordered.flatMap((section, index) => (
    groupIds.includes(section.id) ? [index] : []
  ));
  const group = groupIndices.map((index) => ordered[index]);
  const groupIndex = group.findIndex((section) => section.id === sectionId);
  if (groupIndex < 0) return ordered;
  const targetGroupIndex = groupIndex + direction;
  if (targetGroupIndex < 0 || targetGroupIndex >= group.length) return ordered;

  [group[groupIndex], group[targetGroupIndex]] = [group[targetGroupIndex], group[groupIndex]];
  groupIndices.forEach((index, i) => {
    ordered[index] = group[i];
  });

  return ordered.map((section, order) => ({ ...section, order }));
}
