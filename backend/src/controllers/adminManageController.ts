import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../types';
import { User } from '../models/User';
import { AthleteProfile } from '../models/AthleteProfile';
import { CoachProfile } from '../models/CoachProfile';
import { Organization } from '../models/Organization';
import { Listing } from '../models/Listing';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { JobApplication } from '../models/JobApplication';
import { Payment } from '../models/Payment';
import { Review } from '../models/Review';
import { Notification } from '../models/Notification';
import { SiteSettings, getSiteSettings } from '../models/SiteSettings';
import { sendSuccess, sendError } from '../utils/response';

// Admin management endpoints (everything beyond the original dashboard/approvals in adminController).
// All routes are mounted behind protect + authorize('admin').

/** Escape user text before using it in a RegExp (prevents regex injection / catastrophic patterns). */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);

const paging = (req: Request) => {
  const page = Math.max(1, parseInt(String(req.query.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 20), 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};
const meta = (total: number, page: number, limit: number) => ({ total, page, limit, pages: Math.ceil(total / limit) });

// Fields that must never be overwritten from the admin edit forms.
const PROTECTED = ['_id', 'id', 'userId', 'createdBy', 'organizationId', 'createdAt', 'updatedAt', '__v', 'passwordHash', 'refreshTokens'];
const editable = (body: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(body || {}).filter(([k]) => !PROTECTED.includes(k) && !k.startsWith('$')));

const validId = (res: Response, id: string, what: string) => {
  if (mongoose.isValidObjectId(id)) return true;
  sendError(res, `${what} not found`, 404);
  return false;
};

const PROFILE_MODELS: Record<string, any> = { athlete: AthleteProfile, coach: CoachProfile, organization: Organization };
const profileFor = async (userId: mongoose.Types.ObjectId | string, role: string) => {
  const Model: any = role === 'athlete' ? AthleteProfile : role === 'coach' || role === 'professional' ? CoachProfile : role === 'organization' ? Organization : null;
  return Model ? Model.findOne({ userId }).lean() : null;
};

// ── Users ────────────────────────────────────────────────────────────────────

/** One user with their profile and activity counts. */
export const getUserDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!validId(res, req.params.id, 'User')) return;
    const user = await User.findById(req.params.id).lean();
    if (!user) { sendError(res, 'User not found', 404); return; }
    const [profile, listingApplications, jobApplications, listingsCreated, jobsCreated] = await Promise.all([
      profileFor(user._id, user.role),
      Application.countDocuments({ applicantId: user._id }),
      JobApplication.countDocuments({ applicantId: user._id }),
      Listing.countDocuments({ createdBy: user._id }),
      Job.countDocuments({ createdBy: user._id }),
    ]);
    sendSuccess(res, { user, profile, counts: { listingApplications, jobApplications, listingsCreated, jobsCreated } });
  } catch { sendError(res, 'Failed to get user', 500); }
};

/** Edit any athlete / coach / organization profile. */
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const Model = PROFILE_MODELS[req.params.kind];
    if (!Model) { sendError(res, 'Unknown profile type', 400); return; }
    if (!validId(res, req.params.id, 'Profile')) return;
    const doc = await Model.findByIdAndUpdate(req.params.id, { $set: editable(req.body) }, { new: true, runValidators: true });
    if (!doc) { sendError(res, 'Profile not found', 404); return; }
    sendSuccess(res, doc, 'Profile updated');
  } catch (e: any) { sendError(res, e?.name === 'ValidationError' ? e.message : 'Failed to update profile', e?.name === 'ValidationError' ? 400 : 500); }
};

// ── Opportunities: listings (trials/events/…) and jobs ─────────────────────────

const listQuery = (req: Request, typeField?: string) => {
  const q: Record<string, unknown> = {};
  if (req.query.status) q.status = req.query.status;
  if (typeField && req.query.type) q[typeField] = req.query.type;
  if (req.query.q) q.title = new RegExp(escapeRegex(String(req.query.q)), 'i');
  return q;
};

export const getAllListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = paging(req);
    const query = listQuery(req, 'type');
    const [items, total] = await Promise.all([
      Listing.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('organizationId', 'name logo isVerified').lean(),
      Listing.countDocuments(query),
    ]);
    sendSuccess(res, items, 'Listings fetched', 200, meta(total, page, limit));
  } catch { sendError(res, 'Failed to get listings', 500); }
};

export const updateListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!validId(res, req.params.id, 'Listing')) return;
    const doc = await Listing.findByIdAndUpdate(req.params.id, { $set: editable(req.body) }, { new: true, runValidators: true });
    if (!doc) { sendError(res, 'Listing not found', 404); return; }
    sendSuccess(res, doc, 'Listing updated');
  } catch (e: any) { sendError(res, e?.name === 'ValidationError' ? e.message : 'Failed to update listing', e?.name === 'ValidationError' ? 400 : 500); }
};

export const deleteListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!validId(res, req.params.id, 'Listing')) return;
    const doc = await Listing.findByIdAndDelete(req.params.id);
    if (!doc) { sendError(res, 'Listing not found', 404); return; }
    const { deletedCount } = await Application.deleteMany({ listingId: doc._id });
    sendSuccess(res, { applicationsRemoved: deletedCount }, 'Listing deleted');
  } catch { sendError(res, 'Failed to delete listing', 500); }
};

export const getListingApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!validId(res, req.params.id, 'Listing')) return;
    const apps = await Application.find({ listingId: req.params.id }).sort({ appliedAt: -1 })
      .populate('applicantId', 'email phone role').lean();
    sendSuccess(res, apps);
  } catch { sendError(res, 'Failed to get applications', 500); }
};

export const getAllJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = paging(req);
    const query = listQuery(req, 'category');
    const [items, total] = await Promise.all([
      Job.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('organizationId', 'name logo isVerified').lean(),
      Job.countDocuments(query),
    ]);
    sendSuccess(res, items, 'Jobs fetched', 200, meta(total, page, limit));
  } catch { sendError(res, 'Failed to get jobs', 500); }
};

export const updateJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!validId(res, req.params.id, 'Job')) return;
    const doc = await Job.findByIdAndUpdate(req.params.id, { $set: editable(req.body) }, { new: true, runValidators: true });
    if (!doc) { sendError(res, 'Job not found', 404); return; }
    sendSuccess(res, doc, 'Job updated');
  } catch (e: any) { sendError(res, e?.name === 'ValidationError' ? e.message : 'Failed to update job', e?.name === 'ValidationError' ? 400 : 500); }
};

export const deleteJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!validId(res, req.params.id, 'Job')) return;
    const doc = await Job.findByIdAndDelete(req.params.id);
    if (!doc) { sendError(res, 'Job not found', 404); return; }
    const { deletedCount } = await JobApplication.deleteMany({ jobId: doc._id });
    sendSuccess(res, { applicationsRemoved: deletedCount }, 'Job deleted');
  } catch { sendError(res, 'Failed to delete job', 500); }
};

export const getJobApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!validId(res, req.params.id, 'Job')) return;
    const apps = await JobApplication.find({ jobId: req.params.id }).sort({ appliedAt: -1 })
      .populate('applicantId', 'email phone role').lean();
    sendSuccess(res, apps);
  } catch { sendError(res, 'Failed to get applications', 500); }
};

/** Change an application's status (kind = listing | job). */
export const updateApplicationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const Model: any = req.params.kind === 'job' ? JobApplication : req.params.kind === 'listing' ? Application : null;
    if (!Model) { sendError(res, 'Unknown application type', 400); return; }
    if (!validId(res, req.params.id, 'Application')) return;
    const { status, rejectionReason } = req.body || {};
    const doc = await Model.findByIdAndUpdate(
      req.params.id,
      { $set: { status, rejectionReason: status === 'rejected' ? rejectionReason || '' : undefined, statusUpdatedAt: new Date() } },
      { new: true, runValidators: true },
    );
    if (!doc) { sendError(res, 'Application not found', 404); return; }
    sendSuccess(res, doc, 'Application updated');
  } catch (e: any) { sendError(res, e?.name === 'ValidationError' ? 'Invalid status' : 'Failed to update application', e?.name === 'ValidationError' ? 400 : 500); }
};

// ── Organizations ──────────────────────────────────────────────────────────────

export const getAllOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = paging(req);
    const query: Record<string, unknown> = {};
    if (req.query.status) query.verificationStatus = req.query.status;
    if (req.query.q) query.name = new RegExp(escapeRegex(String(req.query.q)), 'i');
    const [items, total] = await Promise.all([
      Organization.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'email isSuspended').lean(),
      Organization.countDocuments(query),
    ]);
    sendSuccess(res, items, 'Organizations fetched', 200, meta(total, page, limit));
  } catch { sendError(res, 'Failed to get organizations', 500); }
};

// ── Moderation: reviews ───────────────────────────────────────────────────────

export const getReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = paging(req);
    const query: Record<string, unknown> = req.query.reported === 'true' ? { isReported: true } : {};
    const [items, total] = await Promise.all([
      Review.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('reviewer', 'email role').populate('reviewee', 'email role').lean(),
      Review.countDocuments(query),
    ]);
    sendSuccess(res, items, 'Reviews fetched', 200, meta(total, page, limit));
  } catch { sendError(res, 'Failed to get reviews', 500); }
};

export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!validId(res, req.params.id, 'Review')) return;
    const doc = await Review.findByIdAndDelete(req.params.id);
    if (!doc) { sendError(res, 'Review not found', 404); return; }
    sendSuccess(res, null, 'Review removed');
  } catch { sendError(res, 'Failed to remove review', 500); }
};

export const dismissReviewReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!validId(res, req.params.id, 'Review')) return;
    const doc = await Review.findByIdAndUpdate(req.params.id, { $set: { isReported: false }, $unset: { reportReason: 1, reportedBy: 1 } }, { new: true });
    if (!doc) { sendError(res, 'Review not found', 404); return; }
    sendSuccess(res, doc, 'Report dismissed');
  } catch { sendError(res, 'Failed to update review', 500); }
};

// ── Payments ────────────────────────────────────────────────────────────────────

export const getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = paging(req);
    const query: Record<string, unknown> = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.type) query.type = req.query.type;
    const [items, total] = await Promise.all([
      Payment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'email role').lean(),
      Payment.countDocuments(query),
    ]);
    sendSuccess(res, items, 'Payments fetched', 200, meta(total, page, limit));
  } catch { sendError(res, 'Failed to get payments', 500); }
};

// ── Notifications: announcement history ───────────────────────────────────────

export const getAnnouncements = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // announcements are stored as one notification per recipient; group them back into sends
    const rows = await Notification.aggregate([
      { $match: { type: 'system_announcement' } },
      {
        $group: {
          _id: { title: '$title', message: '$message', minute: { $dateToString: { format: '%Y-%m-%dT%H:%M', date: '$createdAt' } } },
          sentAt: { $min: '$createdAt' }, recipients: { $sum: 1 }, read: { $sum: { $cond: ['$isRead', 1, 0] } },
        },
      },
      { $sort: { sentAt: -1 } },
      { $limit: 50 },
    ]);
    sendSuccess(res, rows.map((r) => ({ title: r._id.title, message: r._id.message, sentAt: r.sentAt, recipients: r.recipients, read: r.read })));
  } catch { sendError(res, 'Failed to get announcements', 500); }
};

// ── Site & app settings ──────────────────────────────────────────────────────────

const SETTINGS_FIELDS = ['banner', 'maintenance', 'signupsOpen', 'supportEmail', 'sports'];

export const getSettingsAdmin = async (_req: AuthRequest, res: Response): Promise<void> => {
  try { sendSuccess(res, await getSiteSettings()); } catch { sendError(res, 'Failed to get settings', 500); }
};

export const updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => SETTINGS_FIELDS.includes(k)));
    if (Array.isArray(body.sports)) body.sports = (body.sports as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 100);
    await getSiteSettings();
    const doc = await SiteSettings.findOneAndUpdate({ key: 'site' }, { $set: { ...body, updatedBy: req.user!._id } }, { new: true, runValidators: true });
    sendSuccess(res, doc, 'Settings saved');
  } catch (e: any) { sendError(res, e?.name === 'ValidationError' ? e.message : 'Failed to save settings', e?.name === 'ValidationError' ? 400 : 500); }
};

/** Public: what the website and app need (no admin-only fields). */
export const getPublicSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const s = await getSiteSettings();
    res.set('Cache-Control', 'public, max-age=60');
    sendSuccess(res, {
      banner: s.banner?.active ? { text: s.banner.text, link: s.banner.link, tone: s.banner.tone } : null,
      maintenance: s.maintenance?.active ? { message: s.maintenance.message } : null,
      signupsOpen: s.signupsOpen,
      supportEmail: s.supportEmail,
      sports: s.sports,
    });
  } catch { sendError(res, 'Failed to get settings', 500); }
};
