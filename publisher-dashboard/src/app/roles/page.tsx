'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { adminFetch } from '@/lib/api';
import { ALL_PAGES, ACTIONS, BUILT_IN_ROLES, DEFAULT_PERMISSIONS, parsePermissions, type PageId, type Action, type RolePermissions, type CustomRole } from '@/lib/permissions';

const ROLE_COLORS = ['bg-purple-100 text-purple-700', 'bg-teal-100 text-teal-700', 'bg-pink-100 text-pink-700', 'bg-lime-100 text-lime-700', 'bg-sky-100 text-sky-700', 'bg-orange-100 text-orange-700'];
const ACTION_LABELS: Record<Action, string> = { view: '👁 View', create: '➕ Create', edit: '✏️ Edit', delete: '🗑 Delete', publish: '📢 Publish' };

export default function RolesPage() {
  const { token, hasRole } = useAuth();
  const { reload } = usePermissions();
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState('EDITOR');
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [deleteRole, setDeleteRole] = useState<string | null>(null);

  const allRoles = [...BUILT_IN_ROLES.filter((r) => r !== 'ADMIN'), ...customRoles.map((r) => r.name)];

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const settings = await adminFetch<Array<{ key: string; value: string }>>('/settings', { token });
      const permEntry = Array.isArray(settings) ? settings.find((s) => s.key === 'rolePermissions') : null;
      if (permEntry?.value) setPermissions({ ...DEFAULT_PERMISSIONS, ...parsePermissions(permEntry.value) });
      const rolesEntry = Array.isArray(settings) ? settings.find((s) => s.key === 'customRoles') : null;
      if (rolesEntry?.value) setCustomRoles(JSON.parse(rolesEntry.value));
    } catch { /* defaults */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!hasRole('ADMIN')) return <div><h1 className="text-2xl font-bold mb-4">Roles & Permissions</h1><p className="text-red-600">Admin access required.</p></div>;

  const togglePageAccess = (role: string, pageId: string) => {
    setPermissions((prev) => {
      const copy = { ...prev };
      if (!copy[role]) copy[role] = {};
      const current = copy[role][pageId] || { access: false, actions: [] };
      copy[role] = { ...copy[role], [pageId]: { ...current, access: !current.access, actions: !current.access ? ['view', 'create', 'edit'] : [] } };
      return copy;
    });
  };

  const toggleAction = (role: string, pageId: string, action: Action) => {
    setPermissions((prev) => {
      const copy = { ...prev };
      if (!copy[role]) copy[role] = {};
      const current = copy[role][pageId] || { access: true, actions: [] };
      const actions = current.actions.includes(action) ? current.actions.filter((a) => a !== action) : [...current.actions, action];
      copy[role] = { ...copy[role], [pageId]: { ...current, actions } };
      return copy;
    });
  };

  const grantAll = (role: string) => {
    setPermissions((prev) => {
      const copy = { ...prev };
      copy[role] = {};
      for (const p of ALL_PAGES) copy[role][p.id] = { access: true, actions: [...ACTIONS] };
      return copy;
    });
  };

  const revokeAll = (role: string) => {
    setPermissions((prev) => {
      const copy = { ...prev };
      copy[role] = {};
      for (const p of ALL_PAGES) copy[role][p.id] = { access: p.id === 'dashboard', actions: p.id === 'dashboard' ? ['view'] : [] };
      return copy;
    });
  };

  const handleCreateRole = () => {
    if (!newRoleName.trim() || !newRoleLabel.trim()) { setError('Name and label required'); return; }
    const name = newRoleName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if ([...BUILT_IN_ROLES, ...customRoles.map((r) => r.name)].includes(name)) { setError('Role already exists'); return; }
    const newRole: CustomRole = { name, label: newRoleLabel.trim(), description: newRoleDesc.trim(), color: ROLE_COLORS[customRoles.length % ROLE_COLORS.length] };
    setCustomRoles((prev) => [...prev, newRole]);
    // Initialize with dashboard view only
    setPermissions((prev) => {
      const copy = { ...prev };
      copy[name] = {};
      for (const p of ALL_PAGES) copy[name][p.id] = { access: p.id === 'dashboard', actions: p.id === 'dashboard' ? ['view'] : [] };
      return copy;
    });
    setSelectedRole(name);
    setNewRoleName(''); setNewRoleLabel(''); setNewRoleDesc(''); setShowNewRole(false); setError('');
  };

  const handleDeleteRole = (roleName: string) => {
    setCustomRoles((prev) => prev.filter((r) => r.name !== roleName));
    setPermissions((prev) => { const copy = { ...prev }; delete copy[roleName]; return copy; });
    if (selectedRole === roleName) setSelectedRole('EDITOR');
    setDeleteRole(null);
  };

  const saveAll = async () => {
    if (!token) return;
    setError(''); setMessage(''); setSaving(true);
    try {
      const permToSave: RolePermissions = {};
      for (const role of allRoles) permToSave[role] = permissions[role] || {};
      await Promise.all([
        adminFetch('/settings', { token, method: 'PUT', body: JSON.stringify({ key: 'rolePermissions', value: JSON.stringify(permToSave) }) }),
        adminFetch('/settings', { token, method: 'PUT', body: JSON.stringify({ key: 'customRoles', value: JSON.stringify(customRoles) }) }),
      ]);
      setMessage('Saved successfully');
      await reload();
      setTimeout(() => setMessage(''), 3000);
    } catch { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  const getRoleInfo = (name: string) => {
    if (name === 'EDITOR') return { label: 'Editor', color: 'bg-blue-100 text-blue-700', isBuiltIn: true };
    if (name === 'AUTHOR') return { label: 'Author', color: 'bg-gray-100 text-gray-700', isBuiltIn: true };
    const cr = customRoles.find((r) => r.name === name);
    return cr ? { label: cr.label, color: cr.color, isBuiltIn: false } : { label: name, color: 'bg-gray-100', isBuiltIn: false };
  };

  if (loading) return <div><h1 className="text-2xl font-bold mb-4">Roles & Permissions</h1><p className="text-gray-500 text-sm">Loading…</p></div>;

  const rolePerms = permissions[selectedRole] || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">Configure page access and action permissions per role.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewRole(!showNewRole)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">+ New Role</button>
          <button onClick={saveAll} disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save All'}</button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
      {message && <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{message}</div>}

      {showNewRole && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6 space-y-3">
          <h2 className="font-semibold">Create New Role</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))} placeholder="ROLE_NAME" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={newRoleLabel} onChange={(e) => setNewRoleLabel(e.target.value)} placeholder="Display Label" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Description" className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateRole} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
            <button onClick={() => setShowNewRole(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Role selector tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700">🔐 ADMIN (Full Access)</span>
        {allRoles.map((role) => {
          const info = getRoleInfo(role);
          return (
            <button key={role} onClick={() => setSelectedRole(role)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedRole === role ? 'ring-2 ring-blue-500 ring-offset-1' : ''} ${info.color} flex items-center gap-1`}>
              {info.label}
              {!info.isBuiltIn && <button onClick={(e) => { e.stopPropagation(); setDeleteRole(role); }} className="ml-1 text-red-400 hover:text-red-600">✕</button>}
            </button>
          );
        })}
      </div>

      {/* Quick actions for selected role */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => grantAll(selectedRole)} className="text-xs text-blue-600 hover:underline">Grant all</button>
        <span className="text-gray-300">|</span>
        <button onClick={() => revokeAll(selectedRole)} className="text-xs text-gray-500 hover:underline">Revoke all</button>
      </div>

      {/* Permission matrix for selected role */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 w-48">Page</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-700 w-20">Access</th>
              {ACTIONS.map((a) => (
                <th key={a} className="text-center px-2 py-3 font-semibold text-gray-700 text-xs w-20">{ACTION_LABELS[a]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {ALL_PAGES.map((page) => {
              const perm = rolePerms[page.id] || { access: false, actions: [] };
              const isDashboard = page.id === 'dashboard';
              return (
                <tr key={page.id} className={`hover:bg-gray-50 ${perm.access ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span>{page.icon}</span>
                      <span className="font-medium text-xs">{page.label}</span>
                    </div>
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={perm.access} onChange={() => !isDashboard && togglePageAccess(selectedRole, page.id)} disabled={isDashboard} className="sr-only peer" />
                      <div className={`w-9 h-5 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full ${isDashboard ? 'bg-green-400 cursor-not-allowed' : 'bg-gray-300 peer-checked:bg-blue-600 cursor-pointer'}`} />
                    </label>
                  </td>
                  {ACTIONS.map((action) => (
                    <td key={action} className="text-center px-2 py-2.5">
                      <input
                        type="checkbox"
                        checked={perm.actions.includes(action)}
                        onChange={() => toggleAction(selectedRole, page.id, action)}
                        disabled={!perm.access || isDashboard}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4">Admin always has full access. Dashboard is always enabled. Action checkboxes only apply when page access is enabled.</p>

      {deleteRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteRole(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Delete Role?</h3>
            <p className="text-sm text-gray-600 mb-4">Delete <strong>{getRoleInfo(deleteRole).label}</strong>?</p>
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
