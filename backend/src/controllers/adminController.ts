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
    if (q) query.email = new RegExp(q as string, 'i');

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
    if (!['percentage', 'flat'].includes(discountType)) {
      sendError(res, 'discountType must be percentage or flat', 400); return;
    }
    if (typeof discountValue !== 'number' || discountValue <= 0) {
      sendError(res, 'discountValue must be a positive number', 400); return;
    }
    const coupon = await Coupon.create({
      code: String(code).toUpperCase().trim(),
      discountType,
      discountValue,
      maxUses: maxUses ? Number(maxUses) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      description: description ? String(description).slice(0, 500) : undefined,
      createdBy: req.user!._id,
    });
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

export const getCvStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalPlayers, completedCvs, downloads24h, sportAgg] = await Promise.all([
      User.countDocuments({ role: 'athlete' }),
      AthleteProfile.countDocuments({ profileCompletion: { $gte: COMPLETED_CV_THRESHOLD } }),
      ActivityEvent.countDocuments({
        eventType: { $in: ['PDF_DOWNLOADED', 'STORY_CARD_EXPORTED'] },
        createdAt: { $gte: since },
      }),
      AthleteProfile.aggregate([
        { $match: { primarySport: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: '$primarySport', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);
    sendSuccess(res, {
      totalPlayers,
      completedCvs,
      downloads24h,
      mostActiveSport: sportAgg[0] ? { sport: sportAgg[0]._id, players: sportAgg[0].count } : null,
      completedThreshold: COMPLETED_CV_THRESHOLD,
    });
  } catch { sendError(res, 'Failed to get CV stats', 500); }
};

export const getCvUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const query: Record<string, unknown> = {};

    if (typeof q === 'string' && q.trim()) {
      const re = new RegExp(q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchedUsers = await User.find({ $or: [{ email: re }, { phone: re }] }).select('_id').lean();
      query.$or = [
        { fullName: re }, { primarySport: re }, { phone: re }, { email: re },
        ...(matchedUsers.length ? [{ userId: { $in: matchedUsers.map((u) => u._id) } }] : []),
      ];
      if (/^[a-f0-9]{24}$/i.test(q.trim())) (query.$or as unknown[]).push({ userId: q.trim() }, { _id: q.trim() });
    }

    const [profiles, total] = await Promise.all([
      AthleteProfile.find(query)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .populate('userId', 'email phone createdAt')
        .select('fullName primarySport phone email profileCompletion profileUrl createdAt userId'),
      AthleteProfile.countDocuments(query),
    ]);

    const rows = profiles.map((p) => {
      const u = p.userId as unknown as { _id: string; email?: string; phone?: string; createdAt?: Date } | null;
      return {
        userId: u?._id ?? null,
        fullName: p.fullName,
        phone: p.phone || u?.phone || '',
        email: p.email || u?.email || '',
        sport: p.primarySport || '',
        completion: p.profileCompletion || 0,
        registeredAt: u?.createdAt || p.createdAt,
        profileUrl: p.profileUrl,
      };
    });

    sendSuccess(res, rows, 'Players fetched', 200, {
      total, page: safePage, pages: Math.ceil(total / safeLimit), limit: safeLimit,
    });
  } catch { sendError(res, 'Failed to get players', 500); }
};

export const getActivityFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = 50, after } = req.query;
    const query: Record<string, unknown> = {};
    if (typeof after === 'string' && after) {
      const d = new Date(after);
      if (!isNaN(d.getTime())) query.createdAt = { $gt: d };
    }
    const events = await ActivityEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Math.max(1, Number(limit) || 50)))
      .lean();

    // Shape matches the event-logging contract in the sprint spec.
    sendSuccess(res, events.map((e) => ({
      event_id: e.eventId,
      user_id: String(e.userId),
      user_name: e.userName,
      sport: e.sport || '',
      event_type: e.eventType,
      meta: e.meta,
      timestamp: e.createdAt.toISOString(),
    })));
  } catch { sendError(res, 'Failed to get activity', 500); }
};
