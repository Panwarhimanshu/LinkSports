'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ExternalLink, Pencil, Users } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import {
  Badge, Btn, Card, ConfirmButton, Modal, PageHeader, Pagination, SearchInput, Select, Table, errMsg, fmtDate, fmtMoney,
} from './ui';

type Kind = 'listing' | 'job';

const CONFIG = {
  listing: {
    title: 'Trials & Events', subtitle: 'Every trial, event, tournament, admission and camp posted on LinkSports.',
    statuses: ['draft', 'pending', 'published', 'closed', 'completed', 'cancelled'],
    types: [['', 'All types'], ['trial', 'Trials'], ['event', 'Events'], ['tournament', 'Tournaments'], ['admission', 'Admissions'], ['training_camp', 'Training camps']] as [string, string][],
    typeField: 'type', publicPath: (id: string) => `/listings/${id}`,
    appStatuses: ['applied', 'shortlisted', 'rejected', 'withdrawn'],
  },
  job: {
    title: 'Jobs', subtitle: 'Coaching, fitness, physio and other sports jobs.',
    statuses: ['draft', 'pending', 'published', 'closed'],
    types: [['', 'All categories'], ['coach', 'Coach'], ['pe_teacher', 'PE teacher'], ['fitness_trainer', 'Fitness trainer'], ['sports_physio', 'Physio'], ['nutritionist', 'Nutritionist'], ['manager', 'Manager'], ['admin', 'Admin'], ['other', 'Other']] as [string, string][],
    typeField: 'category', publicPath: (id: string) => `/jobs/${id}`,
    appStatuses: ['applied', 'shortlisted', 'rejected'],
  },
} as const;

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-brand';
const toDateInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function OpportunityAdmin({ kind }: { kind: Kind }) {
  const cfg = CONFIG[kind];
  const params = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [pg, setPg] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ q: '', status: params.get('status') || '', type: '' });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [appsFor, setAppsFor] = useState<any>(null);

  const api = kind === 'listing'
    ? { list: adminAPI.getListings, update: adminAPI.updateListing, remove: adminAPI.deleteListing, review: adminAPI.reviewListing }
    : { list: adminAPI.getJobs, update: adminAPI.updateJob, remove: adminAPI.deleteJob, review: adminAPI.reviewJob };

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const p: Record<string, unknown> = { page, limit: 20 };
      if (filters.q) p.q = filters.q;
      if (filters.status) p.status = filters.status;
      if (filters.type) p.type = filters.type;
      const r = await api.list(p);
      setRows(r.data.data || []);
      const m = r.data.pagination || {};
      setPg({ page: m.page || page, pages: m.pages || 1, total: m.total || 0 });
    } catch (e) { toast.error(errMsg(e, 'Could not load')); } finally { setLoading(false); }
  }, [filters, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(1); }, [load]);

  const setStatus = async (row: any, status: string) => {
    try { await api.update(row._id, { status }); toast.success(`Marked ${status}`); load(pg.page); } catch (e) { toast.error(errMsg(e)); }
  };
  const review = async (row: any, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? window.prompt('Reason for rejection (sent to the organization):') ?? undefined : undefined;
    if (action === 'reject' && reason === undefined) return;
    try { await api.review(row._id, action, reason); toast.success(action === 'approve' ? 'Approved & published' : 'Rejected'); load(pg.page); } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (row: any) => {
    try { const r = await api.remove(row._id); toast.success(`Deleted (${r.data.data?.applicationsRemoved ?? 0} applications removed)`); load(pg.page); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title={cfg.title} subtitle={cfg.subtitle} />
      <Card
        title={`${pg.total} ${kind === 'listing' ? 'listings' : 'jobs'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <SearchInput value={filters.q} onChange={(q) => setFilters((f) => ({ ...f, q }))} placeholder="Search title" />
            <Select label="Status" value={filters.status} onChange={(status) => setFilters((f) => ({ ...f, status }))} options={[['', 'All statuses'], ...cfg.statuses.map((s) => [s, s[0].toUpperCase() + s.slice(1)] as [string, string])]} />
            <Select label="Type" value={filters.type} onChange={(type) => setFilters((f) => ({ ...f, type }))} options={cfg.types} />
          </div>
        }
      >
        <Table head={['Title', 'Organization', kind === 'listing' ? 'Type' : 'Category', 'Status', kind === 'listing' ? 'Starts' : 'Apply by', 'Applicants', '']} loading={loading} empty={!rows.length}>
          {rows.map((r) => (
            <tr key={r._id} className="hover:bg-gray-50 align-top">
              <td className="px-5 py-3 max-w-[260px]">
                <p className="font-medium text-gray-900 truncate">{r.title}</p>
                <p className="text-xs text-gray-400">Posted {fmtDate(r.createdAt)}{kind === 'listing' && r.participantFee ? ` · ${fmtMoney(r.participantFee)}` : ''}</p>
              </td>
              <td className="px-5 py-3 text-gray-600 max-w-[180px] truncate">{r.organizationId?.name || '—'}</td>
              <td className="px-5 py-3 text-gray-600 capitalize whitespace-nowrap">{String(r[cfg.typeField] || '—').replace(/_/g, ' ')}</td>
              <td className="px-5 py-3">
                <select aria-label="Status" value={r.status} onChange={(e) => setStatus(r, e.target.value)}
                  className="h-8 px-2 rounded-lg border border-gray-200 text-xs bg-white capitalize">
                  {cfg.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(kind === 'listing' ? r.startDate : r.applicationDeadline)}</td>
              <td className="px-5 py-3 text-gray-700">{(kind === 'listing' ? r.participantCount : r.applicantCount) ?? 0}</td>
              <td className="px-5 py-3">
                <div className="flex gap-1.5 justify-end whitespace-nowrap">
                  {r.status === 'pending' && (
                    <>
                      <button onClick={() => review(r, 'approve')} className="h-8 px-2.5 rounded-lg bg-green-600 text-white text-xs font-semibold">Approve</button>
                      <button onClick={() => review(r, 'reject')} className="h-8 px-2.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold">Reject</button>
                    </>
                  )}
                  <button onClick={() => setAppsFor(r)} title="Applicants" aria-label="Applicants" className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center"><Users className="w-4 h-4" /></button>
                  <button onClick={() => setEditing(r)} title="Edit" aria-label="Edit" className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                  <Link href={cfg.publicPath(r._id)} target="_blank" aria-label="Open public page" className="h-8 w-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 inline-flex items-center justify-center"><ExternalLink className="w-3.5 h-3.5" /></Link>
                  <ConfirmButton small label="Delete" confirmLabel="Delete" onConfirm={() => remove(r)} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onPage={load} />
      </Card>

      {editing && <EditForm kind={kind} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(pg.page); }} />}
      {appsFor && <Applicants kind={kind} row={appsFor} statuses={[...cfg.appStatuses]} onClose={() => setAppsFor(null)} />}
    </>
  );
}

function EditForm({ kind, row, onClose, onSaved }: { kind: Kind; row: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>(kind === 'listing'
    ? { title: row.title, description: row.description, startDate: toDateInput(row.startDate), registrationDeadline: toDateInput(row.registrationDeadline), participantFee: row.participantFee ?? 0, participantLimit: row.participantLimit ?? '' }
    : { title: row.title, description: row.description, location: row.location, applicationDeadline: toDateInput(row.applicationDeadline), salaryMin: row.salaryMin ?? '', salaryMax: row.salaryMax ?? '' });
  const [busy, setBusy] = useState(false);
  const num = (v: any) => (v === '' || v === null || v === undefined ? undefined : Number(v));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = kind === 'listing'
        ? { title: f.title, description: f.description, startDate: f.startDate || undefined, registrationDeadline: f.registrationDeadline || undefined, participantFee: num(f.participantFee) ?? 0, participantLimit: num(f.participantLimit) }
        : { title: f.title, description: f.description, location: f.location, applicationDeadline: f.applicationDeadline || undefined, salaryMin: num(f.salaryMin), salaryMax: num(f.salaryMax) };
      await (kind === 'listing' ? adminAPI.updateListing(row._id, body) : adminAPI.updateJob(row._id, body));
      toast.success('Saved');
      onSaved();
    } catch (err) { toast.error(errMsg(err, 'Could not save')); } finally { setBusy(false); }
  };

  const field = (key: string, label: string, type = 'text') => (
    <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <input type={type} className={inputCls} value={f[key] ?? ''} onChange={(e) => setF({ ...f, [key]: e.target.value })} /></label>
  );

  return (
    <Modal title={`Edit ${kind === 'listing' ? 'listing' : 'job'}`} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        {field('title', 'Title')}
        <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Description</span>
          <textarea rows={6} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-brand" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="grid sm:grid-cols-2 gap-4">
          {kind === 'listing' ? (
            <>
              {field('startDate', 'Start date', 'date')}
              {field('registrationDeadline', 'Register by', 'date')}
              {field('participantFee', 'Fee (₹, 0 = free)', 'number')}
              {field('participantLimit', 'Spots (empty = unlimited)', 'number')}
            </>
          ) : (
            <>
              {field('location', 'Location')}
              {field('applicationDeadline', 'Apply by', 'date')}
              {field('salaryMin', 'Salary from (₹)', 'number')}
              {field('salaryMax', 'Salary to (₹)', 'number')}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Btn></div>
      </form>
    </Modal>
  );
}

function Applicants({ kind, row, statuses, onClose }: { kind: Kind; row: any; statuses: string[]; onClose: () => void }) {
  const [apps, setApps] = useState<any[] | null>(null);
  const load = useCallback(() => {
    (kind === 'listing' ? adminAPI.getListingApplications(row._id) : adminAPI.getJobApplications(row._id))
      .then((r) => setApps(r.data.data || [])).catch((e) => { toast.error(errMsg(e)); setApps([]); });
  }, [kind, row._id]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (a: any, status: string) => {
    try { await adminAPI.updateApplication(kind, a._id, { status }); toast.success('Updated'); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Modal title={`Applicants · ${row.title}`} onClose={onClose} wide>
      <Table head={['Applicant', 'Phone', 'Applied', 'Status']} loading={apps === null} empty={apps?.length === 0}>
        {(apps || []).map((a) => (
          <tr key={a._id}>
            <td className="px-5 py-3 text-gray-900">{a.applicantId?.email || '—'} {a.applicantProfileType && <Badge value={a.applicantProfileType} />}</td>
            <td className="px-5 py-3 text-gray-600">{a.applicantId?.phone || '—'}</td>
            <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(a.appliedAt)}</td>
            <td className="px-5 py-3">
              <select aria-label="Application status" value={a.status} onChange={(e) => setStatus(a, e.target.value)} className="h-8 px-2 rounded-lg border border-gray-200 text-xs bg-white capitalize">
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </td>
          </tr>
        ))}
      </Table>
    </Modal>
  );
}
