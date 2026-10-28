'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Activity, BarChart3, Camera, CheckCircle2, ChevronRight, Eye, FileDown, FileText, Globe, GraduationCap, Images, Loader2, Lock, Medal, Phone,
  Plus, PlusSquare, RefreshCw, Shield, Sparkles, Trash2, Trophy, Video, X,
} from 'lucide-react';
import { eventAPI, profileAPI, uploadAPI } from '@/lib/api';
import { MAX_ACTION_PHOTOS, ageFromDob, compressImage, photosOf, realName, videosOf } from '@/lib/cv';
import { getPhotoUrl } from '@/lib/utils';
import { apiError } from '@/lib/useCvSession';
import { useSports } from './useSports';
import LocationFields from './LocationFields';
import { canonicalState } from '@/lib/india';
import { POSITIONS_BY_SPORT } from '@/lib/positions';
import StoryPreview from './StoryPreview';
import { AccentTitle, Field, btnGhost, btnPrimary, inputCls, textareaCls } from './ui';

type Profile = Record<string, any>;
type Save = (patch: Record<string, unknown>) => Promise<Profile>;
type Row = Record<string, string>;
type SectionId = 'basic' | 'sport' | 'teams' | 'education' | 'certificates' | 'achievements' | 'tournaments' | 'about' | 'stats' | 'skills' | 'social' | 'photos' | 'videos' | 'custom' | 'privacy';

const CORE: { id: SectionId; label: string; icon: typeof Phone }[] = [
  { id: 'basic', label: 'Basic & Contact Info', icon: Phone },
  { id: 'sport', label: 'Sport & Position', icon: Activity },
  { id: 'teams', label: 'Teams, Clubs & Academy', icon: Shield },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'certificates', label: 'Certificates', icon: Medal },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
  { id: 'tournaments', label: 'Tournaments', icon: Activity },
];
const OPTIONAL: { id: SectionId; label: string; icon: typeof Phone }[] = [
  { id: 'about', label: 'About, Strengths & Goals', icon: FileText },
  { id: 'stats', label: 'Career Stats & Performance', icon: BarChart3 },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'social', label: 'Social Links', icon: Globe },
  { id: 'photos', label: 'Add Action Photos', icon: Images },
  { id: 'videos', label: 'Highlight Video Links', icon: Video },
  { id: 'custom', label: 'Add Custom Section', icon: PlusSquare },
  { id: 'privacy', label: 'Profile Visibility', icon: Lock },
];

const SHEET_TITLE: Record<SectionId, string> = {
  basic: 'Basic & Contact Info', sport: 'Sport & Position', teams: 'Teams, Clubs & Academy',
  education: 'Education', certificates: 'Certificates', tournaments: 'Tournaments', about: 'About, Strengths & Goals', skills: 'Skills', social: 'Social Links', privacy: 'Profile Visibility',
  achievements: 'Achievements', stats: 'Career Stats', photos: 'Action Photos',
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
      const a = n(p.achievements);
      return { text: a ? `${a} achievement${a === 1 ? '' : 's'}` : 'Medals, titles, milestones', done: a > 0 };
    }
    case 'tournaments': {
      const t = n(p.tournaments);
      return { text: t ? `${t} tournament${t === 1 ? '' : 's'}` : 'Tournaments you have played', done: t > 0 };
    }
    case 'education': {
      const e = n(p.education);
      return { text: e ? `${e} entr${e === 1 ? 'y' : 'ies'}` : 'School, college, class or degree', done: e > 0 };
    }
    case 'certificates': {
      const c = n(p.certifications);
      return { text: c ? `${c} certificate${c === 1 ? '' : 's'}` : 'Coaching and sports certificates', done: c > 0 };
    }
    case 'about': {
      const parts = [p.careerHighlights, p.strengths, p.goalsAspirations].filter(Boolean).length;
      return { text: parts ? `${parts} of 3 filled in` : 'Career highlights, strengths, goals', done: parts > 0 };
    }
    case 'skills': {
      const c = n(p.skills);
      return { text: c ? `${c} skill${c === 1 ? '' : 's'}` : 'Dribbling, leadership, speed…', done: c > 0 };
    }
    case 'social': {
      const c = Object.values(p.socialLinks || {}).filter(Boolean).length;
      return { text: c ? `${c} link${c === 1 ? '' : 's'}` : 'Instagram, YouTube, LinkedIn, X', done: c > 0 };
    }
    case 'privacy':
      return { text: ({ public: 'Public: anyone with the link', connections: 'Connections only', private: 'Private: only you' } as Record<string, string>)[p.visibility as string] || 'Public: anyone with the link', done: true };
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
    <div className="mx-auto w-full max-w-6xl flex-1 pb-6 md:grid md:grid-cols-[minmax(0,560px)_minmax(0,1fr)] md:items-start md:gap-14 md:px-8 md:pt-4">
    <div>
      <div className="px-4 pb-4 pt-6 md:px-0">
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

      <p className="px-4 pb-1 pt-5 md:px-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">View &amp; download CV</p>
      <ul className="border-y border-line md:overflow-hidden md:rounded-2xl md:border">
        <ListRow icon={Eye} label="Preview CV" sub="See it the way scouts see it" onClick={() => router.push('/me')} />
        <ListRow icon={FileDown} label="Download PDF" sub="A4 resume with all your sections" busy={pdfBusy} onClick={downloadPdf} last />
      </ul>

    </div>

    {/* desktop: live preview of the card that scouts and the Story export use */}
    <aside className="hidden md:block">
      <div className="sticky top-24 flex flex-col items-center rounded-3xl bg-cream px-8 py-8">
        <p className="eyebrow">Live preview</p>
        <p className="mb-5 mt-2 text-center text-sm text-ink-soft">Your Story card updates each time you save.</p>
        <StoryPreview profile={profile} maxWidth={300} />
      </div>
    </aside>

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
      <p className="px-4 pb-1 pt-5 md:px-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{title}</p>
      <ul className="border-y border-line md:overflow-hidden md:rounded-2xl md:border">
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 md:items-center md:p-6"
      role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[430px] flex-col rounded-t-3xl bg-white shadow-2xl md:max-h-[88vh] md:max-w-xl md:rounded-3xl">
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
      {id === 'education' && <EducationForm {...props} />}
      {id === 'certificates' && <CertificatesForm {...props} />}
      {id === 'tournaments' && <TournamentsForm {...props} />}
      {id === 'about' && <AboutForm {...props} />}
      {id === 'skills' && <SkillsForm {...props} />}
      {id === 'social' && <SocialForm {...props} />}
      {id === 'privacy' && <PrivacyForm {...props} />}
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

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1949 }, (_, i) => String(THIS_YEAR - i));
const YEARS_AHEAD = Array.from({ length: THIS_YEAR + 7 - 1949 }, (_, i) => String(THIS_YEAR + 6 - i));

interface FieldSpec {
  key: string; placeholder: string; inputMode?: 'numeric' | 'text' | 'url'; full?: boolean;
  kind?: 'text' | 'select' | 'year' | 'yearAhead' | 'date' | 'textarea' | 'check';
  options?: string[];
  /** Hides the field while this other key of the same row is "yes". */
  hideWhen?: string;
}

function RowEditor({ rows, onChange, blank, addLabel, fields, max = 12 }: {
  rows: Row[]; onChange: (r: Row[]) => void; blank: Row; addLabel: string; fields: FieldSpec[]; max?: number;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, i) => {
        const setVal = (k: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
        return (
          <div key={i} className="relative grid grid-cols-2 gap-2 rounded-2xl border border-line bg-cream/70 p-3">
            {fields.filter((f) => !(f.hideWhen && row[f.hideWhen] === 'yes')).map((f) => {
              const span = f.full === false ? '' : fields.length === 1 || f.full || f.kind === 'textarea' || f.kind === 'check' ? 'col-span-2' : '';
              const value = row[f.key] || '';
              if (f.kind === 'check') {
                return (
                  <label key={f.key} className={`${span} flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm font-medium text-ink`}>
                    <input type="checkbox" className="h-5 w-5 accent-[#004fab]" checked={value === 'yes'} onChange={(e) => setVal(f.key, e.target.checked ? 'yes' : '')} />
                    {f.placeholder}
                  </label>
                );
              }
              if (f.kind === 'textarea') {
                return <textarea key={f.key} rows={2} className={`${textareaCls} ${span}`} placeholder={f.placeholder} value={value} onChange={(e) => setVal(f.key, e.target.value)} />;
              }
              if (f.kind === 'select' || f.kind === 'year' || f.kind === 'yearAhead') {
                const opts = f.kind === 'year' ? YEARS : f.kind === 'yearAhead' ? YEARS_AHEAD : f.options || [];
                const list = value && !opts.includes(value) ? [value, ...opts] : opts;
                return (
                  <select key={f.key} className={`${inputCls} ${span}`} aria-label={f.placeholder} value={value} onChange={(e) => setVal(f.key, e.target.value)}>
                    <option value="">{f.placeholder}</option>
                    {list.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                );
              }
              if (f.kind === 'date') {
                return (
                  <label key={f.key} className={`${span} block`}>
                    <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">{f.placeholder}</span>
                    <input type="date" className={inputCls} value={value} onChange={(e) => setVal(f.key, e.target.value)} />
                  </label>
                );
              }
              return (
                <input key={f.key} className={`${inputCls} ${span}`} placeholder={f.placeholder} inputMode={f.inputMode} value={value} onChange={(e) => setVal(f.key, e.target.value)} />
              );
            })}
            <button
              type="button"
              aria-label="Remove"
              className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full border border-line bg-white hover:border-red-500"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        );
      })}
      <button type="button" disabled={rows.length >= max} className={btnGhost + ' w-full'} onClick={() => onChange([...rows, { ...blank }])}>
        <Plus className="h-4 w-4" />{addLabel}
      </button>
    </div>
  );
}

const dateStr = (v: unknown) => (v ? String(v).slice(0, 10) : '');

// ── 1. Basic & contact ────────────────────────────────────────────────────────
function BasicForm({ profile, busy, commit }: FormProps) {
  const [f, setF] = useState({
    fullName: realName(profile.fullName), dob: profile.dob ? String(profile.dob).slice(0, 10) : '', gender: profile.gender || '',
    city: profile.location?.city || '', state: profile.location?.state || '', phone: profile.phone || '',
    tagline: profile.tagline || '', aboutBio: profile.aboutBio || '', username: profile.username || '',
    nationality: profile.nationality || '', address: profile.location?.address || '', pincode: profile.location?.pincode || '',
    whatsapp: profile.socialLinks?.whatsapp || '', countryCode: profile.countryCode || '+91',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const age = ageFromDob(f.dob);

  // A 6-digit pincode fills in the state and city (free India Post lookup); failures are ignored.
  const lookupPincode = async (pin: string) => {
    if (!/^[0-9]{6}$/.test(pin)) return;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      const office = data?.[0]?.Status === 'Success' ? data[0].PostOffice?.[0] : null;
      if (office) setF((s) => ({ ...s, pincode: pin, state: canonicalState(office.State) || office.State, city: office.District || s.city }));
    } catch { /* offline or blocked: the pickers still work */ }
  };

  return (
    <FormBody busy={busy} onSubmit={() => {
      if (f.fullName.trim().length < 2) return toast.error('Enter your full name');
      if (f.username && !/^[a-z0-9][a-z0-9_-]{2,29}$/.test(f.username)) return toast.error('Username: 3–30 letters, numbers, - or _');
      return commit({
        username: f.username || undefined,
        fullName: f.fullName.trim(), dob: f.dob || undefined, gender: f.gender || undefined, phone: f.phone.trim() || undefined,
        nationality: f.nationality.trim() || undefined, countryCode: f.countryCode,
        socialLinks: { ...(profile.socialLinks || {}), whatsapp: f.whatsapp.trim() },
        location: { ...(profile.location || {}), city: f.city.trim(), state: f.state.trim(), address: f.address.trim(), pincode: f.pincode.trim() },
        tagline: f.tagline.trim() || undefined, aboutBio: f.aboutBio.trim() || undefined,
      });
    }}>
      <Field label="Full name *"><input className={inputCls} autoComplete="name" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
      <Field label="Username" hint={`Your public CV link: linksports.in/cv/${f.username || 'your-name'}`}>
        <input className={inputCls} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={30} placeholder="e.g. rahul-sharma" value={f.username}
          onChange={(e) => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} />
      </Field>
      <Field label="Date of birth" hint={age !== null ? `Age ${age}` : undefined}>
        <input type="date" max={new Date().toISOString().slice(0, 10)} className={inputCls} value={f.dob} onChange={(e) => set('dob', e.target.value)} />
      </Field>
      <Field label="Gender">
        <select className={inputCls} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
          <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
        </select>
      </Field>
      <LocationFields state={f.state} city={f.city} onChange={(v) => setF((s) => ({ ...s, ...v }))} />
      <Field label="Nationality"><input className={inputCls} placeholder="e.g. Indian" value={f.nationality} onChange={(e) => set('nationality', e.target.value)} /></Field>
      <Field label="Address"><input className={inputCls} autoComplete="street-address" placeholder="Area / street" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
      <Field label="Pincode" hint="Fills in your state and city"><input className={inputCls} inputMode="numeric" maxLength={6} autoComplete="postal-code" value={f.pincode} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); set('pincode', v); void lookupPincode(v); }} /></Field>
      <Field label="WhatsApp number" hint="Include the country code"><input className={inputCls} type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></Field>
      <Field label="Phone" hint="Only shared with people you allow.">
        <div className="flex gap-2">
          <select className={inputCls + ' !w-28 shrink-0'} aria-label="Country code" value={f.countryCode} onChange={(e) => set('countryCode', e.target.value)}>
            {['+91', '+1', '+44', '+61', '+971', '+65', '+60', '+49', '+33', '+81', '+86', '+92', '+880', '+94', '+977', '+27'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className={inputCls} type="tel" inputMode="tel" autoComplete="tel-national" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
      </Field>
      <Field label="One-line tagline"><input className={inputCls} maxLength={120} placeholder="e.g. Left-wing striker, Mumbai U-21" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
      <Field label="Bio"><textarea className={textareaCls} rows={4} maxLength={1000} placeholder="A few lines about your game and goals" value={f.aboutBio} onChange={(e) => set('aboutBio', e.target.value)} /></Field>
    </FormBody>
  );
}

/** Position picker: a list for sports we know, free text for the rest (and for a saved value not in the list). */
function PositionInput({ sport, value, onChange, placeholder }: { sport: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const options = POSITIONS_BY_SPORT[sport];
  if (!options) return <input className={inputCls} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select position</option>
      {list.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── 2. Sport & position ───────────────────────────────────────────────────────
function SportForm({ profile, busy, commit }: FormProps) {
  const sports = useSports();
  const [f, setF] = useState({
    primarySport: profile.primarySport || '', position: profile.position || '',
    secondaryPosition: profile.secondaryPosition || '', dominantSide: profile.dominantSide || '',
    secondarySports: (profile.secondarySports || []).join(', '), yearsOfExperience: profile.yearsOfExperience != null ? String(profile.yearsOfExperience) : '',
    experienceLevel: profile.experienceLevel || '', height: profile.height != null ? String(profile.height) : '', heightUnit: profile.heightUnit || 'cm',
    weight: profile.weight != null ? String(profile.weight) : '', availabilityStatus: profile.availabilityStatus || '',
    para: profile.isParaAthlete ? 'yes' : '', paraClassification: profile.paraClassification || '',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const options = sports.includes(f.primarySport) || !f.primarySport ? sports : [f.primarySport, ...sports];

  return (
    <FormBody busy={busy} onSubmit={() => commit({
      primarySport: f.primarySport || undefined, position: f.position.trim() || undefined,
      secondaryPosition: f.secondaryPosition.trim() || undefined, dominantSide: f.dominantSide || undefined,
      secondarySports: f.secondarySports.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5),
      yearsOfExperience: num(f.yearsOfExperience), experienceLevel: f.experienceLevel || undefined,
      height: num(f.height), heightUnit: f.heightUnit, weight: num(f.weight), availabilityStatus: f.availabilityStatus || undefined,
      isParaAthlete: f.para === 'yes', paraClassification: f.para === 'yes' ? f.paraClassification.trim() || undefined : undefined,
    })}>
      <Field label="Sport">
        <select className={inputCls} value={f.primarySport} onChange={(e) => set('primarySport', e.target.value)}>
          <option value="">Select your sport</option>
          {options.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Primary position"><PositionInput sport={f.primarySport} value={f.position} onChange={(v) => set('position', v)} placeholder="e.g. Striker, Opening batter" /></Field>
      <Field label="Secondary position"><PositionInput sport={f.primarySport} value={f.secondaryPosition} onChange={(v) => set('secondaryPosition', v)} placeholder="Optional" /></Field>
      <Field label="Strong foot / hand">
        <select className={inputCls} value={f.dominantSide} onChange={(e) => set('dominantSide', e.target.value)}>
          <option value="">Not set</option><option value="right">Right</option><option value="left">Left</option><option value="both">Both</option>
        </select>
      </Field>
      <Field label="Other sports" hint="Separate with commas"><input className={inputCls} placeholder="e.g. Cricket, Kabaddi" value={f.secondarySports} onChange={(e) => set('secondarySports', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Years of experience"><input className={inputCls} inputMode="numeric" value={f.yearsOfExperience} onChange={(e) => set('yearsOfExperience', e.target.value)} /></Field>
        <Field label="Level">
          <select className={inputCls} value={f.experienceLevel} onChange={(e) => set('experienceLevel', e.target.value)}>
            <option value="">Not set</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="professional">Professional</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_88px_1fr] gap-3">
        <Field label="Height"><input className={inputCls} inputMode="decimal" value={f.height} onChange={(e) => set('height', e.target.value)} /></Field>
        <Field label="Unit">
          <select className={inputCls} value={f.heightUnit} onChange={(e) => set('heightUnit', e.target.value)}><option value="cm">cm</option><option value="m">m</option><option value="ft">ft</option></select>
        </Field>
        <Field label="Weight (kg)"><input className={inputCls} inputMode="decimal" value={f.weight} onChange={(e) => set('weight', e.target.value)} /></Field>
      </div>
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
        <input type="checkbox" className="h-5 w-5 accent-[#004fab]" checked={f.para === 'yes'} onChange={(e) => set('para', e.target.checked ? 'yes' : '')} />
        I am a para-athlete
      </label>
      {f.para === 'yes' && (
        <Field label="Para classification"><input className={inputCls} placeholder="e.g. T44, F56" value={f.paraClassification} onChange={(e) => set('paraClassification', e.target.value)} /></Field>
      )}
      <Field label="Availability">
        <select className={inputCls} value={f.availabilityStatus} onChange={(e) => set('availabilityStatus', e.target.value)}>
          <option value="">Not set</option><option value="open_for_trials">Open for trials</option><option value="looking_for_academy">Looking for an academy</option>
          <option value="available_for_selection">Available for selection</option><option value="not_available">Not available</option>
        </select>
      </Field>
    </FormBody>
  );
}

// ── 3. Teams, clubs & academy ─────────────────────────────────────────────────
function TeamsForm({ profile, busy, commit }: FormProps) {
  const history: any[] = profile.playingHistory || [];
  const currentEntry = history.find((h) => h?.current);
  const [current, setCurrent] = useState<Row>({
    organization: currentEntry?.organization || '', role: currentEntry?.role || '', startDate: dateStr(currentEntry?.startDate),
  });
  const [past, setPast] = useState<Row[]>(
    history.filter((h) => h && h !== currentEntry).map((h) => ({
      organization: h.organization || '', role: h.role || '', startDate: dateStr(h.startDate), endDate: dateStr(h.endDate), description: h.description || '',
    })),
  );
  const [school, setSchool] = useState<string>(profile.institutionName || '');
  const [course, setCourse] = useState<string>(profile.currentEducation || '');
  const upd = (k: string, v: string) => setCurrent((c) => ({ ...c, [k]: v }));

  return (
    <FormBody busy={busy} onSubmit={() => {
      const next = [
        ...(current.organization.trim() ? [{ organization: current.organization.trim(), role: current.role?.trim() || undefined, startDate: current.startDate || undefined, current: true }] : []),
        ...past.filter((r) => r.organization?.trim()).map((r) => ({
          organization: r.organization.trim(), role: r.role?.trim() || undefined, startDate: r.startDate || undefined,
          endDate: r.endDate || undefined, description: r.description?.trim() || undefined, current: false,
        })),
      ];
      return commit({ playingHistory: mergeRows(history, next, 'organization'), institutionName: school.trim() || undefined, currentEducation: course.trim() || undefined });
    }}>
      <div className="space-y-2 rounded-2xl border border-line bg-cream/70 p-3">
        <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">Current club / academy</span>
        <input className={inputCls} placeholder="Where you play now" value={current.organization} onChange={(e) => upd('organization', e.target.value)} />
        <PositionInput sport={profile.primarySport || ''} value={current.role} onChange={(v) => upd('role', v)} placeholder="Your position / role" />
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">Joined</span>
          <input type="date" className={inputCls} value={current.startDate} onChange={(e) => upd('startDate', e.target.value)} />
        </label>
      </div>
      <div>
        <span className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">Past clubs &amp; academies</span>
        <RowEditor rows={past} onChange={setPast} blank={{ organization: '', role: '', startDate: '', endDate: '', description: '' }} addLabel="Add past club"
          fields={[
            { key: 'organization', placeholder: 'Club / academy name', full: true },
            { key: 'role', placeholder: 'Position / role', full: true, kind: profile.primarySport && POSITIONS_BY_SPORT[profile.primarySport] ? 'select' : 'text', options: POSITIONS_BY_SPORT[profile.primarySport] },
            { key: 'startDate', placeholder: 'From', kind: 'date', full: false },
            { key: 'endDate', placeholder: 'To', kind: 'date', full: false },
            { key: 'description', placeholder: 'What you did there (optional)', kind: 'textarea' },
          ]} />
      </div>
      <Field label="School / college"><input className={inputCls} value={school} onChange={(e) => setSchool(e.target.value)} /></Field>
      <Field label="Current class / course"><input className={inputCls} placeholder="e.g. Class 12, B.Com 2nd year" value={course} onChange={(e) => setCourse(e.target.value)} /></Field>
    </FormBody>
  );
}

// ── 4. Achievements ───────────────────────────────────────────────────────────
const LEVELS = ['School', 'District', 'State', 'Zonal', 'National', 'International'];
const AWARD_CATEGORIES = ['Medal', 'Trophy', 'Player of the match', 'Player of the series', 'Scholarship', 'Selection', 'Certificate', 'Other'];

function AchievementsForm({ profile, busy, commit }: FormProps) {
  const [achs, setAchs] = useState<Row[]>((profile.achievements || []).map((a: any) => ({
    title: a.title || '', year: a.year ? String(a.year) : '', level: a.level || '', category: a.category || '', description: a.description || '',
  })));
  return (
    <FormBody busy={busy} onSubmit={() => commit({
      achievements: mergeRows(profile.achievements,
        achs.filter((r) => r.title?.trim()).map((r) => ({
          title: r.title.trim(), year: num(r.year), level: r.level || undefined, category: r.category || undefined, description: r.description?.trim() || undefined,
        })), 'title'),
    })}>
      <RowEditor rows={achs} onChange={setAchs} blank={{ title: '', year: '', level: '', category: '', description: '' }} addLabel="Add achievement"
        fields={[
          { key: 'title', placeholder: 'e.g. Gold medal, Player of the series', full: true },
          { key: 'category', placeholder: 'Type', kind: 'select', options: AWARD_CATEGORIES, full: false },
          { key: 'level', placeholder: 'Level', kind: 'select', options: LEVELS, full: false },
          { key: 'year', placeholder: 'Year', kind: 'year', full: true },
          { key: 'description', placeholder: 'Details (optional)', kind: 'textarea' },
        ]} />
    </FormBody>
  );
}

// ── Tournaments ───────────────────────────────────────────────────────────────
function TournamentsForm({ profile, busy, commit }: FormProps) {
  const [tours, setTours] = useState<Row[]>((profile.tournaments || []).map((t: any) => ({
    name: t.name || '', startDate: dateStr(t.startDate), endDate: dateStr(t.endDate), year: t.year ? String(t.year) : '',
    location: t.location || '', result: t.result || '', description: t.description || '',
  })));
  return (
    <FormBody busy={busy} onSubmit={() => commit({
      tournaments: mergeRows(profile.tournaments,
        tours.filter((r) => r.name?.trim()).map((r) => ({
          name: r.name.trim(), startDate: r.startDate || undefined, endDate: r.endDate || undefined,
          year: num(r.year) ?? (r.startDate ? Number(r.startDate.slice(0, 4)) : undefined),
          location: r.location?.trim() || undefined, result: r.result?.trim() || undefined, description: r.description?.trim() || undefined,
        })), 'name'),
    })}>
      <RowEditor rows={tours} onChange={setTours} blank={{ name: '', startDate: '', endDate: '', year: '', location: '', result: '', description: '' }} addLabel="Add tournament"
        fields={[
          { key: 'name', placeholder: 'Tournament name', full: true },
          { key: 'startDate', placeholder: 'Start date', kind: 'date', full: false },
          { key: 'endDate', placeholder: 'End date', kind: 'date', full: false },
          { key: 'location', placeholder: 'Venue / city', full: false },
          { key: 'result', placeholder: 'Result (e.g. Winner)', full: false },
          { key: 'description', placeholder: 'Your performance (optional)', kind: 'textarea' },
        ]} />
    </FormBody>
  );
}

// ── Education ─────────────────────────────────────────────────────────────────
function EducationForm({ profile, busy, commit }: FormProps) {
  const [edu, setEdu] = useState<Row[]>((profile.education || []).map((e: any) => ({
    institution: e.institution || '', degree: e.degree || '', fieldOfStudy: e.fieldOfStudy || '',
    startYear: e.startYear ? String(e.startYear) : '', endYear: e.endYear ? String(e.endYear) : e.year ? String(e.year) : '',
    studying: e.isCurrent ? 'yes' : '', description: e.description || '',
  })));
  return (
    <FormBody busy={busy} onSubmit={() => commit({
      education: mergeRows(profile.education,
        edu.filter((r) => r.institution?.trim()).map((r) => ({
          institution: r.institution.trim(), degree: r.degree?.trim() || undefined, fieldOfStudy: r.fieldOfStudy?.trim() || undefined,
          startYear: num(r.startYear), endYear: r.studying === 'yes' ? undefined : num(r.endYear), isCurrent: r.studying === 'yes',
          description: r.description?.trim() || undefined,
        })), 'institution'),
    })}>
      <RowEditor rows={edu} onChange={setEdu} blank={{ institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', studying: '', description: '' }} addLabel="Add education"
        fields={[
          { key: 'institution', placeholder: 'School / college / university', full: true },
          { key: 'degree', placeholder: 'Class / degree', full: false },
          { key: 'fieldOfStudy', placeholder: 'Field of study', full: false },
          { key: 'startYear', placeholder: 'Start year', kind: 'year', full: false },
          { key: 'endYear', placeholder: 'End year', kind: 'yearAhead', full: false, hideWhen: 'studying' },
          { key: 'studying', placeholder: 'Currently studying here', kind: 'check' },
          { key: 'description', placeholder: 'Academic or sports achievements (optional)', kind: 'textarea' },
        ]} />
    </FormBody>
  );
}

// ── Certificates ──────────────────────────────────────────────────────────────
function CertificatesForm({ profile, busy, commit }: FormProps) {
  const [certs, setCerts] = useState<Row[]>((profile.certifications || []).map((c: any) => ({ name: c.name || '', issuer: c.issuer || '', year: c.year ? String(c.year) : '' })));
  return (
    <FormBody busy={busy} onSubmit={() => commit({
      certifications: mergeRows(profile.certifications,
        certs.filter((r) => r.name?.trim()).map((r) => ({ name: r.name.trim(), issuer: r.issuer?.trim() || undefined, year: num(r.year) })), 'name'),
    })}>
      <RowEditor rows={certs} onChange={setCerts} blank={{ name: '', issuer: '', year: '' }} addLabel="Add certificate"
        fields={[{ key: 'name', placeholder: 'Certificate name', full: true }, { key: 'issuer', placeholder: 'Issued by', full: false }, { key: 'year', placeholder: 'Year', inputMode: 'numeric', full: false }]} />
    </FormBody>
  );
}

// ── About, strengths & goals ──────────────────────────────────────────────────
function AboutForm({ profile, busy, commit }: FormProps) {
  const [f, setF] = useState({ careerHighlights: profile.careerHighlights || '', strengths: profile.strengths || '', goalsAspirations: profile.goalsAspirations || '' });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <FormBody busy={busy} onSubmit={() => commit({
      careerHighlights: f.careerHighlights.trim() || undefined, strengths: f.strengths.trim() || undefined, goalsAspirations: f.goalsAspirations.trim() || undefined,
    })}>
      <Field label="Career highlights"><textarea className={textareaCls} rows={4} maxLength={1500} placeholder="Your proudest moments, matches and results" value={f.careerHighlights} onChange={(e) => set('careerHighlights', e.target.value)} /></Field>
      <Field label="Strengths"><textarea className={textareaCls} rows={3} maxLength={800} placeholder="What you do best on the field" value={f.strengths} onChange={(e) => set('strengths', e.target.value)} /></Field>
      <Field label="Goals and aspirations"><textarea className={textareaCls} rows={3} maxLength={800} placeholder="Where you want to take your game" value={f.goalsAspirations} onChange={(e) => set('goalsAspirations', e.target.value)} /></Field>
    </FormBody>
  );
}

// ── Skills ────────────────────────────────────────────────────────────────────
function SkillsForm({ profile, busy, commit }: FormProps) {
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !skills.some((s) => norm(s) === norm(v)) && skills.length < 20) setSkills([...skills, v]);
    setDraft('');
  };
  return (
    <FormBody busy={busy} onSubmit={() => commit({ skills: draft.trim() ? [...skills, draft.trim()].slice(0, 20) : skills })}>
      <p className="text-sm text-ink-soft">Short tags scouts can scan: Dribbling, Leadership, Sprint speed.</p>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Type a skill" value={draft} maxLength={40}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} className={btnGhost + ' shrink-0'}>Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream px-3 py-1.5 text-sm font-semibold text-ink">
            {s}
            <button type="button" aria-label={`Remove ${s}`} onClick={() => setSkills(skills.filter((x) => x !== s))}><X className="h-3.5 w-3.5 text-ink/50" /></button>
          </span>
        ))}
      </div>
    </FormBody>
  );
}

// ── Social links ──────────────────────────────────────────────────────────────
const SOCIALS: { key: string; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourname' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/yourname' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/yourname' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourname' },
];

function SocialForm({ profile, busy, commit }: FormProps) {
  const [links, setLinks] = useState<Record<string, string>>(Object.fromEntries(SOCIALS.map((s) => [s.key, profile.socialLinks?.[s.key] || ''])));
  const [featured, setFeatured] = useState<string>(profile.featuredVideoUrl || '');
  return (
    <FormBody busy={busy} onSubmit={() => {
      const all = [...Object.values(links), featured].map((v) => v.trim()).filter(Boolean);
      if (all.some((u) => !/^https?:[/][/]/i.test(u))) return toast.error('Links must start with https://');
      return commit({
        socialLinks: { ...(profile.socialLinks || {}), ...Object.fromEntries(Object.entries(links).map(([k, v]) => [k, v.trim()])) },
        featuredVideoUrl: featured.trim() || undefined,
      });
    }}>
      {SOCIALS.map((s) => (
        <Field key={s.key} label={s.label}>
          <input className={inputCls} inputMode="url" autoCapitalize="none" placeholder={s.placeholder} value={links[s.key]} onChange={(e) => setLinks({ ...links, [s.key]: e.target.value })} />
        </Field>
      ))}
      <Field label="Featured video" hint="Your best clip, shown first on your CV"><input className={inputCls} inputMode="url" placeholder="https://…" value={featured} onChange={(e) => setFeatured(e.target.value)} /></Field>
    </FormBody>
  );
}

// ── Visibility ────────────────────────────────────────────────────────────────
function PrivacyForm({ profile, busy, commit }: FormProps) {
  const [v, setV] = useState<string>(profile.visibility || 'public');
  const opts = [
    { id: 'public', t: 'Public', d: 'Anyone with your link can view your CV. Best for scouts.' },
    { id: 'connections', t: 'Connections only', d: 'Only people you are connected with.' },
    { id: 'private', t: 'Private', d: 'Only you. Your link will not open for others.' },
  ];
  return (
    <FormBody busy={busy} onSubmit={() => commit({ visibility: v })}>
      {opts.map((o) => (
        <button key={o.id} type="button" onClick={() => setV(o.id)}
          className={`w-full rounded-2xl border p-4 text-left transition ${v === o.id ? 'border-brand bg-brand/5' : 'border-line hover:border-ink/40'}`}>
          <span className="block font-display text-lg font-semibold text-ink">{o.t}</span>
          <span className="mt-0.5 block text-sm text-ink-soft">{o.d}</span>
        </button>
      ))}
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
