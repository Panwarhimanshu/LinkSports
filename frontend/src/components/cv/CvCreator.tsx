'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toJpeg, toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Check, ChevronRight, Copy, Download, Eye, FileText, ImageIcon, Loader2, Mail, Plus, Search, Share2, Trash2, Camera,
} from 'lucide-react';
import { authAPI, eventAPI, profileAPI, settingsAPI, uploadAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { buildStoryData, MIN_COMPLETE, shareUrlFor, toDataUrl, type StoryData } from '@/lib/cv';
import { getPhotoUrl } from '@/lib/utils';
import Logo from '@/components/shared/Logo';
import { SPORTS } from './sports';
import SportIcon from './SportIcon';
import StoryCard, { STORY_H, STORY_W } from './StoryCard';
import Ticker from './Ticker';

type Row = Record<string, string>;
interface CvForm {
  fullName: string; dob: string; gender: string; city: string; state: string; phone: string;
  position: string; height: string; weight: string; tagline: string; photo: string;
  teams: Row[]; tournaments: Row[]; achievements: Row[]; videos: Row[]; instagram: string;
}

const emptyForm: CvForm = {
  fullName: '', dob: '', gender: '', city: '', state: '', phone: '', position: '', height: '', weight: '',
  tagline: '', photo: '', teams: [{ organization: '', role: '' }], tournaments: [{ name: '', year: '', result: '' }],
  achievements: [{ title: '', year: '', level: '' }], videos: [{ url: '' }], instagram: '',
};

const SECTIONS = ['Basic info', 'Team / Academy', 'Tournaments', 'Achievements', 'Photo & media'] as const;
const inputCls = 'w-full h-12 px-4 rounded-xl border border-line bg-cream/60 text-base text-ink placeholder:text-ink/35 focus:outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 transition';
const labelCls = 'block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft mb-1.5';
const btnPrimary = 'flex-1 h-12 px-6 rounded-full bg-brand hover:bg-brand-dark text-white font-display text-[15px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition';
const btnSecondary = 'flex-1 h-12 px-6 rounded-full border border-brand text-brand hover:bg-brand/5 font-display text-[15px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition';
const btnGhost = 'h-12 px-5 rounded-full border border-line hover:border-ink text-ink font-display text-[15px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition';

const nonEmpty = (rows: Row[], key: string) => rows.filter((r) => r[key]?.trim());
const num = (v: string) => (v?.trim() && !isNaN(Number(v)) ? Number(v) : undefined);

function fromProfile(p: Record<string, any>): CvForm {
  const rows = <T,>(arr: T[] | undefined, fallback: T[]) => (arr && arr.length ? arr : fallback);
  return {
    fullName: p.fullName && p.fullName !== 'Player' ? p.fullName : '', dob: p.dob ? String(p.dob).slice(0, 10) : '', gender: p.gender || '',
    city: p.location?.city || '', state: p.location?.state || '', phone: p.phone || '', position: p.position || '',
    height: p.height != null ? String(p.height) : '', weight: p.weight != null ? String(p.weight) : '',
    tagline: p.tagline || '', photo: p.photo || '',
    teams: rows(p.playingHistory?.map((h: any) => ({ organization: h.organization || '', role: h.role || '' })), emptyForm.teams),
    tournaments: rows(p.tournaments?.map((t: any) => ({ name: t.name || '', year: t.year ? String(t.year) : '', result: t.result || '' })), emptyForm.tournaments),
    achievements: rows(p.achievements?.map((a: any) => ({ title: a.title || '', year: a.year ? String(a.year) : '', level: a.level || '' })), emptyForm.achievements),
    videos: rows((p.media || []).filter((m: any) => m.type === 'video').map((m: any) => ({ url: m.url || '' })), emptyForm.videos),
    instagram: p.socialLinks?.instagram || '',
  };
}

function toPayload(sport: string, f: CvForm) {
  return {
    primarySport: sport,
    fullName: f.fullName.trim() || undefined,
    dob: f.dob || undefined,
    gender: f.gender || undefined,
    phone: f.phone.trim() || undefined,
    location: { city: f.city.trim(), state: f.state.trim() },
    position: f.position.trim() || undefined,
    height: num(f.height), weight: num(f.weight),
    tagline: f.tagline.trim() || undefined,
    photo: f.photo || undefined,
    playingHistory: nonEmpty(f.teams, 'organization').map((t) => ({ organization: t.organization.trim(), role: t.role?.trim() || undefined })),
    tournaments: nonEmpty(f.tournaments, 'name').map((t) => ({ name: t.name.trim(), year: num(t.year), result: t.result?.trim() || undefined })),
    achievements: nonEmpty(f.achievements, 'title').map((a) => ({ title: a.title.trim(), year: num(a.year), level: a.level?.trim() || undefined })),
    media: nonEmpty(f.videos, 'url').map((v) => ({
      type: 'video', url: v.url.trim(),
      platform: /youtu/i.test(v.url) ? 'YouTube' : /instagram/i.test(v.url) ? 'Instagram' : /vimeo/i.test(v.url) ? 'Vimeo' : 'Other',
    })),
    socialLinks: { instagram: f.instagram.trim() || undefined },
  };
}

export default function CvCreator() {
  const { user, isAuthenticated, setAccessToken, fetchMe, logout } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [section, setSection] = useState(0);
  const [sport, setSport] = useState('');
  const [form, setForm] = useState<CvForm>(emptyForm);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  // ── bootstrap: restore session, load existing CV, jump to the right step ──
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          await fetchMe();
          const me = useAuthStore.getState();
          if (me.user?.role === 'athlete') {
            const res = await profileAPI.getMyAthleteProfile();
            const p = res.data.data?.profile || res.data.data;
            setProfile(p);
            setForm(fromProfile(p));
            setSport(p.primarySport || '');
            setStep(!p.primarySport ? 2 : (p.profileCompletion || 0) >= MIN_COMPLETE ? 4 : 3);
          } else if (me.user) {
            setStep(2);
          }
        }
      } catch {
        // expired session → AuthStep shows; signed in but no CV yet → start at sport selection
        if (useAuthStore.getState().isAuthenticated) setStep(2);
      } finally {
        setReady(true);
      }
    })();
  }, [fetchMe]);

  const set = <K extends keyof CvForm>(k: K, v: CvForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useCallback(async (): Promise<Record<string, any> | null> => {
    setSaving(true);
    try {
      const res = await profileAPI.updateAthleteProfile(toPayload(sport, form));
      const p = res.data.data;
      setProfile(p);
      useAuthStore.getState().setProfile(p); // keeps the navbar avatar/name in sync
      return p;
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || 'Could not save. Check your connection and try again.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [sport, form]);

  const pickSport = async (name: string) => {
    setSport(name);
    setSaving(true);
    try {
      const res = await profileAPI.updateAthleteProfile({ primarySport: name });
      setProfile(res.data.data);
      useAuthStore.getState().setProfile(res.data.data);
      void eventAPI.log('SPORT_SELECTED', { sport: name });
      setStep(3);
      setSection(0);
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || 'Could not save your sport.');
    } finally {
      setSaving(false);
    }
  };

  const nextSection = async () => {
    if (section === 0 && form.fullName.trim().length < 2) return toast.error('Enter your full name');
    const p = await save(); // autosave on every Next
    if (!p) return;
    if (section < SECTIONS.length - 1) setSection(section + 1);
    else { toast.success('CV saved!'); setStep(4); }
  };

  if (!ready) {
    return <Shell><div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-ink" /></div></Shell>;
  }

  // ── Step 1: auth ──
  if (!isAuthenticated) {
    return (
      <Shell wide>
        <AuthStep onToken={async (t) => { setAccessToken(t); window.location.reload(); }} />
      </Shell>
    );
  }

  // the CV creator is for players; send admins to their dashboard instead of a dead end
  if (user?.role === 'admin') {
    if (typeof window !== 'undefined') window.location.replace('/admin');
    return <Shell><div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div></Shell>;
  }

  if (user && user.role !== 'athlete') {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4">
          <h1 className="text-xl font-bold">The CV creator is for players</h1>
          <p className="text-ink-soft">You're signed in as {user.role}. Sign out and sign in with a player account.</p>
          <button className={btnPrimary + ' flex-none w-full'} onClick={async () => { await logout(); window.location.reload(); }}>Sign out</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      aside={step >= 3 || sport ? (
        <DesktopPreview data={liveStory(sport, form, profile)} title={<>Live <span className="text-brand">preview</span></>} caption="Updates as you type. Download it on the last step." />
      ) : undefined}
    >
      <Header
        step={step}
        onBack={step > 2 ? () => (step === 4 ? setStep(3) : section > 0 ? setSection(section - 1) : setStep(2)) : undefined}
      />
      {step === 2 && <SportStep selected={sport} busy={saving} onPick={pickSport} />}
      {step === 3 && (
        <FormStep
          section={section} setSection={setSection} form={form} set={set} saving={saving} onNext={nextSection}
        />
      )}
      {step === 4 && profile && (
        <ExportStep
          profile={profile}
          onChangeSport={() => setStep(2)}
        />
      )}
    </Shell>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────
//  wide  → edge-to-edge page (login)
//  aside → white form column on the left, cream "stage" with the live Story card on the right
//  else  → one centered card
function Shell({ children, aside, wide }: { children: React.ReactNode; aside?: React.ReactNode; wide?: boolean }) {
  const layout = wide
    ? 'lg:max-w-none'
    : aside
      ? 'lg:max-w-none lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,38vw)]'
      : 'lg:max-w-4xl lg:py-8';
  const main = wide
    ? 'bg-cream'
    : aside
      ? 'bg-white lg:border-r lg:border-line'
      : 'bg-white lg:min-h-[calc(100vh-4rem)] lg:rounded-3xl lg:border lg:border-line';
  return (
    <div className="min-h-screen bg-cream">
      <div className={`mx-auto w-full max-w-[430px] ${layout}`}>
        <main className={`w-full min-h-screen flex flex-col relative ${main}`}>{children}</main>
        {aside && <aside className="hidden lg:flex flex-col items-center justify-center sticky top-0 h-screen px-10">{aside}</aside>}
      </div>
    </div>
  );
}

/** Heading with its last word picked out in the brand colour. */
function AccentTitle({ children, className = '' }: { children: string; className?: string }) {
  const words = children.split(' ');
  const last = words.pop();
  return (
    <span className={className}>
      {words.length > 0 && `${words.join(' ')} `}
      <span className="text-brand">{last}</span>
    </span>
  );
}

function ScaledStory({ data, logo, width }: { data: StoryData; logo: string | null; width: number }) {
  const scale = width / STORY_W;
  return (
    <div
      className="overflow-hidden rounded-3xl bg-slate-900 ring-1 ring-black/5 shadow-[0_36px_80px_-28px_rgba(0,35,90,0.55)]"
      style={{ width, height: (width * STORY_H) / STORY_W, position: 'relative' }}
    >
      <div style={{ width: STORY_W, height: STORY_H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
        <StoryCard data={data} logoSrc={logo} />
      </div>
    </div>
  );
}

/** Small floating stat badge that overlaps the preview. */
function StatChip({ icon, title, sub, className }: { icon: React.ReactNode; title: string; sub: string; className: string }) {
  return (
    <div className={`absolute flex items-center gap-2.5 rounded-2xl border border-line bg-white/95 px-3 py-2 shadow-[0_14px_34px_-14px_rgba(0,0,0,0.35)] backdrop-blur ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">{icon}</span>
      <span className="leading-tight">
        <span className="block font-display text-sm font-semibold text-ink">{title}</span>
        <span className="block font-mono text-[10px] uppercase tracking-widest text-ink-soft">{sub}</span>
      </span>
    </div>
  );
}

function DesktopPreview({ data, title, caption }: { data: StoryData; title: React.ReactNode; caption: string }) {
  const [logo, setLogo] = useState<string | null>(null);
  const [width, setWidth] = useState(440);
  useEffect(() => { toDataUrl('/logo.png').then(setLogo); }, []);
  // as large as the window height allows (leaving room for the title), within 340–560px wide
  useEffect(() => {
    const fit = () => setWidth(Math.round(Math.min(560, Math.max(340, ((window.innerHeight - 190) * STORY_W) / STORY_H))));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <>
      <p className="eyebrow">Story card · 9:16</p>
      <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{title}</h2>
      <p className="mb-6 mt-1 text-sm text-ink-soft">{caption}</p>
      <div className="relative">
        <ScaledStory data={data} logo={logo} width={width} />
        <StatChip className="-left-12 top-28" icon={<ImageIcon className="h-4 w-4" />} title="1080 × 1920" sub="Story size" />
        <StatChip className="-right-10 bottom-32" icon={<FileText className="h-4 w-4" />} title="PNG or JPG" sub="One-tap export" />
      </div>
    </>
  );
}

/** Live preview built from the unsaved form, so it updates as the player types. */
function liveStory(sport: string, f: CvForm, profile: Record<string, any> | null): StoryData {
  const base = buildStoryData({
    fullName: f.fullName.trim() || 'Your Name',
    primarySport: sport,
    position: f.position.trim(),
    achievements: nonEmpty(f.achievements, 'title'),
    tournaments: nonEmpty(f.tournaments, 'name'),
    playingHistory: nonEmpty(f.teams, 'organization'),
    profileUrl: profile?.profileUrl,
  });
  return { ...base, photo: getPhotoUrl(f.photo) };
}

function Header({ step, onBack }: { step: number; onBack?: () => void }) {
  const labels = ['Sport', 'Profile', 'Share']; // login is step 1 of 4 but lives on its own screen
  return (
    <div className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:px-12">
      {onBack ? (
        <button onClick={onBack} aria-label="Back" className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-cream"><ArrowLeft className="h-5 w-5" /></button>
      ) : null}
      <Link href="/" aria-label="LinkSports home" className="flex items-center"><Logo height={30} /></Link>
      <ol className="ml-auto flex items-center gap-1">
        {labels.map((l, i) => {
          const n = i + 2;
          const state = n === step ? 'now' : n < step ? 'done' : 'todo';
          return (
            <li
              key={l}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] ${
                state === 'now' ? 'bg-brand text-white' : state === 'done' ? 'text-ink' : 'text-ink/30'
              }`}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              <span className="hidden sm:inline">{l}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// On phones the bar sits just above the app tab bar (MobileTabBar, 64px + home-indicator inset).
function BottomBar({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-0 z-20 bg-white/95 backdrop-blur border-t border-line p-3 flex gap-2 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-12 lg:justify-end lg:[&>*]:flex-none lg:[&>*]:min-w-[200px]">{children}</div>;
}

// ── Step 1: Direct entry & fast login (email OTP, Google when configured) ────
// The same code signs in an existing account or creates a new one, so "Join free" only changes the copy.
function AuthStep({ onToken }: { onToken: (t: string) => void }) {
  const [joining, setJoining] = useState(false);
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0); // resend cooldown (seconds)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === 'true';
  const address = email.trim().toLowerCase();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const sendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) return toast.error('Enter a valid email address');
    setBusy(true);
    try {
      const res = await authAPI.sendEmailOtp(address);
      setStage('otp');
      setWait(30);
      const devOtp = res.data?.data?.devOtp;
      if (devOtp) { setOtp(devOtp); toast.success(`Dev mode: code ${devOtp} filled in`); }
      else toast.success(`Code sent to ${address}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Could not send the code');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(otp)) return toast.error('Enter the 6-digit code');
    setBusy(true);
    try {
      const res = await authAPI.verifyEmailOtp(address, otp);
      onToken(res.data.data.accessToken);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Could not verify the code');
      setBusy(false);
    }
  };

  const title = stage === 'otp' ? 'Check your email' : joining ? 'Join LinkSports' : 'Welcome back';
  const primary = btnPrimary + ' mt-4 w-full';

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-cream bg-[radial-gradient(60%_40%_at_20%_0%,rgba(0,79,171,0.10),transparent)]">
      <header className="mx-auto flex w-full max-w-6xl items-center px-5 pt-6 lg:px-10 lg:pt-8">
        <Link href="/" aria-label="LinkSports"><Logo height={36} /></Link>
        <span className="ml-auto hidden font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft sm:block">India&apos;s sports network</span>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10 lg:px-0">
        <div className="grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,1fr)_448px] lg:px-10">
          {/* headline (desktop) */}
          <div className="hidden lg:block">
            <p className="eyebrow">Player CV · Free forever</p>
            <h2 className="mt-5 font-display text-[88px] font-bold uppercase leading-[0.92] tracking-tight text-brand xl:text-[104px]">
              Your game.<br />Your CV.<br />One link.
            </h2>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-ink-soft">
              Build a professional sports CV in about three minutes. Download the PDF, post the Story card, and let scouts find you.
            </p>
            <p className="mt-8 flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
              <span>3 min build</span><span className="h-3 w-px bg-line" /><span>PDF + Story</span><span className="h-3 w-px bg-line" /><span>Free</span>
            </p>
          </div>

          <div className="mx-auto w-full max-w-md lg:max-w-none">
          <p className="eyebrow mb-4 lg:hidden">Player CV · Free forever</p>
          <div className="rounded-3xl border border-line bg-white p-8 shadow-[0_28px_60px_-34px_rgba(0,35,90,0.4)]">
            <h1 className="font-display text-3xl font-semibold text-ink"><AccentTitle>{title}</AccentTitle></h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              {stage === 'otp'
                ? <>We sent a 6-digit code to <span className="font-semibold text-ink">{address}</span></>
                : joining ? 'Create your free sports CV with just your email.' : 'Sign in with your email. We will send you a one-time code.'}
            </p>

            {googleEnabled && stage === 'email' && (
              <>
                <a href={`${apiUrl}/auth/oauth/google`} className={btnGhost + ' mt-6 w-full normal-case tracking-normal'}>
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 019.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 000 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
                  Continue with Google
                </a>
                <div className="my-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
              </>
            )}

            {stage === 'email' ? (
              <form onSubmit={sendOtp} className={googleEnabled ? '' : 'mt-6'}>
                <label className={labelCls} htmlFor="email">Email address</label>
                <div className="flex h-12 items-center rounded-xl border border-line bg-cream/60 transition focus-within:border-brand focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/15">
                  <Mail className="ml-3.5 mr-2.5 h-4 w-4 text-ink/40" />
                  <input
                    id="email" type="email" inputMode="email" autoComplete="email" autoFocus
                    placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="h-full flex-1 bg-transparent pr-3.5 text-base text-ink placeholder:text-ink/35 focus:outline-none"
                  />
                </div>
                <button disabled={busy} className={primary}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-4 w-4" />}Send code
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="mt-6">
                <label className={labelCls} htmlFor="otp">6-digit code</label>
                <input
                  id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className={inputCls + ' text-center font-mono text-2xl tracking-[0.5em]'}
                />
                <button disabled={busy || otp.length !== 6} className={primary}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-4 w-4" />}Verify &amp; continue
                </button>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setStage('email'); setOtp(''); }} className="text-ink-soft hover:text-ink">Change email</button>
                  <button type="button" disabled={wait > 0 || busy} onClick={() => sendOtp()} className="font-semibold text-brand disabled:text-ink/30">
                    {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
                  </button>
                </div>
                <p className="mt-3 text-xs text-ink-soft">Can&apos;t find it? Check your spam or promotions folder.</p>
              </form>
            )}

            {stage === 'email' && (
              <>
                <p className="mt-6 text-center text-sm text-ink-soft">
                  {joining ? 'Already on LinkSports? ' : 'New to LinkSports? '}
                  <button type="button" onClick={() => setJoining(!joining)} className="font-semibold text-brand hover:underline">{joining ? 'Sign in' : 'Join free'}</button>
                </p>
                <p className="mt-2 text-center text-xs text-ink/50">
                  Have a password? <Link href="/auth/login?redirect=/" className="underline underline-offset-2">Sign in with password</Link>
                </p>
              </>
            )}
          </div>

          <p className="mt-6 flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft lg:hidden">
            <span>PDF CV</span><span className="h-3 w-px bg-line" /><span>Story card</span><span className="h-3 w-px bg-line" /><span>Share link</span>
          </p>

          {process.env.NEXT_PUBLIC_DEV_LOGIN === 'true' && (
            <button
              type="button"
              className="mt-4 h-9 w-full rounded-full border border-dashed border-orange-500 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700"
              onClick={async () => {
                try {
                  const res = await authAPI.devLogin();
                  onToken(res.data.data.accessToken);
                } catch {
                  toast.error('Dev login unavailable — set DEV_LOGIN=true in .env and restart the backend');
                }
              }}
            >
              Dev: skip login
            </button>
          )}

          <p className="mt-6 text-center text-xs text-ink/50">
            By continuing you agree to our <Link href="/terms" className="underline underline-offset-2">Terms</Link> and <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
          </p>
          </div>
        </div>
      </div>
      <Ticker />
    </div>
  );
}

// ── Step 2: Select sport ─────────────────────────────────────────────────────
function SportStep({ selected, busy, onPick }: { selected: string; busy: boolean; onPick: (s: string) => void }) {
  const [q, setQ] = useState('');
  // the list can be edited in Admin → Site & App Settings; fall back to the built-in list
  const [sports, setSports] = useState(SPORTS);
  useEffect(() => {
    settingsAPI.get().then((r) => {
      const names: string[] = r.data.data?.sports || [];
      if (names.length) setSports(names.map((name) => ({ name, emoji: '' })));
    }).catch(() => undefined);
  }, []);
  const list = useMemo(() => sports.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())), [q, sports]);
  return (
    <div className="flex-1 px-4 pb-10 pt-6 lg:px-12 lg:pt-10">
      <p className="eyebrow">Step 02 · Sport</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-ink lg:text-5xl"><AccentTitle>What do you play?</AccentTitle></h1>
      <p className="mt-2 text-ink-soft">Pick your main sport. You can change it later.</p>
      <div className="relative mt-6">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <input className={inputCls + ' pl-11'} placeholder="Search sport" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {list.map((s, i) => {
          const on = selected === s.name;
          return (
            <button
              key={s.name} disabled={busy} onClick={() => onPick(s.name)}
              className={`group relative min-h-[104px] rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
                on ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_14px_30px_-18px_rgba(0,79,171,0.5)]'
              }`}
            >
              <span className={`block font-mono text-[11px] font-bold tracking-[0.2em] ${on ? 'text-white/60' : 'text-ink/35'}`}>{String(i + 1).padStart(2, '0')}</span>
              <SportIcon
                name={s.name}
                className={`absolute right-4 top-4 h-8 w-8 transition-all duration-200 lg:h-9 lg:w-9 ${on ? 'text-white' : 'text-ink/30 group-hover:scale-110 group-hover:text-brand'}`}
              />
              <span className="mt-4 block pr-10 font-display text-xl font-semibold leading-tight">{s.name}</span>
            </button>
          );
        })}
        {list.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-line py-10 text-center text-ink-soft">No match. Choose &quot;Other&quot;.</p>}
      </div>
    </div>
  );
}

// ── Step 3: stepped form ─────────────────────────────────────────────────────
function FormStep({ section, setSection, form, set, saving, onNext }: {
  section: number; setSection: (n: number) => void; form: CvForm;
  set: <K extends keyof CvForm>(k: K, v: CvForm[K]) => void; saving: boolean; onNext: () => void;
}) {
  const last = section === SECTIONS.length - 1;
  return (
    <>
      <div className="flex-1 px-4 pt-4 pb-6 lg:px-12 lg:pt-8 lg:max-w-3xl">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {SECTIONS.map((s, i) => (
            <button key={s} onClick={() => setSection(i)} className={`shrink-0 h-9 px-4 rounded-full border font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${i === section ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft hover:border-ink'}`}>{s}</button>
          ))}
        </div>
        <p className="eyebrow mt-7">Step 03 · {String(section + 1).padStart(2, '0')} of {String(SECTIONS.length).padStart(2, '0')}</p>
        <h2 className="mb-6 mt-3 font-display text-4xl font-semibold text-ink"><AccentTitle>{SECTIONS[section]}</AccentTitle></h2>

        {section === 0 && (
          <div className="space-y-3">
            <Field label="Full name *"><input className={inputCls} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
            <Field label="Date of birth"><input type="date" className={inputCls} value={form.dob} onChange={(e) => set('dob', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
              <Field label="State"><input className={inputCls} value={form.state} onChange={(e) => set('state', e.target.value)} /></Field>
            </div>
            <Field label="Playing position"><input className={inputCls} placeholder="e.g. Striker, Opening batter" value={form.position} onChange={(e) => set('position', e.target.value)} /></Field>
            <Field label="Gender">
              <select className={inputCls} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Height (cm)"><input className={inputCls} inputMode="decimal" value={form.height} onChange={(e) => set('height', e.target.value)} /></Field>
              <Field label="Weight (kg)"><input className={inputCls} inputMode="decimal" value={form.weight} onChange={(e) => set('weight', e.target.value)} /></Field>
            </div>
            <Field label="Phone"><input className={inputCls} inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="One-line bio"><input className={inputCls} maxLength={120} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
          </div>
        )}

        {section === 1 && (
          <RowList rows={form.teams} onChange={(r) => set('teams', r)} blank={{ organization: '', role: '' }} addLabel="Add team / academy"
            render={(row, upd) => (<>
              <input className={inputCls} placeholder="Team / Academy / Club name" value={row.organization} onChange={(e) => upd('organization', e.target.value)} />
              <input className={inputCls} placeholder="Your role (optional)" value={row.role} onChange={(e) => upd('role', e.target.value)} />
            </>)} />
        )}

        {section === 2 && (
          <RowList rows={form.tournaments} onChange={(r) => set('tournaments', r)} blank={{ name: '', year: '', result: '' }} addLabel="Add tournament"
            render={(row, upd) => (<>
              <input className={inputCls} placeholder="Tournament name" value={row.name} onChange={(e) => upd('name', e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="Year" inputMode="numeric" value={row.year} onChange={(e) => upd('year', e.target.value)} />
                <input className={inputCls} placeholder="Result (e.g. Winner)" value={row.result} onChange={(e) => upd('result', e.target.value)} />
              </div>
            </>)} />
        )}

        {section === 3 && (
          <RowList rows={form.achievements} onChange={(r) => set('achievements', r)} blank={{ title: '', year: '', level: '' }} addLabel="Add achievement"
            render={(row, upd) => (<>
              <input className={inputCls} placeholder="Achievement / medal" value={row.title} onChange={(e) => upd('title', e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="Year" inputMode="numeric" value={row.year} onChange={(e) => upd('year', e.target.value)} />
                <input className={inputCls} placeholder="Level (District/State…)" value={row.level} onChange={(e) => upd('level', e.target.value)} />
              </div>
            </>)} />
        )}

        {section === 4 && <MediaSection form={form} set={set} />}
      </div>
      <BottomBar>
        <button className={btnPrimary} disabled={saving} onClick={onNext}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : last ? <><Check className="w-5 h-5" />Save & preview</> : <>Next<ChevronRight className="w-5 h-5" /></>}
        </button>
      </BottomBar>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className={labelCls}>{label}</span>{children}</label>;
}

function RowList({ rows, onChange, blank, addLabel, render }: {
  rows: Row[]; onChange: (r: Row[]) => void; blank: Row; addLabel: string;
  render: (row: Row, upd: (k: string, v: string) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="space-y-2 p-4 rounded-2xl bg-cream/70 border border-line relative">
          {render(row, (k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r))))}
          {rows.length > 1 && (
            <button aria-label="Remove" className="absolute -top-3 -right-3 grid h-8 w-8 place-items-center rounded-full border border-line bg-white hover:border-red-500" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      ))}
      <button className={btnGhost + ' w-full'} onClick={() => onChange([...rows, { ...blank }])}><Plus className="w-4 h-4" />{addLabel}</button>
    </div>
  );
}

function MediaSection({ form, set }: { form: CvForm; set: <K extends keyof CvForm>(k: K, v: CvForm[K]) => void }) {
  const [uploading, setUploading] = useState(false);
  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Photo must be under 5 MB');
    setUploading(true);
    try {
      const res = await uploadAPI.uploadImage(file);
      set('photo', res.data.data.url);
    } catch {
      toast.error('Photo upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };
  const photo = getPhotoUrl(form.photo);
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        <div className="w-32 h-32 rounded-full bg-cream border-2 border-dashed border-line overflow-hidden flex items-center justify-center">
          {photo ? <img src={photo} alt="Your photo" className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-ink/40" />}
        </div>
        <label className={btnGhost + ' cursor-pointer'}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {photo ? 'Change photo' : 'Add headshot / action photo'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <p className="text-xs text-ink-soft">Shown on your Story card. A clear face photo works best.</p>
      </div>
      <Field label="Instagram (optional)"><input className={inputCls} placeholder="https://instagram.com/yourname" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} /></Field>
      <div>
        <span className={labelCls}>Highlight video links (YouTube / Instagram)</span>
        <RowList rows={form.videos} onChange={(r) => set('videos', r)} blank={{ url: '' }} addLabel="Add video link"
          render={(row, upd) => <input className={inputCls} placeholder="https://…" inputMode="url" value={row.url} onChange={(e) => upd('url', e.target.value)} />} />
      </div>
    </div>
  );
}

// ── Step 4: preview, export, share ───────────────────────────────────────────
function ExportStep({ profile, onChangeSport }: { profile: Record<string, any>; onChangeSport: () => void }) {
  const [story, setStory] = useState<StoryData | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [busy, setBusy] = useState<'pdf' | 'story' | 'share' | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);
  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare;

  // inline photo + logo as data URLs so the export never fails on CORS
  useEffect(() => {
    let alive = true;
    (async () => {
      const [photo, logoUrl] = await Promise.all([toDataUrl(profile.photo), toDataUrl('/logo.png')]);
      if (!alive) return;
      setLogo(logoUrl);
      setStory({ ...buildStoryData(profile), photo });
    })();
    return () => { alive = false; };
  }, [profile]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / STORY_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [story]);

  const link = shareUrlFor(profile.profileUrl);
  const fileName = `${(profile.fullName || 'player').replace(/\s+/g, '_')}_LinkSports_Story.${format}`;

  const render = async (): Promise<Blob> => {
    if (!exportRef.current) throw new Error('Card not ready');
    await document.fonts?.ready;
    // make sure the photo and logo are fully decoded before drawing
    await Promise.all(Array.from(exportRef.current.querySelectorAll('img')).map((img) => img.decode?.().catch(() => undefined)));
    const opts = { width: STORY_W, height: STORY_H, pixelRatio: 1, canvasWidth: STORY_W, canvasHeight: STORY_H, backgroundColor: '#0f172a' };
    const shoot = () => (format === 'png' ? toPng(exportRef.current!, opts) : toJpeg(exportRef.current!, { ...opts, quality: 0.95 }));
    // Safari (iPhone) often leaves images blank on the first capture; the second pass is reliable
    await shoot().catch(() => undefined);
    const dataUrl = await shoot();
    return await (await fetch(dataUrl)).blob();
  };

  // Phones: a website can't write to the gallery directly. The share sheet can ("Save Image" on
  // iPhone, save/gallery targets on Android), but iOS only opens it right after a tap — so the
  // image is rendered ahead of time and the tap just hands it over.
  const isPhone = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  const prepared = useRef<{ format: string; blob: Blob } | null>(null);
  const [savePreview, setSavePreview] = useState<string | null>(null);

  useEffect(() => {
    prepared.current = null;
    if (!story || !isPhone) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const blob = await render();
        if (alive) prepared.current = { format, blob };
      } catch { /* rendered again on tap */ }
    }, 800);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, logo, format, isPhone]);

  const closePreview = () => {
    if (savePreview) URL.revokeObjectURL(savePreview);
    setSavePreview(null);
  };

  const downloadStory = async () => {
    setBusy('story');
    try {
      const blob = prepared.current?.format === format ? prepared.current.blob : await render();

      if (isPhone) {
        const file = new File([blob], fileName, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          toast('Choose "Save Image" to add it to your gallery', { icon: '📲', duration: 5000 });
          try {
            await navigator.share({ files: [file] });
            void eventAPI.log('STORY_CARD_EXPORTED', { sport: profile.primarySport, format });
            return;
          } catch (e: any) {
            if (e?.name === 'AbortError') return; // closed the sheet
            // not allowed / unsupported → fall back to press-and-hold save below
          }
        }
        setSavePreview(URL.createObjectURL(blob));
        void eventAPI.log('STORY_CARD_EXPORTED', { sport: profile.primarySport, format });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      void eventAPI.log('STORY_CARD_EXPORTED', { sport: profile.primarySport, format });
      toast.success('Story card saved');
    } catch {
      toast.error('Could not create the image. Please try again.');
    } finally { setBusy(null); }
  };

  const shareStory = async () => {
    setBusy('share');
    try {
      const blob = await render();
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Sports CV', text: `Check out my sports profile: ${link}` });
        void eventAPI.log('STORY_CARD_EXPORTED', { sport: profile.primarySport, format });
      } else {
        toast.error('Sharing isn\'t supported here — use Download.');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Could not share the image.');
    } finally { setBusy(null); }
  };

  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      const res = await profileAPI.downloadAthleteCV(profile._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${(profile.fullName || 'player').replace(/\s+/g, '_')}_Sports_CV.pdf`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      void eventAPI.log('PDF_DOWNLOADED', { sport: profile.primarySport });
    } catch {
      toast.error('Could not download the PDF.');
    } finally { setBusy(null); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); toast.success('Link copied'); }
    catch { window.prompt('Copy your link', link); }
  };

  return (
    <>
      <div className="flex-1 px-4 pt-4 pb-6 lg:px-12 lg:pt-8">
        <p className="eyebrow">Step 04 · Share</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink lg:text-5xl"><AccentTitle>Your CV is ready</AccentTitle></h1>
        <p className="text-ink-soft mt-2">Download the PDF, or post the Story card on Instagram and WhatsApp.</p>

        <div ref={wrapRef} className="mt-4 w-full overflow-hidden rounded-3xl bg-slate-900 shadow-[0_28px_60px_-24px_rgba(0,35,90,0.5)] lg:hidden" style={{ aspectRatio: '9 / 16', position: 'relative' }}>
          {story ? (
            <div style={{ width: STORY_W, height: STORY_H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
              <StoryCard data={story} logoSrc={logo} />
            </div>
          ) : <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>}
        </div>

        {/* off-screen full-size copy that is actually captured */}
        {story && (
          <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
            <StoryCard ref={exportRef} data={story} logoSrc={logo} />
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">Image format</span>
          {(['png', 'jpg'] as const).map((f) => (
            <button key={f} onClick={() => setFormat(f)} className={`h-11 rounded-full border px-5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${format === f ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:border-ink'}`}>{f}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
          <button className={btnGhost} onClick={copyLink}><Copy className="w-4 h-4" />Copy link</button>
          {canShareFiles && <button className={btnGhost} onClick={shareStory} disabled={busy !== null || !story}>{busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}Share</button>}
          <Link href="/profile/edit" className={btnGhost}>Edit CV</Link>
          <button className={btnGhost} onClick={onChangeSport}>Change sport</button>
        </div>
        <p className="text-xs text-ink-soft mt-3 break-all">Your link: {link}</p>
      </div>

      <BottomBar>
        <button className={btnPrimary + ' !px-3 whitespace-nowrap'} onClick={downloadPdf} disabled={busy !== null}>{busy === 'pdf' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}PDF CV</button>
        <button className={btnPrimary + ' !px-3 whitespace-nowrap'} onClick={downloadStory} disabled={busy !== null || !story}>{busy === 'story' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}Story</button>
        <Link href={`/athlete/${profile.profileUrl}`} className={btnSecondary + ' !px-3 whitespace-nowrap'}><Eye className="w-5 h-5" /><span className="sm:hidden">Profile</span><span className="hidden sm:inline">Public profile</span></Link>
      </BottomBar>

      {/* fallback when the share sheet isn't available: long-press saves an <img> to the gallery */}
      {savePreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-4" role="dialog" aria-label="Save your Story card">
          <p className="text-white text-center text-sm font-semibold max-w-xs">
            Press and hold the image, then tap <span className="text-blue-300">“Save to Photos”</span> or <span className="text-blue-300">“Download image”</span>
          </p>
          <img src={savePreview} alt="Your LinkSports Story card" className="mt-4 max-h-[72vh] w-auto rounded-lg shadow-2xl" />
          <button onClick={closePreview} className="mt-5 h-11 px-8 rounded-full bg-white text-ink font-semibold">Done</button>
        </div>
      )}
    </>
  );
}
