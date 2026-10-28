import { Response } from 'express';
import { AuthRequest } from '../types';
import { User } from '../models/User';
import { AthleteProfile } from '../models/AthleteProfile';
import { CoachProfile } from '../models/CoachProfile';
import { Organization } from '../models/Organization';
import { Listing } from '../models/Listing';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { Payment, Coupon } from '../models/Payment';
import { Notification } from '../models/Notification';
import { ActivityEvent } from '../models/ActivityEvent';
import { sendSuccess, sendError } from '../utils/response';
import { escapeRegex } from './adminManageController';

export const getDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers, athletes, coaches, orgs, listings, jobs, totalRevenue, pendingListings, pendingOrgs,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'athlete' }),
      User.countDocuments({ role: 'coach' }),
      User.countDocuments({ role: 'organization' }),
      Listing.countDocuments({ status: 'published' }),
      Job.countDocuments({ status: 'published' }),
      Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Listing.countDocuments({ status: 'pending' }),
      Organization.countDocuments({ verificationStatus: 'pending' }),
    ]);

    sendSuccess(res, {
      users: { total: totalUsers, athletes, coaches, organizations: orgs },
      listings: { active: listings },
      jobs: { active: jobs },
      revenue: { total: totalRevenue[0]?.total || 0 },
      pendingApprovals: { listings: pendingListings, organizations: pendingOrgs },
    });
  } catch { sendError(res, 'Failed to get dashboard', 500); }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, q, page = 1, limit = 20, suspended } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const query: Record<string, unknown> = {};

    if (role) query.role = role;
    if (suspended !== undefined) query.isSuspended = suspended === 'true';
    if (q) {
      const re = new RegExp(escapeRegex(String(q)), 'i');
      query.$or = [{ email: re }, { phone: re }];
    }

    const [users, total] = await Promise.all([
      User.find(query).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    sendSuccess(res, users, 'Users fetched', 200, {
      total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit),
    });
  } catch { sendError(res, 'Failed to get users', 500); }
};

export const suspendUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { sendError(res, 'User not found', 404); return; }
    if (String(user._id) === String(req.user!._id)) { sendError(res, 'You cannot suspend yourself', 400); return; }
    user.isSuspended = !user.isSuspended;
    await user.save();
    sendSuccess(res, user, `User ${user.isSuspended ? 'suspended' : 'unsuspended'}`);
  } catch { sendError(res, 'Failed to update user', 500); }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, role, phone } = req.body;
    if (!email || !password || !role) { sendError(res, 'email, password and role are required', 400); return; }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) { sendError(res, 'Email already in use', 409); return; }
    const user = await User.create({ email: email.toLowerCase(), passwordHash: password, role, phone, isVerified: true, authProvider: 'email' });
    sendSuccess(res, user, 'User created', 201);
  } catch { sendError(res, 'Failed to create user', 500); }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, phone, isVerified, isSuspended, password } = req.body;
    const user = await User.findById(req.params.id).select('+passwordHash');
    if (!user) { sendError(res, 'User not found', 404); return; }
    const isSelf = String(user._id) === String(req.user!._id);
    if (isSelf && ((role && role !== 'admin') || isSuspended === true)) {
      sendError(res, 'You cannot remove your own admin access or suspend yourself', 400); return;
    }
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (isVerified !== undefined) user.isVerified = isVerified;
    if (isSuspended !== undefined) user.isSuspended = isSuspended;
    if (password) user.passwordHash = password;
    await user.save();
    sendSuccess(res, user, 'User updated');
  } catch { sendError(res, 'Failed to update user', 500); }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { sendError(res, 'User not found', 404); return; }
    if (String(user._id) === String(req.user!._id)) { sendError(res, 'Cannot delete your own account', 400); return; }
    await Promise.all([
      AthleteProfile.deleteOne({ userId: user._id }),
      CoachProfile.deleteOne({ userId: user._id }),
      Organization.deleteOne({ userId: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);
    sendSuccess(res, null, 'User deleted');
  } catch { sendError(res, 'Failed to delete user', 500); }
};

export const getPendingListings = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listings = await Listing.find({ status: 'pending' })
      .populate('organizationId', 'name logo isVerified')
      .sort({ createdAt: 1 });
    sendSuccess(res, listings);
  } catch { sendError(res, 'Failed to get pending listings', 500); }
};

export const reviewListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing || listing.status !== 'pending') { sendError(res, 'Listing not found', 404); return; }

    const { action, reason } = req.body;

    if (action === 'approve') {
      listing.status = 'published';
    } else if (action === 'reject') {
      listing.status = 'draft';
      listing.rejectionReason = reason;
    } else if (action === 'request_changes') {
      listing.status = 'draft';
      listing.rejectionReason = reason;
    }

    await listing.save();

    // Notify the org about the review outcome
    await Notification.create({
      recipientId: listing.createdBy,
      type: action === 'approve' ? 'listing_approved' : 'listing_rejected',
      title: `Listing ${action === 'approve' ? 'Approved' : 'Needs Changes'}`,
      message: action === 'approve'
        ? `Your listing "${listing.title}" has been approved and is now live!`
        : `Your listing "${listing.title}" was ${action === 'reject' ? 'rejected' : 'returned for changes'}. ${reason || ''}`,
      referenceId: listing._id,
      referenceType: 'Listing',
    });

    // Notify all athletes when a listing goes live
    if (action === 'approve') {
      const org = await Organization.findById(listing.organizationId).select('name').lean();
      const athletes = await User.find({ role: 'athlete' }, '_id').lean();
      if (athletes.length > 0) {
        const typeLabel = listing.type.replace(/_/g, ' ');
        const athleteNotifs = athletes.map((a) => ({
          recipientId: a._id,
          type: 'new_event_posted',
          title: `New ${typeLabel} posted`,
          message: `${org?.name || 'An organisation'} just posted a new ${typeLabel}: "${listing.title}"`,
          referenceId: listing._id,
          referenceType: 'Listing',
          link: `/listings/${listing._id}`,
          isRead: false,
        }));
        Notification.insertMany(athleteNotifs, { ordered: false }).catch((e) =>
          console.error('[Notify] Failed to notify athletes:', e)
        );
      }
    }

    sendSuccess(res, listing, `Listing ${action}d`);
  } catch { sendError(res, 'Failed to review listing', 500); }
};

export const getPendingJobs = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobs = await Job.find({ status: 'pending' })
      .populate('organizationId', 'name logo')
      .sort({ createdAt: 1 });
    sendSuccess(res, jobs);
  } catch { sendError(res, 'Failed to get pending jobs', 500); }
};

export const reviewJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || job.status !== 'pending') { sendError(res, 'Job not found', 404); return; }

    const { action, reason } = req.body;

    if (action === 'approve') job.status = 'published';
    else { job.status = 'draft'; job.rejectionReason = reason; }

    await job.save();

    await Notification.create({
      recipientId: job.createdBy,
      type: action === 'approve' ? 'new_job_posted' : 'job_rejected',
      title: `Job ${action === 'approve' ? 'Approved' : 'Needs Changes'}`,
      message: action === 'approve'
        ? `Your job "${job.title}" is now live!`
        : `Your job "${job.title}" needs changes. ${reason || ''}`,
      referenceId: job._id,
      referenceType: 'Job',
    });

    sendSuccess(res, job, `Job ${action}d`);
  } catch { sendError(res, 'Failed to review job', 500); }
};

export const getPendingOrganizations = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgs = await Organization.find({ verificationStatus: 'pending' })
      .populate('userId', 'email phone')
      .sort({ createdAt: 1 });
    sendSuccess(res, orgs);
  } catch { sendError(res, 'Failed to get pending orgs', 500); }
};

export const verifyOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) { sendError(res, 'Organization not found', 404); return; }

    const { action, reason } = req.body;

    org.verificationStatus = action === 'approve' ? 'verified' : 'rejected';
    org.isVerified = action === 'approve';
    if (reason) org.rejectionReason = reason;

    if (action === 'approve') {
      await User.findByIdAndUpdate(org.userId, { isApproved: true });
    }

    await org.save();

    await Notification.create({
      recipientId: org.userId,
      type: 'org_verification',
      title: `Organization ${action === 'approve' ? 'Verified' : 'Verification Failed'}`,
      message: action === 'approve'
        ? 'Your organization has been verified! You can now post listings.'
        : `Verification failed. ${reason || ''}`,
      referenceId: org._id,
      referenceType: 'Organization',
    });

    sendSuccess(res, org, `Organization ${action}d`);
  } catch { sendError(res, 'Failed to verify organization', 500); }
};

export const getCoupons = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    sendSuccess(res, coupons);
  } catch { sendError(res, 'Failed to get coupons', 500); }
};

export const createCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code, discountType, discountValue, maxUses, expiresAt, description } = req.body;
    if (!code || !discountType || discountValue === undefined) {
      sendError(res, 'code, discountType and discountValue are required', 400); return;
    }
    // the schema stores flat discounts as 'fixed'; accept both spellings
    const type = discountType === 'flat' ? 'fixed' : discountType;
    if (!['percentage', 'fixed'].includes(type)) {
      sendError(res, 'discountType must be percentage or fixed', 400); return;
    }
    if (typeof discountValue !== 'number' || discountValue <= 0 || (type === 'percentage' && discountValue > 100)) {
      sendError(res, 'discountValue must be a positive number (max 100 for a percentage)', 400); return;
    }
    if (await Coupon.exists({ code: String(code).toUpperCase().trim() })) {
      sendError(res, 'A coupon with this code already exists', 409); return;
    }
    const coupon = await Coupon.create({
      code: String(code).toUpperCase().trim(),
      discountType: type,
      discountValue,
      usageLimit: maxUses ? Number(maxUses) : undefined, // field names follow the Coupon schema
      validUntil: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user!._id,
    });
    void description; // the schema has no description field
    sendSuccess(res, coupon, 'Coupon created', 201);
  } catch { sendError(res, 'Failed to create coupon', 500); }
};

export const toggleCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) { sendError(res, 'Coupon not found', 404); return; }
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    sendSuccess(res, coupon, `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`);
  } catch { sendError(res, 'Failed to update coupon', 500); }
};

export const getRevenueReport = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [total, byType, recent] = await Promise.all([
      Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([
        { $match: { status: 'success' } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.find({ status: 'success' }).sort({ createdAt: -1 }).limit(20).populate('userId', 'email'),
    ]);

    sendSuccess(res, { total: total[0]?.total || 0, byType, recent });
  } catch { sendError(res, 'Failed to get revenue report', 500); }
};

export const createSystemAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, message, targetRole } = req.body;
    const query = targetRole ? { role: targetRole } : {};
    const users = await User.find(query).select('_id');

    const notifications = users.map((u) => ({
      recipientId: u._id,
      type: 'system_announcement',
      title,
      message,
    }));

    await Notification.insertMany(notifications);
    sendSuccess(res, { sent: notifications.length }, 'Announcement sent');
  } catch { sendError(res, 'Failed to send announcement', 500); }
};

// ── CV sprint: KPIs, player directory, activity feed ─────────────────────────
const COMPLETED_CV_THRESHOLD = 60; // profileCompletion % at which a CV counts as "completed"
const DOWNLOAD_EVENTS = ['PDF_DOWNLOADED', 'STORY_CARD_EXPORTED'];
// The player actions the activity stream shows (CV_SAVED is the old name of CV_UPDATED)
const STREAM_EVENTS = ['USER_SIGNUP', 'SPORT_SELECTED', 'CV_UPDATED', 'CV_SAVED', 'PHOTOS_UPLOADED', 'PDF_DOWNLOADED', 'STORY_CARD_EXPORTED', 'PROFILE_SHARED'];

export const getCvStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalPlayers, totalCoaches, completedCvs, downloads24h, downloadsAllTime, topSports] = await Promise.all([
      User.countDocuments({ role: 'athlete' }),
      User.countDocuments({ role: 'coach' }),
      AthleteProfile.countDocuments({ profileCompletion: { $gte: COMPLETED_CV_THRESHOLD } }),
      ActivityEvent.countDocuments({ eventType: { $in: DOWNLOAD_EVENTS }, createdAt: { $gte: since } }),
      ActivityEvent.countDocuments({ eventType: { $in: DOWNLOAD_EVENTS } }),
      AthleteProfile.aggregate([
        { $match: { primarySport: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: '$primarySport', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);
    sendSuccess(res, {
      totalPlayers,
      totalCoaches,
      completedCvs,
      downloads24h,
      downloadsAllTime,
      topSports: topSports.map((t) => ({ sport: t._id as string, players: t.count as number })),
      completedThreshold: COMPLETED_CV_THRESHOLD,
    });
  } catch { sendError(res, 'Failed to get CV stats', 500); }
};

/** Shared by the table and the CSV export so both always agree on filters. */
const buildCvUserQuery = async (q: unknown, sport: unknown, completion: unknown): Promise<Record<string, unknown>> => {
  const and: Record<string, unknown>[] = [];
  if (typeof q === 'string' && q.trim()) {
    const term = q.trim().slice(0, 100);
    const re = new RegExp(escapeRegex(term), 'i');
    const matchedUsers = await User.find({ $or: [{ email: re }, { phone: re }] }).select('_id').lean();
    const or: Record<string, unknown>[] = [
      { fullName: re }, { primarySport: re }, { phone: re }, { email: re },
      ...(matchedUsers.length ? [{ userId: { $in: matchedUsers.map((u) => u._id) } }] : []),
    ];
    if (/^[a-f0-9]{24}$/i.test(term)) or.push({ userId: term }, { _id: term });
    and.push({ $or: or });
  }
  if (typeof sport === 'string' && sport.trim()) and.push({ primarySport: sport.trim() });
  if (completion === 'completed') and.push({ profileCompletion: { $gte: COMPLETED_CV_THRESHOLD } });
  if (completion === 'incomplete') and.push({ profileCompletion: { $lt: COMPLETED_CV_THRESHOLD } });
  return and.length ? { $and: and } : {};
};

const toCvRow = (p: any) => {
  const u = p.userId as { _id: string; email?: string; phone?: string; createdAt?: Date } | null;
  return {
    userId: u?._id ?? null,
    profileId: String(p._id),
    fullName: p.fullName,
    phone: p.phone || u?.phone || '',
    email: p.email || u?.email || '',
    sport: p.primarySport || '',
    completion: p.profileCompletion || 0,
    photos: ((p.media as any[]) || []).filter((m) => m?.type === 'photo').length,
    registeredAt: u?.createdAt || p.createdAt,
    profileUrl: p.username || p.profileUrl,
  };
};

const CV_ROW_FIELDS = 'fullName primarySport phone email profileCompletion profileUrl username createdAt userId media';

export const getCvUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, sport, completion, page = 1, limit = 20 } = req.query;
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const query = await buildCvUserQuery(q, sport, completion);

    const [profiles, total] = await Promise.all([
      AthleteProfile.find(query)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .populate('userId', 'email phone createdAt')
        .select(CV_ROW_FIELDS),
      AthleteProfile.countDocuments(query),
    ]);

    sendSuccess(res, profiles.map(toCvRow), 'Players fetched', 200, {
      total, page: safePage, pages: Math.ceil(total / safeLimit), limit: safeLimit,
    });
  } catch { sendError(res, 'Failed to get players', 500); }
};

const csvCell = (v: unknown) => {
  const t = String(v ?? '');
  // neutralise spreadsheet formulas (=, +, -, @) in user-supplied text
  const safe = /^[=+\-@]/.test(t) ? `'${t}` : t;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const exportCvUsersCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, sport, completion } = req.query;
    const query = await buildCvUserQuery(q, sport, completion);
    const profiles = await AthleteProfile.find(query)
      .sort({ createdAt: -1 })
      .limit(5000)
      .populate('userId', 'email phone createdAt')
      .select(CV_ROW_FIELDS);

    const header = ['User ID', 'Full Name', 'Phone', 'Email', 'Sport', 'Completion %', 'Photos (of 4)', 'Created', 'Profile link'];
    const lines = profiles.map(toCvRow).map((r) => [
      r.userId, r.fullName, r.phone, r.email, r.sport, r.completion, r.photos,
      r.registeredAt ? new Date(r.registeredAt).toISOString() : '', r.profileUrl ? `/cv/${r.profileUrl}` : '',
    ].map(csvCell).join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="linksports-players.csv"');
    res.send(`﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}`);
  } catch { sendError(res, 'Failed to export players', 500); }
};

// Core fields an admin can correct for a player (name typos, wrong sport, missing city…)
const ADMIN_EDITABLE = ['fullName', 'primarySport', 'position', 'phone', 'tagline'] as const;

export const updateCvUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await AthleteProfile.findById(req.params.id);
    if (!profile) { sendError(res, 'Player not found', 404); return; }
    for (const field of ADMIN_EDITABLE) {
      const v = req.body?.[field];
      if (typeof v === 'string') (profile as any)[field] = v.trim().slice(0, field === 'tagline' ? 160 : 80) || undefined;
    }
    if (typeof req.body?.city === 'string') profile.location = { ...(profile.location || {}), city: req.body.city.trim().slice(0, 80) };
    if (!profile.fullName) { sendError(res, 'Name is required', 400); return; }
    await profile.save();
    await profile.populate('userId', 'email phone createdAt');
    sendSuccess(res, toCvRow(profile), 'Player updated');
  } catch { sendError(res, 'Failed to update player', 500); }
};

export const getActivityFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = 50, after } = req.query;
    const query: Record<string, unknown> = { eventType: { $in: STREAM_EVENTS } };
    if (typeof after === 'string' && after) {
      const d = new Date(after);
      if (!isNaN(d.getTime())) query.createdAt = { $gt: d };
    }
    const events = await ActivityEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Math.max(1, Number(limit) || 50)))
      .lean();

    // Payload follows the sprint's activity-log schema
    sendSuccess(res, events.map((e) => ({
      event_id: e.eventId,
      user_id: String(e.userId),
      player_name: e.userName,
      sport: e.sport || '',
      action: e.eventType === 'CV_SAVED' ? 'CV_UPDATED' : e.eventType,
      metadata: e.meta,
      timestamp: e.createdAt.toISOString(),
    })));
  } catch { sendError(res, 'Failed to get activity', 500); }
};
