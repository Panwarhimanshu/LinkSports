'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Eye, Pencil, Plus, ExternalLink } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import {
  Badge, Btn, Card, ConfirmButton, Modal, PageHeader, Pagination, SearchInput, Select, Table, errMsg, fmtDate,
} from '@/components/admin/ui';

const ROLES: [string, string][] = [['', 'All roles'], ['athlete', 'Athletes'], ['coach', 'Coaches'], ['professional', 'Professionals'], ['organization', 'Organizations'], ['admin', 'Admins']];
const STATUS: [string, string][] = [['', 'Any status'], ['false', 'Active'], ['true', 'Suspended']];
const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-brand';

export default function AdminUsersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [pg, setPg] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ q: '', role: '', suspended: '' });
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null); // user object, or {} for "create"

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (filters.q) params.q = filters.q;
      if (filters.role) params.role = filters.role;
      if (filters.suspended) params.suspended = filters.suspended;
      const r = await adminAPI.getUsers(params);
      setRows(r.data.data || []);
      const p = r.data.pagination || {};
      setPg({ page: p.page || page, pages: p.pages || 1, total: p.total || 0 });
    } catch (e) { toast.error(errMsg(e, 'Could not load users')); } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(1); }, [load]);

  const toggleSuspend = async (u: any) => {
    try { await adminAPI.suspendUser(u._id); toast.success(u.isSuspended ? 'User reactivated' : 'User suspended'); load(pg.page); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (u: any) => {
    try { await adminAPI.deleteUser(u._id); toast.success('User deleted'); load(pg.page); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Players, coaches, organizations and admins."
        actions={<Btn onClick={() => setEditing({})}><Plus className="w-4 h-4" />Add user</Btn>} />
      <Card
        title={`${pg.total} users`}
        actions={
          <div className="flex flex-wrap gap-2">
            <SearchInput value={filters.q} onChange={(q) => setFilters((f) => ({ ...f, q }))} placeholder="Search email or phone" />
            <Select label="Role" value={filters.role} onChange={(role) => setFilters((f) => ({ ...f, role }))} options={ROLES} />
            <Select label="Status" value={filters.suspended} onChange={(suspended) => setFilters((f) => ({ ...f, suspended }))} options={STATUS} />
          </div>
        }
      >
        <Table head={['Email', 'Role', 'Phone', 'Status', 'Joined', 'Last login', '']} loading={loading} empty={!rows.length}>
          {rows.map((u) => (
            <tr key={u._id} className="hover:bg-gray-50">
              <td className="px-5 py-3 font-medium text-gray-900 max-w-[240px] truncate">{u.email}</td>
              <td className="px-5 py-3"><Badge value={u.role} /></td>
              <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{u.phone || '—'}</td>
              <td className="px-5 py-3 whitespace-nowrap">
                {u.isSuspended ? <Badge value="suspended" /> : <Badge value="active" />}{' '}
                {!u.isVerified && <Badge value="pending" label="unverified" />}
              </td>
              <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
              <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(u.lastLoginAt)}</td>
              <td className="px-5 py-3">
                <div className="flex gap-1.5 justify-end whitespace-nowrap">
                  <button onClick={() => setViewId(u._id)} title="View details" aria-label="View details" className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => setEditing(u)} title="Edit account" aria-label="Edit account" className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                  <ConfirmButton small tone={u.isSuspended ? 'blue' : 'red'} label={u.isSuspended ? 'Unsuspend' : 'Suspend'} confirmLabel={u.isSuspended ? 'Unsuspend' : 'Suspend'} onConfirm={() => toggleSuspend(u)} />
                  <ConfirmButton small label="Delete" confirmLabel="Delete forever" onConfirm={() => remove(u)} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onPage={load} />
      </Card>

      {viewId && <UserDetail id={viewId} onClose={() => setViewId(null)} />}
      {editing && <UserForm user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(pg.page); }} />}
    </>
  );
}

// ── create / edit account ────────────────────────────────────────────────────
function UserForm({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const isNew = !user._id;
  const [f, setF] = useState({ email: user.email || '', role: user.role || 'athlete', phone: user.phone || '', isVerified: user.isVerified ?? true, password: '' });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isNew) {
        if (!f.email || f.password.length < 8) { toast.error('Email and a password of at least 8 characters are required'); return; }
        await adminAPI.createUser({ email: f.email, password: f.password, role: f.role, phone: f.phone || undefined });
      } else {
        await adminAPI.updateUser(user._id, { role: f.role, phone: f.phone, isVerified: f.isVerified, ...(f.password ? { password: f.password } : {}) });
      }
      toast.success(isNew ? 'User created' : 'User updated');
      onSaved();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title={isNew ? 'Add user' : `Edit ${user.email}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {isNew && <Field label="Email"><input type="email" required className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>}
        <Field label="Role">
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {ROLES.slice(1).map(([v, l]) => <option key={v} value={v}>{l.replace(/s$/, '')}</option>)}
          </select>
        </Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        {!isNew && (
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.isVerified} onChange={(e) => setF({ ...f, isVerified: e.target.checked })} />Email verified</label>
        )}
        <Field label={isNew ? 'Password (min 8 characters)' : 'New password (leave empty to keep)'}>
          <input type="password" autoComplete="new-password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ── user detail + profile editor ─────────────────────────────────────────────
function UserDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminAPI.getUser(id).then((r) => {
      setData(r.data.data);
      const p = r.data.data.profile || {};
      setForm({
        name: p.fullName ?? p.name ?? '', primarySport: p.primarySport ?? '', position: p.position ?? '', tagline: p.tagline ?? '',
        city: p.location?.city ?? p.city ?? '', state: p.location?.state ?? p.state ?? '', visibility: p.visibility ?? 'public',
        verificationStatus: p.verificationStatus ?? '',
      });
    }).catch((e) => { toast.error(errMsg(e, 'Could not load user')); onClose(); });
  }, [id, onClose]);

  if (!data) return <Modal title="Loading…" onClose={onClose}><p className="text-sm text-gray-500">Loading user…</p></Modal>;
  const { user, profile, counts } = data;
  const kind = user.role === 'organization' ? 'organization' : user.role === 'athlete' ? 'athlete' : user.role === 'coach' || user.role === 'professional' ? 'coach' : null;
  const publicUrl = profile?.profileUrl ? (kind === 'organization' ? `/org/${profile.profileUrl}` : kind === 'coach' ? `/coach/${profile.profileUrl}` : `/athlete/${profile.profileUrl}`) : null;

  const saveProfile = async () => {
    if (!kind || !profile?._id) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = kind === 'organization'
        ? { name: form.name, city: form.city, state: form.state, ...(form.verificationStatus ? { verificationStatus: form.verificationStatus, isVerified: form.verificationStatus === 'verified' } : {}) }
        : { fullName: form.name, tagline: form.tagline, visibility: form.visibility, location: { ...(profile.location || {}), city: form.city, state: form.state }, ...(kind === 'athlete' ? { primarySport: form.primarySport, position: form.position } : {}) };
      await adminAPI.updateProfile(kind, profile._id, body);
      toast.success('Profile saved');
    } catch (e) { toast.error(errMsg(e, 'Could not save profile')); } finally { setBusy(false); }
  };

  return (
    <Modal title={user.email} onClose={onClose} wide>
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        {[['Trial applications', counts.listingApplications], ['Job applications', counts.jobApplications], ['Listings posted', counts.listingsCreated], ['Jobs posted', counts.jobsCreated]].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>
        ))}
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-6">
        <Info k="Role"><Badge value={user.role} /></Info>
        <Info k="Status">{user.isSuspended ? <Badge value="suspended" /> : <Badge value="active" />}</Info>
        <Info k="Phone">{user.phone || '—'}</Info>
        <Info k="Signed up with">{user.authProvider || 'email'}</Info>
        <Info k="Joined">{fmtDate(user.createdAt)}</Info>
        <Info k="Last login">{fmtDate(user.lastLoginAt)}</Info>
        {profile && <Info k="Profile completion">{profile.profileCompletion ?? '—'}%</Info>}
        {publicUrl && <Info k="Public profile"><Link href={publicUrl} target="_blank" className="text-brand inline-flex items-center gap-1">Open <ExternalLink className="w-3.5 h-3.5" /></Link></Info>}
      </dl>

      {kind && profile ? (
        <div className="border-t border-gray-100 pt-5">
          <h3 className="font-semibold text-gray-900 mb-3">Edit {kind} profile</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={kind === 'organization' ? 'Organization name' : 'Full name'}><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            {kind === 'athlete' && <Field label="Primary sport"><input className={inputCls} value={form.primarySport} onChange={(e) => setForm({ ...form, primarySport: e.target.value })} /></Field>}
            {kind === 'athlete' && <Field label="Position"><input className={inputCls} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>}
            {kind !== 'organization' && <Field label="Tagline"><input className={inputCls} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></Field>}
            <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="State"><input className={inputCls} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
            {kind !== 'organization' ? (
              <Field label="Visibility">
                <select className={inputCls} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                  <option value="public">Public</option><option value="connections">Connections only</option><option value="private">Private (hidden)</option>
                </select>
              </Field>
            ) : (
              <Field label="Verification">
                <select className={inputCls} value={form.verificationStatus} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })}>
                  <option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
                </select>
              </Field>
            )}
          </div>
          <div className="flex justify-end mt-4"><Btn onClick={saveProfile} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Btn></div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 border-t border-gray-100 pt-5">This account has no profile.</p>
      )}
    </Modal>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>{children}</label>
);
const Info = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-3 py-1 border-b border-gray-50"><dt className="text-gray-500">{k}</dt><dd className="text-gray-900 text-right">{children}</dd></div>
);
