'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import AuthGuard from '@/components/shared/AuthGuard';
import { adminAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Users, Trophy, Briefcase, IndianRupee, Bell, Clock, Loader2,
  Plus, Pencil, Trash2, ShieldOff, Shield, X, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'users';

const ROLES = ['athlete', 'coach', 'professional', 'organization', 'admin'] as const;
type Role = typeof ROLES[number];

interface UserRow {
  _id: string;
  email: string;
  role: Role;
  phone?: string;
  isVerified: boolean;
  isSuspended: boolean;
  createdAt: string;
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────
function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email || '',
    password: '',
    role: user?.role || 'athlete',
    phone: user?.phone || '',
    isVerified: user?.isVerified ?? true,
    isSuspended: user?.isSuspended ?? false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        const payload: Record<string, unknown> = {
          role: form.role, phone: form.phone,
          isVerified: form.isVerified, isSuspended: form.isSuspended,
        };
        if (form.password) payload.password = form.password;
        await adminAPI.updateUser(user._id, payload);
        toast.success('User updated');
      } else {
        if (!form.password) { toast.error('Password is required'); setSaving(false); return; }
        await adminAPI.createUser({ email: form.email, password: form.password, role: form.role, phone: form.phone });
        toast.success('User created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit User' : 'Create User'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email" required disabled={isEdit}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Password {isEdit && <span className="text-gray-400">(leave blank to keep current)</span>}
            </label>
            <input
              type="password" required={!isEdit}
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={isEdit ? '••••••••' : 'Min 8 characters'}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <select
              value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input
              type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 XXXXX XXXXX"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          {isEdit && (
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })} className="accent-brand" />
                Verified
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.isSuspended} onChange={(e) => setForm({ ...form, isSuspended: e.target.checked })} className="accent-red-500" />
                Suspended
              </label>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<{
    users?: { total?: number; athletes?: number; coaches?: number; organizations?: number };
    listings?: { active?: number };
    jobs?: { active?: number };
    revenue?: { total?: number };
    pendingApprovals?: { listings?: number; organizations?: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [announcement, setAnnouncement] = useState({ title: '', message: '', type: 'info' });
  const [sending, setSending] = useState(false);

  // Users tab state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalUser, setModalUser] = useState<UserRow | null | undefined>(undefined); // undefined = closed, null = create
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    adminAPI.getDashboard()
      .then((r) => setDashboard(r.data?.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'users') loadUsers();
  }, [tab]);

  const loadUsers = async (q = search, role = roleFilter) => {
    setUsersLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (q) params.q = q;
      if (role) params.role = role;
      const res = await adminAPI.getUsers(params);
      setUsers(res.data?.data || []);
    } catch { toast.error('Failed to load users'); }
    setUsersLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); loadUsers(search, roleFilter); };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this user and all their data? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await adminAPI.deleteUser(id);
      toast.success('User deleted');
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed');
    }
    setDeletingId(null);
  };

  const handleToggleSuspend = async (id: string, current: boolean) => {
    try {
      await adminAPI.suspendUser(id);
      toast.success(current ? 'User unsuspended' : 'User suspended');
      setUsers((prev) => prev.map((u) => u._id === id ? { ...u, isSuspended: !current } : u));
    } catch { toast.error('Failed'); }
  };

  const sendAnnouncement = async () => {
    if (!announcement.title || !announcement.message) { toast.error('Fill in title and message'); return; }
    setSending(true);
    try {
      await adminAPI.sendAnnouncement(announcement);
      toast.success('Announcement sent!');
      setAnnouncement({ title: '', message: '', type: 'info' });
    } catch { toast.error('Failed to send'); }
    setSending(false);
  };

  const roleBadge: Record<string, string> = {
    athlete: 'bg-blue-100 text-blue-700',
    coach: 'bg-green-100 text-green-700',
    organization: 'bg-purple-100 text-purple-700',
    professional: 'bg-orange-100 text-orange-700',
    admin: 'bg-red-100 text-red-700',
  };

  return (
    <AuthGuard allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">LinkSports platform management</p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
            {([['overview', 'Overview'], ['users', 'User Management']] as [Tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {tab === 'overview' && (
            isLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { icon: Users,       label: 'Total Users',    value: dashboard?.users?.total || 0,              color: 'bg-blue-50 text-blue-600' },
                    { icon: Trophy,      label: 'Active Listings', value: dashboard?.listings?.active || 0,          color: 'bg-green-50 text-green-600' },
                    { icon: Briefcase,   label: 'Active Jobs',     value: dashboard?.jobs?.active || 0,              color: 'bg-purple-50 text-purple-600' },
                    { icon: IndianRupee, label: 'Total Revenue',   value: formatCurrency(dashboard?.revenue?.total || 0), color: 'bg-orange-50 text-orange-600' },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center mb-3`}><Icon className="w-5 h-5" /></div>
                      <p className="text-2xl font-bold text-gray-900">{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-brand" /> User Breakdown</h2>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Athletes',      value: dashboard?.users?.athletes || 0 },
                      { label: 'Coaches',       value: dashboard?.users?.coaches || 0 },
                      { label: 'Organizations', value: dashboard?.users?.organizations || 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-xl font-bold text-gray-900">{value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-orange-500" /> Pending Approvals</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Listings awaiting review',      value: dashboard?.pendingApprovals?.listings || 0 },
                      { label: 'Organizations awaiting verify', value: dashboard?.pendingApprovals?.organizations || 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className={`p-4 rounded-lg ${value > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                        <p className={`text-2xl font-bold ${value > 0 ? 'text-orange-700' : 'text-green-700'}`}>{value}</p>
                        <p className={`text-xs mt-0.5 ${value > 0 ? 'text-orange-600' : 'text-green-600'}`}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-brand" /> Send Announcement</h2>
                  <div className="space-y-3">
                    <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Title" value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} />
                    <textarea rows={3} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none" placeholder="Message..." value={announcement.message} onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })} />
                    <div className="flex gap-3">
                      <select className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" value={announcement.type} onChange={(e) => setAnnouncement({ ...announcement, type: e.target.value })}>
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                      </select>
                      <button onClick={sendAnnouncement} disabled={sending} className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} Send to All
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* ── User Management ── */}
          {tab === 'users' && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <form onSubmit={handleSearch} className="flex gap-2 flex-1">
                  <input
                    type="text" placeholder="Search by email…"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); loadUsers(search, e.target.value); }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">All roles</option>
                    {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                  <button type="submit" className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg">Search</button>
                </form>
                <button onClick={() => setModalUser(null)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-dark whitespace-nowrap">
                  <Plus className="w-4 h-4" /> Create User
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand" /></div>
                ) : users.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 text-sm">No users found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {users.map((u) => (
                          <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{u.email}</p>
                              <p className="text-xs text-gray-400">{u._id}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${roleBadge[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{u.phone || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${u.isVerified ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                                  {u.isVerified ? 'Verified' : 'Unverified'}
                                </span>
                                {u.isSuspended && <span className="text-xs font-medium px-2 py-0.5 rounded-full w-fit bg-red-50 text-red-700">Suspended</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => setModalUser(u)} title="Edit" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleToggleSuspend(u._id, u.isSuspended)} title={u.isSuspended ? 'Unsuspend' : 'Suspend'}
                                  className={`p-1.5 rounded-lg transition-colors ${u.isSuspended ? 'hover:bg-green-50 text-green-600' : 'hover:bg-orange-50 text-orange-600'}`}>
                                  {u.isSuspended ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                                </button>
                                <button onClick={() => handleDelete(u._id)} disabled={deletingId === u._id} title="Delete"
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-40">
                                  {deletingId === u._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">{users.length} user{users.length !== 1 ? 's' : ''} shown</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalUser !== undefined && (
        <UserModal
          user={modalUser}
          onClose={() => setModalUser(undefined)}
          onSaved={() => loadUsers()}
        />
      )}
    </AuthGuard>
  );
}
