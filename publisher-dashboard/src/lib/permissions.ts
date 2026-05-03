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

// Built-in roles that cannot be deleted
export const BUILT_IN_ROLES = ['ADMIN', 'EDITOR', 'AUTHOR'] as const;

// Default permissions for built-in roles
export const DEFAULT_PERMISSIONS: Record<string, PageId[]> = {
  ADMIN: ALL_PAGES.map((p) => p.id),
  EDITOR: ['dashboard', 'articles', 'categories', 'tags', 'media', 'comments', 'obituaries', 'videos'],
  AUTHOR: ['dashboard', 'articles', 'media', 'obituaries', 'videos'],
};

export type RolePermissions = Record<string, PageId[]>;

export interface CustomRole {
  name: string;        // e.g. "MODERATOR"
  label: string;       // e.g. "Moderator"
  description: string; // e.g. "Can moderate comments and obituaries"
  color: string;       // e.g. "bg-purple-100 text-purple-700"
}

/**
 * Check if a role has access to a specific page
 */
export function hasPageAccess(role: string, pageId: PageId, permissions: RolePermissions): boolean {
  if (role === 'ADMIN') return true;
  const rolePerms = permissions[role] || DEFAULT_PERMISSIONS[role] || [];
  return rolePerms.includes(pageId);
}

/**
 * Get the page ID from a pathname
 */
export function getPageIdFromPath(pathname: string): PageId | null {
  if (pathname === '/') return 'dashboard';
  const page = ALL_PAGES.find((p) => p.href !== '/' && pathname.startsWith(p.href));
  return page ? page.id : null;
}
