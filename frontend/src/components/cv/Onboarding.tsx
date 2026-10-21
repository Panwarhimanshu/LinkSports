'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Search } from 'lucide-react';
import { eventAPI } from '@/lib/api';
import { apiError } from '@/lib/useCvSession';
import { realName } from '@/lib/cv';
import SportIcon from './SportIcon';
import { useSports } from './useSports';
import { AccentTitle, Field, btnPrimary, inputCls } from './ui';

type Save = (patch: Record<string, unknown>) => Promise<Record<string, any>>;

// ── Step 1 of 2: pick a sport ─────────────────────────────────────────────────
export function SportStep({ onPick }: { onPick: (sport: string) => Promise<void> }) {
  const sports = useSports();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const list = useMemo(() => sports.filter((s) => s.toLowerCase().includes(q.trim().toLowerCase())), [q, sports]);

  const pick = async (sport: string) => {
    setBusy(sport);
    try { await onPick(sport); } finally { setBusy(null); }
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-6 md:px-8 md:pt-10">
      <p className="eyebrow">Setup · 1 of 2</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-ink"><AccentTitle>What do you play?</AccentTitle></h1>
      <p className="mt-2 text-ink-soft">Pick your main sport. You can change it later in Edit CV.</p>

      <div className="relative mt-6">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <input className={inputCls + ' pl-11'} placeholder="Search sport" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {list.map((name, i) => (
          <button
            key={name}
            disabled={busy !== null}
            onClick={() => pick(name)}
            className="group relative min-h-[104px] rounded-2xl border border-line bg-white p-4 text-left transition hover:border-brand active:scale-[0.98] disabled:opacity-60"
          >
            <span className="block font-mono text-[11px] font-bold tracking-[0.2em] text-ink/35">{String(i + 1).padStart(2, '0')}</span>
            {busy === name
              ? <Loader2 className="absolute right-4 top-4 h-7 w-7 animate-spin text-brand" />
              : <SportIcon name={name} className="absolute right-4 top-4 h-8 w-8 text-ink/30 transition group-hover:text-brand" />}
            <span className="mt-4 block pr-10 font-display text-xl font-semibold leading-tight text-ink">{name}</span>
          </button>
        ))}
        {list.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-line py-10 text-center text-ink-soft">No match. Choose &quot;Other&quot;.</p>
        )}
      </div>
    </div>
  );
}

// ── Step 2 of 2: core details ─────────────────────────────────────────────────
interface Core { fullName: string; dob: string; city: string; state: string; position: string }

export function CoreStep({ profile, userId, save, onDone }: {
  profile: Record<string, any> | null; userId?: string; save: Save; onDone: () => void;
}) {
  const draftKey = `linksports:core-draft:${userId || 'me'}`;
  const [form, setForm] = useState<Core>({
    fullName: realName(profile?.fullName), dob: profile?.dob ? String(profile.dob).slice(0, 10) : '',
    city: profile?.location?.city || '', state: profile?.location?.state || '', position: profile?.position || '',
  });
  const [saving, setSaving] = useState(false);

  // Auto-save: pick up an unfinished draft on load, and keep it updated as the player types.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) setForm((f) => ({ ...f, ...JSON.parse(raw) }));
    } catch { /* ignore a corrupt draft */ }
  }, [draftKey]);
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch { /* storage unavailable */ }
  }, [form, draftKey]);

  const set = (k: keyof Core, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const today = new Date().toISOString().slice(0, 10);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.fullName.trim().length < 2) return toast.error('Enter your full name');
    setSaving(true);
    try {
      await save({
        fullName: form.fullName.trim(),
        dob: form.dob || undefined,
        location: { city: form.city.trim(), state: form.state.trim() },
        position: form.position.trim() || undefined,
      });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      onDone();
    } catch (err) {
      toast.error(apiError(err, 'Could not save. Check your connection and try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-8 pt-6 md:px-8 md:pt-10">
      <p className="eyebrow">Setup · 2 of 2</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-ink"><AccentTitle>Your core details</AccentTitle></h1>
      <p className="mt-2 text-ink-soft">Just the basics. Add medals, photos and stats later in Edit CV.</p>

      <div className="mt-6 space-y-4">
        <Field label="Full name *"><input className={inputCls} autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
        <Field label="Date of birth"><input type="date" max={today} className={inputCls} value={form.dob} onChange={(e) => set('dob', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="State"><input className={inputCls} value={form.state} onChange={(e) => set('state', e.target.value)} /></Field>
        </div>
        <Field label="Playing position"><input className={inputCls} placeholder="e.g. Striker, Opening batter" value={form.position} onChange={(e) => set('position', e.target.value)} /></Field>
      </div>

      <div className="mt-auto pt-8">
        <button disabled={saving} className={btnPrimary + ' w-full'}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create my CV'}
        </button>
        <p className="mt-3 text-center text-xs text-ink-soft">Your answers are saved on this device as you type.</p>
      </div>
    </form>
  );
}

/** Saves the sport choice and records it for the activity log. */
export async function pickSport(save: Save, sport: string) {
  try {
    await save({ primarySport: sport });
    void eventAPI.log('SPORT_SELECTED', { sport });
  } catch (err) {
    toast.error(apiError(err, 'Could not save your sport.'));
    throw err;
  }
}
