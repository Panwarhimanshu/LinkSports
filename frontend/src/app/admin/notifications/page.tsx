'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { Btn, Card, PageHeader, Table, errMsg } from '@/components/admin/ui';

const AUDIENCE: [string, string][] = [['', 'Everyone'], ['athlete', 'Players (athletes)'], ['coach', 'Coaches'], ['professional', 'Professionals'], ['organization', 'Organizations']];
const inputCls = 'w-full px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-brand';

export default function AdminNotificationsPage() {
  const [f, setF] = useState({ title: '', message: '', targetRole: '' });
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);

  const loadHistory = () => adminAPI.getAnnouncements().then((r) => setHistory(r.data.data || [])).catch(() => setHistory([]));
  useEffect(() => { loadHistory(); }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.message.trim()) { toast.error('Add a title and a message'); return; }
    const who = AUDIENCE.find(([v]) => v === f.targetRole)?.[1].toLowerCase();
    if (!window.confirm(`Send this notification to ${who}?`)) return;
    setBusy(true);
    try {
      const r = await adminAPI.sendAnnouncement({ title: f.title.trim(), message: f.message.trim(), ...(f.targetRole ? { targetRole: f.targetRole } : {}) });
      toast.success(`Sent to ${r.data.data?.sent ?? 0} people`);
      setF({ title: '', message: '', targetRole: f.targetRole });
      loadHistory();
    } catch (err) { toast.error(errMsg(err, 'Could not send')); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Notifications" subtitle="Announcements appear in the bell menu on the website and in the app's notifications." />
      <div className="grid lg:grid-cols-5 gap-6">
        <Card title="Send an announcement" className="lg:col-span-2">
          <form onSubmit={send} className="space-y-4">
            <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Send to</span>
              <select className={`${inputCls} h-10`} value={f.targetRole} onChange={(e) => setF({ ...f, targetRole: e.target.value })}>
                {AUDIENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
            <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Title</span>
              <input maxLength={120} className={`${inputCls} h-10`} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. New football trials in Mumbai" /></label>
            <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Message</span>
              <textarea rows={5} maxLength={1000} className={`${inputCls} py-2`} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
            <Btn type="submit" disabled={busy}><Send className="w-4 h-4" />{busy ? 'Sending…' : 'Send notification'}</Btn>
          </form>
        </Card>

        <Card title="Sent announcements" className="lg:col-span-3">
          <Table head={['Sent', 'Announcement', 'Recipients', 'Read']} loading={history === null} empty={history?.length === 0}>
            {(history || []).map((h, i) => (
              <tr key={i} className="align-top">
                <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{new Date(h.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-5 py-3 max-w-[320px]"><p className="font-medium text-gray-900">{h.title}</p><p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{h.message}</p></td>
                <td className="px-5 py-3 text-gray-700">{h.recipients}</td>
                <td className="px-5 py-3 text-gray-700">{h.recipients ? `${Math.round((h.read / h.recipients) * 100)}%` : '—'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
