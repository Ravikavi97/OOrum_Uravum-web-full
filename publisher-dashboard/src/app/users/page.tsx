'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface PaginatedUsers {
  data: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { token, hasRole } = useAuth();
  const [users, setUsers] = useState<PaginatedUsers | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('AUTHOR');
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ─── Fetch users ───────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setListError('');
    try {
      const data = await adminFetch<PaginatedUsers>(
        `/users?page=${page}&pageSize=10`,
        { token },
      );
      setUsers(data);
    } catch (err) {
      setListError(
        err instanceof AdminApiError ? err.message : 'Failed to load users',
      );
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    if (token) fetchUsers();
  }, [fetchUsers, token]);

  // ─── RBAC: ADMIN only ─────────────────────────────────────────────────────

  if (!hasRole('ADMIN')) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        <p className="text-red-600">Admin access required.</p>
      </div>
    );
  }

  // ─── Form helpers ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('AUTHOR');
    setEditingId(null);
    setFormError('');
    setShowForm(false);
  };

  const openEditForm = (u: User) => {
    setEditingId(u.id);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormPassword('');
    setFormError('');
    setShowForm(true);
  };

  // ─── Submit handler ────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const body: Record<string, string> = {
      name: formName,
      email: formEmail,
      role: formRole,
    };
    if (formPassword) body.password = formPassword;

    try {
      if (editingId) {
        await adminFetch(`/users/${editingId}`, {
          token: token!,
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await adminFetch('/users', {
          token: token!,
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      resetForm();
      fetchUsers();
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'DUPLICATE_EMAIL') {
        setFormError('Email is already in use');
      } else if (err instanceof AdminApiError) {
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
    if (!confirm('Delete this user?')) return;
    setDeleteError('');
    try {
      await adminFetch(`/users/${id}`, {
        token: token!,
        method: 'DELETE',
      });
      fetchUsers();
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'HAS_ARTICLES') {
        setDeleteError('User has associated articles that must be reassigned first');
      } else if (err instanceof AdminApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Failed to delete user');
      }
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          + New User
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
          <h2 className="font-semibold">{editingId ? 'Edit User' : 'New User'}</h2>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Name"
            required
            className="w-full border rounded px-3 py-2 text-sm"
            aria-label="User name"
          />
          <input
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
            className="w-full border rounded px-3 py-2 text-sm"
            aria-label="User email"
          />
          <input
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            placeholder={editingId ? 'New password (leave blank to keep)' : 'Password'}
            type="password"
            required={!editingId}
            className="w-full border rounded px-3 py-2 text-sm"
            aria-label="User password"
          />
          <select
            value={formRole}
            onChange={(e) => setFormRole(e.target.value as UserRole)}
            className="border rounded px-3 py-2 text-sm"
            aria-label="User role"
          >
            <option value="AUTHOR">Author</option>
            <option value="EDITOR">Editor</option>
            <option value="ADMIN">Admin</option>
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
          <button onClick={fetchUsers} className="text-red-700 underline text-xs">Retry</button>
        </div>
      )}

      {/* User table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : !users || users.data.length === 0 ? (
        <p className="text-gray-500 text-sm">No users found.</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Email</th>
                  <th className="text-left px-4 py-2">Role</th>
                  <th className="text-left px-4 py-2">Created</th>
                  <th className="text-left px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2">{u.name}</td>
                    <td className="px-4 py-2 text-gray-500">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                        u.role === 'EDITOR' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <button
                        onClick={() => openEditForm(u)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
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
          <div className="flex justify-between items-center mt-4 text-sm">
            <span className="text-gray-500">
              Page {users.page} of {users.totalPages} ({users.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                disabled={page >= users.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
