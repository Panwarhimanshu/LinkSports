'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, X } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { Btn, Card, PageHeader, errMsg } from '@/components/admin/ui';
import { SPORTS } from '@/components/cv/sports';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-brand';

type Settings = {
  banner: { active: boolean; text: string; link: string; tone: 'info' | 'success' | 'warning' };
  maintenance: { active: boolean; message: string };
  signupsOpen: boolean;
  supportEmail: string;
  sports: string[];
};

export default function AdminSettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [newSport, setNewSport] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminAPI.getSettings().then((r) => {
      const d = r.data.data || {};
      setS({
        banner: { active: !!d.banner?.active, text: d.banner?.text || '', link: d.banner?.link || '', tone: d.banner?.tone || 'info' },
        maintenance: { active: !!d.maintenance?.active, message: d.maintenance?.message || '' },
        signupsOpen: d.signupsOpen !== false,
        supportEmail: d.supportEmail || '',
        sports: d.sports?.length ? d.sports : SPORTS.map((x) => x.name),
      });
    }).catch((e) => toast.error(errMsg(e, 'Could not load settings')));
  }, []);

  if (!s) return <p className="text-sm text-gray-500">Loading settings…</p>;

  const save = async () => {
    setBusy(true);
    try { await adminAPI.updateSettings(s); toast.success('Settings saved — live on the website and app within a minute'); }
    catch (e) { toast.error(errMsg(e, 'Could not save')); } finally { setBusy(false); }
  };
  const addSport = () => {
    const v = newSport.trim();
    if (v && !s.sports.some((x) => x.toLowerCase() === v.toLowerCase())) setS({ ...s, sports: [...s.sports, v] });
    setNewSport('');
  };
  const toneCls = { info: 'bg-blue-600', success: 'bg-green-600', warning: 'bg-amber-500' }[s.banner.tone];

  return (
    <>
      <PageHeader title="Site & App Settings" subtitle="Change what visitors see without a code update."
        actions={<Btn onClick={save} disabled={busy}><Save className="w-4 h-4" />{busy ? 'Saving…' : 'Save all'}</Btn>} />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Announcement banner">
          <Toggle checked={s.banner.active} onChange={(v) => setS({ ...s, banner: { ...s.banner, active: v } })} label="Show a banner at the top of every page" />
          <div className="space-y-3 mt-4">
            <input className={inputCls} maxLength={300} placeholder="e.g. Football trials in Delhi — register by 30 Oct" value={s.banner.text} onChange={(e) => setS({ ...s, banner: { ...s.banner, text: e.target.value } })} />
            <input className={inputCls} placeholder="Link (optional), e.g. /listings" value={s.banner.link} onChange={(e) => setS({ ...s, banner: { ...s.banner, link: e.target.value } })} />
            <select className={inputCls} value={s.banner.tone} onChange={(e) => setS({ ...s, banner: { ...s.banner, tone: e.target.value as Settings['banner']['tone'] } })}>
              <option value="info">Blue (information)</option><option value="success">Green (good news)</option><option value="warning">Amber (important)</option>
            </select>
            {s.banner.text && <div className={`${toneCls} text-white text-sm text-center rounded-lg px-4 py-2`}>{s.banner.text}</div>}
          </div>
        </Card>

        <Card title="Maintenance notice">
          <Toggle checked={s.maintenance.active} onChange={(v) => setS({ ...s, maintenance: { ...s.maintenance, active: v } })} label="Tell visitors some features may be unavailable" />
          <textarea rows={3} maxLength={500} className={`${inputCls} h-auto py-2 mt-4`} value={s.maintenance.message} onChange={(e) => setS({ ...s, maintenance: { ...s.maintenance, message: e.target.value } })} />
          <p className="text-xs text-gray-400 mt-2">Shown as a notice; the site keeps working. Use it during updates or outages.</p>
        </Card>

        <Card title="Accounts & contact">
          <Toggle checked={s.signupsOpen} onChange={(v) => setS({ ...s, signupsOpen: v })} label="Allow new sign-ups" />
          <label className="block mt-4"><span className="block text-xs font-medium text-gray-600 mb-1">Support email shown to users</span>
            <input type="email" className={inputCls} value={s.supportEmail} onChange={(e) => setS({ ...s, supportEmail: e.target.value })} /></label>
        </Card>

        <Card title={`Sports list (${s.sports.length})`}>
          <div className="flex flex-wrap gap-2">
            {s.sports.map((sp) => (
              <span key={sp} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-blue-50 text-blue-700 text-sm">
                {sp}<button aria-label={`Remove ${sp}`} onClick={() => setS({ ...s, sports: s.sports.filter((x) => x !== sp) })} className="w-5 h-5 rounded-full hover:bg-blue-100 flex items-center justify-center"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <input className={inputCls} placeholder="Add a sport" value={newSport} onChange={(e) => setNewSport(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSport(); } }} />
            <Btn variant="outline" onClick={addSport}>Add</Btn>
          </div>
          <p className="text-xs text-gray-400 mt-2">Used by the sport picker in the CV creator (website). New sports get a generic icon.</p>
        </Card>
      </div>
    </>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-brand' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}
