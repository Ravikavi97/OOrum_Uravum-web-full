'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

export type UserRole = 'ADMIN' | 'EDITOR' | 'AUTHOR';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('admin_token');
    const storedUser = localStorage.getItem('admin_user');
    if (stored && storedUser) {
      try {
        setToken(stored);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      }
    }
    setLoading(false);
  }, []);

  // Sync token state when api.ts refreshes it
  useEffect(() => {
    const handler = (e: Event) => {
      const newToken = (e as CustomEvent<string>).detail;
      if (newToken) setToken(newToken);
    };
    window.addEventListener('token-refreshed', handler);
    return () => window.removeEventListener('token-refreshed', handler);
  }, []);

  const logout = useCallback(() => {
    // Notify backend (fire-and-forget)
    const t = localStorage.getItem('admin_token');
    if (t) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_refresh_token');
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // Deduplicate concurrent refresh calls
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const doRefresh = async (): Promise<string | null> => {
      const refreshToken = localStorage.getItem('admin_refresh_token');
      if (!refreshToken) {
        logout();
        return null;
      }

      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
          logout();
          return null;
        }

        const data = await res.json();
        const newToken = data.accessToken as string;
        setToken(newToken);
        localStorage.setItem('admin_token', newToken);
        if (data.refreshToken) {
          localStorage.setItem('admin_refresh_token', data.refreshToken);
        }
        return newToken;
      } catch {
        logout();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    };

    refreshPromiseRef.current = doRefresh();
    return refreshPromiseRef.current;
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: { message: 'Login failed' } }));
      throw new Error(body.error?.message || 'Login failed');
    }

    const data = await res.json();
    setToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem('admin_token', data.accessToken);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
    if (data.refreshToken) {
      localStorage.setItem('admin_refresh_token', data.refreshToken);
    }
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
