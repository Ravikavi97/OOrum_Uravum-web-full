'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
  requestRegistrationCode: (data: RegistrationData) => Promise<void>;
  verifyRegistrationCode: (data: RegistrationData & { verificationCode: string }) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

type RegistrationData = {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  password: string;
  confirmPassword: string;
};

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({ error: { message: fallback } }));
  return new Error(body.error?.message || fallback);
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
    const res = await fetch('/api/public-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw await responseError(res, 'Login failed');
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('user_token', data.token);
    localStorage.setItem('user_data', JSON.stringify(data.user));
  }, []);

  const requestRegistrationCode = useCallback(async (data: RegistrationData) => {
    const res = await fetch('/api/public-auth/register-request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw await responseError(res, 'Could not send verification code');
    }
  }, []);

  const verifyRegistrationCode = useCallback(async (data: RegistrationData & { verificationCode: string }) => {
    const res = await fetch('/api/public-auth/register-verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw await responseError(res, 'Could not verify registration code');
    }
    const result = await res.json();
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem('user_token', result.token);
    localStorage.setItem('user_data', JSON.stringify(result.user));
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const res = await fetch('/api/public-auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      throw await responseError(res, 'Google sign-in failed');
    }
    const result = await res.json();
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem('user_token', result.token);
    localStorage.setItem('user_data', JSON.stringify(result.user));
  }, []);

  return (
    <UserAuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      requestRegistrationCode,
      verifyRegistrationCode,
      loginWithGoogle,
      logout,
    }}>
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error('useUserAuth must be used within UserAuthProvider');
  return ctx;
}
