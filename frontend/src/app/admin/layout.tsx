'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Contact, Users, Activity, Settings, Menu, X, ExternalLink, LogOut } from 'lucide-react';
import AuthGuard from '@/components/shared/AuthGuard';
import Logo from '@/components/shared/Logo';
import { useAuthStore } from '@/store/authStore';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/cv', label: 'Players & CVs', icon: Contact },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/activity', label: 'Activity', icon: Activity },
  { href: '/admin/settings', label: 'Site & App Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin';
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map(({ href, label, icon: Icon, exact }) => (
        <Link key={href} href={href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive(href, exact) ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
          <Icon className="w-[18px] h-[18px]" />{label}
        </Link>
      ))}
    </nav>
  );

  return (
    <AuthGuard allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50">
        {/* top bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="lg:hidden w-9 h-9 -ml-1 rounded-lg hover:bg-gray-100 flex items-center justify-center"><Menu className="w-5 h-5" /></button>
          <Link href="/admin" className="flex items-center gap-2">
            <Logo height={28} />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-brand bg-blue-50 px-2 py-0.5 rounded">Admin</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank" className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm text-gray-600 hover:bg-gray-100"><ExternalLink className="w-4 h-4" />View site</Link>
            <span className="hidden md:inline text-sm text-gray-500 max-w-[200px] truncate">{user?.email}</span>
            <button onClick={async () => { await logout(); router.replace('/'); }} className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm text-red-600 hover:bg-red-50"><LogOut className="w-4 h-4" /><span className="hidden sm:inline">Log out</span></button>
          </div>
        </header>

        <div className="flex">
          {/* sidebar (desktop) */}
          <aside className="hidden lg:block w-60 shrink-0 border-r border-gray-200 bg-white min-h-[calc(100vh-3.5rem)] sticky top-14 self-start">{nav}</aside>

          {/* drawer (mobile) */}
          {open && (
            <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)}>
              <aside className="w-72 h-full bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
                  <span className="font-bold text-gray-900">Admin menu</span>
                  <button onClick={() => setOpen(false)} aria-label="Close menu" className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
                </div>
                {nav}
              </aside>
            </div>
          )}

          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
