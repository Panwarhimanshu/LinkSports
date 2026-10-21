'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import AppShell from '@/components/shell/AppShell';
import { isOnboarded } from '@/lib/cv';
import { useCvSession } from '@/lib/useCvSession';
import AuthStep from './AuthStep';
import HomeTab from './HomeTab';
import { CoreStep, SportStep, pickSport } from './Onboarding';
import { btnPrimary } from './ui';

/**
 * The root screen (linksports.in). Flow for a new player: login → pick a sport → core details → Home tab.
 * Returning players land straight on Home.
 */
export default function CvCreator() {
  const { ready, isAuthenticated, user, profile, save, setAccessToken, logout } = useCvSession();

  // the CV app is for players; admins have their own dashboard
  useEffect(() => {
    if (ready && user?.role === 'admin') window.location.replace('/admin');
  }, [ready, user?.role]);

  if (!ready || user?.role === 'admin') {
    return (
      <AppShell bare>
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-ink" /></div>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppShell bare>
        <AuthStep onToken={(t) => { setAccessToken(t); window.location.reload(); }} />
      </AppShell>
    );
  }

  if (user && user.role !== 'athlete') {
    return (
      <AppShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">The CV app is for players</h1>
          <p className="text-ink-soft">You&apos;re signed in as {user.role}. Sign out and sign in with a player account.</p>
          <button className={btnPrimary + ' w-full flex-none'} onClick={async () => { await logout(); window.location.reload(); }}>Sign out</button>
        </div>
      </AppShell>
    );
  }

  if (!isOnboarded(profile)) {
    return (
      <AppShell>
        {!profile?.primarySport
          ? <SportStep onPick={(sport) => pickSport(save, sport)} />
          : <CoreStep profile={profile} userId={user?.id} save={save} onDone={() => undefined} />}
      </AppShell>
    );
  }

  return (
    <AppShell tab="home" profile={profile}>
      <HomeTab profile={profile!} />
    </AppShell>
  );
}
