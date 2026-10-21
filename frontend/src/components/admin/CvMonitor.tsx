'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Activity, Download, FileCheck2, Loader2, Pencil, Search, Trophy, Users, X } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useSports } from '@/components/cv/useSports';

interface Stats {
  totalPlayers: number; completedCvs: number; downloads24h: number; downloadsAllTime: number;
  topSports: { sport: string; players: number }[]; completedThreshold: number;
}
interface PlayerRow {
  userId: string | null; profileId: string; fullName: string; phone: string; email: string; sport: string;
  completion: number; photos: number; registeredAt: string; profileUrl: string;
}
interface ActivityRow {
  event_id: string; user_id: string; player_name: string; sport: string; action: string;
  metadata: Record<string, unknown>; timestamp: string;
}

const ACTION_STYLE: Record<string, string> = {
  USER_SIGNUP: 'bg-green-100 text-green-700',
  SPORT_SELECTED: 'bg-blue-100 text-blue-700',
  CV_UPDATED: 'bg-blue-100 text-blue-700',
  PHOTOS_UPLOADED: 'bg-purple-100 text-purple-700',
  PDF_DOWNLOADED: 'bg-orange-100 text-orange-700',
  STORY_CARD_EXPORTED: 'bg-orange-100 text-orange-700',
  PROFILE_SHARED: 'bg-gray-100 text-gray-700',
};

const POLL_MS = 5000;

export default function CvMonitor() {
  const sports = useSports();
  const [stats, setStats] = useState<Stats | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sport, setSport] = useState('');
  const [completion, setCompletion] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<PlayerRow | null>(null);
  const [reload, setReload] = useState(0);
  const [feed, setFeed] = useState<ActivityRow[]>([]);
  const newest = useRef<string | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const filters = { q: debouncedQ || undefined, sport: sport || undefined, completion: completion || undefined };

  const loadStats = useCallback(async () => {
    try { setStats((await adminAPI.getCvStats()).data.data); } catch { /* keep last value */ }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminAPI.getCvUsers({ ...filters, page, limit: 15 })
      .then((r) => { if (alive) { setPlayers(r.data.data); setPages(r.data.pagination?.pages || 1); setTotal(r.data.pagination?.total || 0); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, sport, completion, page, reload]);

  // live stream + KPIs: poll every few seconds, only fetching events newer than the last one seen
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await adminAPI.getCvActivity({ limit: 50, after: newest.current });
        const fresh: ActivityRow[] = res.data.data;
        if (!alive || fresh.length === 0) return;
        newest.current = fresh[0].timestamp;
        setFeed((prev) => [...fresh, ...prev].slice(0, 100));
        loadStats();
      } catch { /* transient */ }
    };
    loadStats();
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [loadStats]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await adminAPI.exportCvUsers(filters);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'linksports-players.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error('Could not export the list');
    } finally {
      setExporting(false);
    }
  };

  const topMax = Math.max(1, ...(stats?.topSports || []).map((s) => s.players));

  return (
    <div className="space-y-6">
      {/* A. KPI ribbon */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Users} label="Registered players" value={stats?.totalPlayers} />
        <Kpi icon={FileCheck2} label={`Completed CVs (≥${stats?.completedThreshold ?? 60}%)`} value={stats?.completedCvs} />
        <Kpi icon={Download} label="PDF & Story downloads" value={stats ? `${stats.downloads24h} / ${stats.downloadsAllTime}` : undefined} note="24h / all-time" />
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-500"><Trophy className="h-4 w-4" /><span className="text-xs">Top sports</span></div>
          {!stats ? <Loader2 className="mt-3 h-5 w-5 animate-spin text-gray-400" /> : stats.topSports.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No sports chosen yet</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {stats.topSports.map((s) => (
                <li key={s.sport} className="text-xs">
                  <div className="flex justify-between"><span className="truncate font-medium text-gray-800">{s.sport}</span><span className="text-gray-500">{s.players}</span></div>
                  <div className="mt-0.5 h-1 rounded-full bg-gray-100"><div className="h-1 rounded-full bg-brand" style={{ width: `${(s.players / topMax) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* B. Directory */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-2">
          <div className="space-y-3 border-b border-gray-100 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold text-gray-900">Registered players <span className="font-normal text-gray-400">({total})</span></h2>
              <button onClick={exportCsv} disabled={exporting} className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Export CSV
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email, sport, ID"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <select value={sport} onChange={(e) => { setSport(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">All sports</option>
                {sports.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={completion} onChange={(e) => { setCompletion(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Any completion</option>
                <option value="completed">Completed CVs</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>{['User ID', 'Name', 'Contact', 'Sport', 'Complete', 'Photos', 'Created', ''].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="inline h-6 w-6 animate-spin text-brand" /></td></tr>
                ) : players.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-gray-500">No players match.</td></tr>
                ) : players.map((p) => (
                  <tr key={p.profileId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.userId ? `usr_${String(p.userId).slice(-6)}` : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">{p.fullName}</td>
                    <td className="px-4 py-2 text-gray-600"><div>{p.phone || '—'}</div><div className="text-xs text-gray-400">{p.email}</div></td>
                    <td className="px-4 py-2">{p.sport || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 rounded-full bg-gray-200"><div className={`h-1.5 rounded-full ${p.completion >= (stats?.completedThreshold ?? 60) ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, p.completion)}%` }} /></div>
                        <span className="text-xs text-gray-600">{p.completion}%</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">{p.photos}/4</td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{formatDate(p.registeredAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Link href={`/cv/${p.profileUrl}`} target="_blank" className="font-medium text-brand">View</Link>
                      <button onClick={() => setEditing(p)} className="ml-3 inline-flex items-center gap-1 font-medium text-gray-700 hover:text-brand"><Pencil className="h-3.5 w-3.5" />Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 p-3 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <span className="text-gray-500">Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>

        {/* C. Live activity stream */}
        <div className="flex max-h-[640px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 border-b border-gray-100 p-4">
            <Activity className="h-4 w-4 text-green-600" />
            <h2 className="font-semibold text-gray-900">Live activity</h2>
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600"><span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />live</span>
          </div>
          <ul className="divide-y divide-gray-100 overflow-y-auto">
            {feed.length === 0 && <li className="p-6 text-center text-sm text-gray-500">No activity yet.</li>}
            {feed.map((e) => (
              <li key={e.event_id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium ${ACTION_STYLE[e.action] || 'bg-gray-100'}`}>{e.action}</span>
                  <span className="ml-auto text-xs text-gray-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="mt-1 text-gray-800">{e.player_name || e.user_id}{e.sport ? ` · ${e.sport}` : ''}</div>
                <div className="text-xs text-gray-400">
                  {[e.metadata?.format, e.metadata?.photos_count != null ? `${e.metadata.photos_count} photos` : '', e.metadata?.completion, e.metadata?.device]
                    .filter(Boolean).join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {editing && <EditPlayer player={editing} sports={sports} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setReload((n) => n + 1); }} />}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value?: number | string; note?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-gray-500"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div>
      <div className="mt-3 text-2xl font-bold text-gray-900">{value === undefined ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : value}</div>
      {note && <div className="mt-0.5 text-[11px] text-gray-400">{note}</div>}
    </div>
  );
}

/** Lets an admin fix the core details of a player's CV (typos, wrong sport, missing city). */
function EditPlayer({ player, sports, onClose, onSaved }: { player: PlayerRow; sports: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ fullName: player.fullName, primarySport: player.sport, phone: player.phone, position: '', city: '', tagline: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // only send fields the admin actually filled in, so blanks never wipe existing data
      const body = Object.fromEntries(Object.entries(f).filter(([k, v]) => v.trim() || k === 'fullName'));
      await adminAPI.updateCvUser(player.profileId, body);
      toast.success('Player updated');
      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Could not update the player');
      setBusy(false);
    }
  };

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit {player.fullName}</h3>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <label className="block text-sm"><span className="mb-1 block text-gray-600">Full name</span><input className={input} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} required /></label>
        <label className="block text-sm"><span className="mb-1 block text-gray-600">Sport</span>
          <select className={input} value={f.primarySport} onChange={(e) => set('primarySport', e.target.value)}>
            <option value="">—</option>
            {(sports.includes(player.sport) || !player.sport ? sports : [player.sport, ...sports]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block text-sm"><span className="mb-1 block text-gray-600">Phone</span><input className={input} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm"><span className="mb-1 block text-gray-600">Position (optional)</span><input className={input} value={f.position} onChange={(e) => set('position', e.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1 block text-gray-600">City (optional)</span><input className={input} value={f.city} onChange={(e) => set('city', e.target.value)} /></label>
        </div>
        <label className="block text-sm"><span className="mb-1 block text-gray-600">Tagline (optional)</span><input className={input} maxLength={160} value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></label>
        <p className="text-xs text-gray-400">Blank optional fields are left unchanged.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button disabled={busy} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Save
          </button>
        </div>
      </form>
    </div>
  );
}
