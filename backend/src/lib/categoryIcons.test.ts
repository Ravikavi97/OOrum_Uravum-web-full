import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CATEGORY_ICON_KEYS, isCategoryIconKey } from './categoryIcons';

/**
 * The icon key list exists in three places, because the publisher dashboard and
 * the public site are separate Next.js apps that cannot share an import. The
 * backend is the gate that decides what may be persisted, so these assertions
 * fail loudly the moment one list is edited without the others.
 */
const REPO_ROOT = path.resolve(__dirname, '../../..');

const SOURCES = {
  frontend: path.join(
    REPO_ROOT,
    'frontend/src/components/ui/CategoryIcon.tsx',
  ),
  dashboard: path.join(
    REPO_ROOT,
    'publisher-dashboard/src/components/CategoryIconField.tsx',
  ),
} as const;

/** Pull the string literals out of a `const CATEGORY_ICON_KEYS = [...] as const;` block. */
function readDeclaredKeys(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf('CATEGORY_ICON_KEYS = [');
  expect(start, `${file} should declare CATEGORY_ICON_KEYS`).toBeGreaterThan(-1);

  const open = src.indexOf('[', start);
  const close = src.indexOf('] as const', open);
  expect(close, `${file} should close CATEGORY_ICON_KEYS with "] as const"`).toBeGreaterThan(-1);

  const body = src.slice(open + 1, close);
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('category icon key registry', () => {
  it('has no duplicate keys', () => {
    expect(new Set(CATEGORY_ICON_KEYS).size).toBe(CATEGORY_ICON_KEYS.length);
  });

  it('uses lowercase, url-safe key names', () => {
    for (const key of CATEGORY_ICON_KEYS) {
      expect(key).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('includes the map icon requested for the header', () => {
    expect(CATEGORY_ICON_KEYS).toContain('map');
  });

  it('matches the frontend registry exactly', () => {
    expect(readDeclaredKeys(SOURCES.frontend).sort()).toEqual([...CATEGORY_ICON_KEYS].sort());
  });

  it('matches the publisher dashboard registry exactly', () => {
    expect(readDeclaredKeys(SOURCES.dashboard).sort()).toEqual([...CATEGORY_ICON_KEYS].sort());
  });

  it('gives every key path data in the frontend component', () => {
    const src = fs.readFileSync(SOURCES.frontend, 'utf8');
    const start = src.indexOf('const PATHS');
    const close = src.indexOf('\n};', start);
    const block = src.slice(start, close);

    for (const key of CATEGORY_ICON_KEYS) {
      const quoted = key === 'map-pin' ? "'map-pin'" : key;
      expect(block, `frontend PATHS is missing an entry for "${key}"`).toContain(`${quoted}:`);
    }
  });

  it('accepts known keys and rejects unknown ones', () => {
    for (const key of CATEGORY_ICON_KEYS) {
      expect(isCategoryIconKey(key)).toBe(true);
    }
    expect(isCategoryIconKey('definitely-not-an-icon')).toBe(false);
    expect(isCategoryIconKey('')).toBe(false);
    expect(isCategoryIconKey(null)).toBe(false);
    expect(isCategoryIconKey(undefined)).toBe(false);
    expect(isCategoryIconKey(42)).toBe(false);
  });
});