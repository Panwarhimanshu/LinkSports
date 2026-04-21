'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Bell, MessageSquare, Menu, X, LogOut, Settings, Home } from 'lucide-react';
import { notificationAPI, messageAPI, connectionAPI } from '@/lib/api';
import { getInitials, getPhotoUrl } from '@/lib/utils';
import Logo from '@/components/shared/Logo';
import toast from 'react-hot-toast';

export default function Navbar() {
  const router = useRouter();
  const { user, profile, isAuthenticated, logout } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCounts();
      const interval = setInterval(fetchCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const fetchCounts = async () => {
    try {
      const [notif, msg] = await Promise.all([
        notificationAPI.getNotifications({ limit: 1 }),
        messageAPI.getUnreadCount(),
      ]);
      setUnreadNotifications(notif.data.data?.unreadCount || 0);
      setRecentNotifications(notif.data.data?.notifications || []);
      setUnreadMessages(msg.data.data?.unreadCount || 0);
    } catch {}
  };

  const handleNotifAction = async (notifId: string, refId: string, action: 'accept' | 'reject') => {
    try {
      await connectionAPI.respondToRequest(refId, action);
      await notificationAPI.markAsRead(notifId);
      setRecentNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
      setUnreadNotifications(prev => Math.max(0, prev - 1));
      toast.success(`Request ${action}ed`);
    } catch {
      toast.error(`Failed to ${action} request`);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    router.push('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Logo />
          </Link>

          {/* Nav Actions */}
          <div className="hidden md:flex items-center gap-1">
            {isAuthenticated ? (
              <>
                {/* Notification bell */}
                <div className="relative">
                  <button
                    onClick={() => { setIsNotifOpen(!isNotifOpen); setIsProfileOpen(false); }}
                    className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Bell className="w-5 h-5 text-gray-600" />
                    {unreadNotifications > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </span>
                    )}
                  </button>
                  {isNotifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <span className="font-bold text-gray-900">Notifications</span>
                        <Link href="/notifications" className="text-xs text-brand hover:underline" onClick={() => setIsNotifOpen(false)}>View all</Link>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {recentNotifications.length > 0 ? (
                          recentNotifications.slice(0, 5).map((n) => (
                            <div key={n._id} className={`flex flex-col gap-1 px-4 py-3 border-b border-gray-50 last:border-0 ${!n.isRead ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                              <div className="cursor-pointer" onClick={() => { if (!n.isRead) notificationAPI.markAsRead(n._id); setIsNotifOpen(false); router.push(n.link || '/notifications'); }}>
                                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                                <p className="text-xs text-gray-500 line-clamp-1">{n.message}</p>
                              </div>
                              {n.type === 'connection_request' && !n.isRead && (
                                <div className="flex gap-2 mt-1.5">
                                  <button onClick={() => handleNotifAction(n._id, n.referenceId, 'accept')} className="px-2.5 py-1 bg-brand text-white text-[10px] font-bold rounded hover:bg-brand-dark">Accept</button>
                                  <button onClick={() => handleNotifAction(n._id, n.referenceId, 'reject')} className="px-2.5 py-1 bg-white text-gray-700 border border-gray-300 text-[10px] font-bold rounded hover:bg-gray-50">Reject</button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-8 text-center text-gray-400 text-sm italic">No notifications yet</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <Link href="/messages" className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <MessageSquare className="w-5 h-5 text-gray-600" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand text-white text-xs rounded-full flex items-center justify-center">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  )}
                </Link>

                {/* Avatar + dropdown */}
                <div className="relative ml-1">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center text-sm font-semibold hover:bg-brand-dark transition-colors overflow-hidden"
                  >
                    {getPhotoUrl((profile as any)?.photo) ? (
                      <img src={getPhotoUrl((profile as any).photo)!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      getInitials((profile as any)?.fullName || (profile as any)?.name || user?.email?.split('@')[0] || 'U')
                    )}
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {(profile as any)?.username ? `@${(profile as any).username}` : (profile as any)?.name || user?.email?.split('@')[0]}
                        </p>
                        <p className="text-[10px] font-bold text-brand uppercase mt-1 px-1.5 py-0.5 bg-blue-50 rounded w-fit">{user?.role}</p>
                      </div>
                      <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setIsProfileOpen(false)}>
                        <Home className="w-4 h-4" /> Home
                      </Link>
                      <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setIsProfileOpen(false)}>
                        <Settings className="w-4 h-4" /> Settings
                      </Link>
                      <hr className="my-1 border-gray-100" />
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Login</Link>
                <Link href="/auth/register" className="btn-primary text-sm px-4 py-2">Join Free</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>Home</Link>
                <Link href="/messages" className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>Messages</Link>
                <Link href="/notifications" className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>Notifications</Link>
                <Link href="/settings" className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>Settings</Link>
                <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">Logout</button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>Login</Link>
                <Link href="/auth/register" className="block px-3 py-2 rounded-lg text-sm font-medium text-white bg-brand hover:bg-brand-dark" onClick={() => setIsMenuOpen(false)}>Join Free</Link>
              </>
            )}
          </div>
        </div>
      )}

      {isProfileOpen && <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />}
    </nav>
  );
}
