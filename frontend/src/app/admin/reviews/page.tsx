'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Star } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { Badge, Card, ConfirmButton, PageHeader, Pagination, Select, Table, errMsg, fmtDate } from '@/components/admin/ui';

function ReviewsAdmin() {
  const params = useSearchParams();
  const [reported, setReported] = useState(params.get('reported') === 'true' ? 'true' : '');
  const [rows, setRows] = useState<any[]>([]);
  const [pg, setPg] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const r = await adminAPI.getReviews({ page, limit: 20, ...(reported ? { reported } : {}) });
      setRows(r.data.data || []);
      const m = r.data.pagination || {};
      setPg({ page: m.page || page, pages: m.pages || 1, total: m.total || 0 });
    } catch (e) { toast.error(errMsg(e, 'Could not load reviews')); } finally { setLoading(false); }
  }, [reported]);
  useEffect(() => { load(1); }, [load]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast.success(msg); load(pg.page); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title="Moderation" subtitle="Reviews people leave on profiles. Remove anything abusive, fake or off-topic." />
      <Card title={`${pg.total} reviews`} actions={<Select label="Show" value={reported} onChange={setReported} options={[['', 'All reviews'], ['true', 'Reported only']]} />}>
        <Table head={['Review', 'By', 'About', 'Date', '']} loading={loading} empty={!rows.length}>
          {rows.map((r) => (
            <tr key={r._id} className="hover:bg-gray-50 align-top">
              <td className="px-5 py-3 max-w-[360px]">
                <div className="flex items-center gap-0.5 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < (r.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />)}
                  {r.isReported && <span className="ml-2"><Badge value="reported" /></span>}
                </div>
                <p className="text-gray-700 whitespace-pre-wrap break-words">{r.comment || <span className="text-gray-400">No comment</span>}</p>
                {r.isReported && r.reportReason && <p className="text-xs text-red-600 mt-1">Reported: {r.reportReason}</p>}
              </td>
              <td className="px-5 py-3 text-gray-600 max-w-[180px] truncate">{r.reviewer?.email || '—'}</td>
              <td className="px-5 py-3 text-gray-600 max-w-[180px] truncate">{r.reviewee?.email || '—'}</td>
              <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
              <td className="px-5 py-3">
                <div className="flex gap-1.5 justify-end whitespace-nowrap">
                  {r.isReported && <ConfirmButton small tone="blue" label="Keep" confirmLabel="Dismiss report" onConfirm={() => act(() => adminAPI.dismissReview(r._id), 'Report dismissed')} />}
                  <ConfirmButton small label="Remove" confirmLabel="Remove review" onConfirm={() => act(() => adminAPI.deleteReview(r._id), 'Review removed')} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onPage={load} />
      </Card>
    </>
  );
}

export default function Page() {
  return <Suspense><ReviewsAdmin /></Suspense>;
}
