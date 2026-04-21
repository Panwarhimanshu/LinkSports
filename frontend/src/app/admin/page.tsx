'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import AuthGuard from '@/components/shared/AuthGuard';
import { adminAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Users, Trophy, Briefcase, IndianRupee, Bell, Clock, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<{
    users?: { total?: number; athletes?: number; coaches?: number; organizations?: number };
    listings?: { active?: number };
    jobs?: { active?: number };
    revenue?: { total?: number };
    pendingApprovals?: { listings?: number; organizations?: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [announcement, setAnnouncement] = useState({ title: '', message: '', type: 'info' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    adminAPI.getDashboard()
      .then((r) => setDashboard(r.data?.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const sendAnnouncement = async () => {
    if (!announcement.title || !announcement.message) { toast.error('Fill in title and message'); return; }
    setSending(true);
    try {
      await adminAPI.sendAnnouncement(announcement);
      toast.success('Announcement sent!');
      setAnnouncement({ title: '', message: '', type: 'info' });
    } catch { toast.error('Failed to send'); }
    setSending(false);
  };

  return (
    <AuthGuard allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">LinkSports platform overview</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: Users,       label: 'Total Users',      value: dashboard?.users?.total || 0,              color: 'bg-blue-50 text-blue-600' },
                  { icon: Trophy,      label: 'Active Listings',   value: dashboard?.listings?.active || 0,          color: 'bg-green-50 text-green-600' },
                  { icon: Briefcase,   label: 'Active Jobs',       value: dashboard?.jobs?.active || 0,              color: 'bg-purple-50 text-purple-600' },
                  { icon: IndianRupee, label: 'Total Revenue',     value: formatCurrency(dashboard?.revenue?.total || 0), color: 'bg-orange-50 text-orange-600' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center mb-3`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* User breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand" /> User Breakdown
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Athletes',      value: dashboard?.users?.athletes || 0 },
                    { label: 'Coaches',       value: dashboard?.users?.coaches || 0 },
                    { label: 'Organizations', value: dashboard?.users?.organizations || 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-xl font-bold text-gray-900">{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending approvals */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" /> Pending Approvals
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Listings awaiting review',      value: dashboard?.pendingApprovals?.listings || 0 },
                    { label: 'Organizations awaiting verify', value: dashboard?.pendingApprovals?.organizations || 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className={`p-4 rounded-lg ${value > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                      <p className={`text-2xl font-bold ${value > 0 ? 'text-orange-700' : 'text-green-700'}`}>{value}</p>
                      <p className={`text-xs mt-0.5 ${value > 0 ? 'text-orange-600' : 'text-green-600'}`}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Send Announcement */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-brand" /> Send Announcement
                </h2>
                <div className="space-y-3">
                  <input
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                    placeholder="Title"
                    value={announcement.title}
                    onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
                  />
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                    placeholder="Message..."
                    value={announcement.message}
                    onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
                  />
                  <div className="flex gap-3">
                    <select
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                      value={announcement.type}
                      onChange={(e) => setAnnouncement({ ...announcement, type: e.target.value })}
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                    </select>
                    <button
                      onClick={sendAnnouncement}
                      disabled={sending}
                      className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                      Send to All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
