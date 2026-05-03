'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface FrontendUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

interface UserAuthContextType {
  user: FrontendUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; phone?: string; address?: string; password: string; confirmPassword: string }) => Promise<void>;
  logout: () => void;
}

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FrontendUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user_token');
    const storedUser = localStorage.getItem('user_data');
    if (stored && storedUser) {
      try {
        setToken(stored);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_data');
      }
    }
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_data');
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/public-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: { message: 'Login failed' } }));
      throw new Error(body.error?.message || 'Login failed');
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('user_token', data.token);
    localStorage.setItem('user_data', JSON.stringify(data.user));
  }, []);

  const register = useCallback(async (data: { name: string; email: string; phone?: string; address?: string; password: string; confirmPassword: string }) => {
    const res = await fetch(`${API_URL}/public-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: { message: 'Registration failed' } }));
      throw new Error(body.error?.message || 'Registration failed');
    }
    const result = await res.json();
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem('user_token', result.token);
    localStorage.setItem('user_data', JSON.stringify(result.user));
  }, []);

  return (
    <UserAuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error('useUserAuth must be used within UserAuthProvider');
  return ctx;
}
