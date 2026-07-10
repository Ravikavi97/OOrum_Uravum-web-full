'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PERMISSIONS, hasPageAccess, hasActionAccess, parsePermissions, type RolePermissions, type PageId, type Action } from '@/lib/permissions';

interface PermissionsContextType {
  permissions: RolePermissions;
  loading: boolean;
  canAccess: (pageId: PageId) => boolean;
  canAction: (pageId: PageId, action: Action) => boolean;
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${API_URL}/settings/public`);
      if (res.ok) {
        const settings = await res.json();
        if (settings.rolePermissions) {
          const parsed = parsePermissions(settings.rolePermissions);
          setPermissions({ ...DEFAULT_PERMISSIONS, ...parsed });
        }
      }
    } catch { /* use defaults */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const canAccess = useCallback((pageId: PageId): boolean => {
    if (!user) return false;
    return hasPageAccess(user.role, pageId, permissions);
  }, [user, permissions]);

  const canAction = useCallback((pageId: PageId, action: Action): boolean => {
    if (!user) return false;
    return hasActionAccess(user.role, pageId, action, permissions);
  }, [user, permissions]);

  return (
    <PermissionsContext.Provider value={{ permissions, loading, canAccess, canAction, reload: loadPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
}
