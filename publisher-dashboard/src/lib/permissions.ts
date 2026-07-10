// All CMS pages that can have permissions assigned
export const ALL_PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '/' },
  { id: 'articles', label: 'Articles', icon: '📝', href: '/articles' },
  { id: 'categories', label: 'Categories', icon: '📁', href: '/categories' },
  { id: 'tags', label: 'Tags', icon: '🏷️', href: '/tags' },
  { id: 'users', label: 'Users', icon: '👥', href: '/users' },
  { id: 'media', label: 'Media', icon: '🖼️', href: '/media' },
  { id: 'comments', label: 'Comments', icon: '💬', href: '/comments' },
  { id: 'obituaries', label: 'Obituaries', icon: '🕯️', href: '/obituaries' },
  { id: 'videos', label: 'Videos', icon: '🎬', href: '/videos' },
  { id: 'advertisements', label: 'Advertisements', icon: '📢', href: '/advertisements' },
  { id: 'homeLayout', label: 'Home Layout', icon: '🏠', href: '/home-layout' },
  { id: 'settings', label: 'Settings', icon: '⚙️', href: '/settings' },
  { id: 'roles', label: 'Roles & Permissions', icon: '🔐', href: '/roles' },
] as const;

export type PageId = typeof ALL_PAGES[number]['id'];

// Actions that can be controlled per page
export const ACTIONS = ['view', 'create', 'edit', 'delete', 'publish'] as const;
export type Action = typeof ACTIONS[number];

// Built-in roles that cannot be deleted
export const BUILT_IN_ROLES = ['ADMIN', 'EDITOR', 'AUTHOR'] as const;

// Permission entry: page access + allowed actions
export type PagePermission = {
  access: boolean;
  actions: Action[];
};

// Full permissions: role -> page -> permission
export type RolePermissions = Record<string, Record<string, PagePermission>>;

// Legacy format (page ID array) for backward compatibility
export type LegacyRolePermissions = Record<string, PageId[]>;

export interface CustomRole {
  name: string;
  label: string;
  description: string;
  color: string;
}

// Default action permissions per built-in role
const ALL_ACTIONS: Action[] = [...ACTIONS];

export const DEFAULT_PERMISSIONS: RolePermissions = {
  ADMIN: Object.fromEntries(ALL_PAGES.map((p) => [p.id, { access: true, actions: ALL_ACTIONS }])),
  EDITOR: Object.fromEntries(ALL_PAGES.map((p) => {
    const editorPages = ['dashboard', 'articles', 'categories', 'tags', 'media', 'comments', 'obituaries', 'videos'];
    const hasAccess = editorPages.includes(p.id);
    return [p.id, { access: hasAccess, actions: hasAccess ? ALL_ACTIONS : [] }];
  })),
  AUTHOR: Object.fromEntries(ALL_PAGES.map((p) => {
    const authorPages = ['dashboard', 'articles', 'media', 'obituaries', 'videos'];
    const hasAccess = authorPages.includes(p.id);
    // Authors can create/edit but not delete or publish
    return [p.id, { access: hasAccess, actions: hasAccess ? ['view', 'create', 'edit'] : [] }];
  })),
};

/**
 * Convert legacy format (string array) to new format
 */
export function normalizeLegacyPermissions(legacy: LegacyRolePermissions): RolePermissions {
  const result: RolePermissions = {};
  for (const [role, pageIds] of Object.entries(legacy)) {
    result[role] = {};
    for (const page of ALL_PAGES) {
      const hasAccess = pageIds.includes(page.id);
      result[role][page.id] = { access: hasAccess, actions: hasAccess ? ALL_ACTIONS : [] };
    }
  }
  return result;
}

/**
 * Parse permissions from stored JSON — handles both legacy and new format
 */
export function parsePermissions(raw: string): RolePermissions {
  const parsed = JSON.parse(raw);
  // Check if it's legacy format (values are arrays of strings)
  const firstValue = Object.values(parsed)[0];
  if (Array.isArray(firstValue)) {
    return normalizeLegacyPermissions(parsed as LegacyRolePermissions);
  }
  return parsed as RolePermissions;
}

/**
 * Check if a role has access to a specific page
 */
export function hasPageAccess(role: string, pageId: PageId, permissions: RolePermissions): boolean {
  if (role === 'ADMIN') return true;
  const rolePerm = permissions[role]?.[pageId];
  if (rolePerm) return rolePerm.access;
  // Fallback to defaults
  const defaultPerm = DEFAULT_PERMISSIONS[role]?.[pageId];
  return defaultPerm?.access ?? false;
}

/**
 * Check if a role can perform a specific action on a page
 */
export function hasActionAccess(role: string, pageId: PageId, action: Action, permissions: RolePermissions): boolean {
  if (role === 'ADMIN') return true;
  if (!hasPageAccess(role, pageId, permissions)) return false;
  const rolePerm = permissions[role]?.[pageId];
  if (rolePerm) return rolePerm.actions.includes(action);
  const defaultPerm = DEFAULT_PERMISSIONS[role]?.[pageId];
  return defaultPerm?.actions.includes(action) ?? false;
}

/**
 * Get the page ID from a pathname
 */
export function getPageIdFromPath(pathname: string): PageId | null {
  if (pathname === '/') return 'dashboard';
  const page = ALL_PAGES.find((p) => p.href !== '/' && pathname.startsWith(p.href));
  return page ? page.id : null;
}
