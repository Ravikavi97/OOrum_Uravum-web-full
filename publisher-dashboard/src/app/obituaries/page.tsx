'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError, toQueryString } from '@/lib/api';
import ObituaryForm, { type ObituaryDraft } from '@/components/ObituaryForm';
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
  imageUrl: string | null;
  imageMimeType: string | null;
  publishedAt: string;
  createdAt: string;
  firstName: string | null;
  middleName: string | null;
  surname: string | null;
  otherNames: string | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  placeOfBirth: string | null;
  lastResidentialAddress: string | null;
  fatherName: string | null;
  motherName: string | null;
  maritalStatus: string | null;
  spouseName: string | null;
  brothersNames: string | null;
  sistersNames: string | null;
  fatherInLawName: string | null;
  motherInLawName: string | null;
  sonsNames: string | null;
  daughtersNames: string | null;
  sonsInLawNames: string | null;
  daughtersInLawNames: string | null;
  grandchildrenNames: string | null;
  occupations: string | null;
  hobbiesInterests: string | null;
  communityActivities: string | null;
  otherDetails: string | null;
  lifeStory: string | null;
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

const reviewFields: Array<[keyof Obituary, string]> = [
  ['firstName', 'First name'],
  ['middleName', 'Middle name'],
  ['surname', 'Surname'],
  ['otherNames', 'Other names'],
  ['dateOfBirth', 'Date of birth'],
  ['dateOfDeath', 'Date of death'],
  ['placeOfBirth', 'Place of birth'],
  ['lastResidentialAddress', 'Last residential address'],
  ['fatherName', 'Father'],
  ['motherName', 'Mother'],
  ['maritalStatus', 'Marital status'],
  ['spouseName', 'Spouse'],
  ['brothersNames', 'Brothers'],
  ['sistersNames', 'Sisters'],
  ['fatherInLawName', 'Father-in-law'],
  ['motherInLawName', 'Mother-in-law'],
  ['sonsNames', 'Sons'],
  ['daughtersNames', 'Daughters'],
  ['sonsInLawNames', 'Sons-in-law'],
  ['daughtersInLawNames', 'Daughters-in-law'],
  ['grandchildrenNames', 'Grandchildren'],
  ['occupations', 'Occupations'],
  ['hobbiesInterests', 'Hobbies and interests'],
  ['communityActivities', 'Community activities'],
  ['otherDetails', 'Other details'],
  ['lifeStory', 'Life story'],
];

export default function ObituariesPage() {
  const { token, hasRole } = useAuth();
  const canReview = hasRole('ADMIN', 'EDITOR');
  const { toasts, showToast, dismiss } = useToast();
  const [obituaries, setObituaries] = useState<Obituary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Obituary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const pageSize = 10;

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [approvalTargetId, setApprovalTargetId] = useState<string | null>(null);
  const [formInitial, setFormInitial] = useState<ObituaryDraft>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!token) return;
    try {
      const [allRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
        adminFetch<PaginatedResponse>('/obituaries?pageSize=1', { token }),
        adminFetch<PaginatedResponse>('/obituaries?pageSize=1&status=PENDING', { token }),
        adminFetch<PaginatedResponse>('/obituaries?pageSize=1&status=APPROVED', { token }),
        adminFetch<PaginatedResponse>('/obituaries?pageSize=1&status=REJECTED', { token }),
      ]);
      setCounts({ all: allRes.total, pending: pendingRes.total, approved: approvedRes.total, rejected: rejectedRes.total });
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to load obituary counts');
    }
  }, [token]);

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
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter]);

  useEffect(() => { if (token) fetchObituaries(); }, [fetchObituaries, token]);
  useEffect(() => { if (token) fetchCounts(); }, [fetchCounts, token]);

  const resetForm = () => {
    setEditingId(null);
    setApprovalTargetId(null);
    setFormInitial({});
    setFormError('');
    setShowForm(false);
  };

  const openEdit = (o: Obituary) => {
    setEditingId(o.id);
    setApprovalTargetId(null);
    setFormInitial({
      ...o,
      firstName: o.firstName || (!o.middleName && !o.surname ? o.name : ''),
      publishedAt: o.publishedAt,
    });
    setFormError('');
    setShowForm(true);
  };

  const openReviewForm = (o: Obituary) => {
    setEditingId(o.id);
    setApprovalTargetId(o.id);
    setFormInitial({
      ...o,
      firstName: o.firstName || (!o.middleName && !o.surname ? o.name : ''),
      content: '',
      publishedAt: o.publishedAt,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleFormSave = async (formData: FormData) => {
    if (!token) {
      setFormError('Your session has expired. Sign in again to save this obituary.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      if (approvalTargetId) formData.append('status', 'APPROVED');
      const url = editingId ? `${API_URL}/obituaries/${editingId}` : `${API_URL}/obituaries`;
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setFormError(result.error?.message || 'Failed to save obituary.');
        return;
      }
      resetForm();
      await Promise.all([fetchObituaries(), fetchCounts()]);
      showToast(approvalTargetId
        ? 'Obituary reviewed and approved for publication'
        : editingId ? 'Obituary updated successfully' : 'Obituary created successfully');
    } catch (err) {
      setFormError(err instanceof Error ? `Could not save obituary: ${err.message}` : 'Could not connect to save the obituary.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await adminFetch(`/obituaries/${id}`, { token: token!, method: 'PUT', body: JSON.stringify({ status }) });
      await Promise.all([fetchObituaries(), fetchCounts()]);
      showToast(`Obituary ${status.toLowerCase()}`);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : `Failed to ${status.toLowerCase()} obituary`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminFetch(`/obituaries/${deleteTarget.id}`, { token, method: 'DELETE' });
      setDeleteTarget(null);
      await Promise.all([fetchObituaries(), fetchCounts()]);
      showToast('Obituary deleted');
    } catch (err) {
      setDeleteError(err instanceof AdminApiError ? err.message : 'Failed to delete obituary');
    } finally {
      setDeleting(false);
    }
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
        <ObituaryForm
          key={approvalTargetId || editingId || 'new'}
          initialValue={formInitial}
          existingImageUrl={editingId
            ? obituaries.find((obituary) => obituary.id === editingId)?.imageUrl
              || (obituaries.find((obituary) => obituary.id === editingId)?.imageMimeType
                ? `${API_URL}/obituaries/${editingId}/image`
                : '')
            : ''}
          saveLabel={approvalTargetId
            ? 'Save publication and approve'
            : editingId ? 'Save obituary changes' : 'Create obituary'}
          requireSubmissionFields={!editingId || Boolean(approvalTargetId && formInitial.dateOfDeath)}
          submitting={submitting}
          error={formError}
          onCancel={resetForm}
          onSave={handleFormSave}
          />
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
                <Fragment key={o.id}>
                <tr key={o.id} className={o.status === 'PENDING' ? 'bg-yellow-50/50' : ''}>
                  <td className="px-4 py-2">
                    {o.imageUrl || o.imageMimeType ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.imageUrl || `${API_URL}/obituaries/${o.id}/image`} alt={o.name} className="w-12 h-12 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{truncate(o.content)}</p>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    <div>
                      <p className="font-medium text-gray-700">{o.submitterName || 'Admin'}</p>
                      {o.submitterEmail && <p>{o.submitterEmail}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(o.status)}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(o.publishedAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {canReview && expandedReviewId === o.id && o.status === 'PENDING' && (
                        <>
                          <button onClick={() => openReviewForm(o)} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium hover:bg-green-100">Prepare publication</button>
                          <button onClick={() => handleStatusChange(o.id, 'REJECTED')} className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-medium hover:bg-red-100">❌ Reject</button>
                        </>
                      )}
                      {canReview && expandedReviewId === o.id && o.status === 'REJECTED' && (
                        <button onClick={() => openReviewForm(o)} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium hover:bg-green-100">Prepare to republish</button>
                      )}
                      {canReview && o.status === 'APPROVED' && (
                        <button onClick={() => handleStatusChange(o.id, 'REJECTED')} className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-medium hover:bg-yellow-100">Unpublish</button>
                      )}
                      <button onClick={() => openEdit(o)} className="text-blue-600 hover:underline text-xs px-1">Edit</button>
                      <button
                        onClick={() => {
                          setImageLoadError(false);
                          setExpandedReviewId((current) => current === o.id ? null : o.id);
                        }}
                        className="text-gray-600 hover:underline text-xs px-1"
                        aria-expanded={expandedReviewId === o.id}
                      >
                        {expandedReviewId === o.id ? 'Hide details' : 'Review details'}
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError('');
                          setDeleteTarget(o);
                        }}
                        className="text-red-600 hover:underline text-xs px-1"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedReviewId === o.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-4 py-4">
                      <h3 className="font-semibold text-sm mb-3">Submission details</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Submitted by: {o.submitterName || 'Admin'}{o.submitterEmail ? ` (${o.submitterEmail})` : ''}
                      </p>
                      {(o.imageUrl || o.imageMimeType) && (
                        <div className="mb-4">
                          {imageLoadError ? (
                            <p role="status" className="text-sm text-red-600">
                              Image could not be loaded. Verify the image URL and the encryption key used when it was uploaded.
                            </p>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={o.imageUrl || `${API_URL}/obituaries/${o.id}/image`}
                              alt={o.name}
                              onError={() => setImageLoadError(true)}
                              className="max-h-64 max-w-full rounded object-contain"
                            />
                          )}
                        </div>
                      )}
                      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                        {reviewFields.filter(([field]) => Boolean(o[field])).map(([field, label]) => {
                          const value = o[field];
                          const text = field === 'dateOfBirth' || field === 'dateOfDeath'
                            ? formatDate(String(value))
                            : String(value);
                          return (
                            <div key={field}>
                              <dt className="text-xs font-semibold text-gray-500">{label}</dt>
                              <dd className="text-sm whitespace-pre-line break-words">{text}</dd>
                            </div>
                          );
                        })}
                        {o.imageUrl && (
                          <div>
                            <dt className="text-xs font-semibold text-gray-500">Image URL</dt>
                            <dd className="text-sm break-all">{o.imageUrl}</dd>
                          </div>
                        )}
                      </dl>
                    </td>
                  </tr>
                )}
                </Fragment>
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

      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setDeleteError('');
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-obituary-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 id="delete-obituary-title" className="text-lg font-bold text-gray-900 text-center mb-2">
              Delete obituary?
            </h2>
            <p className="text-sm text-gray-500 text-center mb-1">
              You are about to permanently delete:
            </p>
            <p className="text-sm font-medium text-gray-800 text-center mb-5 break-words">
              &ldquo;{deleteTarget.name}&rdquo;
            </p>
            <p className="text-xs text-red-600 text-center mb-5 bg-red-50 rounded-lg p-2">
              This cannot be undone. The obituary will be permanently removed.
            </p>
            {deleteError && (
              <p role="alert" className="text-sm text-red-700 text-center mb-4">
                {deleteError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                autoFocus
                disabled={deleting}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete Obituary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
