'use client';

import Link from 'next/link';
import toast from 'react-hot-toast';
import { Home, PencilLine, Share2, UserRound } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { eventAPI } from '@/lib/api';
import { profileHandle, realName, shareUrlFor } from '@/lib/cv';

export type Tab = 'home' | 'edit' | 'me';

const TABS: { id: Tab; href: string; label: string; icon: typeof Home }[] = [
  { id: 'home', href: '/', label: 'Home', icon: Home },
  { id: 'edit', href: '/edit', label: 'Edit CV', icon: PencilLine },
  { id: 'me', href: '/me', label: 'My Profile', icon: UserRound },
];

interface Props {
  children: React.ReactNode;
  /** Highlights a tab and shows the navigation. Leave undefined on screens that have no tabs (setup, public CV). */
  tab?: Tab;
  /** Owner's profile. When it has a public link, the Share button appears in the top bar. */
  profile?: Record<string, any> | null;
  /** No top or bottom bar at all (the login screen draws its own header). */
  bare?: boolean;
}

/**
 * The app frame. Responsive:
 *  - phones: top bar (logo + Share) and a three-tab bar fixed to the bottom, like a native app;
 *  - desktop (md+): one full-width header with the logo, the same three tabs inline, and Share.
 * Screens decide their own content width inside it.
 */
export default function AppShell({ children, tab, profile, bare }: Props) {
  const url = profileHandle(profile) ? shareUrlFor(profileHandle(profile)) : '';

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
    <div className="flex min-h-screen flex-col bg-white">
      {!bare && (
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 md:h-16 md:px-8">
            <Link href="/" aria-label="LinkSports home" className="flex shrink-0 items-center"><Logo height={30} /></Link>

            {/* desktop navigation */}
            {tab && (
              <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
                {TABS.map(({ id, href, label, icon: Icon }) => {
                  const active = id === tab;
                  return (
                    <Link
                      key={id}
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-10 items-center gap-2 rounded-full px-4 font-display text-[15px] font-semibold uppercase tracking-wider transition-colors ${
                        active ? 'bg-brand/10 text-brand' : 'text-ink-soft hover:bg-cream hover:text-ink'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.75} />{label}
                    </Link>
                  );
                })}
              </nav>
            )}

            {url && (
              <button
                onClick={share}
                aria-label="Share my CV"
                className="ml-auto flex h-11 items-center gap-2 rounded-full px-3 text-ink transition hover:bg-cream active:scale-95 md:border md:border-line md:px-4 md:hover:border-ink"
              >
                <Share2 className="h-5 w-5" />
                <span className="hidden font-display text-[15px] font-semibold uppercase tracking-wider md:inline">Share</span>
              </button>
            )}
          </div>
        </header>
      )}

      <main className="flex flex-1 flex-col">{children}</main>

      {/* phone tab bar */}
      {tab && !bare && (
        <nav
          aria-label="Main (mobile)"
          className="sticky bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur md:hidden"
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
  );
}
