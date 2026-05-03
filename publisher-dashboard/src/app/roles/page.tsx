'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { adminFetch } from '@/lib/api';
import { ALL_PAGES, DEFAULT_PERMISSIONS, BUILT_IN_ROLES, type PageId, type RolePermissions, type CustomRole } from '@/lib/permissions';

const ROLE_COLORS = [
  'bg-purple-100 text-purple-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
  'bg-lime-100 text-lime-700',
  'bg-sky-100 text-sky-700',
  'bg-orange-100 text-orange-700',
];

export default function RolesPage() {
  const { token, hasRole } = useAuth();
  const { reload } = usePermissions();
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // New role form
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Delete confirmation
  const [deleteRole, setDeleteRole] = useState<string | null>(null);

  const allRoles = [...BUILT_IN_ROLES.filter((r) => r !== 'ADMIN'), ...customRoles.map((r) => r.name)];

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const settings = await adminFetch<Array<{ key: string; value: string }>>('/settings', { token });
      const permEntry = Array.isArray(settings) ? settings.find((s) => s.key === 'rolePermissions') : null;
      if (permEntry?.value) setPermissions({ ...DEFAULT_PERMISSIONS, ...JSON.parse(permEntry.value) });

      const rolesEntry = Array.isArray(settings) ? settings.find((s) => s.key === 'customRoles') : null;
      if (rolesEntry?.value) setCustomRoles(JSON.parse(rolesEntry.value));
    } catch { /* defaults */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!hasRole('ADMIN')) {
    return <div><h1 className="text-2xl font-bold mb-4">Roles & Permissions</h1><p className="text-red-600">Admin access required.</p></div>;
  }

  const togglePermission = (role: string, pageId: PageId) => {
    setPermissions((prev) => {
      const current = prev[role] || [];
      const updated = current.includes(pageId) ? current.filter((p) => p !== pageId) : [...current, pageId];
      return { ...prev, [role]: updated };
    });
  };

  const selectAll = (role: string) => setPermissions((prev) => ({ ...prev, [role]: ALL_PAGES.map((p) => p.id) }));
  const deselectAll = (role: string) => setPermissions((prev) => ({ ...prev, [role]: ['dashboard'] }));

  const handleCreateRole = () => {
    if (!newRoleName.trim() || !newRoleLabel.trim()) { setError('Role name and label are required'); return; }
    const name = newRoleName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if ([...BUILT_IN_ROLES, ...customRoles.map((r) => r.name)].includes(name)) { setError('Role name already exists'); return; }

    const newRole: CustomRole = {
      name,
      label: newRoleLabel.trim(),
      description: newRoleDesc.trim(),
      color: ROLE_COLORS[customRoles.length % ROLE_COLORS.length],
    };

    setCustomRoles((prev) => [...prev, newRole]);
    setPermissions((prev) => ({ ...prev, [name]: ['dashboard'] }));
    setNewRoleName(''); setNewRoleLabel(''); setNewRoleDesc('');
    setShowNewRole(false); setError('');
  };

  const handleDeleteRole = (roleName: string) => {
    setCustomRoles((prev) => prev.filter((r) => r.name !== roleName));
    setPermissions((prev) => { const copy = { ...prev }; delete copy[roleName]; return copy; });
    setDeleteRole(null);
  };

  const saveAll = async () => {
    if (!token) return;
    setError(''); setMessage(''); setSaving(true);
    try {
      const permToSave: RolePermissions = {};
      for (const role of allRoles) permToSave[role] = permissions[role] || [];

      await Promise.all([
        adminFetch('/settings', { token, method: 'PUT', body: JSON.stringify({ key: 'rolePermissions', value: JSON.stringify(permToSave) }) }),
        adminFetch('/settings', { token, method: 'PUT', body: JSON.stringify({ key: 'customRoles', value: JSON.stringify(customRoles) }) }),
      ]);

      setMessage('Roles and permissions saved');
      await reload();
      setTimeout(() => setMessage(''), 3000);
    } catch { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  const getRoleInfo = (name: string): { label: string; color: string; isBuiltIn: boolean } => {
    if (name === 'EDITOR') return { label: 'Editor', color: 'bg-blue-100 text-blue-700', isBuiltIn: true };
    if (name === 'AUTHOR') return { label: 'Author', color: 'bg-gray-100 text-gray-700', isBuiltIn: true };
    const custom = customRoles.find((r) => r.name === name);
    return custom ? { label: custom.label, color: custom.color, isBuiltIn: false } : { label: name, color: 'bg-gray-100 text-gray-600', isBuiltIn: false };
  };

  if (loading) return <div><h1 className="text-2xl font-bold mb-4">Roles & Permissions</h1><p className="text-gray-500 text-sm">Loading…</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage roles and configure page access for each role.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewRole(!showNewRole)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            + New Role
          </button>
          <button onClick={saveAll} disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
      {message && <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{message}</div>}

      {/* Create new role form */}
      {showNewRole && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6 space-y-3">
          <h2 className="font-semibold">Create New Role</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role Name (uppercase, no spaces)</label>
              <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))} placeholder="e.g. MODERATOR" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Label</label>
              <input value={newRoleLabel} onChange={(e) => setNewRoleLabel(e.target.value)} placeholder="e.g. Moderator" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="e.g. Can moderate content" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateRole} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create Role</button>
            <button onClick={() => setShowNewRole(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Role cards */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700">🔐 ADMIN (Full Access)</span>
        {allRoles.map((role) => {
          const info = getRoleInfo(role);
          return (
            <span key={role} className={`px-3 py-1.5 rounded-full text-xs font-bold ${info.color} flex items-center gap-1`}>
              {info.label}
              {!info.isBuiltIn && (
                <button onClick={() => setDeleteRole(role)} className="ml-1 text-red-400 hover:text-red-600" title="Delete role">✕</button>
              )}
            </span>
          );
        })}
      </div>

      {/* Admin info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-blue-800"><strong>🔐 Admin</strong> always has full access. Custom roles use the AUTHOR base role in the database — permissions are controlled here.</p>
      </div>

      {/* Permission matrix */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[200px] sticky left-0 bg-gray-50">Page</th>
              {allRoles.map((role) => {
                const info = getRoleInfo(role);
                return (
                  <th key={role} className="text-center px-3 py-3 font-semibold text-gray-700 min-w-[100px]">
                    <div className="text-xs">{info.label}</div>
                    <div className="flex gap-1 justify-center mt-1">
                      <button onClick={() => selectAll(role)} className="text-[10px] text-blue-600 hover:underline">All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => deselectAll(role)} className="text-[10px] text-gray-500 hover:underline">None</button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {ALL_PAGES.map((page) => (
              <tr key={page.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <span>{page.icon}</span>
                    <span className="font-medium text-xs">{page.label}</span>
                  </div>
                </td>
                {allRoles.map((role) => {
                  const checked = (permissions[role] || []).includes(page.id);
                  const isDashboard = page.id === 'dashboard';
                  return (
                    <td key={role} className="text-center px-3 py-2.5">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => !isDashboard && togglePermission(role, page.id)} disabled={isDashboard} className="sr-only peer" />
                        <div className={`w-8 h-4.5 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-3.5 ${isDashboard ? 'bg-green-400 cursor-not-allowed' : 'bg-gray-300 peer-checked:bg-blue-600 cursor-pointer'}`} />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4">Dashboard is always enabled. When assigning custom roles to users, select the base role as AUTHOR in the user form — permissions are controlled from this page.</p>

      {/* Delete role confirmation */}
      {deleteRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteRole(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Delete Role?</h3>
            <p className="text-sm text-gray-600 mb-4">Delete the <strong>{getRoleInfo(deleteRole).label}</strong> role? Users with this role will lose their custom permissions.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteRole(deleteRole)} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
              <button onClick={() => setDeleteRole(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
