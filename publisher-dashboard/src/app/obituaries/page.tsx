'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError, toQueryString } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Obituary {
  id: string;
  name: string;
  content: string;
  sourceUrl: string | null;
  publishedAt: string;
  createdAt: string;
}

interface PaginatedResponse {
  data: Obituary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text: string, max = 100): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ObituariesPage() {
  const { token } = useAuth();

  // ─── State ─────────────────────────────────────────────────────────────────

  const [obituaries, setObituaries] = useState<Obituary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Fetch obituaries ──────────────────────────────────────────────────────

  const fetchObituaries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setListError('');
    try {
      const qs = toQueryString({ page, pageSize });
      const data = await adminFetch<PaginatedResponse>(`/obituaries${qs}`, { token });
      setObituaries(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      setListError(err instanceof AdminApiError ? err.message : 'Failed to load obituaries');
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    if (token) fetchObituaries();
  }, [fetchObituaries, token]);

  // ─── Form helpers ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setName('');
    setContent('');
    setPublishedAt('');
    setEditingId(null);
    setFormError('');
    setShowForm(false);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const openEditForm = (obit: Obituary) => {
    setEditingId(obit.id);
    setName(obit.name);
    setContent(obit.content);
    setPublishedAt(toDateInputValue(obit.publishedAt));
    setFormError('');
    setShowForm(true);
    setImagePreview(`${API_URL}/obituaries/${obit.id}/image`);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── Image selection preview ───────────────────────────────────────────────

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // ─── Submit (multipart via raw fetch) ──────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('content', content);
      if (publishedAt) {
        formData.append('publishedAt', new Date(publishedAt).toISOString());
      }
      const file = fileRef.current?.files?.[0];
      if (file) {
        formData.append('image', file);
      }

      const url = editingId
        ? `${API_URL}/obituaries/${editingId}`
        : `${API_URL}/obituaries`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
        setFormError(errBody.error?.message || 'Request failed');
        return;
      }

      resetForm();
      fetchObituaries();
    } catch {
      setFormError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete handler ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this obituary?')) return;
    setDeleteError('');
    try {
      await adminFetch(`/obituaries/${id}`, { token: token!, method: 'DELETE' });
      fetchObituaries();
    } catch (err) {
      setDeleteError(err instanceof AdminApiError ? err.message : 'Failed to delete obituary');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Obituaries</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          + New Obituary
        </button>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex justify-between items-center">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="text-red-700 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-6 space-y-3">
          <h2 className="font-semibold">{editingId ? 'Edit Obituary' : 'New Obituary'}</h2>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className="w-full border rounded px-3 py-2 text-sm"
            aria-label="Obituary name"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Content"
            required
            rows={4}
            className="w-full border rounded px-3 py-2 text-sm"
            aria-label="Obituary content"
          />
          <div>
            <label className="block text-sm text-gray-600 mb-1">Image</label>
            {imagePreview ? (
              <div className="flex items-start gap-3">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 border shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Change image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
              >
                <svg className="w-8 h-8 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-700">Click to upload image</p>
                  <p className="text-xs text-gray-400">JPEG, PNG, WebP or AVIF</p>
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
              aria-label="Obituary image"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Published Date</label>
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
              aria-label="Published date"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={resetForm} className="bg-gray-200 px-4 py-2 rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List error */}
      {listError && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex justify-between items-center">
          <span>{listError}</span>
          <button onClick={fetchObituaries} className="text-red-700 underline text-xs">Retry</button>
        </div>
      )}

      {/* Obituary table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : obituaries.length === 0 ? (
        <p className="text-gray-500 text-sm">No obituaries found.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2">Image</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Content</th>
                <th className="text-left px-4 py-2">Published</th>
                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {obituaries.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${API_URL}/obituaries/${o.id}/image`}
                      alt={o.name}
                      className="w-12 h-12 object-cover rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </td>
                  <td className="px-4 py-2 font-medium">{o.name}</td>
                  <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{truncate(o.content)}</td>
                  <td className="px-4 py-2 text-gray-500">{formatDate(o.publishedAt)}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => openEditForm(o)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(o.id)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded border text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded border text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
