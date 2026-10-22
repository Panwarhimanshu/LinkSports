'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2, ShieldAlert } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: string[];
  allowedRoles?: string[];
  redirectTo?: string;
}

export default function AuthGuard({ children, roles, allowedRoles, redirectTo = '/' }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, user, isLoading, fetchMe, logout } = useAuthStore();
  const permittedRoles = roles || allowedRoles;
  // Role-restricted pages re-check the role with the server first: the role saved in the browser
  // can be out of date (e.g. an account that was made admin after it last signed in).
  const [roleChecked, setRoleChecked] = useState(!permittedRoles);
  const roleCheckStarted = useRef(false); // roles arrays are new on every render; check once

  const checkAuth = useCallback(() => {
    if (!isAuthenticated && !isLoading) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token) {
        fetchMe();
      } else {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        router.replace(`${redirectTo}?redirect=${encodeURIComponent(path)}`);
      }
    }
  }, [isAuthenticated, isLoading, fetchMe, router, redirectTo]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!permittedRoles || !isAuthenticated || roleCheckStarted.current) return;
    roleCheckStarted.current = true;
    fetchMe().finally(() => setRoleChecked(true));
  }, [permittedRoles, isAuthenticated, fetchMe]);

  if (!isAuthenticated || !roleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (permittedRoles && user && !permittedRoles.includes(user.role)) {
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-orange-500 mx-auto" />
          <h1 className="text-lg font-semibold text-gray-900 mt-4">You don&apos;t have access to this page</h1>
          <p className="text-sm text-gray-600 mt-2">
            You&apos;re signed in as <span className="font-medium text-gray-900">{user.email}</span> ({user.role}).
            This page needs a{permittedRoles.includes('admin') ? 'n admin' : ` ${permittedRoles.join(' / ')}`} account.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={async () => { await logout(); router.replace(`${redirectTo}?redirect=${encodeURIComponent(path)}`); }}
              className="h-10 px-4 rounded-md bg-brand hover:bg-brand-dark text-white text-sm font-medium"
            >
              Sign in with another account
            </button>
            <Link href="/" className="h-10 px-4 rounded-md border border-gray-300 text-gray-700 text-sm font-medium flex items-center justify-center hover:bg-gray-50">
              Go to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
