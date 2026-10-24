'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Check, Loader2, Mail } from 'lucide-react';
import { authAPI } from '@/lib/api';
import Logo from '@/components/shared/Logo';
import Ticker from './Ticker';
import { AccentTitle, btnGhost, btnPrimary, inputCls, labelCls } from './ui';

// Login: email one-time code (and Google when enabled). The same code signs in an existing account or
// creates a new one, so "Join free" only changes the copy.
export default function AuthStep({ onToken }: { onToken: (t: string) => void }) {
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
      if (err.response?.data?.error?.code === 'OTP_TOO_SOON') { setStage('otp'); setWait(30); } // a code is already on its way
      toast.error(err.response?.data?.error?.message || 'Could not send the code. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e?: React.FormEvent, code = otp) => {
    e?.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return toast.error('Enter the 6-digit code');
    setBusy(true);
    try {
      const res = await authAPI.verifyEmailOtp(address, code);
      onToken(res.data.data.accessToken);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Could not verify the code');
      setOtp('');
      setBusy(false);
    }
  };

  const title = stage === 'otp' ? 'Check your email' : joining ? 'Join LinkSports' : 'Welcome back';
  const primary = btnPrimary + ' mt-4 w-full';

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-cream bg-[radial-gradient(70%_32%_at_25%_0%,rgba(0,79,171,0.10),transparent)]">
      <header className="mx-auto w-full max-w-6xl px-5 pt-6 lg:px-10 lg:pt-8">
        <Link href="/" aria-label="LinkSports"><Logo height={34} /></Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-8 lg:px-0">
       <div className="w-full max-w-md lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-16 lg:px-10">
        <div>
        <p className="eyebrow px-1">Player CV · Free forever</p>
        <h2 className="mb-6 mt-3 px-1 font-display text-[46px] font-bold uppercase leading-[0.93] tracking-tight text-brand lg:mb-0 lg:text-[88px] xl:text-[104px]">
          Your game.<br />Your CV.<br />One link.
        </h2>
        <p className="mt-7 hidden max-w-md px-1 text-lg leading-relaxed text-ink-soft lg:block">
          Build a professional sports CV in about three minutes. Download the PDF, post the Story card, and let scouts find you.
        </p>
        </div>

        <div>

        <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_28px_60px_-34px_rgba(0,35,90,0.4)]">
          <h1 className="font-display text-3xl font-semibold text-ink"><AccentTitle>{title}</AccentTitle></h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {stage === 'otp'
              ? <>We sent a 6-digit code to <span className="break-all font-semibold text-ink">{address}</span></>
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
                  id="email" type="email" inputMode="email" autoComplete="email"
                  placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="h-full min-w-0 flex-1 bg-transparent pr-3.5 text-base text-ink placeholder:text-ink/35 focus:outline-none"
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
                value={otp}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(v);
                  if (v.length === 6) void verifyOtp(undefined, v); // sign in as soon as the last digit is typed or pasted
                }}
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
              <p className="mt-3 text-xs text-ink-soft">The code can take up to a minute. Can&apos;t find it? Check spam or promotions, then tap Resend.</p>
            </form>
          )}

          {stage === 'email' && (
            <>
              <p className="mt-6 text-center text-sm text-ink-soft">
                {joining ? 'Already on LinkSports? ' : 'New to LinkSports? '}
                <button type="button" onClick={() => setJoining(!joining)} className="font-semibold text-brand hover:underline">{joining ? 'Sign in' : 'Join free'}</button>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
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
