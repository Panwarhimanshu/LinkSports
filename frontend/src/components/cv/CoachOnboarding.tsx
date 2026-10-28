'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { eventAPI } from '@/lib/api';
import { apiError } from '@/lib/useCvSession';
import { realName } from '@/lib/cv';
import LocationFields from './LocationFields';
import { AccentTitle, Field, btnPrimary, inputCls } from './ui';

type Save = (patch: Record<string, unknown>) => Promise<Record<string, any>>;

/** Saves the coach's main sport (more can be added in Edit CV) and records it for the activity log. */
export async function pickCoachSport(save: Save, sport: string) {
  try {
    await save({ sportsSpecialization: [sport] });
    void eventAPI.log('SPORT_SELECTED', { sport });
  } catch (err) {
    toast.error(apiError(err, 'Could not save your sport.'));
    throw err;
  }
}

interface Core { fullName: string; city: string; state: string; years: string; organization: string }

// ── Step 2 of 2 for a coach: the basics ───────────────────────────────────────
export function CoachCoreStep({ profile, userId, save }: { profile: Record<string, any> | null; userId?: string; save: Save }) {
  const draftKey = `linksports:coach-draft:${userId || 'me'}`;
  const current = (profile?.experience || []).find((e: any) => e?.current);
  const [form, setForm] = useState<Core>({
    fullName: realName(profile?.fullName), city: profile?.location?.city || '', state: profile?.location?.state || '',
    years: profile?.yearsOfExperience != null ? String(profile.yearsOfExperience) : '', organization: current?.organization || '',
  });
  const [saving, setSaving] = useState(false);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.fullName.trim().length < 2) return toast.error('Enter your full name');
    setSaving(true);
    try {
      const years = form.years.trim() && !isNaN(Number(form.years)) ? Number(form.years) : undefined;
      await save({
        fullName: form.fullName.trim(),
        location: { city: form.city.trim(), state: form.state.trim() },
        yearsOfExperience: years,
        ...(form.organization.trim() ? { experience: [{ organization: form.organization.trim(), role: 'Coach', current: true }] } : {}),
      });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    } catch (err) {
      toast.error(apiError(err, 'Could not save. Check your connection and try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-8 pt-6 md:px-8 md:pt-10">
      <p className="eyebrow">Setup · 2 of 2</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-ink"><AccentTitle>About you</AccentTitle></h1>
      <p className="mt-2 text-ink-soft">Just the basics. Add certifications, experience and the players you have trained later in Edit CV.</p>

      <div className="mt-6 space-y-4">
        <Field label="Full name *"><input className={inputCls} autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
        <LocationFields state={form.state} city={form.city} onChange={(v) => setForm((f) => ({ ...f, ...v }))} />
        <Field label="Years of coaching experience"><input className={inputCls} inputMode="numeric" maxLength={2} value={form.years} onChange={(e) => set('years', e.target.value.replace(/[^0-9]/g, ''))} /></Field>
        <Field label="Current academy / club / school"><input className={inputCls} placeholder="Where you coach now" value={form.organization} onChange={(e) => set('organization', e.target.value)} /></Field>
      </div>

      <div className="mt-auto pt-8">
        <button disabled={saving} className={btnPrimary + ' w-full'}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create my coach CV'}
        </button>
        <p className="mt-3 text-center text-xs text-ink-soft">Your answers are saved on this device as you type.</p>
      </div>
    </form>
  );
}
