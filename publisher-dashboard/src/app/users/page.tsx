'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';
import { BUILT_IN_ROLES, type CustomRole } from '@/lib/permissions';
import { ToastContainer, useToast } from '@/components/Toast';

interface CmsUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface FrontendUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  active: boolean;
  failedLogins: number;
  lockedUntil: string | null;
  createdAt: string;
}

interface Paginated<T> { data: T[]; total: number; page: number; pageSize: number; totalPages: number; }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function UsersPage() {
  const { token, hasRole } = useAuth();
  const [tab, setTab] = useState<'cms' | 'frontend'>('cms');
  const { toasts, showToast, dismiss } = useToast();

  // CMS users state
  const [cmsUsers, setCmsUsers] = useState<Paginated<CmsUser> | null>(null);
  const [cmsPage, setCmsPage] = useState(1);
  const [cmsLoading, setCmsLoading] = useState(true);
  const [cmsError, setCmsError] = useState('');

  // CMS form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('AUTHOR');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Frontend users state
  const [feUsers, setFeUsers] = useState<Paginated<FrontendUser> | null>(null);
  const [fePage, setFePage] = useState(1);
  const [feLoading, setFeLoading] = useState(true);
  const [feError, setFeError] = useState('');
  const [feSearch, setFeSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<FrontendUser | null>(null);

  // Custom roles
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  // Fetch CMS users
  const fetchCmsUsers = useCallback(async () => {
    if (!token) return;
    setCmsLoading(true); setCmsError('');
    try {
      const data = await adminFetch<Paginated<CmsUser>>(`/users?page=${cmsPage}&pageSize=10`, { token });
      setCmsUsers(data);
      // Also load custom roles
      const settings = await adminFetch<Array<{ key: string; value: string }>>('/settings', { token });
      const rolesEntry = Array.isArray(settings) ? settings.find((s) => s.key === 'customRoles') : null;
      if (rolesEntry?.value) setCustomRoles(JSON.parse(rolesEntry.value));
    } catch (err) { setCmsError(err instanceof AdminApiError ? err.message : 'Failed to load'); }
    finally { setCmsLoading(false); }
  }, [token, cmsPage]);

  // Fetch frontend users
  const fetchFeUsers = useCallback(async () => {
    if (!token) return;
    setFeLoading(true); setFeError('');
    try {
      const qs = `?page=${fePage}&pageSize=20${feSearch ? `&search=${encodeURIComponent(feSearch)}` : ''}`;
      const data = await adminFetch<Paginated<FrontendUser>>(`/public-auth/admin/list${qs}`, { token });
      setFeUsers(data);
    } catch (err) { setFeError(err instanceof AdminApiError ? err.message : 'Failed to load'); }
    finally { setFeLoading(false); }
  }, [token, fePage, feSearch]);

  useEffect(() => { if (token && tab === 'cms') fetchCmsUsers(); }, [fetchCmsUsers, token, tab]);
  useEffect(() => { if (token && tab === 'frontend') fetchFeUsers(); }, [fetchFeUsers, token, tab]);

  if (!hasRole('ADMIN')) {
    return <div><h1 className="text-2xl font-bold mb-4">Users</h1><p className="text-red-600">Admin access required.</p></div>;
  }

  // CMS form helpers
  const resetForm = () => { setFormName(''); setFormEmail(''); setFormPassword(''); setFormRole('AUTHOR'); setEditingId(null); setFormError(''); setShowForm(false); };
  const openEdit = (u: CmsUser) => { setEditingId(u.id); setFormName(u.name); setFormEmail(u.email); setFormRole(u.role); setFormPassword(''); setFormError(''); setShowForm(true); };

  const handleCmsSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setSubmitting(true);
    const body: Record<string, string> = { name: formName, email: formEmail, role: formRole };
    if (formPassword) body.password = formPassword;
    try {
      if (editingId) await adminFetch(`/users/${editingId}`, { token: token!, method: 'PUT', body: JSON.stringify(body) });
      else await adminFetch('/users', { token: token!, method: 'POST', body: JSON.stringify(body) });
      resetForm(); fetchCmsUsers();
      showToast(editingId ? 'User updated' : 'User created');
    } catch (err) { setFormError(err instanceof AdminApiError ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleCmsDelete = async (id: string) => {
    if (!confirm('Delete this CMS user?')) return;
    try { await adminFetch(`/users/${id}`, { token: token!, method: 'DELETE' }); fetchCmsUsers(); showToast('User deleted'); }
    catch { setCmsError('Failed to delete'); }
  };

  // Frontend user actions
  const toggleFeUser = async (id: string) => {
    try { await adminFetch(`/public-auth/admin/${id}/toggle`, { token: token!, method: 'PUT' }); fetchFeUsers(); setSelectedUser(null); showToast('User status updated'); }
    catch { /* silent */ }
  };

  const unlockFeUser = async (id: string) => {
    try { await adminFetch(`/public-auth/admin/${id}/unlock`, { token: token!, method: 'PUT' }); fetchFeUsers(); setSelectedUser(null); showToast('User unlocked'); }
    catch { setFeError('Failed to unlock user'); }
  };

  const deleteFeUser = async (id: string) => {
    if (!confirm('Delete this frontend user? This cannot be undone.')) return;
    try { await adminFetch(`/public-auth/admin/${id}`, { token: token!, method: 'DELETE' }); fetchFeUsers(); setSelectedUser(null); showToast('User deleted'); }
    catch { setFeError('Failed to delete'); }
  };

  const isLocked = (u: FrontendUser) => u.lockedUntil && new Date(u.lockedUntil) > new Date();

  return (
    <div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        {tab === 'cms' && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ New CMS User</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 max-w-md">
        <button onClick={() => setTab('cms')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'cms' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          👥 CMS Users {cmsUsers ? `(${cmsUsers.total})` : ''}
        </button>
        <button onClick={() => setTab('frontend')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'frontend' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          🌐 Frontend Users {feUsers ? `(${feUsers.total})` : ''}
        </button>
      </div>

      {/* ─── CMS Users Tab ──────────────────────────────────────────────── */}
      {tab === 'cms' && (
        <>
          {cmsError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{cmsError}</div>}

          {showForm && (
            <form onSubmit={handleCmsSubmit} className="bg-white p-4 rounded-lg shadow mb-6 space-y-3">
              <h2 className="font-semibold">{editingId ? 'Edit User' : 'New CMS User'}</h2>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Name" required className="w-full border rounded px-3 py-2 text-sm" />
              <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="Email" type="email" required className="w-full border rounded px-3 py-2 text-sm" />
              <input value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder={editingId ? 'New password (leave blank to keep)' : 'Password (min 8 chars)'} type="password" required={!editingId} className="w-full border rounded px-3 py-2 text-sm" />
              <select value={formRole} onChange={(e) => setFormRole(e.target.value as UserRole)} className="border rounded px-3 py-2 text-sm">
                <option value="AUTHOR">Author</option>
                <option value="EDITOR">Editor</option>
                <option value="ADMIN">Admin</option>
                {customRoles.map((r) => (
                  <option key={r.name} value={r.name}>{r.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={resetForm} className="bg-gray-200 px-4 py-2 rounded text-sm">Cancel</button>
              </div>
            </form>
          )}

          {cmsLoading ? <p className="text-gray-500 text-sm">Loading…</p> : !cmsUsers || cmsUsers.data.length === 0 ? <p className="text-gray-500 text-sm">No CMS users.</p> : (
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
                  {cmsUsers.data.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2 font-medium">{u.name}</td>
                      <td className="px-4 py-2 text-gray-500">{u.email}</td>
                      <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                        u.role === 'EDITOR' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'AUTHOR' ? 'bg-gray-100 text-gray-700' :
                        (() => { const cr = customRoles.find((r) => r.name === u.role); return cr?.color || 'bg-purple-100 text-purple-700'; })()
                      }`}>{(() => { const cr = customRoles.find((r) => r.name === u.role); return cr?.label || u.role; })()}</span></td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-2 flex gap-2">
                        <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline text-xs">Edit</button>
                        <button onClick={() => handleCmsDelete(u.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cmsUsers && cmsUsers.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={cmsPage <= 1} onClick={() => setCmsPage(cmsPage - 1)} className="px-3 py-1 rounded border text-sm disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {cmsPage} of {cmsUsers.totalPages}</span>
              <button disabled={cmsPage >= cmsUsers.totalPages} onClick={() => setCmsPage(cmsPage + 1)} className="px-3 py-1 rounded border text-sm disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}

      {/* ─── Frontend Users Tab ─────────────────────────────────────────── */}
      {tab === 'frontend' && (
        <>
          {feError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{feError}</div>}

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={feSearch}
              onChange={(e) => { setFeSearch(e.target.value); setFePage(1); }}
              placeholder="Search by name, email, or phone..."
              className="w-full max-w-md border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {feLoading ? <p className="text-gray-500 text-sm">Loading…</p> : !feUsers || feUsers.data.length === 0 ? <p className="text-gray-500 text-sm">No frontend users found.</p> : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-left px-4 py-2">Email</th>
                    <th className="text-left px-4 py-2">Phone</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Joined</th>
                    <th className="text-left px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {feUsers.data.map((u) => (
                    <tr key={u.id} className={!u.active ? 'bg-red-50/30' : isLocked(u) ? 'bg-yellow-50/30' : ''}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-accent-red/10 flex items-center justify-center text-accent-red text-xs font-bold">{u.name.charAt(0).toUpperCase()}</div>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{u.email}</td>
                      <td className="px-4 py-2 text-gray-500">{u.phone || '—'}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {u.active ? 'Active' : 'Disabled'}
                          </span>
                          {isLocked(u) && <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">🔒 Locked</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => setSelectedUser(u)} className="bg-blue-50 text-blue-600 px-3 py-1 rounded text-xs font-medium hover:bg-blue-100">Actions</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {feUsers && feUsers.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={fePage <= 1} onClick={() => setFePage(fePage - 1)} className="px-3 py-1 rounded border text-sm disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {fePage} of {feUsers.totalPages}</span>
              <button disabled={fePage >= feUsers.totalPages} onClick={() => setFePage(fePage + 1)} className="px-3 py-1 rounded border text-sm disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}

      {/* Frontend User Action Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">User Actions</h3>
              <button onClick={() => setSelectedUser(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* User info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-accent-red/10 flex items-center justify-center text-accent-red font-bold">{selectedUser.name.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="font-semibold">{selectedUser.name}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-400">Phone:</span> <span className="text-gray-700">{selectedUser.phone || '—'}</span></div>
                <div><span className="text-gray-400">Joined:</span> <span className="text-gray-700">{formatDate(selectedUser.createdAt)}</span></div>
                {selectedUser.address && <div className="col-span-2"><span className="text-gray-400">Address:</span> <span className="text-gray-700">{selectedUser.address}</span></div>}
              </div>
              <div className="flex gap-2 mt-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedUser.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {selectedUser.active ? 'Active' : 'Disabled'}
                </span>
                {isLocked(selectedUser) && <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">🔒 Locked ({selectedUser.failedLogins} failed attempts)</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {/* Toggle active/disabled */}
              <button
                onClick={() => toggleFeUser(selectedUser.id)}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${selectedUser.active ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}
              >
                {selectedUser.active ? '⚠️ Deactivate Account' : '✅ Activate Account'}
              </button>

              {/* Unlock (only if locked) */}
              {isLocked(selectedUser) && (
                <button
                  onClick={() => unlockFeUser(selectedUser.id)}
                  className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  🔓 Unlock Account
                </button>
              )}

              {/* Delete */}
              <button
                onClick={() => deleteFeUser(selectedUser.id)}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
              >
                🗑️ Delete Account Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
