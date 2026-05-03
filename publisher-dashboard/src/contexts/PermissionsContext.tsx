'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch } from '@/lib/api';
import { DEFAULT_PERMISSIONS, hasPageAccess, type RolePermissions, type PageId } from '@/lib/permissions';

interface PermissionsContextType {
  permissions: RolePermissions;
  loading: boolean;
  canAccess: (pageId: PageId) => boolean;
  reload: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const settings = await adminFetch<Array<{ key: string; value: string }>>('/settings', { token });
      const entry = Array.isArray(settings) ? settings.find((s) => s.key === 'rolePermissions') : null;
      if (entry?.value) {
        const parsed = JSON.parse(entry.value);
        setPermissions({ ...DEFAULT_PERMISSIONS, ...parsed });
      }
    } catch { /* use defaults */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const canAccess = useCallback((pageId: PageId): boolean => {
    if (!user) return false;
    return hasPageAccess(user.role, pageId, permissions);
  }, [user, permissions]);

  return (
    <PermissionsContext.Provider value={{ permissions, loading, canAccess, reload: loadPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
}
