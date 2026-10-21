'use client';

import { useCallback, useEffect, useState } from 'react';
import { profileAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type Profile = Record<string, any>;

/**
 * Restores the signed-in player's session and CV profile for the three app tabs.
 * `save(patch)` sends a partial update and keeps the navbar/profile store in sync; it throws on failure
 * so the caller can show the server's message.
 */
export function useCvSession() {
  const { user, isAuthenticated, fetchMe, setAccessToken, logout } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem('accessToken')) {
          await fetchMe();
          const me = useAuthStore.getState();
          if (me.user?.role === 'athlete') {
            const res = await profileAPI.getMyAthleteProfile();
            setProfile(res.data.data?.profile || res.data.data);
          }
        }
      } catch {
        // signed out or the session expired: the screen shows the login
      } finally {
        setReady(true);
      }
    })();
  }, [fetchMe]);

  const save = useCallback(async (patch: Record<string, unknown>): Promise<Profile> => {
    const res = await profileAPI.updateAthleteProfile(patch);
    const next = res.data.data as Profile;
    setProfile(next);
    useAuthStore.getState().setProfile(next);
    return next;
  }, []);

  return { ready, isAuthenticated, user, profile, setProfile, save, setAccessToken, logout };
}

/** Pulls the server's message out of an axios error. */
export const apiError = (e: unknown, fallback = 'Something went wrong. Please try again.') =>
  (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || fallback;
