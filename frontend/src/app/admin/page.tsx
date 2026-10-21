'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Contact, Download, FileCheck2, Trophy } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { Card, PageHeader, StatCard } from '@/components/admin/ui';

// Plain-English wording for each action in the activity log
const ACTION_LABEL: Record<string, string> = {
  USER_SIGNUP: 'signed up',
  SPORT_SELECTED: 'picked a sport',
  CV_UPDATED: 'updated their CV',
  PHOTOS_UPLOADED: 'uploaded photos',
  PDF_DOWNLOADED: 'downloaded their PDF CV',
  STORY_CARD_EXPORTED: 'saved their Story card',
  PROFILE_SHARED: 'shared their profile',
};

export default function AdminDashboard() {
  const [d, setD] = useState<any>(null);
  const [cv, setCv] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    adminAPI.getDashboard().then((r) => setD(r.data.data)).catch(() => undefined);
    adminAPI.getCvStats().then((r) => setCv(r.data.data)).catch(() => undefined);
    adminAPI.getCvActivity({ limit: 10 }).then((r) => setActivity(r.data.data || [])).catch(() => undefined);
  }, []);

  const n = (v: any) => (d || cv ? (v ?? 0).toLocaleString('en-IN') : '…');
  const topSports: { sport: string; players: number }[] = cv?.topSports || [];
  const topMax = Math.max(1, ...topSports.map((s) => s.players));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Key numbers for player CVs." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={n(d?.users?.total)} icon={Users} />
        <StatCard label="Players" value={n(cv?.totalPlayers)} icon={Contact} tone="green" />
        <StatCard label="Completed CVs" value={n(cv?.completedCvs)} icon={FileCheck2} tone="purple" hint={cv ? `${cv.completedThreshold}% or more filled in` : undefined} />
        <StatCard label="PDF & Story downloads" value={cv ? `${(cv.downloads24h ?? 0).toLocaleString('en-IN')} / ${(cv.downloadsAllTime ?? 0).toLocaleString('en-IN')}` : '…'} icon={Download} tone="blue" hint="last 24h / all time" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Top sports">
          {topSports.length === 0 ? (
            <p className="text-sm text-gray-400">No sports chosen yet.</p>
          ) : (
            <ul className="space-y-3">
              {topSports.map((s) => (
                <li key={s.sport} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-gray-800"><Trophy className="h-4 w-4 text-gray-400" />{s.sport}</span>
                    <span className="text-gray-500">{s.players}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${(s.players / topMax) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Latest activity" className="lg:col-span-2" actions={<Link href="/admin/activity" className="text-sm font-medium text-brand">See all</Link>}>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {activity.map((a) => (
                <li key={a.event_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="truncate text-gray-700">
                    <b className="text-gray-900">{a.player_name || 'Someone'}</b> {ACTION_LABEL[a.action] || String(a.action).toLowerCase().replace(/_/g, ' ')}
                    {a.sport ? ` · ${a.sport}` : ''}{a.metadata?.device ? ` · ${a.metadata.device}` : ''}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{new Date(a.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
