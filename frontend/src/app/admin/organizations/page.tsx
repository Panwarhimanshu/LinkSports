'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { Badge, Card, PageHeader, Pagination, SearchInput, Select, Table, errMsg, fmtDate } from '@/components/admin/ui';

const STATUS: [string, string][] = [['', 'All'], ['pending', 'Awaiting verification'], ['verified', 'Verified'], ['rejected', 'Rejected']];

function OrganizationsAdmin() {
  const params = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [pg, setPg] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ q: '', status: params.get('status') || '' });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const p: Record<string, unknown> = { page, limit: 20 };
      if (filters.q) p.q = filters.q;
      if (filters.status) p.status = filters.status;
      const r = await adminAPI.getOrganizations(p);
      setRows(r.data.data || []);
      const m = r.data.pagination || {};
      setPg({ page: m.page || page, pages: m.pages || 1, total: m.total || 0 });
    } catch (e) { toast.error(errMsg(e, 'Could not load organizations')); } finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { load(1); }, [load]);

  const verify = async (org: any, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? window.prompt('Reason (sent to the organization):') ?? undefined : undefined;
    if (action === 'reject' && reason === undefined) return;
    try { await adminAPI.verifyOrganization(org._id, action, reason); toast.success(action === 'approve' ? 'Verified' : 'Rejected'); load(pg.page); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title="Organizations" subtitle="Academies, clubs and schools. Verified organizations can post trials and jobs." />
      <Card
        title={`${pg.total} organizations`}
        actions={
          <div className="flex flex-wrap gap-2">
            <SearchInput value={filters.q} onChange={(q) => setFilters((f) => ({ ...f, q }))} placeholder="Search name" />
            <Select label="Verification" value={filters.status} onChange={(status) => setFilters((f) => ({ ...f, status }))} options={STATUS} />
          </div>
        }
      >
        <Table head={['Organization', 'Type', 'Location', 'Account', 'Verification', 'Joined', '']} loading={loading} empty={!rows.length}>
          {rows.map((o) => (
            <tr key={o._id} className="hover:bg-gray-50">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  {o.logo ? <img src={o.logo} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100" /> : <div className="w-9 h-9 rounded-lg bg-blue-50 text-brand font-bold flex items-center justify-center">{o.name?.[0] || '?'}</div>}
                  <span className="font-medium text-gray-900 inline-flex items-center gap-1">{o.name}{o.isVerified && <BadgeCheck className="w-4 h-4 text-brand" />}</span>
                </div>
              </td>
              <td className="px-5 py-3 text-gray-600 capitalize">{String(o.type || '—').replace(/_/g, ' ')}</td>
              <td className="px-5 py-3 text-gray-600">{[o.city, o.state].filter(Boolean).join(', ') || '—'}</td>
              <td className="px-5 py-3 text-gray-600 max-w-[200px] truncate">{o.userId?.email || '—'} {o.userId?.isSuspended && <Badge value="suspended" />}</td>
              <td className="px-5 py-3"><Badge value={o.verificationStatus || 'pending'} /></td>
              <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(o.createdAt)}</td>
              <td className="px-5 py-3">
                <div className="flex gap-1.5 justify-end whitespace-nowrap">
                  {o.verificationStatus !== 'verified' && <button onClick={() => verify(o, 'approve')} className="h-8 px-2.5 rounded-lg bg-green-600 text-white text-xs font-semibold">Verify</button>}
                  {o.verificationStatus !== 'rejected' && <button onClick={() => verify(o, 'reject')} className="h-8 px-2.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold">{o.verificationStatus === 'verified' ? 'Revoke' : 'Reject'}</button>}
                  {o.profileUrl && <Link href={`/org/${o.profileUrl}`} target="_blank" aria-label="Open public page" className="h-8 w-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 inline-flex items-center justify-center"><ExternalLink className="w-3.5 h-3.5" /></Link>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onPage={load} />
      </Card>
      <p className="text-xs text-gray-400 mt-3">To edit an organization&apos;s details, open its account under Users → View.</p>
    </>
  );
}

export default function Page() {
  return <Suspense><OrganizationsAdmin /></Suspense>;
}
