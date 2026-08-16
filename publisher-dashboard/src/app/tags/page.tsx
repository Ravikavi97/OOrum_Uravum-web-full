'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';
import { ToastContainer, useToast } from '@/components/Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tag {
  id: string;
  name: string;
  slug: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TagsPage() {
  const { token, hasRole } = useAuth();
  const { toasts, showToast, dismiss } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deleteError, setDeleteError] = useState('');

  const canEdit = hasRole('ADMIN', 'EDITOR');

  // ─── Fetch tags ────────────────────────────────────────────────────────────

  const fetchTags = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setListError('');
    try {
      const data = await adminFetch<Tag[]>('/tags', { token });
      setTags(data);
    } catch (err) {
      setListError(err instanceof AdminApiError ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchTags();
  }, [fetchTags, token]);

  // ─── Create handler ────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await adminFetch('/tags', {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setName('');
      setShowForm(false);
      fetchTags();
      showToast('Tag created');
    } catch (err) {
      setFormError(err instanceof AdminApiError ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Inline edit handlers ──────────────────────────────────────────────────

  const startEditing = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setEditError('');
    setEditSaving(true);
    try {
      await adminFetch(`/tags/${editingId}`, {
        token: token!,
        method: 'PUT',
        body: JSON.stringify({ name: editName.trim() }),
      });
      cancelEditing();
      fetchTags();
      showToast('Tag updated');
    } catch (err) {
      setEditError(err instanceof AdminApiError ? err.message : 'Failed to save');
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // ─── Delete handler ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    setDeleteError('');
    try {
      await adminFetch(`/tags/${id}`, {
        token: token!,
        method: 'DELETE',
      });
      fetchTags();
      showToast('Tag deleted');
    } catch (err) {
      setDeleteError(err instanceof AdminApiError ? err.message : 'Failed to delete tag');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tags</h1>
        {canEdit && (
          <button
            onClick={() => { setName(''); setFormError(''); setShowForm(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            + New Tag
          </button>
        )}
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex justify-between items-center">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="text-red-700 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-lg shadow mb-6 space-y-3">
          <h2 className="font-semibold">New Tag</h2>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag name"
            required
            className="w-full border rounded px-3 py-2 text-sm"
            aria-label="Tag name"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List error */}
      {listError && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex justify-between items-center">
          <span>{listError}</span>
          <button onClick={fetchTags} className="text-red-700 underline text-xs">Retry</button>
        </div>
      )}

      {/* Tag table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : tags.length === 0 ? (
        <p className="text-gray-500 text-sm">No tags found.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Slug</th>
                {canEdit && <th className="text-left px-4 py-2">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {tags.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2">
                    {editingId === t.id ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            className="border rounded px-2 py-1 text-sm w-48"
                            aria-label="Edit tag name"
                            autoFocus
                          />
                          <button
                            onClick={saveEdit}
                            disabled={editSaving}
                            className="text-green-600 hover:underline text-xs disabled:opacity-50"
                          >
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-500 hover:underline text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                        {editError && <p className="text-red-600 text-xs">{editError}</p>}
                      </div>
                    ) : canEdit ? (
                      <button
                        onClick={() => startEditing(t)}
                        className="text-left hover:text-blue-600 hover:underline cursor-pointer"
                        title="Click to edit"
                      >
                        {t.name}
                      </button>
                    ) : (
                      t.name
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{t.slug}</td>
                  {canEdit && (
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
