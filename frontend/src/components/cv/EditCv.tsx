'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Activity, BarChart3, Camera, CheckCircle2, ChevronRight, Eye, FileDown, Images, Loader2, Medal, Phone,
  Plus, PlusSquare, RefreshCw, Shield, Trash2, Trophy, Video, X,
} from 'lucide-react';
import { eventAPI, profileAPI, uploadAPI } from '@/lib/api';
import { MAX_ACTION_PHOTOS, ageFromDob, compressImage, photosOf, realName, videosOf } from '@/lib/cv';
import { getPhotoUrl } from '@/lib/utils';
import { apiError } from '@/lib/useCvSession';
import { useSports } from './useSports';
import { AccentTitle, Field, btnGhost, btnPrimary, inputCls, textareaCls } from './ui';

type Profile = Record<string, any>;
type Save = (patch: Record<string, unknown>) => Promise<Profile>;
type Row = Record<string, string>;
type SectionId = 'basic' | 'sport' | 'teams' | 'achievements' | 'stats' | 'photos' | 'videos' | 'custom';

const CORE: { id: SectionId; label: string; icon: typeof Phone }[] = [
  { id: 'basic', label: 'Basic & Contact Info', icon: Phone },
  { id: 'sport', label: 'Sport & Position', icon: Activity },
  { id: 'teams', label: 'Teams, Clubs & Academy', icon: Shield },
  { id: 'achievements', label: 'Tournaments & Achievements', icon: Trophy },
];
const OPTIONAL: { id: SectionId; label: string; icon: typeof Phone }[] = [
  { id: 'stats', label: 'Career Stats & Performance', icon: BarChart3 },
  { id: 'photos', label: 'Add Action Photos', icon: Images },
  { id: 'videos', label: 'Highlight Video Links', icon: Video },
  { id: 'custom', label: 'Add Custom Section', icon: PlusSquare },
];

const SHEET_TITLE: Record<SectionId, string> = {
  basic: 'Basic & Contact Info', sport: 'Sport & Position', teams: 'Teams, Clubs & Academy',
  achievements: 'Tournaments & Achievements', stats: 'Career Stats', photos: 'Action Photos',
  videos: 'Highlight Videos', custom: 'Custom Sections',
};

/** One-line summary and "filled in" flag for each row of the list. */
function summarize(id: SectionId, p: Profile): { text: string; done: boolean } {
  const n = (a: unknown) => (Array.isArray(a) ? a.length : 0);
  switch (id) {
    case 'basic': {
      const age = ageFromDob(p.dob);
      const text = [realName(p.fullName), p.location?.city, age ? `${age} yrs` : ''].filter(Boolean).join(' · ');
      return { text: text || 'Name, age, city, phone, bio', done: !!realName(p.fullName) && !!p.location?.city };
    }
    case 'sport': {
      const text = [p.primarySport, p.position].filter(Boolean).join(' · ');
      return { text: text || 'Sport, position, strong foot / hand', done: !!p.primarySport };
    }
    case 'teams': {
      const current = (p.playingHistory || []).find((h: any) => h?.current)?.organization || p.playingHistory?.[0]?.organization;
      return { text: current || p.institutionName || 'Current club, past academies, school', done: !!(current || p.institutionName) };
    }
    case 'achievements': {
      const t = n(p.tournaments); const a = n(p.achievements);
      return { text: t || a ? `${a} achievement${a === 1 ? '' : 's'} · ${t} tournament${t === 1 ? '' : 's'}` : 'Medals, titles, tournaments', done: !!(t || a) };
    }
    case 'stats': {
      const c = n(p.careerStats);
      return { text: c ? `${c} stat${c === 1 ? '' : 's'}` : 'Matches played, goals, runs, points', done: c > 0 };
    }
    case 'photos': {
      const c = photosOf(p).length;
      return { text: `${c} of ${MAX_ACTION_PHOTOS} photos`, done: c > 0 };
    }
    case 'videos': {
      const c = videosOf(p).length;
      return { text: c ? `${c} link${c === 1 ? '' : 's'}` : 'YouTube, Instagram Reel or Drive links', done: c > 0 };
    }
    case 'custom': {
      const c = n(p.customSections);
      return { text: c ? `${c} section${c === 1 ? '' : 's'}` : 'Fitness metrics, certifications, references', done: c > 0 };
    }
  }
}

export default function EditCv({ profile, save }: { profile: Profile; save: Save }) {
  const router = useRouter();
  const [open, setOpen] = useState<SectionId | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await profileAPI.downloadAthleteCV(profile._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(profile.fullName || 'player').replace(/\s+/g, '_')}_Sports_CV.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      void eventAPI.log('PDF_DOWNLOADED', { sport: profile.primarySport });
    } catch {
      toast.error('Could not download the PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  const completion = Math.min(100, profile.profileCompletion || 0);

  return (
    <div className="flex-1 pb-6">
      <div className="px-4 pb-4 pt-6">
        <p className="eyebrow">Edit CV</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink"><AccentTitle>Build your CV</AccentTitle></h1>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${completion}%` }} />
          </div>
          <span className="font-mono text-xs font-bold text-ink-soft">{completion}%</span>
        </div>
      </div>

      <Group title="Core sections" items={CORE} profile={profile} onOpen={setOpen} />
      <Group title="Optional sections" items={OPTIONAL} profile={profile} onOpen={setOpen} />

      <p className="px-4 pb-1 pt-5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">View &amp; download CV</p>
      <ul className="border-y border-line">
        <ListRow icon={Eye} label="Preview CV" sub="See it the way scouts see it" onClick={() => router.push('/me')} />
        <ListRow icon={FileDown} label="Download PDF" sub="A4 resume with all your sections" busy={pdfBusy} onClick={downloadPdf} last />
      </ul>

      {open && (
        <SectionSheet id={open} profile={profile} save={save} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function Group({ title, items, profile, onOpen }: {
  title: string; items: typeof CORE; profile: Profile; onOpen: (id: SectionId) => void;
}) {
  return (
    <>
      <p className="px-4 pb-1 pt-5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{title}</p>
      <ul className="border-y border-line">
        {items.map(({ id, label, icon }, i) => {
          const s = summarize(id, profile);
          return <ListRow key={id} icon={icon} label={label} sub={s.text} done={s.done} onClick={() => onOpen(id)} last={i === items.length - 1} />;
        })}
      </ul>
    </>
  );
}

function ListRow({ icon: Icon, label, sub, done, busy, onClick, last }: {
  icon: typeof Phone; label: string; sub?: string; done?: boolean; busy?: boolean; onClick: () => void; last?: boolean;
}) {
  return (
    <li className={last ? '' : 'border-b border-line'}>
      <button onClick={onClick} disabled={busy} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cream/70 active:bg-cream disabled:opacity-60">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-brand">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-semibold leading-tight text-ink">{label}</span>
          {sub && <span className="mt-0.5 block truncate text-sm text-ink-soft">{sub}</span>}
        </span>
        {done && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-label="Filled in" />}
        <ChevronRight className="h-5 w-5 shrink-0 text-ink/30" />
      </button>
    </li>
  );
}

// ── Bottom sheet that holds each section's form ───────────────────────────────
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50"
      role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[430px] flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 grid h-11 w-11 place-items-center rounded-full hover:bg-cream"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Form wrapper: scrolling body + a sticky Save button. */
function FormBody({ children, busy, onSubmit, submitLabel = 'Save' }: {
  children: React.ReactNode; busy: boolean; onSubmit: () => void; submitLabel?: string;
}) {
  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">{children}</div>
      <div className="shrink-0 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button disabled={busy} className={btnPrimary + ' w-full'}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : submitLabel}
        </button>
      </div>
    </form>
  );
}

function SectionSheet({ id, profile, save, onClose }: { id: SectionId; profile: Profile; save: Save; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  /** Saves a patch, then closes the sheet. */
  const commit = async (patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      await save(patch);
      toast.success('Saved');
      onClose();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const props = { profile, busy, commit };
  return (
    <Sheet title={SHEET_TITLE[id]} onClose={onClose}>
      {id === 'basic' && <BasicForm {...props} />}
      {id === 'sport' && <SportForm {...props} />}
      {id === 'teams' && <TeamsForm {...props} />}
      {id === 'achievements' && <AchievementsForm {...props} />}
      {id === 'stats' && <StatsForm {...props} />}
      {id === 'photos' && <PhotosForm profile={profile} save={save} onClose={onClose} />}
      {id === 'videos' && <VideosForm {...props} />}
      {id === 'custom' && <CustomForm {...props} />}
    </Sheet>
  );
}

interface FormProps { profile: Profile; busy: boolean; commit: (patch: Record<string, unknown>) => Promise<void> }

// ── helpers ───────────────────────────────────────────────────────────────────
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const num = (v: string) => (v?.trim() && !isNaN(Number(v)) ? Number(v) : undefined);

/**
 * Rebuilds a list from the form rows but keeps fields the simple form doesn't show (descriptions, dates,
 * levels added in the full profile editor), matching old and new entries by `key`.
 */
function mergeRows<T extends Record<string, any>>(existing: T[] | undefined, next: T[], key: keyof T): T[] {
  const byKey = new Map((existing || []).map((e) => [norm(e[key]), e]));
  return next.map((n) => ({ ...(byKey.get(norm(n[key])) || {}), ...n }));
}

interface FieldSpec { key: string; placeholder: string; inputMode?: 'numeric' | 'text' | 'url'; full?: boolean }

function RowEditor({ rows, onChange, blank, addLabel, fields, max = 12 }: {
  rows: Row[]; onChange: (r: Row[]) => void; blank: Row; addLabel: string; fields: FieldSpec[]; max?: number;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="relative grid grid-cols-2 gap-2 rounded-2xl border border-line bg-cream/70 p-3">
          {fields.map((f) => (
            <input
              key={f.key}
              className={`${inputCls} ${f.full === false ? '' : fields.length === 1 || f.full ? 'col-span-2' : ''}`}
              placeholder={f.placeholder}
              inputMode={f.inputMode}
              value={row[f.key] || ''}
              onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value } : r)))}
            />
          ))}
          <button
            type="button"
            aria-label="Remove"
            className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full border border-line bg-white hover:border-red-500"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      ))}
      <button type="button" disabled={rows.length >= max} className={btnGhost + ' w-full'} onClick={() => onChange([...rows, { ...blank }])}>
        <Plus className="h-4 w-4" />{addLabel}
      </button>
    </div>
  );
}

// ── 1. Basic & contact ────────────────────────────────────────────────────────
function BasicForm({ profile, busy, commit }: FormProps) {
  const [f, setF] = useState({
    fullName: realName(profile.fullName), dob: profile.dob ? String(profile.dob).slice(0, 10) : '', gender: profile.gender || '',
    city: profile.location?.city || '', state: profile.location?.state || '', phone: profile.phone || '',
    tagline: profile.tagline || '', aboutBio: profile.aboutBio || '',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const age = ageFromDob(f.dob);

  return (
    <FormBody busy={busy} onSubmit={() => {
      if (f.fullName.trim().length < 2) return toast.error('Enter your full name');
      return commit({
        fullName: f.fullName.trim(), dob: f.dob || undefined, gender: f.gender || undefined, phone: f.phone.trim() || undefined,
        location: { ...(profile.location || {}), city: f.city.trim(), state: f.state.trim() },
        tagline: f.tagline.trim() || undefined, aboutBio: f.aboutBio.trim() || undefined,
      });
    }}>
      <Field label="Full name *"><input className={inputCls} autoComplete="name" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
      <Field label="Date of birth" hint={age !== null ? `Age ${age}` : undefined}>
        <input type="date" max={new Date().toISOString().slice(0, 10)} className={inputCls} value={f.dob} onChange={(e) => set('dob', e.target.value)} />
      </Field>
      <Field label="Gender">
        <select className={inputCls} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
          <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><input className={inputCls} value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="State"><input className={inputCls} value={f.state} onChange={(e) => set('state', e.target.value)} /></Field>
      </div>
      <Field label="Phone" hint="Only shared with people you allow."><input className={inputCls} type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
      <Field label="One-line tagline"><input className={inputCls} maxLength={120} placeholder="e.g. Left-wing striker, Mumbai U-21" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
      <Field label="Bio"><textarea className={textareaCls} rows={4} maxLength={1000} placeholder="A few lines about your game and goals" value={f.aboutBio} onChange={(e) => set('aboutBio', e.target.value)} /></Field>
    </FormBody>
  );
}

// ── 2. Sport & position ───────────────────────────────────────────────────────
function SportForm({ profile, busy, commit }: FormProps) {
  const sports = useSports();
  const [f, setF] = useState({
    primarySport: profile.primarySport || '', position: profile.position || '',
    secondaryPosition: profile.secondaryPosition || '', dominantSide: profile.dominantSide || '',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const options = sports.includes(f.primarySport) || !f.primarySport ? sports : [f.primarySport, ...sports];

  return (
    <FormBody busy={busy} onSubmit={() => commit({
      primarySport: f.primarySport || undefined, position: f.position.trim() || undefined,
      secondaryPosition: f.secondaryPosition.trim() || undefined, dominantSide: f.dominantSide || undefined,
    })}>
      <Field label="Sport">
        <select className={inputCls} value={f.primarySport} onChange={(e) => set('primarySport', e.target.value)}>
          <option value="">Select your sport</option>
          {options.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Primary position"><input className={inputCls} placeholder="e.g. Striker, Opening batter" value={f.position} onChange={(e) => set('position', e.target.value)} /></Field>
      <Field label="Secondary position"><input className={inputCls} placeholder="Optional" value={f.secondaryPosition} onChange={(e) => set('secondaryPosition', e.target.value)} /></Field>
      <Field label="Strong foot / hand">
        <select className={inputCls} value={f.dominantSide} onChange={(e) => set('dominantSide', e.target.value)}>
          <option value="">Not set</option><option value="right">Right</option><option value="left">Left</option><option value="both">Both</option>
        </select>
      </Field>
    </FormBody>
  );
}

// ── 3. Teams, clubs & academy ─────────────────────────────────────────────────
function TeamsForm({ profile, busy, commit }: FormProps) {
  const history: any[] = profile.playingHistory || [];
  const currentEntry = history.find((h) => h?.current);
  const [current, setCurrent] = useState<string>(currentEntry?.organization || '');
  const [past, setPast] = useState<Row[]>(
    history.filter((h) => h && h !== currentEntry).map((h) => ({ organization: h.organization || '', role: h.role || '' })),
  );
  const [school, setSchool] = useState<string>(profile.institutionName || '');

  return (
    <FormBody busy={busy} onSubmit={() => {
      const next = [
        ...(current.trim() ? [{ organization: current.trim(), current: true }] : []),
        ...past.filter((r) => r.organization?.trim()).map((r) => ({ organization: r.organization.trim(), role: r.role?.trim() || undefined, current: false })),
      ];
      return commit({ playingHistory: mergeRows(history, next, 'organization'), institutionName: school.trim() || undefined });
    }}>
      <Field label="Current club / academy"><input className={inputCls} placeholder="Where you play now" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
      <div>
        <span className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">Past clubs &amp; academies</span>
        <RowEditor rows={past} onChange={setPast} blank={{ organization: '', role: '' }} addLabel="Add past club"
          fields={[{ key: 'organization', placeholder: 'Club / academy name', full: true }, { key: 'role', placeholder: 'Your role (optional)', full: true }]} />
      </div>
      <Field label="School / college"><input className={inputCls} value={school} onChange={(e) => setSchool(e.target.value)} /></Field>
    </FormBody>
  );
}

// ── 4. Tournaments & achievements ─────────────────────────────────────────────
function AchievementsForm({ profile, busy, commit }: FormProps) {
  const [tours, setTours] = useState<Row[]>((profile.tournaments || []).map((t: any) => ({ name: t.name || '', year: t.year ? String(t.year) : '', result: t.result || '' })));
  const [achs, setAchs] = useState<Row[]>((profile.achievements || []).map((a: any) => ({ title: a.title || '', year: a.year ? String(a.year) : '', level: a.level || '' })));

  return (
    <FormBody busy={busy} onSubmit={() => commit({
      tournaments: mergeRows(profile.tournaments,
        tours.filter((r) => r.name?.trim()).map((r) => ({ name: r.name.trim(), year: num(r.year), result: r.result?.trim() || undefined })), 'name'),
      achievements: mergeRows(profile.achievements,
        achs.filter((r) => r.title?.trim()).map((r) => ({ title: r.title.trim(), year: num(r.year), level: r.level?.trim() || undefined })), 'title'),
    })}>
      <div>
        <span className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">Medals, titles &amp; milestones</span>
        <RowEditor rows={achs} onChange={setAchs} blank={{ title: '', year: '', level: '' }} addLabel="Add achievement"
          fields={[{ key: 'title', placeholder: 'e.g. Gold medal, Player of the series', full: true }, { key: 'year', placeholder: 'Year', inputMode: 'numeric', full: false }, { key: 'level', placeholder: 'District / State…', full: false }]} />
      </div>
      <div>
        <span className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">Tournaments played</span>
        <RowEditor rows={tours} onChange={setTours} blank={{ name: '', year: '', result: '' }} addLabel="Add tournament"
          fields={[{ key: 'name', placeholder: 'Tournament name', full: true }, { key: 'year', placeholder: 'Year', inputMode: 'numeric', full: false }, { key: 'result', placeholder: 'Result (e.g. Winner)', full: false }]} />
      </div>
    </FormBody>
  );
}

// ── 5. Career stats ───────────────────────────────────────────────────────────
const STAT_PRESETS: Record<string, string[]> = {
  Football: ['Matches', 'Goals', 'Assists'], Cricket: ['Matches', 'Runs', 'Wickets'], Basketball: ['Matches', 'Points', 'Rebounds'],
  Badminton: ['Matches', 'Wins', 'Titles'], Kabaddi: ['Matches', 'Raid points', 'Tackle points'], Hockey: ['Matches', 'Goals', 'Assists'],
  Athletics: ['Events', 'Personal best', 'Medals'], Volleyball: ['Matches', 'Points', 'Blocks'], Tennis: ['Matches', 'Wins', 'Titles'],
};

function StatsForm({ profile, busy, commit }: FormProps) {
  const [rows, setRows] = useState<Row[]>((profile.careerStats || []).map((s: any) => ({ label: s.label || '', value: s.value || '' })));
  const preset = STAT_PRESETS[profile.primarySport] || ['Matches', 'Points', 'Wins'];

  return (
    <FormBody busy={busy} onSubmit={() => commit({ careerStats: rows.filter((r) => r.label?.trim() && r.value?.trim()).map((r) => ({ label: r.label.trim(), value: r.value.trim() })) })}>
      <p className="text-sm text-ink-soft">Numbers that show on your CV and PDF. Keep them to your best 3 to 6.</p>
      {rows.length === 0 && (
        <button type="button" className={btnGhost + ' w-full'} onClick={() => setRows(preset.map((label) => ({ label, value: '' })))}>
          Use suggested fields for {profile.primarySport || 'your sport'}
        </button>
      )}
      <RowEditor rows={rows} onChange={setRows} blank={{ label: '', value: '' }} addLabel="Add stat"
        fields={[{ key: 'label', placeholder: 'Matches, Goals, Runs…', full: false }, { key: 'value', placeholder: 'Number', inputMode: 'numeric', full: false }]} />
    </FormBody>
  );
}

// ── 6. Action photos (up to 4) + profile photo ────────────────────────────────
function PhotosForm({ profile, save, onClose }: { profile: Profile; save: Save; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null); // 'avatar' | 'slot-0'…
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<'avatar' | number>('avatar');

  const photos = photosOf(profile);
  const videos = videosOf(profile);

  const choose = (t: 'avatar' | number) => { target.current = t; input.current?.click(); };

  /** compress → upload → save, for the profile photo or one action-photo slot */
  const onFile = async (file?: File) => {
    if (!file) return;
    const t = target.current;
    setBusy(t === 'avatar' ? 'avatar' : `slot-${t}`);
    try {
      const small = await compressImage(file);
      const res = await uploadAPI.uploadImage(small);
      const url: string = res.data.data.url;
      if (t === 'avatar') {
        await save({ photo: url });
      } else {
        const next = [...photos]; // keep any extra fields on the other photos
        if (t < next.length) next[t] = { ...next[t], url }; else next.push({ url });
        await save({ media: [...next.map((p) => ({ ...p, type: 'photo' })), ...videos] });
      }
      toast.success(t === 'avatar' ? 'Profile photo updated' : 'Photo saved');
    } catch (e) {
      toast.error(e instanceof Error && !(e as any).response ? e.message : apiError(e, 'Photo upload failed. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (index: number) => {
    if (!window.confirm('Remove this photo?')) return;
    setBusy(`slot-${index}`);
    try {
      await save({ media: [...photos.filter((_, i) => i !== index).map((p) => ({ ...p, type: 'photo' })), ...videos] });
      toast.success('Photo removed');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const avatar = getPhotoUrl(profile.photo);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-line bg-cream">
            {busy === 'avatar' ? <Loader2 className="h-6 w-6 animate-spin text-brand" />
              : avatar ? <img src={avatar} alt="Profile" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-ink/30" />}
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-ink">Profile photo</p>
            <p className="text-sm text-ink-soft">A clear face photo. Shown on your Story card.</p>
            <button type="button" disabled={busy !== null} onClick={() => choose('avatar')} className="mt-1 text-sm font-semibold text-brand disabled:opacity-50">
              {avatar ? 'Change' : 'Add photo'}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="font-display text-lg font-semibold text-ink">Action photos</p>
            <span className="font-mono text-xs font-bold text-ink-soft">{photos.length} / {MAX_ACTION_PHOTOS}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: MAX_ACTION_PHOTOS }).map((_, i) => {
              const p = photos[i];
              const loading = busy === `slot-${i}`;
              const canAdd = i === photos.length; // fill slots in order
              return (
                <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-cream">
                  {p ? (
                    <>
                      <img src={getPhotoUrl(p.url) || p.url} alt={`Action photo ${i + 1}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 to-transparent p-2">
                        <button type="button" disabled={busy !== null} onClick={() => choose(i)} aria-label="Replace photo" className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink disabled:opacity-50"><RefreshCw className="h-4 w-4" /></button>
                        <button type="button" disabled={busy !== null} onClick={() => remove(i)} aria-label="Delete photo" className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </>
                  ) : (
                    <button type="button" disabled={!canAdd || busy !== null} onClick={() => choose(i)} className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-soft transition hover:text-brand disabled:opacity-40">
                      <Plus className="h-6 w-6" /><span className="text-xs font-semibold">Add photo</span>
                    </button>
                  )}
                  {loading && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-soft">Photos are shrunk to under 800 KB automatically before they upload.</p>
        </div>
      </div>
      <div className="shrink-0 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClose} className={btnPrimary + ' w-full'}>Done</button>
      </div>
    </div>
  );
}

// ── 7. Highlight videos ───────────────────────────────────────────────────────
function VideosForm({ profile, busy, commit }: FormProps) {
  const [rows, setRows] = useState<Row[]>(videosOf(profile).map((v) => ({ url: v.url })));
  return (
    <FormBody busy={busy} onSubmit={() => {
      const clean = rows.map((r) => r.url?.trim()).filter(Boolean);
      if (clean.some((u) => !/^https?:[/][/]/i.test(u))) return toast.error('Links must start with https://');
      const existing = videosOf(profile) as any[];
      const videos = clean.map((url) => ({
        ...(existing.find((v) => v.url === url) || {}), type: 'video', url,
        platform: /youtu/i.test(url) ? 'YouTube' : /instagram/i.test(url) ? 'Instagram' : /vimeo/i.test(url) ? 'Vimeo' : 'Other',
      }));
      return commit({ media: [...photosOf(profile).map((p) => ({ ...p, type: 'photo' })), ...videos] });
    }}>
      <p className="text-sm text-ink-soft">Paste links to your best clips: YouTube, an Instagram Reel, or a Google Drive video.</p>
      <RowEditor rows={rows} onChange={setRows} blank={{ url: '' }} addLabel="Add video link" max={6}
        fields={[{ key: 'url', placeholder: 'https://…', inputMode: 'url' }]} />
    </FormBody>
  );
}

// ── 8. Custom sections ────────────────────────────────────────────────────────
const SECTION_PRESETS = ['Fitness metrics', 'Certifications', 'References'];

function CustomForm({ profile, busy, commit }: FormProps) {
  const [sections, setSections] = useState<{ title: string; items: Row[] }[]>(
    (profile.customSections || []).map((c: any) => ({ title: c.title || '', items: (c.items || []).map((i: any) => ({ label: i.label || '', value: i.value || '' })) })),
  );
  const update = (i: number, next: Partial<{ title: string; items: Row[] }>) => setSections((s) => s.map((x, j) => (j === i ? { ...x, ...next } : x)));
  const add = (title: string) => setSections((s) => (s.length >= 6 ? s : [...s, { title, items: [{ label: '', value: '' }] }]));

  return (
    <FormBody busy={busy} onSubmit={() => commit({
      customSections: sections.map((s) => ({ title: s.title.trim(), items: s.items.filter((i) => i.value?.trim()).map((i) => ({ label: i.label?.trim() || undefined, value: i.value.trim() })) })),
    })}>
      <p className="text-sm text-ink-soft">Add anything else scouts should see: fitness test results, certificates, or people who can vouch for you.</p>
      {sections.map((s, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-line p-3">
          <div className="flex items-center gap-2">
            <input className={inputCls} placeholder="Section title" value={s.title} onChange={(e) => update(i, { title: e.target.value })} />
            <button type="button" aria-label="Remove section" onClick={() => setSections((x) => x.filter((_, j) => j !== i))} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line hover:border-red-500">
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
          <RowEditor rows={s.items} onChange={(items) => update(i, { items })} blank={{ label: '', value: '' }} addLabel="Add line"
            fields={[{ key: 'label', placeholder: 'Label (e.g. 30m sprint)', full: false }, { key: 'value', placeholder: 'Value (e.g. 4.2 s)', full: false }]} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {SECTION_PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => add(p)} className="h-10 rounded-full border border-line px-4 text-sm font-semibold text-ink hover:border-ink">+ {p}</button>
        ))}
        <button type="button" onClick={() => add('')} className="h-10 rounded-full border border-line px-4 text-sm font-semibold text-ink hover:border-ink">+ Other</button>
      </div>
    </FormBody>
  );
}
