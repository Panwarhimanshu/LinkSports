'use client';

import TabPage from '@/components/shell/TabPage';
import PublicCv from '@/components/cv/PublicCv';

// My Profile tab: the player's public CV exactly as scouts see it, plus log out.
export default function MyProfilePage() {
  return (
    <TabPage tab="me">
      {({ profile, logout }) => (
        <PublicCv profile={profile} onLogout={async () => { await logout(); window.location.href = '/'; }} />
      )}
    </TabPage>
  );
}
