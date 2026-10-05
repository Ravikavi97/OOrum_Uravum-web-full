/**
 * Built-in category icon keys.
 *
 * These keys map to inline SVG paths rendered by the frontend
 * (`frontend/src/components/ui/CategoryIcon.tsx`). The frontend registry is the
 * source of truth for the artwork — this list only gates which keys the API
 * will persist, so both sides must be kept in sync.
 */
export const CATEGORY_ICON_KEYS = [
  'map', 'globe', 'newspaper', 'megaphone', 'users', 'heart', 'star',
  'calendar', 'camera', 'video', 'trophy', 'briefcase', 'home', 'chart',
  'fire', 'compass', 'phone', 'tag', 'academic', 'scale', 'cpu', 'code',
  'bolt', 'leaf', 'cloud', 'sun', 'plane', 'gift', 'ticket', 'clock',
  'map-pin', 'shield', 'document', 'folder', 'play', 'mic', 'shopping',
  'truck', 'wrench', 'book',
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export function isCategoryIconKey(value: unknown): value is CategoryIconKey {
  return typeof value === 'string' && (CATEGORY_ICON_KEYS as readonly string[]).includes(value);
}