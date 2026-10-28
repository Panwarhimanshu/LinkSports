'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Award, Briefcase, Camera, ClipboardList, Eye, FileDown, FileText, Globe, GraduationCap, Loader2, Lock, Medal,
  Phone, Sparkles, Trophy, Users,
} from 'lucide-react';
import { eventAPI, profileAPI, uploadAPI } from '@/lib/api';
import { ageFromDob, compressImage, realName } from '@/lib/cv';
import { getPhotoUrl } from '@/lib/utils';
import { apiError } from '@/lib/useCvSession';
import { useSports } from './useSports';
import LocationFields from './LocationFields';
import { canonicalState } from '@/lib/india';
import StoryPreview from './StoryPreview';
import { AccentTitle, Field, btnGhost, btnPrimary, inputCls, textareaCls } from './ui';
import {
  AchievementsForm, EducationForm, FormBody, ListRow, PrivacyForm, RowEditor, SkillsForm, SocialForm, Sheet, dateStr, mergeRows, num,
  type FormProps, type Profile, type Row, type Save,
} from './EditCv';

type Id = 'basic' | 'sports' | 'experience' | 'qualifications' | 'education' | 'players' | 'achievements' | 'about' | 'skills' | 'social' | 'photo' | 'privacy';

const CORE: { id: Id; label: string; icon: typeof Phone }[] = [
  { id: 'basic', label: 'Basic & Contact Info', icon: Phone },
  { id: 'sports', label: 'Sports & Coaching Level', icon: ClipboardList },
  { id: 'experience', label: 'Coaching Experience', icon: Briefcase },
  { id: 'qualifications', label: 'Certifications & Licences', icon: Award },
  { id: 'education', label: 'Education', icon: GraduationCap },
];
const OPTIONAL: { id: Id; label: string; icon: typeof Phone }[] = [
  { id: 'players', label: 'Players & Teams Trained', icon: Users },
  { id: 'achievements', label: 'Awards & Achievements', icon: Trophy },
  { id: 'about', label: 'Philosophy & About', icon: FileText },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'social', label: 'Social Links', icon: Globe },
  { id: 'photo', label: 'Profile Photo', icon: Camera },
  { id: 'privacy', label: 'Profile Visibility', icon: Lock },
];
const TITLE: Record<Id, string> = {
  basic: 'Basic & Contact Info', sports: 'Sports & Coaching Level', experience: 'Coaching Experience', qualifications: 'Certifications & Licences',
  education: 'Education', players: 'Players & Teams Trained', achievements: 'Awards & Achievements', about: 'Philosophy & About',
  skills: 'Skills', social: 'Social Links', photo: 'Profile Photo', privacy: 'Profile Visibility',
};

function summarize(id: Id, p: Profile): { text: string; done: boolean } {
  const n = (a: unknown) => (Array.isArray(a) ? a.length : 0);
  switch (id) {
    case 'basic': {
      const age = ageFromDob(p.dob);
      const text = [realName(p.fullName), p.location?.city, age ? `${age} yrs` : ''].filter(Boolean).join(' · ');
      return { text: text || 'Name, city, phone, short bio', done: !!realName(p.fullName) && !!p.location?.city };
    }
    case 'sports': {
      const text = [(p.sportsSpecialization || []).join(', '), p.coachingLevel, p.yearsOfExperience ? `${p.yearsOfExperience} yrs` : ''].filter(Boolean).join(' · ');
      return { text: text || 'Sports you coach, age groups, level', done: n(p.sportsSpecialization) > 0 };
    }
    case 'experience': {
      const cur = (p.experience || []).find((e: any) => e?.current)?.organization || p.experience?.[0]?.organization;
      return { text: cur ? `${cur}${n(p.experience) > 1 ? ` +${n(p.experience) - 1} more` : ''}` : 'Academies, clubs and schools you have coached', done: n(p.experience) > 0 };
    }
    case 'qualifications': {
      const c = n(p.qualifications);
      return { text: c ? `${c} certificate${c === 1 ? '' : 's'}` : 'Coaching licences, diplomas, courses', done: c > 0 };
    }
    case 'education': {
      const e = n(p.education);
      return { text: e ? `${e} entr${e === 1 ? 'y' : 'ies'}` : 'Degrees and schooling', done: e > 0 };
    }
    case 'players': {
      const c = n(p.playersTrained);
      return { text: c ? `${c} player${c === 1 ? '' : 's'} / team${c === 1 ? '' : 's'}` : 'Players you developed, teams you led', done: c > 0 };
    }
    case 'achievements': {
      const a = n(p.achievements);
      return { text: a ? `${a} award${a === 1 ? '' : 's'}` : 'Coach of the year, titles won', done: a > 0 };
    }
    case 'about': {
      const parts = [p.coachingPhilosophy, p.aboutBio].filter(Boolean).length;
      return { text: parts ? `${parts} of 2 filled in` : 'Your coaching philosophy and story', done: parts > 0 };
    }
    case 'skills': {
      const c = n(p.skills);
      return { text: c ? `${c} skill${c === 1 ? '' : 's'}` : 'Fitness planning, video analysis…', done: c > 0 };
    }
    case 'social': {
      const c = Object.values(p.socialLinks || {}).filter(Boolean).length;
      return { text: c ? `${c} link${c === 1 ? '' : 's'}` : 'Instagram, YouTube, LinkedIn', done: c > 0 };
    }
    case 'photo':
      return { text: p.photo ? 'Photo added' : 'A clear face photo builds trust', done: !!p.photo };
    case 'privacy':
      return { text: ({ public: 'Public: anyone with the link', connections: 'Connections only', private: 'Private: only you' } as Record<string, string>)[p.visibility as string] || 'Public: anyone with the link', done: true };
  }
}

export default function EditCoachCv({ profile, save }: { profile: Profile; save: Save }) {
  const router = useRouter();
  const [open, setOpen] = useState<Id | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const completion = Math.min(100, profile.profileCompletion || 0);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await profileAPI.downloadCoachCV(profile._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${(profile.fullName || 'coach').replace(/\s+/g, '_')}_Coach_CV.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      void eventAPI.log('PDF_DOWNLOADED', { sport: profile.sportsSpecialization?.[0] });
    } catch {
      toast.error('Could not download the PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  const group = (title: string, items: typeof CORE) => (
    <>
      <p className="px-4 pb-1 pt-5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft md:px-1">{title}</p>
      <ul className="border-y border-line md:overflow-hidden md:rounded-2xl md:border">
        {items.map(({ id, label, icon }, i) => {
          const s = summarize(id, profile);
          return <ListRow key={id} icon={icon} label={label} sub={s.text} done={s.done} onClick={() => setOpen(id)} last={i === items.length - 1} />;
        })}
      </ul>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 pb-6 md:grid md:grid-cols-[minmax(0,560px)_minmax(0,1fr)] md:items-start md:gap-14 md:px-8 md:pt-4">
      <div>
        <div className="px-4 pb-4 pt-6 md:px-0">
          <p className="eyebrow">Edit coach CV</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-ink"><AccentTitle>Build your CV</AccentTitle></h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${completion}%` }} />
            </div>
            <span className="font-mono text-xs font-bold text-ink-soft">{completion}%</span>
          </div>
        </div>

        {group('Core sections', CORE)}
        {group('Optional sections', OPTIONAL)}

        <p className="px-4 pb-1 pt-5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft md:px-1">View &amp; download CV</p>
        <ul className="border-y border-line md:overflow-hidden md:rounded-2xl md:border">
          <ListRow icon={Eye} label="Preview CV" sub="See it the way academies see it" onClick={() => router.push('/me')} />
          <ListRow icon={FileDown} label="Download PDF" sub="A4 resume with all your sections" busy={pdfBusy} onClick={downloadPdf} last />
        </ul>
      </div>

      <aside className="hidden md:block">
        <div className="sticky top-24 flex flex-col items-center rounded-3xl bg-cream px-8 py-8">
          <p className="eyebrow">Live preview</p>
          <p className="mb-5 mt-2 text-center text-sm text-ink-soft">Your Story card updates each time you save.</p>
          <StoryPreview profile={profile} maxWidth={300} kind="coach" />
        </div>
      </aside>

      {open && <CoachSheet id={open} profile={profile} save={save} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CoachSheet({ id, profile, save, onClose }: { id: Id; profile: Profile; save: Save; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
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
    <Sheet title={TITLE[id]} onClose={onClose}>
      {id === 'basic' && <CoachBasicForm {...props} />}
      {id === 'sports' && <CoachSportsForm {...props} />}
      {id === 'experience' && <ExperienceForm {...props} />}
      {id === 'qualifications' && <QualificationsForm {...props} />}
      {id === 'education' && <EducationForm {...props} />}
      {id === 'players' && <PlayersForm {...props} />}
      {id === 'achievements' && <AchievementsForm {...props} />}
      {id === 'about' && <CoachAboutForm {...props} />}
      {id === 'skills' && <SkillsForm {...props} />}
      {id === 'social' && <SocialForm {...props} />}
      {id === 'photo' && <CoachPhotoForm profile={profile} save={save} onClose={onClose} />}
      {id === 'privacy' && <PrivacyForm {...props} />}
    </Sheet>
  );
}

// ── Basic & contact ───────────────────────────────────────────────────────────
function CoachBasicForm({ profile, busy, commit }: FormProps) {
  const [f, setF] = useState({
    fullName: realName(profile.fullName), username: profile.username || '', dob: profile.dob ? String(profile.dob).slice(0, 10) : '',
    gender: profile.gender || '', city: profile.location?.city || '', state: canonicalState(profile.location?.state) || profile.location?.state || '',
    countryCode: profile.countryCode || '+91', phone: profile.phone || '', nationality: profile.nationality || '', tagline: profile.tagline || '',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const age = ageFromDob(f.dob);

  return (
    <FormBody busy={busy} onSubmit={() => {
      if (f.fullName.trim().length < 2) return toast.error('Enter your full name');
      if (f.username && !/^[a-z0-9][a-z0-9_-]{2,29}$/.test(f.username)) return toast.error('Username: 3–30 letters, numbers, - or _');
      return commit({
        username: f.username || undefined, fullName: f.fullName.trim(), dob: f.dob || undefined, gender: f.gender || undefined,
        location: { ...(profile.location || {}), city: f.city.trim(), state: f.state.trim() },
        countryCode: f.countryCode, phone: f.phone.trim() || undefined, nationality: f.nationality.trim() || undefined, tagline: f.tagline.trim() || undefined,
      });
    }}>
      <Field label="Full name *"><input className={inputCls} autoComplete="name" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
      <Field label="Username" hint={`Your public CV link: linksports.in/cv/${f.username || 'your-name'}`}>
        <input className={inputCls} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={30} placeholder="e.g. coach-sharma" value={f.username}
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
      <Field label="Phone" hint="Only shared with people you allow.">
        <div className="flex gap-2">
          <select className={inputCls + ' !w-28 shrink-0'} aria-label="Country code" value={f.countryCode} onChange={(e) => set('countryCode', e.target.value)}>
            {['+91', '+1', '+44', '+61', '+971', '+65', '+60', '+49', '+33', '+81', '+86', '+92', '+880', '+94', '+977', '+27'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className={inputCls} type="tel" inputMode="tel" autoComplete="tel-national" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
      </Field>
      <Field label="One-line tagline"><input className={inputCls} maxLength={120} placeholder="e.g. UEFA B licensed football coach, 12 years" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
    </FormBody>
  );
}

// ── Sports, age groups, level ─────────────────────────────────────────────────
const AGE_GROUPS = ['Under 10', 'Under 12', 'Under 14', 'Under 16', 'Under 19', 'Seniors', 'Women', 'Adults', 'Para athletes'];
const COACH_LEVELS = ['Assistant coach', 'Head coach', 'Academy director', 'Fitness trainer', 'Goalkeeping coach', 'Strength & conditioning', 'Physical education teacher', 'Sports physio', 'Analyst'];
const AVAILABILITY: [string, string][] = [['full_time', 'Full time'], ['part_time', 'Part time'], ['freelance', 'Freelance'], ['consulting', 'Consulting'], ['not_available', 'Not available']];

function Chips({ options, value, onChange, max }: { options: string[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const list = [...value.filter((v) => !options.includes(v)), ...options];
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o} type="button" aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : max && value.length >= max ? value : [...value, o])}
            className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold transition ${on ? 'border-brand bg-brand text-white' : 'border-line text-ink hover:border-ink'}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function CoachSportsForm({ profile, busy, commit }: FormProps) {
  const sports = useSports();
  const [f, setF] = useState({
    sports: (profile.sportsSpecialization || []) as string[], ages: (profile.ageGroupsCoached || []) as string[],
    years: profile.yearsOfExperience != null ? String(profile.yearsOfExperience) : '', level: profile.coachingLevel || '', availability: profile.availability || 'full_time',
  });
  return (
    <FormBody busy={busy} onSubmit={() => {
      if (f.sports.length === 0) return toast.error('Pick at least one sport');
      return commit({ sportsSpecialization: f.sports, ageGroupsCoached: f.ages, yearsOfExperience: num(f.years), coachingLevel: f.level || undefined, availability: f.availability });
    }}>
      <div>
        <span className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">Sports you coach (up to 5)</span>
        <Chips options={sports} value={f.sports} onChange={(v) => setF({ ...f, sports: v })} max={5} />
      </div>
      <div>
        <span className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">Age groups</span>
        <Chips options={AGE_GROUPS} value={f.ages} onChange={(v) => setF({ ...f, ages: v })} />
      </div>
      <Field label="Role">
        <select className={inputCls} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
          <option value="">Select your role</option>
          {[...(f.level && !COACH_LEVELS.includes(f.level) ? [f.level] : []), ...COACH_LEVELS].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>
      <Field label="Years of coaching experience"><input className={inputCls} inputMode="numeric" maxLength={2} value={f.years} onChange={(e) => setF({ ...f, years: e.target.value.replace(/[^0-9]/g, '') })} /></Field>
      <Field label="Availability">
        <select className={inputCls} value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value })}>
          {AVAILABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
    </FormBody>
  );
}

// ── Coaching experience ───────────────────────────────────────────────────────
function ExperienceForm({ profile, busy, commit }: FormProps) {
  const [rows, setRows] = useState<Row[]>((profile.experience || []).map((e: any) => ({
    organization: e.organization || '', role: e.role || '', startDate: dateStr(e.startDate), endDate: dateStr(e.endDate), current: e.current ? 'yes' : '',
  })));
  return (
    <FormBody busy={busy} onSubmit={() => commit({
      experience: rows.filter((r) => r.organization?.trim()).map((r) => ({
        organization: r.organization.trim(), role: r.role?.trim() || undefined, startDate: r.startDate || undefined,
        endDate: r.current === 'yes' ? undefined : r.endDate || undefined, current: r.current === 'yes',
      })),
    })}>
      <RowEditor rows={rows} onChange={setRows} blank={{ organization: '', role: '', startDate: '', endDate: '', current: '' }} addLabel="Add experience" max={20}
        fields={[
          { key: 'organization', placeholder: 'Academy / club / school', full: true },
          { key: 'role', placeholder: 'Your role (e.g. Head coach, U-14)', full: true },
          { key: 'startDate', placeholder: 'From', kind: 'date', full: false },
          { key: 'endDate', placeholder: 'To', kind: 'date', full: false, hideWhen: 'current' },
          { key: 'current', placeholder: 'I currently work here', kind: 'check' },
        ]} />
    </FormBody>
  );
}

// ── Certifications ────────────────────────────────────────────────────────────
function QualificationsForm({ profile, busy, commit }: FormProps) {
  const [rows, setRows] = useState<Row[]>((profile.qualifications || []).map((q: any) => ({ name: q.name || '', issuer: q.issuer || '', year: q.year ? String(q.year) : '' })));
  return (
    <FormBody busy={busy} onSubmit={() => commit({
      qualifications: mergeRows(profile.qualifications,
        rows.filter((r) => r.name?.trim()).map((r) => ({ name: r.name.trim(), issuer: r.issuer?.trim() || undefined, year: num(r.year) })), 'name'),
    })}>
      <p className="text-sm text-ink-soft">Coaching licences, diplomas and courses, for example AFC C Licence, NIS Diploma, BCCI Level 1.</p>
      <RowEditor rows={rows} onChange={setRows} blank={{ name: '', issuer: '', year: '' }} addLabel="Add certificate" max={20}
        fields={[
          { key: 'name', placeholder: 'Certificate / licence name', full: true },
          { key: 'issuer', placeholder: 'Issued by', full: false },
          { key: 'year', placeholder: 'Year', kind: 'year', full: false },
        ]} />
    </FormBody>
  );
}

// ── Players & teams trained ───────────────────────────────────────────────────
function PlayersForm({ profile, busy, commit }: FormProps) {
  const [rows, setRows] = useState<Row[]>((profile.playersTrained || []).map((t: any) => ({ name: t.name || '', result: t.result || '', year: t.year ? String(t.year) : '', description: t.description || '' })));
  return (
    <FormBody busy={busy} onSubmit={() => commit({
      playersTrained: rows.filter((r) => r.name?.trim()).map((r) => ({ name: r.name.trim(), result: r.result?.trim() || undefined, year: num(r.year), description: r.description?.trim() || undefined })),
    })}>
      <p className="text-sm text-ink-soft">Players you developed or teams you led, with the result. This is what academies look at first.</p>
      <RowEditor rows={rows} onChange={setRows} blank={{ name: '', result: '', year: '', description: '' }} addLabel="Add player or team" max={20}
        fields={[
          { key: 'name', placeholder: 'Player or team name', full: true },
          { key: 'result', placeholder: 'Result (e.g. State champions)', full: false },
          { key: 'year', placeholder: 'Year', kind: 'year', full: false },
          { key: 'description', placeholder: 'What you did (optional)', kind: 'textarea' },
        ]} />
    </FormBody>
  );
}

// ── Philosophy & about ────────────────────────────────────────────────────────
function CoachAboutForm({ profile, busy, commit }: FormProps) {
  const [f, setF] = useState({ coachingPhilosophy: profile.coachingPhilosophy || '', aboutBio: profile.aboutBio || '' });
  return (
    <FormBody busy={busy} onSubmit={() => commit({ coachingPhilosophy: f.coachingPhilosophy.trim() || undefined, aboutBio: f.aboutBio.trim() || undefined })}>
      <Field label="Coaching philosophy"><textarea className={textareaCls} rows={5} maxLength={2000} placeholder="How you train, what you value, how you build players" value={f.coachingPhilosophy} onChange={(e) => setF({ ...f, coachingPhilosophy: e.target.value })} /></Field>
      <Field label="About you"><textarea className={textareaCls} rows={5} maxLength={2000} placeholder="Your journey as a player and coach" value={f.aboutBio} onChange={(e) => setF({ ...f, aboutBio: e.target.value })} /></Field>
    </FormBody>
  );
}

// ── Profile photo ─────────────────────────────────────────────────────────────
function CoachPhotoForm({ profile, save, onClose }: { profile: Profile; save: Save; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const photo = getPhotoUrl(profile.photo);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const small = await compressImage(file);
      const res = await uploadAPI.uploadImage(small);
      await save({ photo: res.data.data.url });
      toast.success('Profile photo updated');
      onClose();
    } catch (err) {
      toast.error(apiError(err, (err as Error)?.message || 'Could not upload the photo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 px-5 py-8">
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="grid h-40 w-40 place-items-center overflow-hidden rounded-full border-2 border-dashed border-line bg-cream hover:border-brand">
        {busy ? <Loader2 className="h-8 w-8 animate-spin text-brand" /> : photo ? <img src={photo} alt="Profile" className="h-full w-full object-cover" /> : <Camera className="h-9 w-9 text-ink/30" />}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={btnPrimary + ' w-full max-w-xs'}>{photo ? 'Change photo' : 'Choose a photo'}</button>
      <p className="text-center text-sm text-ink-soft">A clear, front-facing photo. It is shrunk automatically before upload.</p>
      <button type="button" className={btnGhost + ' w-full max-w-xs'} onClick={onClose}>Close</button>
    </div>
  );
}
