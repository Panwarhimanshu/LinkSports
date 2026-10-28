'use client';

import TabPage from '@/components/shell/TabPage';
import PublicCv from '@/components/cv/PublicCv';
import PublicCoachCv from '@/components/cv/PublicCoachCv';

// My Profile tab: the player's public CV exactly as scouts see it, plus log out.
export default function MyProfilePage() {
  return (
    <TabPage tab="me">
      {({ profile, logout, user }) => {
        const onLogout = async () => { await logout(); window.location.href = '/'; };
        return user?.role === 'coach' ? <PublicCoachCv profile={profile} onLogout={onLogout} /> : <PublicCv profile={profile} onLogout={onLogout} />;
      }}
    </TabPage>
  );
}
