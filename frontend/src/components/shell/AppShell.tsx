'use client';

import Link from 'next/link';
import toast from 'react-hot-toast';
import { Home, PencilLine, Share2, UserRound } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { eventAPI } from '@/lib/api';
import { realName, shareUrlFor } from '@/lib/cv';

export type Tab = 'home' | 'edit' | 'me';

const TABS: { id: Tab; href: string; label: string; icon: typeof Home }[] = [
  { id: 'home', href: '/', label: 'Home', icon: Home },
  { id: 'edit', href: '/edit', label: 'Edit CV', icon: PencilLine },
  { id: 'me', href: '/me', label: 'My Profile', icon: UserRound },
];

interface Props {
  children: React.ReactNode;
  /** Highlights a tab and shows the bottom bar. Leave undefined on screens that have no tabs (login, setup). */
  tab?: Tab;
  /** Owner's profile. When it has a public link, the Share button appears in the top bar. */
  profile?: Record<string, any> | null;
  /** No top or bottom bar at all (the login screen draws its own header). */
  bare?: boolean;
}

/**
 * The app frame: a 430px column centred on desktop and full width on phones, with a persistent
 * top bar (logo + Share) and, once the player is set up, a three-tab bottom bar.
 */
export default function AppShell({ children, tab, profile, bare }: Props) {
  const url = profile?.profileUrl ? shareUrlFor(profile.profileUrl) : '';

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Profile link copied'); }
    catch { window.prompt('Copy your profile link', url); }
  };

  const share = async () => {
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${realName(profile?.fullName) || 'My'} — Sports CV`, text: 'My sports CV on LinkSports', url });
      } else {
        await copy();
      }
      void eventAPI.log('PROFILE_SHARED', { sport: profile?.primarySport });
    } catch (e: any) {
      if (e?.name !== 'AbortError') await copy(); // share sheet refused: fall back to copying the link
    }
  };

  return (
    <div className="min-h-screen bg-[#e9e6dc]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white shadow-[0_0_60px_-24px_rgba(0,0,0,0.35)]">
        {!bare && (
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur">
            <Link href="/" aria-label="LinkSports home" className="flex items-center"><Logo height={30} /></Link>
            {url && (
              <button
                onClick={share}
                aria-label="Share my CV"
                className="grid h-11 w-11 place-items-center rounded-full text-ink transition hover:bg-cream active:scale-95"
              >
                <Share2 className="h-5 w-5" />
              </button>
            )}
          </header>
        )}

        <main className="flex flex-1 flex-col">{children}</main>

        {tab && !bare && (
          <nav
            aria-label="Main"
            className="sticky bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <ul className="grid h-16 grid-cols-3">
              {TABS.map(({ id, href, label, icon: Icon }) => {
                const active = id === tab;
                return (
                  <li key={id}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-full flex-col items-center justify-center gap-1 transition-colors ${active ? 'text-brand' : 'text-ink-soft hover:text-ink'}`}
                    >
                      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                      <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
