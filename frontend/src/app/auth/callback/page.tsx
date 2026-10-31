'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/lib/api';
import { Loader2 } from 'lucide-react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAccessToken, fetchMe } = useAuthStore();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error || !code) {
      router.replace('/auth/login?error=oauth_failed');
      return;
    }

    // the redirect only carries a one-time code; the token itself never appears in the address bar
    authAPI.exchangeOAuthCode(code)
      .then((res) => {
        setAccessToken(res.data.data.accessToken);
        window.history.replaceState(null, '', '/auth/callback');
        return fetchMe();
      })
      .then(() => router.replace('/'))
      .catch(() => router.replace('/auth/login?error=oauth_failed'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand" />
      <p className="text-gray-500 text-sm">Completing sign in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
