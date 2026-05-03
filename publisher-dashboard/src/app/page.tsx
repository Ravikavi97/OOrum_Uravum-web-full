'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { adminFetch } from '@/lib/api';

interface DashboardStats {
  articles: { published: number; draft: number; archived: number; total: number };
  categories: number;
  tags: number;
  users: { cms: number; frontend: number; frontendToday: number };
  comments: { total: number; pending: number };
  obituaries: { total: number; pending: number };
  videos: { total: number; categories: number };
  ads: { total: number; active: number };
  visitors: { total: number; today: number };
  notifications: { unread: number };
  recentArticles: { id: string; title: string; status: string; updatedAt: string; author: { name: string } }[];
  pendingObituaries: { id: string; name: string; submitterName: string | null; createdAt: string }[];
}

function StatCard({ icon, label, value, sub, href, color }: { icon: string; label: string; value: number | string; sub?: string; href: string; color: string }) {
  return (
    <Link href={href} className={`rounded-xl p-4 ${color} hover:shadow-md transition-all hover:-translate-y-0.5 block`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-sm font-medium mt-2">{label}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
    </Link>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const { canAccess } = usePermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    adminFetch<DashboardStats>('/dashboard/stats', { token })
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 bg-gray-100 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div><h1 className="text-2xl font-bold mb-4">Dashboard</h1><p className="text-gray-500">Failed to load dashboard data.</p></div>;
  }

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}!</p>
      </div>

      {/* Alert banners */}
      {(stats.obituaries.pending > 0 || stats.comments.pending > 0 || stats.notifications.unread > 0) && (
        <div className="flex gap-3 mb-6 flex-wrap">
          {stats.obituaries.pending > 0 && (
            <Link href="/obituaries" className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg text-sm hover:bg-yellow-100 transition-colors">
              <span>🕯️</span> {stats.obituaries.pending} obituaries pending approval
            </Link>
          )}
          {stats.comments.pending > 0 && (
            <Link href="/comments" className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg text-sm hover:bg-blue-100 transition-colors">
              <span>💬</span> {stats.comments.pending} comments pending
            </Link>
          )}
          {stats.notifications.unread > 0 && (
            <span className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg text-sm">
              <span>🔔</span> {stats.notifications.unread} unread notifications
            </span>
          )}
        </div>
      )}

      {/* Stats grid — only show cards for pages user can access */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {canAccess('articles') && <StatCard icon="📝" label="Published Articles" value={stats.articles.published} sub={`${stats.articles.draft} drafts, ${stats.articles.archived} archived`} href="/articles" color="bg-green-50 text-green-900" />}
        {canAccess('categories') && <StatCard icon="📁" label="Categories" value={stats.categories} href="/categories" color="bg-blue-50 text-blue-900" />}
        {canAccess('tags') && <StatCard icon="🏷️" label="Tags" value={stats.tags} href="/tags" color="bg-indigo-50 text-indigo-900" />}
        {canAccess('videos') && <StatCard icon="🎬" label="Videos" value={stats.videos.total} sub={`${stats.videos.categories} categories`} href="/videos" color="bg-purple-50 text-purple-900" />}
        {canAccess('obituaries') && <StatCard icon="🕯️" label="Obituaries" value={stats.obituaries.total} sub={stats.obituaries.pending > 0 ? `${stats.obituaries.pending} pending` : 'All approved'} href="/obituaries" color="bg-amber-50 text-amber-900" />}
        {canAccess('comments') && <StatCard icon="💬" label="Comments" value={stats.comments.total} sub={stats.comments.pending > 0 ? `${stats.comments.pending} pending` : 'All reviewed'} href="/comments" color="bg-cyan-50 text-cyan-900" />}
        {canAccess('advertisements') && <StatCard icon="📢" label="Advertisements" value={stats.ads.total} sub={`${stats.ads.active} active`} href="/advertisements" color="bg-orange-50 text-orange-900" />}
        {canAccess('users') && <StatCard icon="👥" label="CMS Users" value={stats.users.cms} href="/users" color="bg-red-50 text-red-900" />}
        {canAccess('users') && <StatCard icon="🌐" label="Frontend Users" value={stats.users.frontend} sub={stats.users.frontendToday > 0 ? `+${stats.users.frontendToday} today` : ''} href="/users" color="bg-teal-50 text-teal-900" />}
        <StatCard icon="👁️" label="Total Visitors" value={stats.visitors.total.toLocaleString()} sub={`${stats.visitors.today.toLocaleString()} today`} href="/" color="bg-violet-50 text-violet-900" />
        {canAccess('articles') && <StatCard icon="📄" label="Total Articles" value={stats.articles.total} href="/articles" color="bg-gray-100 text-gray-900" />}
      </div>

      {/* Quick actions — only show for accessible pages */}
      <div className="flex gap-3 mb-8 flex-wrap">
        {canAccess('articles') && <Link href="/articles" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">+ New Article</Link>}
        {canAccess('videos') && <Link href="/videos" className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">+ New Video</Link>}
        {canAccess('obituaries') && <Link href="/obituaries" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">+ New Obituary</Link>}
        {canAccess('categories') && <Link href="/categories" className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">Manage Categories</Link>}
        {canAccess('settings') && <Link href="/settings" className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">⚙️ Settings</Link>}
      </div>

      {/* Two-column layout: Recent articles + Pending obituaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent articles */}
        {canAccess('articles') && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Recent Articles</h2>
            <Link href="/articles" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {stats.recentArticles.length === 0 ? (
            <p className="text-gray-400 text-sm bg-white rounded-lg p-4">No articles yet.</p>
          ) : (
            <div className="bg-white rounded-lg shadow-sm divide-y">
              {stats.recentArticles.map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.author.name} · {formatDate(a.updatedAt)}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                    a.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                    a.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Pending obituaries */}
        {canAccess('obituaries') && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Pending Obituaries</h2>
            <Link href="/obituaries" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {stats.pendingObituaries.length === 0 ? (
            <p className="text-gray-400 text-sm bg-white rounded-lg p-4">No pending obituaries.</p>
          ) : (
            <div className="bg-white rounded-lg shadow-sm divide-y">
              {stats.pendingObituaries.map((o) => (
                <Link key={o.id} href="/obituaries" className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors block">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{o.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">by {o.submitterName || 'Admin'} · {formatDate(o.createdAt)}</p>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">PENDING</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
