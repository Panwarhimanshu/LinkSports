'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Activity, ClipboardList, Loader2 } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { apiError } from '@/lib/useCvSession';
import { AccentTitle } from './ui';

const OPTIONS = [
  {
    role: 'athlete' as const, title: 'I am a player', icon: Activity,
    text: 'Build a sports CV with your stats, achievements and action photos. Share one link with scouts and academies.',
  },
  {
    role: 'coach' as const, title: 'I am a coach', icon: ClipboardList,
    text: 'Show your certifications, coaching experience and the players you have trained. Be found by academies and parents.',
  },
];

/** First step after the very first sign-in: "Are you a player or a coach?" It decides which CV the account builds. */
export default function RoleStep({ onDone }: { onDone: () => Promise<void> | void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const choose = async (role: 'athlete' | 'coach') => {
    setBusy(role);
    try {
      await authAPI.chooseRole(role);
      await onDone();
    } catch (err) {
      toast.error(apiError(err, 'Could not save your choice. Please try again.'));
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-8 md:px-8 md:pt-14">
      <p className="eyebrow">Welcome to LinkSports</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-ink md:text-5xl"><AccentTitle>Who are you?</AccentTitle></h1>
      <p className="mt-2 text-ink-soft">Pick the one that fits you. It decides which CV you build, and it is set once for this account.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {OPTIONS.map(({ role, title, icon: Icon, text }) => (
          <button
            key={role}
            disabled={busy !== null}
            onClick={() => choose(role)}
            className="group relative flex min-h-[200px] flex-col rounded-3xl border border-line bg-white p-6 text-left transition hover:border-brand active:scale-[0.99] disabled:opacity-60"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cream text-brand transition group-hover:bg-brand group-hover:text-white">
              {busy === role ? <Loader2 className="h-7 w-7 animate-spin" /> : <Icon className="h-7 w-7" />}
            </span>
            <span className="mt-5 block font-display text-2xl font-semibold text-ink">{title}</span>
            <span className="mt-1.5 block text-[15px] leading-relaxed text-ink-soft">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
