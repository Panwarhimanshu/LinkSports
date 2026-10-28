'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { isOnboardedFor } from '@/lib/cv';
import { useCvSession } from '@/lib/useCvSession';
import AppShell, { type Tab } from './AppShell';

type Ctx = ReturnType<typeof useCvSession> & { profile: Record<string, any> };

/**
 * Wrapper for the Edit CV and My Profile tabs. Sends visitors who aren't signed in (or haven't finished
 * setup) back to the root screen, which handles login and setup, then renders the tab inside the shell.
 */
export default function TabPage({ tab, children }: { tab: Tab; children: (ctx: Ctx) => React.ReactNode }) {
  const router = useRouter();
  const session = useCvSession();
  const { ready, isAuthenticated, user, profile } = session;
  const allowed = ready && isAuthenticated && (user?.role === 'athlete' || user?.role === 'coach') && !user?.needsRoleSelection && isOnboardedFor(user?.role, profile);

  useEffect(() => {
    if (ready && !allowed) router.replace('/');
  }, [ready, allowed, router]);

  if (!allowed) {
    return (
      <AppShell bare>
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-ink" /></div>
      </AppShell>
    );
  }

  return (
    <AppShell tab={tab} profile={profile}>
      {children({ ...session, profile: profile! })}
    </AppShell>
  );
}
