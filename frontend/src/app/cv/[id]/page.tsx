'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AppShell from '@/components/shell/AppShell';
import PublicCv, { CvMessage } from '@/components/cv/PublicCv';
import PublicCoachCv from '@/components/cv/PublicCoachCv';
import { btnPrimary } from '@/components/cv/ui';
import { profileAPI } from '@/lib/api';

// Public CV page: linksports.in/cv/{username}. Anyone with the link can view it (unless the player made it private).
export default function PublicCvPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [kind, setKind] = useState<'player' | 'coach'>('player');
  const [state, setState] = useState<'loading' | 'ok' | 'private' | 'missing'>('loading');

  useEffect(() => {
    // one link style for everyone: try a player with this username, then a coach
    profileAPI.getAthleteProfile(id)
      .then((res) => { setProfile(res.data.data?.profile || res.data.data); setState('ok'); })
      .catch((e) => {
        if (e?.response?.status === 403) return setState('private');
        profileAPI.getCoachProfile(id)
          .then((res) => { setProfile(res.data.data?.profile || res.data.data); setKind('coach'); setState('ok'); })
          .catch((e2) => setState(e2?.response?.status === 403 ? 'private' : 'missing'));
      });
  }, [id]);

  return (
    <AppShell profile={profile}>
      {state === 'loading' && <div className="flex flex-1 items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-ink" /></div>}
      {state === 'private' && <CvMessage title="Private profile" text="This person has chosen not to share their CV publicly." />}
      {state === 'missing' && <CvMessage title="CV not found" text="This link may be wrong, or the CV was removed." />}
      {state === 'ok' && profile && (
        <>
          {kind === 'coach' ? <PublicCoachCv profile={profile} /> : <PublicCv profile={profile} />}
          <div className="px-4 pb-8 pt-2">
            <Link href="/" className={btnPrimary + ' w-full'}>Create your free Sports CV</Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
