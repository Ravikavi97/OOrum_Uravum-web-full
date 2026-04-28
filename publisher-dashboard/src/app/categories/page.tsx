'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParentCategory {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parent: ParentCategory | null;
  _count: { articles: number };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { token, hasRole } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canEdit = hasRole('ADMIN', 'EDITOR');

  // ─── Fetch categories ──────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setListError('');
    try {
      const data = await adminFetch<Category[]>('/categories', { token });
      setCategories(data);
    } catch (err) {
      setListError(err instanceof AdminApiError ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchCategories();
  }, [fetchCategories, token]);

  // ─── Form helpers ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setName('');
    setDescription('');
    setParentId('');
    setEditingId(null);
    setFormError('');
    setShowForm(false);
  };

  const openEditForm = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
    setParentId(cat.parentId || '');
    setFormError('');
    setShowForm(true);
  };

  // ─── Submit handler ────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const body: Record<string, unknown> = {
      name,
      description: description || undefined,
      parentId: parentId || undefined,
    };

    try {
      if (editingId) {
        await adminFetch(`/categories/${editingId}`, {
          token: token!,
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await adminFetch('/categories', {
          token: token!,
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      resetForm();
      fetchCategories();
    } catch (err) {
      if (err instanceof AdminApiError) {
        setFormError(err.message);
      } else {
        setFormError('Network error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete handler ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    setDeleteError('');
    try {
      await adminFetch(`/categories/${id}`, {
        token: token!,
        method: 'DELETE',
      });
      fetchCategories();
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'HAS_ARTICLES') {
        setDeleteError(err.message);
      } else if (err instanceof AdminApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Failed to delete category');
      }
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        {canEdit && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            + New Category
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

      {/* Create/Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-6 space-y-3">
          <h2 className="font-semibold">{editingId ? 'Edit Category' : 'New Category'}</h2>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className="w-full border rounded px-3 py-2 text-sm"
            aria-label="Category name"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border rounded px-3 py-2 text-sm"
            aria-label="Category description"
          />
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
            aria-label="Parent category"
          >
            <option value="">No parent</option>
            {categories
              .filter((c) => c.id !== editingId)
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
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
          <button onClick={fetchCategories} className="text-red-700 underline text-xs">Retry</button>
        </div>
      )}

      {/* Category table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : categories.length === 0 ? (
        <p className="text-gray-500 text-sm">No categories found.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Slug</th>
                <th className="text-left px-4 py-2">Description</th>
                <th className="text-left px-4 py-2">Parent</th>
                <th className="text-left px-4 py-2">Articles</th>
                {canEdit && <th className="text-left px-4 py-2">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500">{c.slug}</td>
                  <td className="px-4 py-2 text-gray-500 truncate max-w-xs">{c.description || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{c.parent?.name || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{c._count?.articles ?? 0}</td>
                  {canEdit && (
                    <td className="px-4 py-2 flex gap-2">
                      <button
                        onClick={() => openEditForm(c)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Edit
                      </button>
                      {hasRole('ADMIN') && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-red-600 hover:underline text-xs"
                        >
                          Delete
                        </button>
                      )}
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
