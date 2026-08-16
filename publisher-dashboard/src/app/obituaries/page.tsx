'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError, toQueryString } from '@/lib/api';
import ImageUploadField from '@/components/ImageUploadField';
import { ToastContainer, useToast } from '@/components/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface Obituary {
  id: string;
  name: string;
  content: string;
  status: string;
  submitterName: string | null;
  submitterEmail: string | null;
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

function truncate(text: string, max = 80): string {
  return text.length <= max ? text : text.slice(0, max) + '…';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

export default function ObituariesPage() {
  const { token } = useAuth();
  const { toasts, showToast, dismiss } = useToast();
  const [obituaries, setObituaries] = useState<Obituary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const pageSize = 10;

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchObituaries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page, pageSize };
      if (statusFilter) params.status = statusFilter;
      const qs = toQueryString(params);
      const data = await adminFetch<PaginatedResponse>(`/obituaries${qs}`, { token });
      setObituaries(data.data);
      setTotalPages(data.totalPages);

      // Fetch counts for all statuses
      const [allRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
        adminFetch<PaginatedResponse>('/obituaries?pageSize=1', { token }),
        adminFetch<PaginatedResponse>('/obituaries?pageSize=1&status=PENDING', { token }),
        adminFetch<PaginatedResponse>('/obituaries?pageSize=1&status=APPROVED', { token }),
        adminFetch<PaginatedResponse>('/obituaries?pageSize=1&status=REJECTED', { token }),
      ]);
      setCounts({ all: allRes.total, pending: pendingRes.total, approved: approvedRes.total, rejected: rejectedRes.total });
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter]);

  useEffect(() => { if (token) fetchObituaries(); }, [fetchObituaries, token]);

  const resetForm = () => {
    setName(''); setContent(''); setPublishedAt(''); setEditingId(null);
    setFormError(''); setShowForm(false); setImageUrl('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const openEdit = (o: Obituary) => {
    setEditingId(o.id); setName(o.name); setContent(o.content);
    setPublishedAt(toDateInputValue(o.publishedAt)); setFormError('');
    setShowForm(true); setImageUrl(`${API_URL}/obituaries/${o.id}/image`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name); fd.append('content', content);
      if (publishedAt) fd.append('publishedAt', new Date(publishedAt).toISOString());

      const url = editingId ? `${API_URL}/obituaries/${editingId}` : `${API_URL}/obituaries`;
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setFormError(err.error?.message || 'Failed'); return; }
      resetForm(); fetchObituaries();
      showToast(editingId ? 'Obituary updated successfully' : 'Obituary created successfully');
    } catch { setFormError('Network error'); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await adminFetch(`/obituaries/${id}`, { token: token!, method: 'PUT', body: JSON.stringify({ status }) });
      fetchObituaries();
      showToast(`Obituary ${status.toLowerCase()}`);
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this obituary?')) return;
    try { await adminFetch(`/obituaries/${id}`, { token: token!, method: 'DELETE' }); fetchObituaries(); showToast('Obituary deleted'); }
    catch { setError('Failed to delete'); }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Obituaries</h1>
          {counts.pending > 0 && (
            <p className="text-xs text-yellow-600 mt-1">⚠ {counts.pending} pending approval</p>
          )}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ New Obituary</button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: '', label: 'All', count: counts.all },
          { key: 'PENDING', label: '⏳ Pending', count: counts.pending },
          { key: 'APPROVED', label: '✅ Approved', count: counts.approved },
          { key: 'REJECTED', label: '❌ Rejected', count: counts.rejected },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-6 space-y-3">
          <h2 className="font-semibold">{editingId ? 'Edit Obituary' : 'New Obituary'}</h2>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className="w-full border rounded px-3 py-2 text-sm" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content" required rows={4} className="w-full border rounded px-3 py-2 text-sm" />
          <ImageUploadField
            label="Image"
            value={imageUrl}
            onChange={setImageUrl}
            onUploadingChange={setUploadingImage}
            prefer="medium"
          />
          <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || uploadingImage} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">{uploadingImage ? 'Uploading image…' : submitting ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={resetForm} className="bg-gray-200 px-4 py-2 rounded text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : obituaries.length === 0 ? <p className="text-gray-500 text-sm">No obituaries found.</p> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2">Image</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Submitted By</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {obituaries.map((o) => (
                <tr key={o.id} className={o.status === 'PENDING' ? 'bg-yellow-50/50' : ''}>
                  <td className="px-4 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${API_URL}/obituaries/${o.id}/image`} alt={o.name} className="w-12 h-12 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{truncate(o.content)}</p>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {o.submitterName ? (
                      <div>
                        <p className="font-medium text-gray-700">{o.submitterName}</p>
                        <p>{o.submitterEmail}</p>
                      </div>
                    ) : <span className="text-gray-400">Admin</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(o.status)}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(o.publishedAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {o.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleStatusChange(o.id, 'APPROVED')} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium hover:bg-green-100">✅ Approve</button>
                          <button onClick={() => handleStatusChange(o.id, 'REJECTED')} className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-medium hover:bg-red-100">❌ Reject</button>
                        </>
                      )}
                      {o.status === 'REJECTED' && (
                        <button onClick={() => handleStatusChange(o.id, 'APPROVED')} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium hover:bg-green-100">✅ Approve</button>
                      )}
                      {o.status === 'APPROVED' && (
                        <button onClick={() => handleStatusChange(o.id, 'REJECTED')} className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-medium hover:bg-yellow-100">Unpublish</button>
                      )}
                      <button onClick={() => openEdit(o)} className="text-blue-600 hover:underline text-xs px-1">Edit</button>
                      <button onClick={() => handleDelete(o.id)} className="text-red-600 hover:underline text-xs px-1">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded border text-sm disabled:opacity-50">Previous</button>
          <span className="px-3 py-1 text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded border text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
