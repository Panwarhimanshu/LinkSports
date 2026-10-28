'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import AppShell from '@/components/shell/AppShell';
import { isCoachOnboarded, isOnboarded } from '@/lib/cv';
import { useCvSession } from '@/lib/useCvSession';
import AuthStep from './AuthStep';
import HomeTab from './HomeTab';
import RoleStep from './RoleStep';
import { CoachCoreStep, pickCoachSport } from './CoachOnboarding';
import { CoreStep, SportStep, pickSport } from './Onboarding';
import { btnPrimary } from './ui';

/**
 * The root screen (linksports.in). Flow for a new account:
 * login → "player or coach?" → pick a sport → core details → Home tab.
 * Returning players and coaches land straight on Home.
 */
export default function CvCreator() {
  const { ready, isAuthenticated, user, profile, save, setAccessToken, logout, reload } = useCvSession();

  // admins have their own dashboard
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

  if (user && user.role !== 'athlete' && user.role !== 'coach') {
    return (
      <AppShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">This app is for players and coaches</h1>
          <p className="text-ink-soft">You&apos;re signed in as {user.role}. Sign out and sign in with a player or coach account.</p>
          <button className={btnPrimary + ' w-full flex-none'} onClick={async () => { await logout(); window.location.reload(); }}>Sign out</button>
        </div>
      </AppShell>
    );
  }

  // first sign-in: are you a player or a coach?
  if (user?.needsRoleSelection) {
    return (
      <AppShell>
        <RoleStep onDone={reload} />
      </AppShell>
    );
  }

  if (user?.role === 'coach') {
    if (!isCoachOnboarded(profile)) {
      return (
        <AppShell>
          {!profile?.sportsSpecialization?.length
            ? <SportStep onPick={(sport) => pickCoachSport(save, sport)} title="What do you coach?" subtitle="Pick your main sport. You can add more later in Edit CV." />
            : <CoachCoreStep profile={profile} userId={user?.id} save={save} />}
        </AppShell>
      );
    }
    return (
      <AppShell tab="home" profile={profile}>
        <HomeTab profile={profile!} kind="coach" />
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
