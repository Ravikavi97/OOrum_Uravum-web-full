'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch } from '@/lib/api';

interface ArticleCounts {
  draft: number | null;
  published: number | null;
  archived: number | null;
}

interface RecentArticle {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface ArticleListResponse {
  data: RecentArticle[];
  total: number;
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [counts, setCounts] = useState<ArticleCounts>({ draft: null, published: null, archived: null });
  const [recent, setRecent] = useState<RecentArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    async function fetchData() {
      let draftCount: number | null = null;
      let publishedCount: number | null = null;
      let archivedCount: number | null = null;
      let recentArticles: RecentArticle[] = [];

      // Fetch counts individually so one failure doesn't block others
      try {
        const d = await adminFetch<ArticleListResponse>('/articles?status=DRAFT&pageSize=1', { token: token!, method: 'GET' });
        draftCount = d.total ?? 0;
      } catch {
        /* graceful fallback — leave as null */
      }

      try {
        const p = await adminFetch<ArticleListResponse>('/articles?status=PUBLISHED&pageSize=1', { token: token!, method: 'GET' });
        publishedCount = p.total ?? 0;
      } catch {
        /* graceful fallback — leave as null */
      }

      try {
        const a = await adminFetch<ArticleListResponse>('/articles?status=ARCHIVED&pageSize=1', { token: token!, method: 'GET' });
        archivedCount = a.total ?? 0;
      } catch {
        /* graceful fallback — leave as null */
      }

      try {
        const r = await adminFetch<ArticleListResponse>('/articles?pageSize=5', { token: token!, method: 'GET' });
        recentArticles = r.data ?? [];
      } catch {
        /* graceful fallback — empty list */
      }

      setCounts({ draft: draftCount, published: publishedCount, archived: archivedCount });
      setRecent(recentArticles);
      setLoading(false);
    }

    fetchData();
  }, [token]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Article count cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {([
          { label: 'Drafts', value: counts.draft, color: 'bg-yellow-100 text-yellow-800' },
          { label: 'Published', value: counts.published, color: 'bg-green-100 text-green-800' },
          { label: 'Archived', value: counts.archived, color: 'bg-gray-200 text-gray-700' },
        ] as const).map((card) => (
          <div key={card.label} className={`rounded-lg p-5 ${card.color}`} data-testid={`count-card-${card.label.toLowerCase()}`}>
            <p className="text-sm font-medium">{card.label}</p>
            <p className="text-3xl font-bold mt-1">{loading ? '—' : (card.value === null ? '—' : card.value)}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <Link href="/articles" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          + New Article
        </Link>
        <Link href="/categories" className="bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm hover:bg-gray-300">
          Manage Categories
        </Link>
      </div>

      {/* Recent articles */}
      <h2 className="text-lg font-semibold mb-3">Recent Articles</h2>
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : recent.length === 0 ? (
        <p className="text-gray-500 text-sm">No recent articles.</p>
      ) : (
        <ul className="bg-white rounded-lg shadow divide-y" data-testid="recent-articles-list">
          {recent.map((a) => (
            <li key={a.id} className="px-4 py-3 flex justify-between items-center text-sm">
              <span className="truncate max-w-xs">{a.title}</span>
              <span className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  a.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                  a.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{a.status}</span>
                <span className="text-gray-400">{new Date(a.updatedAt).toLocaleDateString()}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
