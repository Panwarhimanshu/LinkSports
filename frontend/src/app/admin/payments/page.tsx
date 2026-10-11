'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { IndianRupee, Plus, TicketPercent } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import {
  Badge, Btn, Card, ConfirmButton, Modal, PageHeader, Pagination, Select, StatCard, Table, errMsg, fmtDate, fmtMoney,
} from '@/components/admin/ui';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-brand';

export default function AdminPaymentsPage() {
  const [revenue, setRevenue] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [pg, setPg] = useState({ page: 1, pages: 1, total: 0 });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  const loadPayments = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const r = await adminAPI.getPayments({ page, limit: 20, ...(status ? { status } : {}) });
      setRows(r.data.data || []);
      const m = r.data.pagination || {};
      setPg({ page: m.page || page, pages: m.pages || 1, total: m.total || 0 });
    } catch (e) { toast.error(errMsg(e, 'Could not load payments')); } finally { setLoading(false); }
  }, [status]);
  const loadCoupons = () => adminAPI.getCoupons().then((r) => setCoupons(r.data.data || [])).catch(() => undefined);

  useEffect(() => { loadPayments(1); }, [loadPayments]);
  useEffect(() => {
    adminAPI.getRevenue().then((r) => setRevenue(r.data.data)).catch(() => undefined);
    loadCoupons();
  }, []);

  const byType = (t: string) => revenue?.byType?.find((x: any) => x._id === t);

  return (
    <>
      <PageHeader title="Payments & Coupons" subtitle="Listing fees and participant fees paid through Razorpay." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total revenue" value={revenue ? fmtMoney(revenue.total) : '…'} icon={IndianRupee} tone="green" />
        <StatCard label="Listing fees" value={revenue ? fmtMoney(byType('listing_fee')?.total) : '…'} hint={revenue ? `${byType('listing_fee')?.count || 0} payments` : undefined} />
        <StatCard label="Participant fees" value={revenue ? fmtMoney(byType('participant_fee')?.total) : '…'} hint={revenue ? `${byType('participant_fee')?.count || 0} payments` : undefined} />
      </div>

      <Card title="Payments" className="mb-6" actions={<Select label="Status" value={status} onChange={setStatus} options={[['', 'All'], ['success', 'Successful'], ['pending', 'Pending'], ['failed', 'Failed']]} />}>
        <Table head={['Date', 'User', 'Type', 'Amount', 'Coupon', 'Status', 'Razorpay ID']} loading={loading} empty={!rows.length}>
          {rows.map((p) => (
            <tr key={p._id}>
              <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
              <td className="px-5 py-3 text-gray-700 max-w-[200px] truncate">{p.userId?.email || '—'}</td>
              <td className="px-5 py-3 text-gray-600 capitalize">{String(p.type || '').replace(/_/g, ' ')}</td>
              <td className="px-5 py-3 font-semibold text-gray-900">{fmtMoney(p.amount)}{p.discountAmount ? <span className="text-xs text-blue-600 font-normal"> (−{fmtMoney(p.discountAmount)})</span> : null}</td>
              <td className="px-5 py-3 text-gray-600">{p.couponCode || '—'}</td>
              <td className="px-5 py-3"><Badge value={p.status} /></td>
              <td className="px-5 py-3 text-xs text-gray-400 font-mono">{p.razorpayPaymentId || p.razorpayOrderId || '—'}</td>
            </tr>
          ))}
        </Table>
        <Pagination page={pg.page} pages={pg.pages} total={pg.total} onPage={loadPayments} />
      </Card>

      <Card title="Coupons" actions={<Btn onClick={() => setCreating(true)}><Plus className="w-4 h-4" />New coupon</Btn>}>
        <Table head={['Code', 'Discount', 'Used', 'Valid until', 'Status', '']} empty={!coupons.length}>
          {coupons.map((c) => (
            <tr key={c._id}>
              <td className="px-5 py-3 font-mono font-semibold text-gray-900 inline-flex items-center gap-2"><TicketPercent className="w-4 h-4 text-brand" />{c.code}</td>
              <td className="px-5 py-3 text-gray-700">{c.discountType === 'percentage' ? `${c.discountValue}%` : fmtMoney(c.discountValue)}</td>
              <td className="px-5 py-3 text-gray-600">{c.usedCount || 0}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
              <td className="px-5 py-3 text-gray-500">{c.validUntil ? fmtDate(c.validUntil) : 'No expiry'}</td>
              <td className="px-5 py-3">{c.isActive ? <Badge value="active" /> : <Badge value="closed" label="off" />}</td>
              <td className="px-5 py-3 text-right">
                <ConfirmButton small tone={c.isActive ? 'red' : 'blue'} label={c.isActive ? 'Turn off' : 'Turn on'} confirmLabel={c.isActive ? 'Turn off' : 'Turn on'}
                  onConfirm={async () => { try { await adminAPI.toggleCoupon(c._id); loadCoupons(); } catch (e) { toast.error(errMsg(e)); } }} />
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {creating && <CouponForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); loadCoupons(); }} />}
    </>
  );
}

function CouponForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ code: '', discountType: 'percentage', discountValue: '', maxUses: '', expiresAt: '' });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminAPI.createCoupon({
        code: f.code.trim(), discountType: f.discountType, discountValue: Number(f.discountValue),
        ...(f.maxUses ? { maxUses: Number(f.maxUses) } : {}), ...(f.expiresAt ? { expiresAt: f.expiresAt } : {}),
      });
      toast.success('Coupon created');
      onSaved();
    } catch (err) { toast.error(errMsg(err, 'Could not create coupon')); } finally { setBusy(false); }
  };
  return (
    <Modal title="New coupon" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <L t="Code (e.g. TRIAL50)"><input required className={`${inputCls} uppercase`} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></L>
        <div className="grid grid-cols-2 gap-3">
          <L t="Discount type">
            <select className={inputCls} value={f.discountType} onChange={(e) => setF({ ...f, discountType: e.target.value })}>
              <option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (₹)</option>
            </select>
          </L>
          <L t={f.discountType === 'percentage' ? 'Percent off' : 'Rupees off'}><input required type="number" min={1} max={f.discountType === 'percentage' ? 100 : undefined} className={inputCls} value={f.discountValue} onChange={(e) => setF({ ...f, discountValue: e.target.value })} /></L>
          <L t="Max uses (optional)"><input type="number" min={1} className={inputCls} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} /></L>
          <L t="Expires on (optional)"><input type="date" className={inputCls} value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></L>
        </div>
        <div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create coupon'}</Btn></div>
      </form>
    </Modal>
  );
}

// defined at module level so inputs keep focus while typing
const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">{t}</span>{children}</label>;
