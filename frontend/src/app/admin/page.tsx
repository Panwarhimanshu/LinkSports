'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import AuthGuard from '@/components/shared/AuthGuard';
import { adminAPI } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  Users, Trophy, Briefcase, Building2, BarChart2, CheckCircle, XCircle,
  Loader2, Clock, AlertCircle, TrendingUp, IndianRupee, Bell, Tag,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'listings' | 'jobs' | 'organizations' | 'coupons' | 'users';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [pendingListings, setPendingListings] = useState<Record<string, unknown>[]>([]);
  const [pendingJobs, setPendingJobs] = useState<Record<string, unknown>[]>([]);
  const [pendingOrgs, setPendingOrgs] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [coupons, setCoupons] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState({ title: '', message: '', type: 'info' });
  const [newCoupon, setNewCoupon] = useState({ code: '', discountType: 'percentage', discountValue: '', maxUses: '', expiresAt: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [dashRes, listingsRes, jobsRes, orgsRes, couponsRes] = await Promise.all([
        adminAPI.getDashboard().catch(() => ({ data: { data: null } })),
        adminAPI.getPendingListings().catch(() => ({ data: { data: [] } })),
        adminAPI.getPendingJobs().catch(() => ({ data: { data: [] } })),
        adminAPI.getPendingOrganizations().catch(() => ({ data: { data: [] } })),
        adminAPI.getCoupons().catch(() => ({ data: { data: [] } })),
      ]);
      setDashboard(dashRes.data?.data);
      setPendingListings(listingsRes.data?.data || []);
      setPendingJobs(jobsRes.data?.data || []);
      setPendingOrgs(orgsRes.data?.data || []);
      setCoupons(couponsRes.data?.data || []);
    } catch { /* */ }
    setIsLoading(false);
  };

  const reviewListing = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingId(id);
    try {
      await adminAPI.reviewListing(id, action, reason);
      toast.success(`Listing ${action}d`);
      setPendingListings((prev) => prev.filter((l) => (l._id as string) !== id));
    } catch { toast.error('Failed'); }
    setProcessingId(null);
  };

  const reviewJob = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingId(id);
    try {
      await adminAPI.reviewJob(id, action, reason);
      toast.success(`Job ${action}d`);
      setPendingJobs((prev) => prev.filter((j) => (j._id as string) !== id));
    } catch { toast.error('Failed'); }
    setProcessingId(null);
  };

  const verifyOrg = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingId(id);
    try {
      await adminAPI.verifyOrganization(id, action, reason);
      toast.success(`Organization ${action === 'approve' ? 'verified' : 'rejected'}`);
      setPendingOrgs((prev) => prev.filter((o) => (o._id as string) !== id));
    } catch { toast.error('Failed'); }
    setProcessingId(null);
  };

  const createCoupon = async () => {
    try {
      await adminAPI.createCoupon({ ...newCoupon, discountValue: parseFloat(newCoupon.discountValue), maxUses: parseInt(newCoupon.maxUses) || undefined });
      toast.success('Coupon created!');
      setNewCoupon({ code: '', discountType: 'percentage', discountValue: '', maxUses: '', expiresAt: '' });
      const res = await adminAPI.getCoupons();
      setCoupons(res.data?.data || []);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Failed');
    }
  };

  const sendAnnouncement = async () => {
    if (!announcement.title || !announcement.message) { toast.error('Fill in title and message'); return; }
    try {
      await adminAPI.sendAnnouncement(announcement);
      toast.success('Announcement sent!');
      setAnnouncement({ title: '', message: '', type: 'info' });
    } catch { toast.error('Failed'); }
  };

  const stats = dashboard as { users?: { total?: number }; listings?: { active?: number }; jobs?: { active?: number }; revenue?: { total?: number } } | null;

  const navTabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'listings', label: 'Listings', icon: Trophy, badge: pendingListings.length },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, badge: pendingJobs.length },
    { id: 'organizations', label: 'Orgs', icon: Building2, badge: pendingOrgs.length },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'users', label: 'Users', icon: Users },
  ];

  return (
    <AuthGuard allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">Manage the LinkSports platform</p>
          </div>

          <div className="flex gap-6 flex-col lg:flex-row">
            {/* Sidebar Nav */}
            <aside className="lg:w-52 flex-shrink-0">
              <nav className="card p-2 space-y-1">
                {navTabs.map(({ id, label, icon: Icon, badge }) => (
                  <button key={id} onClick={() => setTab(id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === id ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <span className="flex items-center gap-2.5"><Icon className="w-4 h-4" />{label}</span>
                    {badge !== undefined && badge > 0 && (
                      <span className={`text-xs rounded-full px-2 py-0.5 ${tab === id ? 'bg-white text-brand' : 'bg-red-100 text-red-600'}`}>{badge}</span>
                    )}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {isLoading && tab === 'overview' ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
              ) : (
                <>
                  {/* Overview */}
                  {tab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { icon: Users, label: 'Total Users', value: stats?.users?.total || 0, color: 'bg-blue-50 text-blue-600' },
                          { icon: Trophy, label: 'Active Listings', value: stats?.listings?.active || 0, color: 'bg-green-50 text-green-600' },
                          { icon: Briefcase, label: 'Active Jobs', value: stats?.jobs?.active || 0, color: 'bg-purple-50 text-purple-600' },
                          { icon: IndianRupee, label: 'Revenue', value: formatCurrency(stats?.revenue?.total || 0), color: 'bg-orange-50 text-orange-600' },
                        ].map(({ icon: Icon, label, value, color }) => (
                          <div key={label} className="card p-5">
                            <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center mb-3`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Pending reviews summary */}
                      <div className="card p-5">
                        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-orange-500" /> Pending Reviews
                        </h2>
                        <div className="space-y-3">
                          {[
                            { label: 'Listings', count: pendingListings.length, tab: 'listings' as Tab, color: 'text-green-600' },
                            { label: 'Jobs', count: pendingJobs.length, tab: 'jobs' as Tab, color: 'text-purple-600' },
                            { label: 'Organizations', count: pendingOrgs.length, tab: 'organizations' as Tab, color: 'text-blue-600' },
                          ].map(({ label, count, tab: t }) => (
                            <button key={label} onClick={() => setTab(t)} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                              <span className="text-sm text-gray-700">{label}</span>
                              <div className="flex items-center gap-2">
                                {count > 0 ? (
                                  <span className="badge bg-orange-100 text-orange-700">{count} pending</span>
                                ) : (
                                  <span className="badge bg-green-100 text-green-700">All clear</span>
                                )}
                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Send Announcement */}
                      <div className="card p-5">
                        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Bell className="w-5 h-5 text-brand" /> Send Announcement
                        </h2>
                        <div className="space-y-3">
                          <input className="input-field" placeholder="Title" value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} />
                          <textarea rows={3} className="input-field" placeholder="Message..." value={announcement.message} onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })} />
                          <div className="flex gap-3">
                            <select className="input-field" value={announcement.type} onChange={(e) => setAnnouncement({ ...announcement, type: e.target.value })}>
                              <option value="info">Info</option>
                              <option value="success">Success</option>
                              <option value="warning">Warning</option>
                            </select>
                            <button onClick={sendAnnouncement} className="btn-primary whitespace-nowrap">Send to All</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pending Listings */}
                  {tab === 'listings' && (
                    <div className="space-y-4">
                      <h2 className="font-semibold text-gray-900">Pending Listings ({pendingListings.length})</h2>
                      {pendingListings.length === 0 ? (
                        <div className="card p-12 text-center">
                          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                          <p className="text-gray-500">No listings pending review</p>
                        </div>
                      ) : (
                        pendingListings.map((listing) => {
                          const org = listing.organizationId as Record<string, unknown>;
                          return (
                            <div key={listing._id as string} className="card p-5">
                              <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="badge bg-blue-100 text-blue-700 capitalize">{(listing.type as string)?.replace(/_/g, ' ')}</span>
                                    {(listing.participantFee as number) > 0 && <span className="badge bg-green-100 text-green-700">₹{listing.participantFee as number} fee</span>}
                                  </div>
                                  <p className="font-semibold text-gray-900">{listing.title as string}</p>
                                  <p className="text-sm text-gray-500 mt-0.5">By: {org?.name as string} • {formatDate(listing.createdAt as string)}</p>
                                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{listing.description as string}</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Link href={`/listings/${listing._id}`} target="_blank" className="btn-secondary text-xs px-3 py-1.5 text-center">Preview</Link>
                                  <button
                                    onClick={() => reviewListing(listing._id as string, 'approve')}
                                    disabled={processingId === listing._id as string}
                                    className="flex items-center gap-1 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {processingId === listing._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => { const r = window.prompt('Reason for rejection?'); if (r !== null) reviewListing(listing._id as string, 'reject', r); }}
                                    disabled={processingId === listing._id as string}
                                    className="flex items-center gap-1 bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                                  >
                                    <XCircle className="w-3 h-3" /> Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Pending Jobs */}
                  {tab === 'jobs' && (
                    <div className="space-y-4">
                      <h2 className="font-semibold text-gray-900">Pending Jobs ({pendingJobs.length})</h2>
                      {pendingJobs.length === 0 ? (
                        <div className="card p-12 text-center">
                          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                          <p className="text-gray-500">No jobs pending review</p>
                        </div>
                      ) : (
                        pendingJobs.map((job) => {
                          const org = job.organizationId as Record<string, unknown>;
                          return (
                            <div key={job._id as string} className="card p-5">
                              <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="badge bg-purple-100 text-purple-700">{job.category as string}</span>
                                    <span className="badge bg-gray-100 text-gray-600 capitalize">{(job.jobType as string)?.replace(/_/g, ' ')}</span>
                                  </div>
                                  <p className="font-semibold text-gray-900">{job.title as string}</p>
                                  <p className="text-sm text-gray-500 mt-0.5">By: {org?.name as string} • {formatDate(job.createdAt as string)}</p>
                                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{job.description as string}</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Link href={`/jobs/${job._id}`} target="_blank" className="btn-secondary text-xs px-3 py-1.5 text-center">Preview</Link>
                                  <button onClick={() => reviewJob(job._id as string, 'approve')} disabled={processingId === job._id as string}
                                    className="flex items-center gap-1 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                                    {processingId === job._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Approve
                                  </button>
                                  <button onClick={() => { const r = window.prompt('Reason for rejection?'); if (r !== null) reviewJob(job._id as string, 'reject', r); }} disabled={processingId === job._id as string}
                                    className="flex items-center gap-1 bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50">
                                    <XCircle className="w-3 h-3" /> Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Pending Organizations */}
                  {tab === 'organizations' && (
                    <div className="space-y-4">
                      <h2 className="font-semibold text-gray-900">Pending Verification ({pendingOrgs.length})</h2>
                      {pendingOrgs.length === 0 ? (
                        <div className="card p-12 text-center">
                          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                          <p className="text-gray-500">No organizations pending verification</p>
                        </div>
                      ) : (
                        pendingOrgs.map((org) => (
                          <div key={org._id as string} className="card p-5">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="badge bg-orange-100 text-orange-700 capitalize">{org.type as string}</span>
                                </div>
                                <p className="font-semibold text-gray-900">{org.name as string}</p>
                                <p className="text-sm text-gray-500 mt-0.5">
                                  {(org.address as Record<string, string>)?.city}, {(org.address as Record<string, string>)?.state}
                                  {(org.website as string | undefined) && ` • ${org.website as string}`}
                                </p>
                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{org.description as string}</p>
                                {(org.verificationDocuments as string[])?.length > 0 && (
                                  <div className="mt-2 flex gap-2 flex-wrap">
                                    {(org.verificationDocuments as string[]).map((doc, i) => (
                                      <a key={i} href={doc} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                                        Document {i + 1} →
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                <button onClick={() => verifyOrg(org._id as string, 'approve')} disabled={processingId === org._id as string}
                                  className="flex items-center gap-1 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                                  {processingId === org._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Verify
                                </button>
                                <button onClick={() => { const r = window.prompt('Reason for rejection?'); if (r !== null) verifyOrg(org._id as string, 'reject', r); }} disabled={processingId === org._id as string}
                                  className="flex items-center gap-1 bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50">
                                  <XCircle className="w-3 h-3" /> Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Coupons */}
                  {tab === 'coupons' && (
                    <div className="space-y-6">
                      <div className="card p-5">
                        <h2 className="font-semibold text-gray-900 mb-4">Create Coupon</h2>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input className="input-field" placeholder="Coupon Code (e.g. SPORTS50)" value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} />
                          <select className="input-field" value={newCoupon.discountType} onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}>
                            <option value="percentage">Percentage off</option>
                            <option value="fixed">Fixed Amount off</option>
                          </select>
                          <input type="number" className="input-field" placeholder={newCoupon.discountType === 'percentage' ? 'Discount % (e.g. 20)' : 'Amount (e.g. 100)'} value={newCoupon.discountValue} onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })} />
                          <input type="number" className="input-field" placeholder="Max uses (blank = unlimited)" value={newCoupon.maxUses} onChange={(e) => setNewCoupon({ ...newCoupon, maxUses: e.target.value })} />
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Expires At</label>
                            <input type="date" className="input-field" value={newCoupon.expiresAt} onChange={(e) => setNewCoupon({ ...newCoupon, expiresAt: e.target.value })} />
                          </div>
                        </div>
                        <button onClick={createCoupon} className="btn-primary mt-4 flex items-center gap-2">
                          <Tag className="w-4 h-4" /> Create Coupon
                        </button>
                      </div>

                      <div className="card overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                          <h2 className="font-semibold text-gray-900">All Coupons ({coupons.length})</h2>
                        </div>
                        {coupons.length === 0 ? (
                          <div className="p-8 text-center text-gray-400">No coupons yet</div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {coupons.map((coupon) => (
                              <div key={coupon._id as string} className="flex items-center justify-between p-4">
                                <div>
                                  <span className="font-mono font-semibold text-gray-900">{coupon.code as string}</span>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {coupon.discountType === 'percentage' ? `${coupon.discountValue as number}% off` : `₹${coupon.discountValue as number} off`}
                                    {' '} • {coupon.usedCount as number}/{(coupon.maxUses as number) || '∞'} used
                                    {coupon.expiresAt ? ` • Expires ${formatDate(coupon.expiresAt as string)}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`badge ${(coupon.isActive as boolean) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {(coupon.isActive as boolean) ? 'Active' : 'Inactive'}
                                  </span>
                                  <button onClick={() => adminAPI.toggleCoupon(coupon._id as string).then(() => { toast.success('Toggled'); loadData(); }).catch(() => toast.error('Failed'))}
                                    className="text-xs text-brand hover:underline">Toggle</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Users */}
                  {tab === 'users' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900">User Management</h2>
                        <button onClick={() => adminAPI.getUsers().then((r) => setUsers(r.data?.data || [])).catch(() => {})} className="btn-secondary text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" /> Load Users
                        </button>
                      </div>
                      {users.length === 0 ? (
                        <div className="card p-12 text-center">
                          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">Click "Load Users" to view all users</p>
                        </div>
                      ) : (
                        <div className="card overflow-hidden">
                          <div className="divide-y divide-gray-50">
                            {users.map((u) => (
                              <div key={u._id as string} className="flex items-center justify-between p-4">
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{u.email as string}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="badge bg-gray-100 text-gray-600 capitalize">{u.role as string}</span>
                                    {(u.isVerified as boolean | undefined) && <span className="badge bg-green-100 text-green-700">Verified</span>}
                                    {(u.isSuspended as boolean | undefined) && <span className="badge bg-red-100 text-red-700">Suspended</span>}
                                  </div>
                                </div>
                                <button onClick={() => adminAPI.suspendUser(u._id as string).then(() => { toast.success('User suspended'); loadData(); }).catch(() => toast.error('Failed'))}
                                  className="text-xs text-red-600 hover:underline disabled:opacity-50">
                                  {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
