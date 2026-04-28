'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth, UserRole } from '@/contexts/AuthContext';

/* ── Sidebar nav items with role gating ─────────────────────────────────── */

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: UserRole[]; // undefined = all authenticated roles
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
  { label: 'Advertisements', href: '/advertisements', icon: '📢', roles: ['ADMIN'] },
  { label: 'Home Layout', href: '/home-layout', icon: '🏠', roles: ['ADMIN'] },
  { label: 'Settings', href: '/settings', icon: '⚙️', roles: ['ADMIN'] },
];

/* ── Login form (shown when unauthenticated) ────────────────────────────── */

function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-center">Admin Login</h1>
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded px-3 py-2 text-sm"
          aria-label="Email"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border rounded px-3 py-2 text-sm"
          aria-label="Password"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {submitting ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}

/* ── Auth guard wrapper ─────────────────────────────────────────────────── */

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!user) return <LoginForm />;

  return <>{children}</>;
}

/* ── Sidebar ────────────────────────────────────────────────────────────── */

function Sidebar() {
  const pathname = usePathname();
  const { user, logout, hasRole } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || hasRole(...item.roles),
  );

  return (
    <aside className="w-60 bg-gray-900 text-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-gray-700 shrink-0">
        <h2 className="font-bold text-lg">CMS</h2>
        {user && <p className="text-xs text-gray-400 mt-1">{user.name} ({user.role})</p>}
      </div>
      <nav className="flex-1 py-2 overflow-y-auto" aria-label="Admin navigation">
        {visibleItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800 ${active ? 'bg-gray-800 text-white font-medium' : ''}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-700 shrink-0">
        <button onClick={logout} className="text-sm text-gray-400 hover:text-white">
          Logout
        </button>
      </div>
    </aside>
  );
}

/* ── Admin Shell ────────────────────────────────────────────────────────── */

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminGuard>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 bg-gray-50 p-6 overflow-auto">{children}</main>
        </div>
      </AdminGuard>
    </AuthProvider>
  );
}
