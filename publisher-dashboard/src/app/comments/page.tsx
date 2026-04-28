'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError, toQueryString } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  displayName: string;
  email: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
  articleId: string;
  createdAt: string;
  article?: { title: string };
}

interface PaginatedComments {
  data: Comment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type StatusFilter = 'PENDING' | 'FLAGGED' | '';

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommentsPage() {
  const { token, hasRole } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [actionError, setActionError] = useState('');

  // ─── Fetch comments ────────────────────────────────────────────────────────

  const fetchComments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setListError('');
    try {
      const qs = toQueryString({ status: filter });
      const data = await adminFetch<PaginatedComments>(
        `/comments/admin/all${qs}`,
        { token },
      );
      setComments(data.data);
    } catch (err) {
      setListError(
        err instanceof AdminApiError ? err.message : 'Failed to load comments',
      );
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    if (token) fetchComments();
  }, [fetchComments, token]);

  // ─── RBAC: ADMIN / EDITOR only ────────────────────────────────────────────

  if (!hasRole('ADMIN', 'EDITOR')) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Comments</h1>
        <p className="text-red-600">Editor or Admin access required.</p>
      </div>
    );
  }

  // ─── Approve / Reject handlers ─────────────────────────────────────────────

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionError('');
    try {
      await adminFetch(`/comments/${id}/${action}`, {
        token: token!,
        method: 'PUT',
      });
      // Optimistically update the status badge in-place
      setComments((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: action === 'approve' ? 'APPROVED' : 'REJECTED' }
            : c,
        ),
      );
    } catch (err) {
      setActionError(
        err instanceof AdminApiError ? err.message : 'Action failed',
      );
    }
  };

  // ─── Status badge color ────────────────────────────────────────────────────

  const statusColor = (s: string) => {
    switch (s) {
      case 'PENDING':  return 'bg-yellow-100 text-yellow-700';
      case 'FLAGGED':  return 'bg-red-100 text-red-700';
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'REJECTED': return 'bg-gray-100 text-gray-600';
      default:         return 'bg-gray-100 text-gray-600';
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Comment Moderation</h1>

      {/* Status filter tabs */}
      <div className="flex gap-3 mb-4">
        {(['PENDING', 'FLAGGED', ''] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-red-700 underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* List error */}
      {listError && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex justify-between items-center">
          <span>{listError}</span>
          <button onClick={fetchComments} className="text-red-700 underline text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Comment list */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-gray-500 text-sm">No comments found.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-medium text-sm">{c.displayName}</span>
                  <span className="text-gray-400 text-xs ml-2">{c.email}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(c.status)}`}
                >
                  {c.status}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{c.content}</p>
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                  {c.article?.title && (
                    <span className="text-xs text-blue-600">
                      Article: {c.article.title}
                    </span>
                  )}
                </div>
                {(c.status === 'PENDING' || c.status === 'FLAGGED') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(c.id, 'approve')}
                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(c.id, 'reject')}
                      className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
