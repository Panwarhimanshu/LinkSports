'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, Download, FileCheck2, Loader2, Search, Trophy, Users } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Stats { totalPlayers: number; completedCvs: number; downloads24h: number; mostActiveSport: { sport: string; players: number } | null; completedThreshold: number }
interface PlayerRow { userId: string | null; fullName: string; phone: string; email: string; sport: string; completion: number; registeredAt: string; profileUrl: string }
interface ActivityRow { event_id: string; user_id: string; user_name: string; sport: string; event_type: string; meta: Record<string, unknown>; timestamp: string }

const EVENT_STYLE: Record<string, string> = {
  USER_LOGIN: 'bg-gray-100 text-gray-700',
  SPORT_SELECTED: 'bg-blue-100 text-blue-700',
  CV_SAVED: 'bg-blue-100 text-blue-700',
  PDF_DOWNLOADED: 'bg-blue-100 text-blue-700',
  STORY_CARD_EXPORTED: 'bg-blue-100 text-blue-700',
};

const POLL_MS = 5000;

export default function CvMonitor() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<ActivityRow[]>([]);
  const newest = useRef<string | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const loadStats = useCallback(async () => {
    try { setStats((await adminAPI.getCvStats()).data.data); } catch { /* keep last value */ }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminAPI.getCvUsers({ q: debouncedQ || undefined, page, limit: 15 })
      .then((r) => { if (alive) { setPlayers(r.data.data); setPages(r.data.pagination?.pages || 1); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [debouncedQ, page]);

  // live feed + KPIs: poll every few seconds, only fetching events newer than the last one seen
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

  const kpis = [
    { label: 'Registered players', value: stats?.totalPlayers, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: `Completed CVs (≥${stats?.completedThreshold ?? 60}%)`, value: stats?.completedCvs, icon: FileCheck2, color: 'text-blue-600 bg-blue-50' },
    { label: 'PDF & Story downloads (24h)', value: stats?.downloads24h, icon: Download, color: 'text-blue-600 bg-blue-50' },
    { label: 'Most active sport', value: stats ? (stats.mostActiveSport ? `${stats.mostActiveSport.sport} (${stats.mostActiveSport.players})` : '—') : undefined, icon: Trophy, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div className="space-y-6">
      {/* A. KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div>
            <div className="text-2xl font-bold mt-3 text-gray-900">{value === undefined ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* B. Directory */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <h2 className="font-semibold text-gray-900">Registered players</h2>
            <div className="relative ml-auto w-full max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email, sport, ID"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>{['User ID', 'Name', 'Contact', 'Sport', 'Complete', 'Registered', ''].map((h) => <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-brand" /></td></tr>
                ) : players.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-gray-500">No players found.</td></tr>
                ) : players.map((p) => (
                  <tr key={p.userId || p.profileUrl} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.userId ? `usr_${String(p.userId).slice(-6)}` : '—'}</td>
                    <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{p.fullName}</td>
                    <td className="px-4 py-2 text-gray-600"><div>{p.phone || '—'}</div><div className="text-xs text-gray-400">{p.email}</div></td>
                    <td className="px-4 py-2">{p.sport || '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full"><div className={`h-1.5 rounded-full ${p.completion >= (stats?.completedThreshold ?? 60) ? 'bg-blue-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, p.completion)}%` }} /></div>
                        <span className="text-xs text-gray-600">{p.completion}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatDate(p.registeredAt)}</td>
                    <td className="px-4 py-2"><Link href={`/athlete/${p.profileUrl}`} target="_blank" className="text-brand font-medium whitespace-nowrap">View CV</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40">Previous</button>
            <span className="text-gray-500">Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40">Next</button>
          </div>
        </div>

        {/* C. Live activity */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col max-h-[640px]">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Live activity</h2>
            <span className="ml-auto flex items-center gap-1 text-xs text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />live</span>
          </div>
          <ul className="overflow-y-auto divide-y divide-gray-100">
            {feed.length === 0 && <li className="p-6 text-center text-sm text-gray-500">No activity yet.</li>}
            {feed.map((e) => (
              <li key={e.event_id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${EVENT_STYLE[e.event_type] || 'bg-gray-100'}`}>{e.event_type}</span>
                  <span className="ml-auto text-xs text-gray-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="mt-1 text-gray-800">{e.user_name || e.user_id}{e.sport ? ` · ${e.sport}` : ''}</div>
                {(e.meta?.format || e.meta?.device) ? <div className="text-xs text-gray-400">{[e.meta.format, e.meta.device].filter(Boolean).join(' · ') as string}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
