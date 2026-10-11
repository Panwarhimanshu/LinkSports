'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Users, UserCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

/** Height of the bar (without the iPhone home-indicator inset); sticky bottom bars sit above it. */
export const TAB_BAR_H = 64;

const HIDDEN_ON = ['/admin', '/auth'];

/**
 * App-style bottom navigation for phones (hidden from the md breakpoint up, where the top
 * navbar shows these links). Mirrors the website's main sections.
 */
export default function MobileTabBar() {
  const pathname = usePathname() || '/';
  const { profile } = useAuthStore();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const ownProfileUrl = (profile as any)?.profileUrl as string | undefined;
  const tabs = [
    { href: '/', label: 'Home', icon: Home, active: pathname === '/' || pathname === '/dashboard' || pathname === '/home' },
    { href: '/listings', label: 'Opportunities', icon: Trophy, active: pathname.startsWith('/listings') || pathname.startsWith('/jobs') },
    { href: '/search', label: 'Network', icon: Users, active: pathname.startsWith('/search') },
    {
      href: '/profile', label: 'My Profile', icon: UserCircle2,
      active: pathname.startsWith('/profile') || (!!ownProfileUrl && pathname === `/athlete/${ownProfileUrl}`),
    },
  ];

  return (
    <>
      {/* reserves room at the end of normal pages so the last content isn't hidden behind the bar */}
      <div aria-hidden className="md:hidden" style={{ height: `calc(${TAB_BAR_H}px + env(safe-area-inset-bottom))` }} />
      <nav
        aria-label="Main"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-4" style={{ height: TAB_BAR_H }}>
          {tabs.map(({ href, label, icon: Icon, active }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`h-full flex flex-col items-center justify-center gap-1 transition-colors ${active ? 'text-brand' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                <span className={`text-[10px] uppercase tracking-wide ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
