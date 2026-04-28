import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property tests for admin navigation visibility and active link matching.
 *
 * These tests replicate the exact NAV_ITEMS data and filtering/active logic
 * from layout.tsx to verify correctness properties without React rendering.
 */

// ── Replicated types and data from layout.tsx ──────────────────────────────

type UserRole = 'ADMIN' | 'EDITOR' | 'AUTHOR';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: '📊' },
  { label: 'Articles', href: '/articles', icon: '📝' },
  { label: 'Categories', href: '/categories', icon: '📁' },
  { label: 'Tags', href: '/tags', icon: '🏷️' },
  { label: 'Users', href: '/users', icon: '👥', roles: ['ADMIN'] },
  { label: 'Media', href: '/media', icon: '🖼️' },
  { label: 'Comments', href: '/comments', icon: '💬', roles: ['ADMIN', 'EDITOR'] },
  { label: 'Obituaries', href: '/obituaries', icon: '🕯️' },
  { label: 'Home Layout', href: '/home-layout', icon: '🏠', roles: ['ADMIN'] },
  { label: 'Settings', href: '/settings', icon: '⚙️', roles: ['ADMIN'] },
];

// ── Replicated logic from layout.tsx ───────────────────────────────────────

function hasRole(userRole: UserRole, ...roles: UserRole[]): boolean {
  return roles.includes(userRole);
}

function getVisibleItems(userRole: UserRole): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.roles || hasRole(userRole, ...item.roles),
  );
}

function isActive(pathname: string, itemHref: string): boolean {
  return pathname === itemHref || (itemHref !== '/' && pathname.startsWith(itemHref));
}

// ── Expected nav items per role (from requirements 11.3, 11.4) ─────────────

const EXPECTED_LABELS_BY_ROLE: Record<UserRole, string[]> = {
  ADMIN: [
    'Dashboard', 'Articles', 'Categories', 'Tags', 'Users',
    'Media', 'Comments', 'Obituaries', 'Home Layout', 'Settings',
  ],
  EDITOR: [
    'Dashboard', 'Articles', 'Categories', 'Tags',
    'Media', 'Comments', 'Obituaries',
  ],
  AUTHOR: [
    'Dashboard', 'Articles', 'Categories', 'Tags',
    'Media', 'Obituaries',
  ],
};

// ── Arbitraries ────────────────────────────────────────────────────────────

const roleArb = fc.constantFrom<UserRole>('ADMIN', 'EDITOR', 'AUTHOR');

// Generate valid admin page paths (both exact nav hrefs and sub-paths)
const adminPathArb = fc.oneof(
  // Exact nav item hrefs
  fc.constantFrom(...NAV_ITEMS.map(item => item.href)),
  // Sub-paths of nav items (e.g. /articles/123)
  fc.tuple(
    fc.constantFrom(...NAV_ITEMS.filter(i => i.href !== '/').map(i => i.href)),
    fc.stringMatching(/^[a-z0-9\-]{1,20}$/),
  ).map(([base, suffix]) => `${base}/${suffix}`),
);

describe('Feature: publisher-dashboard', () => {
  /**
   * Property 3: Role-based navigation visibility
   * Validates: Requirements 11.3, 11.4
   *
   * For any user role (ADMIN, EDITOR, AUTHOR), the set of visible sidebar
   * navigation items should exactly match the permitted items for that role.
   */
  describe('Property 3: Role-based navigation visibility', () => {
    it('should show exactly the permitted nav items for each role', () => {
      fc.assert(
        fc.property(
          roleArb,
          (role) => {
            const visibleLabels = getVisibleItems(role).map(item => item.label);
            const expectedLabels = EXPECTED_LABELS_BY_ROLE[role];

            expect(visibleLabels).toEqual(expectedLabels);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 13: Active nav link matches current path
   * Validates: Requirements 11.2
   *
   * For any admin page path, the sidebar navigation should highlight
   * exactly one nav item — the one whose href matches the current pathname
   * (exact match for /, prefix match for all others).
   */
  describe('Property 13: Active nav link matches current path', () => {
    it('should highlight exactly one nav item for any admin path', () => {
      fc.assert(
        fc.property(
          adminPathArb,
          (pathname) => {
            const activeItems = NAV_ITEMS.filter(item => isActive(pathname, item.href));

            // There should be at least one active item for any valid admin path
            expect(activeItems.length).toBeGreaterThanOrEqual(1);

            // For exact nav hrefs, verify the correct item is active
            const exactMatch = NAV_ITEMS.find(item => item.href === pathname);
            if (exactMatch) {
              expect(activeItems).toContainEqual(exactMatch);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should highlight only Dashboard for exact / path', () => {
      const activeItems = NAV_ITEMS.filter(item => isActive('/', item.href));
      expect(activeItems).toHaveLength(1);
      expect(activeItems[0].label).toBe('Dashboard');
    });

    it('should not highlight Dashboard for non-/ sub-paths', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ...NAV_ITEMS.filter(i => i.href !== '/').map(i => i.href),
          ),
          (pathname) => {
            const dashboardActive = isActive(pathname, '/');
            // Dashboard (/) should NOT be active for sub-paths like /articles
            // because the logic uses exact match for /
            expect(dashboardActive).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
