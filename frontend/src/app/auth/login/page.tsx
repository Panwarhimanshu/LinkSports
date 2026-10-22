'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/**
 * There are no passwords: everyone signs in with a one-time email code on the start page.
 * This route only finishes the Google sign-in hand-off (?token=…) and sends everyone else to the start page.
 */
function Handoff() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAccessToken, fetchMe } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/');
      return;
    }
    setAccessToken(token);
    if (searchParams.get('newUser') === 'true') {
      // every new sign-in is a player: no role picker
      fetchMe().then(() => authAPI.updateRole('athlete')).catch(() => undefined).finally(() => router.replace('/'));
    } else {
      fetchMe().finally(() => router.replace('/'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
      <p className="text-sm text-ink-soft">Signing you in…</p>
    </div>
  );
}

export default function LoginHandoff() {
  return (
    <Suspense fallback={null}>
      <Handoff />
    </Suspense>
  );
}
