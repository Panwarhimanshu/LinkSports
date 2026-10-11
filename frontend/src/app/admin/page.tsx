'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Trophy, Briefcase, IndianRupee, Contact, Download, Clock, Building2, ArrowRight } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { Card, PageHeader, StatCard, fmtMoney } from '@/components/admin/ui';

const EVENT_LABEL: Record<string, string> = {
  USER_SIGNUP: 'signed up', USER_LOGIN: 'logged in', SPORT_SELECTED: 'picked a sport',
  CV_SAVED: 'saved their CV', PDF_DOWNLOADED: 'downloaded their PDF CV', STORY_CARD_EXPORTED: 'saved their Story card',
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

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Key numbers for the website and app." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total users" value={n(d?.users?.total)} icon={Users} />
        <StatCard label="Players" value={n(cv?.totalPlayers)} icon={Contact} tone="green" hint={cv ? `${cv.completedCvs} completed CVs` : undefined} />
        <StatCard label="Live trials & events" value={n(d?.listings?.active)} icon={Trophy} tone="purple" />
        <StatCard label="Live jobs" value={n(d?.jobs?.active)} icon={Briefcase} tone="orange" />
        <StatCard label="CV downloads (24h)" value={n(cv?.downloads24h)} icon={Download} tone="blue" hint="PDF + Story card" />
        <StatCard label="Revenue" value={d ? fmtMoney(d?.revenue?.total) : '…'} icon={IndianRupee} tone="green" />
        <StatCard label="Coaches" value={n(d?.users?.coaches)} icon={Users} tone="gray" />
        <StatCard label="Organizations" value={n(d?.users?.organizations)} icon={Building2} tone="gray" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <Card title="Needs your attention">
          <div className="space-y-3">
            {[
              { label: 'Trials / events awaiting review', value: d?.pendingApprovals?.listings, href: '/admin/listings?status=pending' },
              { label: 'Organizations awaiting verification', value: d?.pendingApprovals?.organizations, href: '/admin/organizations?status=pending' },
              { label: 'Reported reviews', value: undefined, href: '/admin/reviews?reported=true' },
            ].map((x) => (
              <Link key={x.label} href={x.href} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-blue-50 group">
                <span className="flex items-center gap-2 text-sm text-gray-700"><Clock className="w-4 h-4 text-orange-500" />{x.label}</span>
                <span className="flex items-center gap-2">
                  {x.value !== undefined && <span className={`text-sm font-bold ${x.value ? 'text-orange-600' : 'text-gray-400'}`}>{x.value ?? '…'}</span>}
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand" />
                </span>
              </Link>
            ))}
          </div>
          {cv?.mostActiveSport && (
            <p className="text-xs text-gray-500 mt-4">Most popular sport: <b className="text-gray-800">{cv.mostActiveSport.sport}</b> ({cv.mostActiveSport.players} players)</p>
          )}
        </Card>

        <Card title="Latest activity" className="lg:col-span-2" actions={<Link href="/admin/activity" className="text-sm text-brand font-medium">See all</Link>}>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {activity.map((a) => (
                <li key={a.event_id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-700 truncate"><b className="text-gray-900">{a.user_name || 'Someone'}</b> {EVENT_LABEL[a.event_type] || a.event_type.toLowerCase().replace(/_/g, ' ')}{a.sport ? ` · ${a.sport}` : ''}{a.meta?.device ? ` · ${a.meta.device}` : ''}</span>
                  <span className="text-xs text-gray-400 shrink-0">{new Date(a.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
