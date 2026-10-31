import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { AuthRequest } from '../types';
import { AthleteProfile } from '../models/AthleteProfile';
import { CoachProfile } from '../models/CoachProfile';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Connection } from '../models/Connection';
import { sendSuccess, sendError } from '../utils/response';
import { generateSlug } from '../utils/jwt';
import { Listing } from '../models/Listing';
import { Application } from '../models/Application';
import { pageParams } from '../utils/query';
import { Job } from '../models/Job';
import { deviceFromUserAgent, logEvent } from '../utils/activity';
import { StoredImage } from '../models/StoredImage';
import { athleteLookup, coachLookup, isRealName, isValidUsername, normalizeUsername, uniqueUsername, usernameTaken } from '../utils/username';

// ── HELPERS ──────────────────────────────────────────────────────────────────

const toNum = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
};

const toDate = (v: unknown): Date | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? undefined : d;
};

const sanitizeAchievements = (arr: unknown[]) =>
  arr.map((a: any) => ({ ...a, year: toNum(a.year) }));

const sanitizeTournaments = (arr: unknown[]) =>
  arr.map((t: any) => ({ ...t, year: toNum(t.year), startDate: toDate(t.startDate), endDate: toDate(t.endDate) }));

const sanitizeEducation = (arr: unknown[]) =>
  arr.map((e: any) => ({ ...e, year: toNum(e.year), startYear: toNum(e.startYear), endYear: toNum(e.endYear) }));

const sanitizePlayingHistory = (arr: unknown[]) =>
  arr.map((h: any) => ({ ...h, startDate: toDate(h.startDate), endDate: toDate(h.endDate) }));

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

const sanitizeCareerStats = (arr: unknown[]) =>
  arr.slice(0, 12).map((s: any) => ({ label: clip(s?.label, 40), value: clip(s?.value, 20) })).filter((s) => s.label && s.value);

const sanitizeCustomSections = (arr: unknown[]) =>
  arr.slice(0, 6).map((c: any) => ({
    title: clip(c?.title, 60),
    items: (Array.isArray(c?.items) ? c.items : []).slice(0, 12)
      .map((i: any) => ({ label: clip(i?.label, 60), value: clip(i?.value, 200) })).filter((i: { value: string }) => i.value),
  })).filter((c) => c.title && c.items.length);

// Sprint spec: at most 4 action photos (the profile avatar is a separate field) and a few video links.
export const MAX_ACTION_PHOTOS = 4;
const sanitizeMedia = (arr: unknown[]) => {
  const list = (arr as any[]).filter((m) => m && typeof m.url === 'string' && m.url);
  return [
    ...list.filter((m) => m.type === 'photo').slice(0, MAX_ACTION_PHOTOS),
    ...list.filter((m) => m.type === 'video').slice(0, 6),
  ];
};

/**
 * Deletes this player's database-stored photos that their profile no longer uses (replaced or removed).
 * Only photos older than 10 minutes are touched, so one that was just uploaded but not saved yet is safe.
 */
const pruneUnusedImages = async (userId: unknown, profile: any) => {
  try {
    const used = new Set<string>();
    for (const u of [profile.photo, ...((profile.media as any[]) || []).map((m) => m?.url)]) {
      const m = String(u || '').match(/images[/]([a-f0-9]{24})/i);
      if (m) used.add(m[1]);
    }
    await StoredImage.deleteMany({ ownerId: userId, _id: { $nin: [...used] }, createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } });
  } catch { /* housekeeping only: never fail the save */ }
};

const photoCount = (media: unknown) => ((media as any[]) || []).filter((m) => m?.type === 'photo').length;

const sanitizeCertifications = (arr: unknown[]) =>
  arr.map((c: any) => ({ ...c, year: toNum(c.year) }));

/** Email and phone are private: only the owner and accepted connections receive them. */
const withContactPrivacy = (profile: any, canSeeContact: boolean) => {
  const p = typeof profile?.toJSON === 'function' ? profile.toJSON() : { ...profile };
  if (!canSeeContact) {
    delete p.email;
    delete p.phone;
    if (p.userId && typeof p.userId === 'object') delete p.userId.email;
  }
  return p;
};

/** A CV may be pulled by an organization only if it is verified and has a real tie to the owner (a connection or an application to its listing). */
const orgMayViewCv = async (orgUserId: unknown, ownerUserId: unknown): Promise<boolean> => {
  const org = await Organization.findOne({ userId: orgUserId }).select('_id verificationStatus');
  if (!org || org.verificationStatus !== 'verified') return false;
  const connected = await Connection.exists({
    status: 'accepted',
    $or: [
      { requesterId: orgUserId, recipientId: ownerUserId },
      { requesterId: ownerUserId, recipientId: orgUserId },
    ],
  });
  if (connected) return true;
  const listingIds = await Listing.find({ organizationId: org._id }).distinct('_id');
  return Boolean(await Application.exists({ applicantId: ownerUserId, listingId: { $in: listingIds } }));
};

// ── ATHLETE ──────────────────────────────────────────────────────────────────

export const getAthleteProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const query = athleteLookup(id);

    const profile = await AthleteProfile.findOne(query)
      .populate('userId', 'email role isVerified')
      .populate('coachReferences', 'fullName photo profileUrl');

    if (!profile) { sendError(res, 'Profile not found', 404); return; }

    // userId is populated, so compare its _id (calling toString() on the populated document never matches)
    const ownerId = ((profile.userId as any)?._id || profile.userId)?.toString();
    if (profile.visibility === 'private' && ownerId !== req.user?._id.toString()) {
      sendError(res, 'This profile is private', 403); return;
    }

    let connectionStatus = null;
    let connectionId = null;
    if (req.user) {
      const conn = await Connection.findOne({
        $or: [
          { requesterId: req.user._id, recipientId: (profile.userId as any)._id || profile.userId },
          { requesterId: (profile.userId as any)._id || profile.userId, recipientId: req.user._id }
        ]
      });
      if (conn) {
        connectionId = conn._id;
        if (conn.status === 'accepted') {
          connectionStatus = 'accepted';
        } else if (conn.status === 'pending') {
          connectionStatus = conn.requesterId.toString() === req.user._id.toString() ? 'pending' : 'received_pending';
        }
      }
    }

    const profileOwnerId = ((profile.userId as any)?._id || profile.userId)?.toString();
    const isOwnProfile = req.user ? req.user._id.toString() === profileOwnerId : false;
    const canSeeContact = isOwnProfile || connectionStatus === 'accepted';
    sendSuccess(res, { profile: withContactPrivacy(profile, canSeeContact), connectionStatus, connectionId, isOwnProfile });
  } catch (err) {
    console.error('getAthleteProfile error:', err);
    sendError(res, 'Failed to get profile', 500); 
  }
};

const isPhoneOrEmail = (value: string): boolean => {
  if (!value) return false;
  const stripped = value.replace(/[\s\-().+]/g, '');
  if (/^\d{7,}$/.test(stripped)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
  return false;
};

export const updateAthleteProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.body.fullName && isPhoneOrEmail(req.body.fullName)) {
      sendError(res, 'Display name cannot be a phone number or email address', 400);
      return;
    }

    let profile = await AthleteProfile.findOne({ userId: req.user!._id });
    if (!profile) {
      profile = await AthleteProfile.create({
        userId: req.user!._id,
        fullName: req.body.fullName || 'Athlete',
        profileUrl: generateSlug(req.body.fullName || req.user!._id.toString()),
      });
    }

    const allowedFields = [
      'fullName', 'username', 'photo', 'dob', 'gender', 'location', 'email', 'phone', 'primarySport', 'secondarySports',
      'position', 'dominantSide', 'height', 'heightUnit', 'weight', 'isParaAthlete', 'paraClassification',
      'achievements', 'tournaments', 'playingHistory', 'education', 'certifications',
      'media', 'socialLinks', 'tagline', 'aboutBio', 'careerHighlights', 'goalsAspirations',
      'yearsOfExperience', 'experienceLevel', 'strengths', 'featuredVideoUrl', 'institutionName', 'currentEducation',
      'availabilityStatus', 'visibility', 'coachReferences',
      'secondaryPosition', 'careerStats', 'customSections', 'nationality', 'countryCode', 'skills',
    ];

    const numericFields = new Set(['height', 'weight', 'yearsOfExperience']);

    // The username is the public CV link, so it must be unique and URL-safe.
    if (req.body.username !== undefined) {
      const wanted = normalizeUsername(req.body.username);
      if (!wanted) {
        delete req.body.username; // blank means "leave it as it is"
      } else if (!isValidUsername(wanted)) {
        sendError(res, 'Username must be 3–30 characters: letters, numbers, - or _', 400, 'INVALID_USERNAME');
        return;
      } else if (wanted !== profile.username && await usernameTaken(wanted, profile._id)) {
        sendError(res, 'That username is already taken. Try another.', 409, 'USERNAME_TAKEN');
        return;
      } else {
        req.body.username = wanted;
      }
    }

    const photosBefore = photoCount(profile.media);

    allowedFields.forEach((field) => {
      let value = req.body[field];
      if (value === undefined) return;

      // Convert empty strings to undefined to avoid validation errors for enums/dates/numbers
      if (value === '') value = undefined;

      if (numericFields.has(field)) {
        value = toNum(value);
      } else if (field === 'achievements' && Array.isArray(value)) {
        value = sanitizeAchievements(value);
      } else if (field === 'tournaments' && Array.isArray(value)) {
        value = sanitizeTournaments(value);
      } else if (field === 'playingHistory' && Array.isArray(value)) {
        value = sanitizePlayingHistory(value);
      } else if (field === 'education' && Array.isArray(value)) {
        value = sanitizeEducation(value);
      } else if (field === 'certifications' && Array.isArray(value)) {
        value = sanitizeCertifications(value);
      } else if (field === 'careerStats' && Array.isArray(value)) {
        value = sanitizeCareerStats(value);
      } else if (field === 'skills' && Array.isArray(value)) {
        value = value.slice(0, 20).map((x) => clip(x, 40)).filter(Boolean);
      } else if (field === 'socialLinks' && value && typeof value === 'object') {
        value = Object.fromEntries(['instagram', 'youtube', 'twitter', 'facebook', 'linkedin', 'whatsapp'].map((k) => [k, clip((value as any)[k], 200)]));
      } else if (field === 'customSections' && Array.isArray(value)) {
        value = sanitizeCustomSections(value);
      } else if (field === 'media' && Array.isArray(value)) {
        value = sanitizeMedia(value);
      } else if (field === 'dob') {
        value = toDate(value);
      }
      (profile as any)[field] = value;
    });

    if (!profile.username && isRealName(profile.fullName)) {
      profile.username = await uniqueUsername(profile.fullName, profile._id);
    }

    profile.profileCompletion = calculateAthleteCompletion(profile);
    await profile.save();
    void pruneUnusedImages(req.user!._id, profile);
    const device = deviceFromUserAgent(req.headers['user-agent'], req.headers['x-app-platform'] as string | undefined);
    void logEvent(req.user!._id.toString(), 'CV_UPDATED', { sport: profile.primarySport, meta: { device } });
    if (photoCount(profile.media) > photosBefore) {
      void logEvent(req.user!._id.toString(), 'PHOTOS_UPLOADED', { sport: profile.primarySport, meta: { device } });
    }
    sendSuccess(res, profile, 'Profile updated');
  } catch (err) {
    console.error('updateAthleteProfile error:', err);
    sendError(res, (err as any).message || 'Failed to update profile', 500);
  }
};

const calculateAthleteCompletion = (profile: InstanceType<typeof AthleteProfile>): number => {
  let score = 0;
  if (profile.photo) score += 10;
  if (profile.fullName) score += 10;
  if (profile.dob) score += 5;
  if (profile.gender) score += 5;
  if (profile.location?.city || profile.location?.pincode) score += 5;
  if (profile.primarySport) score += 15;
  if (profile.tagline || profile.aboutBio) score += 10;
  if (profile.achievements && profile.achievements.length > 0) score += 15;
  if (profile.playingHistory && profile.playingHistory.length > 0) score += 10;
  if (profile.media && profile.media.length > 0) score += 10;
  if (profile.availabilityStatus) score += 5;
  if (profile.email) score += 5;
  if (profile.phone) score += 5;
  return Math.min(score, 100);
};

export const getMyAthleteProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await AthleteProfile.findOne({ userId: req.user!._id });
    if (!profile) { sendError(res, 'Profile not found', 404); return; }
    // Existing players have no username yet: give them a clean one (rahul-sharma) so their share link isn't a random slug.
    // updateOne skips full-document validation, so older profiles with legacy data can't block this.
    if (!profile.username && isRealName(profile.fullName)) {
      const username = await uniqueUsername(profile.fullName, profile._id);
      await AthleteProfile.updateOne({ _id: profile._id }, { $set: { username } });
      profile.username = username;
    }
    sendSuccess(res, profile);
  } catch { sendError(res, 'Failed to get profile', 500); }
};

// ── COACH ─────────────────────────────────────────────────────────────────────

export const getMyCoachProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let profile = await CoachProfile.findOne({ userId: req.user!._id });
    if (!profile) {
      profile = await CoachProfile.create({ userId: req.user!._id, fullName: 'Coach', profileUrl: generateSlug(req.user!._id.toString()) });
    }
    // every coach gets their public link (username) the first time they open their CV
    if (!profile.username && isRealName(profile.fullName) && profile.fullName !== 'Coach') {
      profile.username = await uniqueUsername(profile.fullName, profile._id);
      await profile.save();
    }
    sendSuccess(res, profile);
  } catch { sendError(res, 'Failed to get profile', 500); }
};

export const getCoachProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const profile = await CoachProfile.findOne(coachLookup(id))
      .populate('userId', 'email role isVerified')
      .populate('athletesDeveloped', 'fullName photo profileUrl primarySport');

    if (!profile) { sendError(res, 'Profile not found', 404); return; }

    const ownerOfProfile = ((profile.userId as any)?._id || profile.userId)?.toString();
    if (profile.visibility === 'private' && ownerOfProfile !== req.user?._id.toString()) {
      sendError(res, 'This profile is private', 403); return;
    }

    let connectionStatus = null;
    let connectionId = null;
    if (req.user) {
      const conn = await Connection.findOne({
        $or: [
          { requesterId: req.user._id, recipientId: (profile.userId as any)._id || profile.userId },
          { requesterId: (profile.userId as any)._id || profile.userId, recipientId: req.user._id }
        ]
      });
      if (conn) {
        connectionId = conn._id;
        if (conn.status === 'accepted') {
          connectionStatus = 'accepted';
        } else if (conn.status === 'pending') {
          connectionStatus = conn.requesterId.toString() === req.user._id.toString() ? 'pending' : 'received_pending';
        }
      }
    }

    const profileOwnerId = ((profile.userId as any)?._id || profile.userId)?.toString();
    const isOwnProfile = req.user ? req.user._id.toString() === profileOwnerId : false;
    const canSeeContact = isOwnProfile || connectionStatus === 'accepted';
    sendSuccess(res, { profile: withContactPrivacy(profile, canSeeContact), connectionStatus, connectionId, isOwnProfile });
  } catch (err) {
    console.error('getCoachProfile error:', err);
    sendError(res, 'Failed to get coach profile', 500);
  }
};

const sanitizeCoachEducation = (arr: unknown[]) =>
  arr.slice(0, 12).map((e: any) => ({
    institution: clip(e?.institution, 120), degree: clip(e?.degree, 80), fieldOfStudy: clip(e?.fieldOfStudy, 80),
    startYear: toNum(e?.startYear), endYear: e?.isCurrent ? undefined : toNum(e?.endYear), isCurrent: !!e?.isCurrent, description: clip(e?.description, 400),
  })).filter((e) => e.institution);

const sanitizeCoachExperience = (arr: unknown[]) =>
  arr.slice(0, 20).map((e: any) => ({
    organization: clip(e?.organization, 120), role: clip(e?.role, 80), startDate: toDate(e?.startDate),
    endDate: e?.current ? undefined : toDate(e?.endDate), current: !!e?.current,
  })).filter((e) => e.organization);

const sanitizeQualifications = (arr: unknown[]) =>
  arr.slice(0, 20).map((q: any) => ({ name: clip(q?.name, 120), issuer: clip(q?.issuer, 120), year: toNum(q?.year), document: q?.document ? clip(q.document, 300) : undefined })).filter((q) => q.name);

const sanitizePlayersTrained = (arr: unknown[]) =>
  arr.slice(0, 20).map((t: any) => ({ name: clip(t?.name, 120), result: clip(t?.result, 120), year: toNum(t?.year), description: clip(t?.description, 400) })).filter((t) => t.name);

const sanitizeCoachAchievements = (arr: unknown[]) =>
  arr.slice(0, 20).map((a: any) => ({ title: clip(a?.title, 140), year: toNum(a?.year), level: clip(a?.level, 40), category: clip(a?.category, 40), description: clip(a?.description, 400) })).filter((a) => a.title);

const calculateCoachCompletion = (p: InstanceType<typeof CoachProfile>): number => {
  let score = 0;
  if (p.photo) score += 10;
  if (isRealName(p.fullName) && p.fullName !== 'Coach') score += 10;
  if (p.dob) score += 5;
  if (p.gender) score += 5;
  if (p.location?.city) score += 5;
  if (p.sportsSpecialization?.length) score += 15;
  if (p.tagline || p.aboutBio) score += 10;
  if (p.qualifications?.length) score += 15;
  if (p.experience?.length) score += 15;
  if (p.playersTrained?.length || p.achievements?.length) score += 5;
  if (p.email) score += 5;
  if (p.phone) score += 5;
  return Math.min(score, 100);
};

export const updateCoachProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.body.fullName && isPhoneOrEmail(req.body.fullName)) {
      sendError(res, 'Display name cannot be a phone number or email address', 400);
      return;
    }

    let profile = await CoachProfile.findOne({ userId: req.user!._id });
    if (!profile) {
      profile = await CoachProfile.create({
        userId: req.user!._id,
        fullName: req.body.fullName || 'Coach',
        profileUrl: generateSlug(req.body.fullName || req.user!._id.toString()),
      });
    }

    const allowedFields = [
      'fullName', 'username', 'photo', 'dob', 'gender', 'location', 'email', 'phone', 'countryCode', 'nationality', 'tagline',
      'qualifications', 'sportsSpecialization', 'ageGroupsCoached', 'experience', 'education', 'playersTrained', 'achievements',
      'skills', 'coachingPhilosophy', 'availability', 'aboutBio', 'socialLinks', 'visibility', 'yearsOfExperience', 'coachingLevel',
      'featuredVideoUrl',
    ];

    if (req.body.username !== undefined) {
      const wanted = normalizeUsername(req.body.username);
      if (!wanted) {
        delete req.body.username;
      } else if (!isValidUsername(wanted)) {
        sendError(res, 'Username must be 3–30 characters: letters, numbers, - or _', 400, 'INVALID_USERNAME');
        return;
      } else if (wanted !== profile.username && await usernameTaken(wanted, profile._id)) {
        sendError(res, 'That username is already taken. Try another.', 409, 'USERNAME_TAKEN');
        return;
      } else {
        req.body.username = wanted;
      }
    }

    allowedFields.forEach((field) => {
      let value = req.body[field];
      if (value === undefined) return;
      if (value === '') value = undefined;

      if (field === 'yearsOfExperience') value = toNum(value);
      else if (field === 'dob') value = toDate(value);
      else if (field === 'qualifications' && Array.isArray(value)) value = sanitizeQualifications(value);
      else if (field === 'experience' && Array.isArray(value)) value = sanitizeCoachExperience(value);
      else if (field === 'education' && Array.isArray(value)) value = sanitizeCoachEducation(value);
      else if (field === 'playersTrained' && Array.isArray(value)) value = sanitizePlayersTrained(value);
      else if (field === 'achievements' && Array.isArray(value)) value = sanitizeCoachAchievements(value);
      else if ((field === 'skills' || field === 'sportsSpecialization' || field === 'ageGroupsCoached') && Array.isArray(value)) {
        value = value.slice(0, field === 'skills' ? 20 : 12).map((x: unknown) => clip(x, 40)).filter(Boolean);
      } else if (field === 'socialLinks' && value && typeof value === 'object') {
        value = Object.fromEntries(['instagram', 'youtube', 'twitter', 'facebook', 'linkedin', 'whatsapp'].map((k) => [k, clip((value as any)[k], 200)]));
      }
      (profile as any)[field] = value;
    });

    if (!profile.username && isRealName(profile.fullName) && profile.fullName !== 'Coach') {
      profile.username = await uniqueUsername(profile.fullName, profile._id);
    }

    profile.profileCompletion = calculateCoachCompletion(profile);
    await profile.save();
    const device = deviceFromUserAgent(req.headers['user-agent'], req.headers['x-app-platform'] as string | undefined);
    void logEvent(req.user!._id.toString(), 'CV_UPDATED', { sport: profile.sportsSpecialization?.[0], meta: { device } });
    sendSuccess(res, profile, 'Coach profile updated');
  } catch (err) {
    console.error('updateCoachProfile error:', err);
    sendError(res, (err as any).message || 'Failed to update coach profile', 500);
  }
};

// ── ORGANIZATION ──────────────────────────────────────────────────────────────

export const getMyOrganizationProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await Organization.findOne({ userId: req.user!._id });
    if (!profile) { sendError(res, 'Profile not found', 404); return; }
    sendSuccess(res, profile);
  } catch { sendError(res, 'Failed to get profile', 500); }
};

export const getOrganizationProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const query = id.includes('-') || id.length !== 24
      ? { profileUrl: id }
      : { $or: [{ _id: id }, { profileUrl: id }, { userId: id }] };

    const org = await Organization.findOne(query)
      .select('-verificationDocuments -rejectionReason -alternatePhone')
      .populate('userId', 'role')
      .populate('coachingStaff', 'fullName photo profileUrl sportsSpecialization');

    if (!org) { sendError(res, 'Organization not found', 404); return; }

    let connectionStatus = null;
    let connectionId = null;
    if (req.user) {
      const conn = await Connection.findOne({
        $or: [
          { requesterId: req.user._id, recipientId: (org.userId as any)._id || org.userId },
          { requesterId: (org.userId as any)._id || org.userId, recipientId: req.user._id }
        ]
      });
      if (conn) {
        connectionId = conn._id;
        if (conn.status === 'accepted') {
          connectionStatus = 'accepted';
        } else if (conn.status === 'pending') {
          connectionStatus = conn.requesterId.toString() === req.user._id.toString() ? 'pending' : 'received_pending';
        }
      }
    }

    const [listings, jobs] = await Promise.all([
      Listing.find({ organizationId: org._id, status: 'published' })
        .select('title type sport startDate endDate location applicationDeadline')
        .sort({ startDate: 1 })
        .limit(10),
      Job.find({ organizationId: org._id, status: 'published' })
        .select('title category jobType location salaryRange')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    const orgOwnerId = ((org.userId as any)?._id || org.userId)?.toString();
    const isOwnProfile = req.user ? req.user._id.toString() === orgOwnerId : false;
    sendSuccess(res, { profile: org, listings, jobs, connectionStatus, connectionId, isOwnProfile });
  } catch (err) {
    console.error('getOrganizationProfile error:', err);
    sendError(res, 'Failed to get organization', 500);
  }
};

export const updateOrganizationProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let org = await Organization.findOne({ userId: req.user!._id });
    if (!org) {
      org = await Organization.create({
        userId: req.user!._id,
        name: req.body.name || 'Organization',
        type: req.body.type || 'academy',
        profileUrl: generateSlug(req.body.name || req.user!._id.toString()),
        verificationStatus: 'pending',
        isVerified: false,
      });
    }

    const allowedFields = [
      'name', 'logo', 'banner', 'description', 'address', 'contact', 'sports',
      'facilities', 'achievements',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (org as any)[field] = req.body[field];
      }
    });

    await org.save();
    sendSuccess(res, org, 'Organization profile updated');
  } catch (err) {
    console.error('updateOrganizationProfile error:', err);
    sendError(res, (err as any).message || 'Failed to update organization', 500);
  }
};

export const uploadVerificationDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const org = await Organization.findOne({ userId: req.user!._id });
    if (!org) { sendError(res, 'Organization not found', 404); return; }

    const { documents } = req.body;
    if (!documents || !Array.isArray(documents)) {
      sendError(res, 'Documents required', 400); return;
    }

    org.verificationDocuments = documents;
    org.verificationStatus = 'pending';
    await org.save();

    sendSuccess(res, org, 'Documents uploaded, pending verification');
  } catch { sendError(res, 'Failed to upload documents', 500); }
};

// ── CV GENERATION ─────────────────────────────────────────────────────────────

export const downloadAthleteCV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const query = athleteLookup(id);

    const profile = await AthleteProfile.findOne(query);
    if (!profile) { sendError(res, 'Profile not found', 404); return; }

    if (profile.visibility === 'private' && profile.userId.toString() !== req.user?._id?.toString()) {
      sendError(res, 'This profile is private', 403); return;
    }

    // ── Permission check ──
    const requesterId = req.user?._id?.toString();
    const isOwn = requesterId === profile.userId.toString();
    const viewerRole = req.user?.role;

    if (!isOwn) {
      if (!req.user) { sendError(res, 'Login required to download CV', 401); return; }
      if (viewerRole === 'athlete') {
        sendError(res, 'Athletes cannot download other athletes\' CV', 403); return;
      }
      if (viewerRole === 'coach' || viewerRole === 'professional') {
        const connected = await Connection.findOne({
          $or: [
            { requesterId, recipientId: profile.userId.toString(), status: 'accepted' },
            { requesterId: profile.userId.toString(), recipientId: requesterId, status: 'accepted' },
          ],
        });
        if (!connected) { sendError(res, 'You must be connected with this athlete to download their CV', 403); return; }
      }
      if (viewerRole === 'organization' && !(await orgMayViewCv(req.user._id, profile.userId))) {
        sendError(res, 'Only verified organizations connected with this athlete can download their CV', 403); return;
      }
    }

    // Images are fetched up front so the PDF stream never stalls half-way; any that fail are simply skipped.
    const fetchImage = async (url?: string): Promise<Buffer | null> => {
      if (!url) return null;
      const stored = url.match(/images[/]([a-f0-9]{24})/i); // photo kept in the database
      if (stored && !/^https?:[/][/]res[.]cloudinary[.]com/.test(url)) {
        // Only the profile owner's own stored photos may be embedded.
        try { const img = await StoredImage.findOne({ _id: stored[1], ownerId: profile.userId }).select('data'); return img ? img.data : null; } catch { return null; }
      }
      // Server-side fetch only from Cloudinary over https: no internal addresses, no redirects, bounded size.
      if (!/^https:[/][/]res[.]cloudinary[.]com[/]/.test(url)) return null;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(6000), redirect: 'error' });
        if (!r.ok || Number(r.headers.get('content-length') || 0) > 5 * 1024 * 1024) return null;
        const buf = Buffer.from(await r.arrayBuffer());
        return buf.length <= 5 * 1024 * 1024 ? buf : null;
      } catch { return null; }
    };
    const galleryUrls = ((profile.media as any[]) || []).filter((m) => m?.type === 'photo').slice(0, 4).map((m) => m.url as string);
    const [avatarBuf, ...galleryBufs] = await Promise.all([fetchImage(profile.photo), ...galleryUrls.map((u) => fetchImage(u))]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const filename = `${profile.fullName.replace(/[^A-Za-z0-9_-]+/g, '_') || 'Sports'}_Sports_CV.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ── Color Palette ──
    const BRAND    = '#1D4ED8';
    const BRAND2   = '#1E40AF';
    const ACCENT   = '#3B82F6';
    const DARK     = '#111827';
    const MID      = '#374151';
    const GRAY     = '#6B7280';
    const LIGHT_GRAY = '#F3F4F6';
    const WHITE    = 'white';
    const PAGE_W   = doc.page.width;   // 595.28
    const CONTENT_W = 495;
    const LEFT     = 50;
    const RIGHT    = LEFT + CONTENT_W;

    // ── Helpers ──
    const addPageIfNeeded = (needed = 40) => {
      if (y + needed > doc.page.height - 70) { doc.addPage(); y = 50; }
    };

    const sectionTitle = (title: string) => {
      addPageIfNeeded(36);
      y += 6;
      doc.rect(LEFT, y, CONTENT_W, 22).fill(BRAND);
      doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold')
        .text(title.toUpperCase(), LEFT + 8, y + 7, { width: CONTENT_W - 16 });
      y += 30;
      doc.fillColor(DARK).font('Helvetica');
    };

    const drawTag = (text: string, x: number, ty: number, bg = ACCENT): number => {
      doc.fontSize(8);
      const w = doc.widthOfString(text) + 12;
      doc.rect(x, ty, w, 14).fill(bg);
      doc.fillColor(WHITE).fontSize(8).font('Helvetica').text(text, x + 6, ty + 3, { width: w - 8 });
      doc.fillColor(DARK);
      return w + 4;
    };

    // ── HEADER BANNER ──
    const headerH = profile.email || profile.phone ? 125 : 110;
    doc.rect(0, 0, PAGE_W, headerH).fill(BRAND2);
    // subtle diagonal accent stripe
    doc.save();
    doc.rect(0, 0, PAGE_W, headerH).clip();
    doc.moveTo(PAGE_W - 120, 0).lineTo(PAGE_W, 0).lineTo(PAGE_W, headerH).lineTo(PAGE_W - 200, headerH).fill(BRAND);
    doc.restore();

    // Round profile photo on the right of the banner
    const textW = avatarBuf ? PAGE_W - 190 : PAGE_W - 100;
    if (avatarBuf) {
      try {
        doc.save();
        doc.circle(PAGE_W - 85, headerH / 2, 38).clip();
        doc.image(avatarBuf, PAGE_W - 123, headerH / 2 - 38, { cover: [76, 76], align: 'center', valign: 'center' });
        doc.restore();
        doc.circle(PAGE_W - 85, headerH / 2, 38).lineWidth(2).strokeColor(WHITE).stroke();
      } catch { doc.restore(); /* unsupported image format: keep the banner without a photo */ }
    }

    // Name
    doc.fillColor(WHITE).fontSize(24).font('Helvetica-Bold').text(profile.fullName, LEFT, 22, { width: textW });

    // Sport · Position · Experience Level
    const subtitleParts: string[] = [];
    if (profile.primarySport) subtitleParts.push(profile.primarySport);
    if (profile.position) subtitleParts.push(profile.secondaryPosition ? `${profile.position} / ${profile.secondaryPosition}` : profile.position);
    if (profile.experienceLevel) subtitleParts.push(profile.experienceLevel);
    if (subtitleParts.length > 0) {
      doc.fontSize(12).font('Helvetica').text(subtitleParts.join('  |  '), LEFT, 50, { width: textW });
    }

    // Location + Status
    const loc = profile.location;
    const locParts: string[] = [];
    if (loc?.city) locParts.push(loc.city);
    if (loc?.state) locParts.push(loc.state);
    if (loc?.country) locParts.push(loc.country);
    const locStr = locParts.length > 0 ? `Location: ${locParts.join(', ')}` : '';
    const statusLabel = profile.availabilityStatus
      ? profile.availabilityStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : '';
    const line3Parts: string[] = [];
    if (locStr) line3Parts.push(locStr);
    if (statusLabel) line3Parts.push(`Status: ${statusLabel}`);
    if (line3Parts.length > 0) {
      doc.fontSize(9).font('Helvetica').text(line3Parts.join('   |   '), LEFT, 68, { width: textW });
    }

    // Contact info row
    const contactParts: string[] = [];
    if (profile.email) contactParts.push(`Email: ${profile.email}`);
    if (profile.phone) contactParts.push(`Phone: ${profile.phone}`);
    if (profile.socialLinks?.whatsapp) contactParts.push(`WhatsApp: ${profile.socialLinks.whatsapp}`);
    if (contactParts.length > 0) {
      doc.fontSize(9).font('Helvetica').text(contactParts.join('   |   '), LEFT, 86, { width: textW });
    }

    doc.fillColor(DARK);
    let y = headerH + 14;

    // ── STATS ROW ──
    const stats: { label: string; value: string }[] = [];
    if (profile.yearsOfExperience) stats.push({ label: 'Experience', value: `${profile.yearsOfExperience} yrs` });
    if (profile.height) stats.push({ label: 'Height', value: `${profile.height} ${profile.heightUnit || 'cm'}` });
    if (profile.weight) stats.push({ label: 'Weight', value: `${profile.weight} kg` });
    if (profile.dominantSide) stats.push({ label: 'Dominant Side', value: profile.dominantSide.charAt(0).toUpperCase() + profile.dominantSide.slice(1) });
    if (profile.dob) {
      const age = Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 3600 * 1000));
      stats.push({ label: 'Age', value: `${age} yrs` });
    }
    if (profile.gender && profile.gender !== 'prefer_not_to_say') {
      stats.push({ label: 'Gender', value: profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) });
    }
    if (profile.isParaAthlete) stats.push({ label: 'Para Athlete', value: profile.paraClassification || 'Yes' });

    if (stats.length > 0) {
      const maxCols = Math.min(stats.length, 6);
      const colW = CONTENT_W / maxCols;
      stats.slice(0, maxCols).forEach((s, i) => {
        const x = LEFT + i * colW;
        const isEven = i % 2 === 0;
        doc.rect(x, y, colW - 2, 42).fill(isEven ? LIGHT_GRAY : '#E8EFFD');
        doc.fillColor(GRAY).fontSize(7).font('Helvetica-Bold').text(s.label.toUpperCase(), x + 6, y + 6, { width: colW - 12 });
        doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(s.value, x + 6, y + 18, { width: colW - 12 });
      });
      // second row if > 6 stats
      if (stats.length > 6) {
        y += 44;
        stats.slice(6).forEach((s, i) => {
          const x = LEFT + i * colW;
          doc.rect(x, y, colW - 2, 42).fill(i % 2 === 0 ? LIGHT_GRAY : '#E8EFFD');
          doc.fillColor(GRAY).fontSize(7).font('Helvetica-Bold').text(s.label.toUpperCase(), x + 6, y + 6, { width: colW - 12 });
          doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(s.value, x + 6, y + 18, { width: colW - 12 });
        });
      }
      doc.fillColor(DARK).font('Helvetica');
      y += 54;
    }

    // ── CAREER STATS ──
    if (profile.careerStats?.length > 0) {
      sectionTitle('Career Stats');
      const cols = Math.min(profile.careerStats.length, 4);
      const tileW = CONTENT_W / cols;
      profile.careerStats.slice(0, 12).forEach((s, i) => {
        const col = i % cols;
        if (col === 0 && i > 0) y += 46;
        const x = LEFT + col * tileW;
        doc.rect(x, y, tileW - 4, 40).fill(i % 2 === 0 ? LIGHT_GRAY : '#E8EFFD');
        doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text(s.value, x + 8, y + 6, { width: tileW - 20 });
        doc.fillColor(GRAY).fontSize(7).font('Helvetica-Bold').text(s.label.toUpperCase(), x + 8, y + 26, { width: tileW - 20 });
      });
      y += 52;
      doc.fillColor(DARK).font('Helvetica');
    }

    // ── ABOUT ──
    if (profile.tagline || profile.aboutBio) {
      sectionTitle('About');
      if (profile.tagline) {
        doc.fillColor(MID).fontSize(10).font('Helvetica-Bold')
          .text(`"${profile.tagline}"`, LEFT, y, { width: CONTENT_W });
        y += doc.heightOfString(`"${profile.tagline}"`, { width: CONTENT_W }) + 8;
      }
      if (profile.aboutBio) {
        doc.fillColor(DARK).fontSize(10).font('Helvetica').text(profile.aboutBio, LEFT, y, { width: CONTENT_W });
        y += doc.heightOfString(profile.aboutBio, { width: CONTENT_W }) + 8;
      }
    }

    // ── CAREER HIGHLIGHTS ──
    if (profile.careerHighlights) {
      addPageIfNeeded(50);
      sectionTitle('Career Highlights');
      doc.fillColor(DARK).fontSize(10).font('Helvetica').text(profile.careerHighlights, LEFT, y, { width: CONTENT_W });
      y += doc.heightOfString(profile.careerHighlights, { width: CONTENT_W }) + 8;
    }

    // ── GOALS & ASPIRATIONS ──
    if (profile.goalsAspirations) {
      addPageIfNeeded(50);
      sectionTitle('Goals & Aspirations');
      doc.fillColor(DARK).fontSize(10).font('Helvetica').text(profile.goalsAspirations, LEFT, y, { width: CONTENT_W });
      y += doc.heightOfString(profile.goalsAspirations, { width: CONTENT_W }) + 8;
    }

    // ── STRENGTHS ──
    if (profile.strengths) {
      addPageIfNeeded(40);
      sectionTitle('Strengths');
      doc.fillColor(DARK).fontSize(10).font('Helvetica').text(profile.strengths, LEFT, y, { width: CONTENT_W });
      y += doc.heightOfString(profile.strengths, { width: CONTENT_W }) + 8;
    }

    // ── SECONDARY SPORTS ──
    if (profile.secondarySports?.length > 0) {
      addPageIfNeeded(40);
      sectionTitle('Secondary Sports');
      let tagX = LEFT;
      for (const sport of profile.secondarySports) {
        doc.fontSize(8);
        const tw = doc.widthOfString(sport) + 12 + 4;
        if (tagX + tw > RIGHT) { tagX = LEFT; y += 20; }
        tagX += drawTag(sport, tagX, y, BRAND);
      }
      y += 22;
    }

    // ── ACHIEVEMENTS ──
    if (profile.achievements?.length > 0) {
      sectionTitle('Achievements');
      for (const a of profile.achievements) {
        addPageIfNeeded(36);
        // Left accent bar
        doc.rect(LEFT, y, 3, 14).fill(ACCENT);
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
          .text(a.title, LEFT + 10, y, { width: 370 });
        // year badge top-right
        if (a.year) {
          doc.fillColor(GRAY).fontSize(9).font('Helvetica')
            .text(String(a.year), LEFT + 10 + 370, y, { align: 'right', width: 115 });
        }
        y += 15;
        const meta: string[] = [];
        if (a.level) meta.push(a.level);
        if (a.category) meta.push(a.category);
        if (meta.length > 0) {
          doc.fillColor(ACCENT).fontSize(8).font('Helvetica').text(meta.join('  ·  '), LEFT + 10, y);
          y += 13;
        }
        if (a.description) {
          doc.fillColor(MID).fontSize(9).font('Helvetica').text(a.description, LEFT + 10, y, { width: CONTENT_W - 10 });
          y += doc.heightOfString(a.description, { width: CONTENT_W - 10 }) + 4;
        }
        y += 6;
      }
      y += 2;
    }

    // ── PLAYING HISTORY ──
    if (profile.playingHistory?.length > 0) {
      sectionTitle('Playing History');
      for (const h of profile.playingHistory) {
        addPageIfNeeded(36);
        const dateStr = h.startDate
          ? `${new Date(h.startDate).getFullYear()} – ${h.current ? 'Present' : h.endDate ? new Date(h.endDate).getFullYear() : ''}`
          : '';
        // Timeline dot
        doc.circle(LEFT + 5, y + 5, 4).fill(BRAND);
        doc.moveTo(LEFT + 5, y + 9).lineTo(LEFT + 5, y + 24).strokeColor('#BFDBFE').lineWidth(1).stroke();
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(h.organization, LEFT + 16, y, { width: 350 });
        if (dateStr) {
          doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(dateStr, LEFT + 16 + 350, y, { align: 'right', width: 129 });
        }
        y += 15;
        if (h.role) {
          doc.fillColor(ACCENT).fontSize(9).font('Helvetica-Bold').text(h.role, LEFT + 16, y);
          y += 13;
        }
        if (h.description) {
          doc.fillColor(MID).fontSize(9).font('Helvetica').text(h.description, LEFT + 16, y, { width: CONTENT_W - 16 });
          y += doc.heightOfString(h.description, { width: CONTENT_W - 16 }) + 4;
        }
        y += 8;
      }
    }

    if (profile.institutionName) {
      addPageIfNeeded(24);
      doc.fillColor(GRAY).fontSize(9).font('Helvetica-Bold').text('SCHOOL / COLLEGE   ', LEFT, y, { continued: true });
      doc.fillColor(DARK).fontSize(10).font('Helvetica').text(profile.institutionName, { width: CONTENT_W - 120 });
      y += 22;
    }


    // ── TOURNAMENTS ──
    if (profile.tournaments?.length > 0) {
      sectionTitle('Tournaments');
      for (const t of profile.tournaments) {
        addPageIfNeeded(34);
        doc.rect(LEFT, y, CONTENT_W, t.description ? 46 : 32).fill('#F0F4FF');
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(t.name, LEFT + 8, y + 6, { width: 340 });
        if (t.result) {
          doc.rect(RIGHT - 80, y + 4, 74, 16).fill(BRAND);
          doc.fillColor(WHITE).fontSize(8).font('Helvetica-Bold').text(t.result, RIGHT - 78, y + 7, { width: 70, align: 'center' });
          doc.fillColor(DARK);
        }
        y += 20;
        const meta: string[] = [];
        // prefer startDate/endDate, fall back to year
        if (t.startDate) {
          const startY = new Date(t.startDate).getFullYear();
          const endY = t.endDate ? new Date(t.endDate).getFullYear() : startY;
          meta.push(startY === endY ? String(startY) : `${startY}–${endY}`);
        } else if (t.year) {
          meta.push(String(t.year));
        }
        if (t.location) meta.push(t.location);
        if (meta.length > 0) {
          doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(meta.join('  ·  '), LEFT + 8, y);
          y += 13;
        }
        if (t.description) {
          doc.fillColor(MID).fontSize(9).font('Helvetica').text(t.description, LEFT + 8, y, { width: CONTENT_W - 16 });
          y += doc.heightOfString(t.description, { width: CONTENT_W - 16 }) + 4;
        }
        y += 6;
      }
    }

    // ── EDUCATION ──
    if (profile.education?.length > 0) {
      sectionTitle('Education');
      for (const e of profile.education) {
        addPageIfNeeded(40);
        doc.circle(LEFT + 5, y + 5, 4).fill(BRAND);
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(e.institution, LEFT + 16, y, { width: 350 });
        // Year range
        const startYr = e.startYear;
        const endYr = e.endYear || e.year;
        const yrStr = startYr && endYr ? `${startYr} – ${endYr}` : endYr ? String(endYr) : startYr ? `${startYr} – Present` : '';
        if (yrStr) {
          doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(yrStr, LEFT + 16 + 350, y, { align: 'right', width: 129 });
        }
        y += 15;
        const degStr = [e.degree, e.fieldOfStudy].filter(Boolean).join(' in ');
        if (degStr) {
          doc.fillColor(ACCENT).fontSize(9).font('Helvetica-Bold').text(degStr, LEFT + 16, y);
          y += 13;
        }
        if (e.sportsAchievements) {
          doc.fillColor(MID).fontSize(9).font('Helvetica').text(`Sports: ${e.sportsAchievements}`, LEFT + 16, y, { width: CONTENT_W - 16 });
          y += doc.heightOfString(`Sports: ${e.sportsAchievements}`, { width: CONTENT_W - 16 }) + 4;
        }
        if (e.description) {
          doc.fillColor(MID).fontSize(9).font('Helvetica').text(e.description, LEFT + 16, y, { width: CONTENT_W - 16 });
          y += doc.heightOfString(e.description, { width: CONTENT_W - 16 }) + 4;
        }
        y += 8;
      }
    }

    // ── CERTIFICATIONS ──
    if (profile.certifications?.length > 0) {
      sectionTitle('Certifications');
      for (const c of profile.certifications) {
        addPageIfNeeded(22);
        doc.rect(LEFT, y, 3, 13).fill(ACCENT);
        doc.fillColor(DARK).fontSize(10).font('Helvetica')
          .text(`${c.name}${c.issuer ? `  —  ${c.issuer}` : ''}${c.year ? `  (${c.year})` : ''}`, LEFT + 10, y, { width: CONTENT_W - 10 });
        y += 16;
      }
      y += 6;
    }

    // ── CUSTOM SECTIONS (fitness metrics, references, ...) ──
    for (const section of profile.customSections || []) {
      sectionTitle(section.title);
      for (const item of section.items) {
        addPageIfNeeded(18);
        const line = item.label ? `${item.label}: ${item.value}` : item.value;
        doc.fillColor(DARK).fontSize(10).font('Helvetica').text(line, LEFT + 10, y, { width: CONTENT_W - 10 });
        y += doc.heightOfString(line, { width: CONTENT_W - 10 }) + 4;
      }
      y += 4;
    }

    // ── ACTION PHOTOS (2×2 grid) ──
    const shots = galleryBufs.filter((b): b is Buffer => !!b);
    if (shots.length > 0) {
      sectionTitle('Action Photos');
      const cellW = (CONTENT_W - 10) / 2;
      const cellH = 150;
      shots.forEach((buf, i) => {
        const col = i % 2;
        if (col === 0) addPageIfNeeded(cellH + 10);
        const x = LEFT + col * (cellW + 10);
        try { doc.image(buf, x, y, { cover: [cellW, cellH], align: 'center', valign: 'center' }); } catch { /* unsupported format */ }
        if (col === 1 || i === shots.length - 1) y += cellH + 10;
      });
    }

    // ── CONNECT / SOCIAL LINKS ──
    const sl = profile.socialLinks;
    const socialEntries: { label: string; url: string }[] = [];
    if (sl?.instagram) socialEntries.push({ label: 'Instagram', url: sl.instagram });
    if (sl?.youtube) socialEntries.push({ label: 'YouTube', url: sl.youtube });
    if (sl?.twitter) socialEntries.push({ label: 'Twitter/X', url: sl.twitter });
    if (sl?.linkedin) socialEntries.push({ label: 'LinkedIn', url: sl.linkedin });
    if (sl?.facebook) socialEntries.push({ label: 'Facebook', url: sl.facebook });
    if (profile.featuredVideoUrl) socialEntries.push({ label: 'Featured Video', url: profile.featuredVideoUrl });

    if (socialEntries.length > 0) {
      sectionTitle('Connect');
      for (const entry of socialEntries) {
        addPageIfNeeded(18);
        doc.fillColor(GRAY).fontSize(9).font('Helvetica-Bold').text(`${entry.label}: `, LEFT, y, { continued: true });
        doc.fillColor(ACCENT).fontSize(9).font('Helvetica').text(entry.url, { width: CONTENT_W - 60 });
        y += 14;
      }
      y += 4;
    }

    // ── FOOTER ──
    const footerY = doc.page.height - 38;
    doc.rect(0, footerY - 10, PAGE_W, 48).fill('#1E293B');
    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
      .text(
        `Generated by LinkSports.in  ·  ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        LEFT, footerY, { align: 'center', width: CONTENT_W }
      );

    doc.end();
  } catch (err) {
    sendError(res, 'Failed to generate CV', 500);
  }
};

export const downloadCoachCV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const profile = await CoachProfile.findOne(coachLookup(id));
    if (!profile) { sendError(res, 'Profile not found', 404); return; }

    // ── Permission check ──
    const requesterId = req.user?._id?.toString();
    const isOwn = requesterId === profile.userId.toString();
    const viewerRole = req.user?.role;

    if (!isOwn) {
      if (!req.user) { sendError(res, 'Login required to download CV', 401); return; }
      if (viewerRole !== 'organization' || !(await orgMayViewCv(req.user._id, profile.userId))) {
        sendError(res, 'Only verified organizations connected with this coach can download their CV', 403); return;
      }
      if (profile.visibility === 'private') { sendError(res, 'Profile not found', 404); return; }
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const filename = `${profile.fullName.replace(/\s+/g, '_')}_Coach_CV.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ── Color Palette ──
    const BRAND    = '#0F766E';   // teal for coaches
    const BRAND2   = '#0D9488';
    const ACCENT   = '#14B8A6';
    const DARK     = '#111827';
    const MID      = '#374151';
    const GRAY     = '#6B7280';
    const LIGHT_GRAY = '#F0FDFA';
    const WHITE    = 'white';
    const PAGE_W   = doc.page.width;
    const CONTENT_W = 495;
    const LEFT     = 50;
    const RIGHT    = LEFT + CONTENT_W;

    const addPageIfNeeded = (needed = 40) => {
      if (y + needed > doc.page.height - 70) { doc.addPage(); y = 50; }
    };

    const sectionTitle = (title: string) => {
      addPageIfNeeded(36);
      y += 6;
      doc.rect(LEFT, y, CONTENT_W, 22).fill(BRAND);
      doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold')
        .text(title.toUpperCase(), LEFT + 8, y + 7, { width: CONTENT_W - 16 });
      y += 30;
      doc.fillColor(DARK).font('Helvetica');
    };

    // ── HEADER BANNER ──
    const hasContact = !!(profile.email || profile.phone);
    const headerH = hasContact ? 125 : 110;
    doc.rect(0, 0, PAGE_W, headerH).fill(BRAND2);
    doc.save();
    doc.rect(0, 0, PAGE_W, headerH).clip();
    doc.moveTo(PAGE_W - 120, 0).lineTo(PAGE_W, 0).lineTo(PAGE_W, headerH).lineTo(PAGE_W - 200, headerH).fill(BRAND);
    doc.restore();

    doc.fillColor(WHITE).fontSize(24).font('Helvetica-Bold').text(profile.fullName, LEFT, 22, { width: PAGE_W - 100 });

    const specs = (profile.sportsSpecialization as string[]) || [];
    if (specs.length > 0) {
      doc.fontSize(12).font('Helvetica').text(`Coach  |  ${specs.join('  ·  ')}`, LEFT, 50, { width: PAGE_W - 100 });
    } else {
      doc.fontSize(12).font('Helvetica').text('Sports Coach', LEFT, 50, { width: PAGE_W - 100 });
    }

    const loc = profile.location as any;
    const locParts: string[] = [];
    if (loc?.city) locParts.push(loc.city);
    if (loc?.state) locParts.push(loc.state);
    if (loc?.country) locParts.push(loc.country);
    const avLabel = profile.availability
      ? (profile.availability as string).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : '';
    const line3: string[] = [];
    if (locParts.length) line3.push(`Location: ${locParts.join(', ')}`);
    if (avLabel) line3.push(`Availability: ${avLabel}`);
    if (line3.length) doc.fontSize(9).font('Helvetica').text(line3.join('   |   '), LEFT, 68, { width: PAGE_W - 100 });

    const contactParts: string[] = [];
    if (profile.email) contactParts.push(`Email: ${profile.email}`);
    if (profile.phone) contactParts.push(`Phone: ${profile.phone}`);
    if (contactParts.length) doc.fontSize(9).font('Helvetica').text(contactParts.join('   |   '), LEFT, 86, { width: PAGE_W - 100 });

    doc.fillColor(DARK);
    let y = headerH + 14;

    // ── STATS ROW ──
    const stats: { label: string; value: string }[] = [];
    const coachYrsExp = (profile as any).yearsOfExperience as number | undefined;
    if (coachYrsExp) stats.push({ label: 'Experience', value: `${coachYrsExp} yrs` });
    if (avLabel) stats.push({ label: 'Availability', value: avLabel });
    const ageGroups = (profile.ageGroupsCoached as string[]) || [];
    if (ageGroups.length > 0) stats.push({ label: 'Age Groups', value: ageGroups.join(', ') });
    if (profile.dob) {
      const age = Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 3600 * 1000));
      stats.push({ label: 'Age', value: `${age} yrs` });
    }
    if (profile.gender) stats.push({ label: 'Gender', value: (profile.gender as string).charAt(0).toUpperCase() + (profile.gender as string).slice(1) });

    if (stats.length > 0) {
      const maxCols = Math.min(stats.length, 5);
      const colW = CONTENT_W / maxCols;
      stats.slice(0, maxCols).forEach((s, i) => {
        const x = LEFT + i * colW;
        doc.rect(x, y, colW - 2, 42).fill(i % 2 === 0 ? LIGHT_GRAY : '#CCFBF1');
        doc.fillColor(GRAY).fontSize(7).font('Helvetica-Bold').text(s.label.toUpperCase(), x + 6, y + 6, { width: colW - 12 });
        doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(s.value, x + 6, y + 18, { width: colW - 12 });
      });
      doc.fillColor(DARK).font('Helvetica');
      y += 54;
    }

    // ── TAGLINE / ABOUT ──
    const tagline = (profile as any).tagline as string | undefined;
    if (tagline || profile.aboutBio) {
      sectionTitle('About');
      if (tagline) {
        doc.fillColor(MID).fontSize(10).font('Helvetica-Bold').text(`"${tagline}"`, LEFT, y, { width: CONTENT_W });
        y += doc.heightOfString(`"${tagline}"`, { width: CONTENT_W }) + 8;
      }
      if (profile.aboutBio) {
        doc.fillColor(DARK).fontSize(10).font('Helvetica').text(profile.aboutBio, LEFT, y, { width: CONTENT_W });
        y += doc.heightOfString(profile.aboutBio, { width: CONTENT_W }) + 8;
      }
    }

    // ── COACHING PHILOSOPHY ──
    if (profile.coachingPhilosophy) {
      sectionTitle('Coaching Philosophy');
      doc.fillColor(DARK).fontSize(10).font('Helvetica').text(profile.coachingPhilosophy, LEFT, y, { width: CONTENT_W });
      y += doc.heightOfString(profile.coachingPhilosophy, { width: CONTENT_W }) + 8;
    }

    // ── COACHING EXPERIENCE ──
    if ((profile.experience as any[])?.length > 0) {
      sectionTitle('Coaching Experience');
      for (const e of profile.experience as any[]) {
        addPageIfNeeded(36);
        const dateStr = e.startDate
          ? `${new Date(e.startDate).getFullYear()} – ${e.current ? 'Present' : e.endDate ? new Date(e.endDate).getFullYear() : ''}`
          : '';
        doc.circle(LEFT + 5, y + 5, 4).fill(BRAND);
        doc.moveTo(LEFT + 5, y + 9).lineTo(LEFT + 5, y + 24).strokeColor('#99F6E4').lineWidth(1).stroke();
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(e.organization, LEFT + 16, y, { width: 350 });
        if (dateStr) {
          doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(dateStr, LEFT + 16 + 350, y, { align: 'right', width: 129 });
        }
        y += 15;
        if (e.role) {
          doc.fillColor(ACCENT).fontSize(9).font('Helvetica-Bold').text(e.role, LEFT + 16, y);
          y += 13;
        }
        y += 8;
      }
    }

    // ── QUALIFICATIONS ──
    if ((profile.qualifications as any[])?.length > 0) {
      sectionTitle('Qualifications & Certifications');
      for (const q of profile.qualifications as any[]) {
        addPageIfNeeded(22);
        doc.rect(LEFT, y, 3, 13).fill(ACCENT);
        doc.fillColor(DARK).fontSize(10).font('Helvetica')
          .text(`${q.name}${q.issuer ? `  —  ${q.issuer}` : ''}${q.year ? `  (${q.year})` : ''}`, LEFT + 10, y, { width: CONTENT_W - 10 });
        y += 16;
      }
      y += 6;
    }

    // ── TOURNAMENT RESULTS ──
    if ((profile.tournamentResults as any[])?.length > 0) {
      sectionTitle('Tournament Results');
      for (const t of profile.tournamentResults as any[]) {
        addPageIfNeeded(34);
        doc.rect(LEFT, y, CONTENT_W, 32).fill('#F0FDFA');
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(t.tournament, LEFT + 8, y + 6, { width: 340 });
        if (t.result) {
          doc.rect(RIGHT - 80, y + 4, 74, 16).fill(BRAND);
          doc.fillColor(WHITE).fontSize(8).font('Helvetica-Bold').text(t.result, RIGHT - 78, y + 7, { width: 70, align: 'center' });
          doc.fillColor(DARK);
        }
        y += 20;
        const meta: string[] = [];
        if (t.team) meta.push(`Team: ${t.team}`);
        if (t.year) meta.push(String(t.year));
        if (meta.length > 0) {
          doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(meta.join('  ·  '), LEFT + 8, y);
          y += 13;
        }
        y += 4;
      }
    }

    // ── CONNECT / SOCIAL LINKS ──
    const sl = profile.socialLinks as any;
    const socialEntries: { label: string; url: string }[] = [];
    if (sl?.instagram) socialEntries.push({ label: 'Instagram', url: sl.instagram });
    if (sl?.youtube) socialEntries.push({ label: 'YouTube', url: sl.youtube });
    if (sl?.twitter) socialEntries.push({ label: 'Twitter/X', url: sl.twitter });
    if (sl?.linkedin) socialEntries.push({ label: 'LinkedIn', url: sl.linkedin });
    if (socialEntries.length > 0) {
      sectionTitle('Connect');
      for (const entry of socialEntries) {
        addPageIfNeeded(18);
        doc.fillColor(GRAY).fontSize(9).font('Helvetica-Bold').text(`${entry.label}: `, LEFT, y, { continued: true });
        doc.fillColor(ACCENT).fontSize(9).font('Helvetica').text(entry.url, { width: CONTENT_W - 60 });
        y += 14;
      }
      y += 4;
    }

    // ── FOOTER ──
    const footerY = doc.page.height - 38;
    doc.rect(0, footerY - 10, PAGE_W, 48).fill('#134E4A');
    doc.fillColor('#99F6E4').fontSize(8).font('Helvetica')
      .text(
        `Generated by LinkSports.in  ·  ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        LEFT, footerY, { align: 'center', width: CONTENT_W }
      );

    doc.end();
  } catch { sendError(res, 'Failed to generate CV', 500); }
};

// ── SEARCH PROFILES ───────────────────────────────────────────────────────────

// Detect query type and return a MongoDB $or condition for profile collections.
// Also returns matching userIds found via the User collection for email/phone.
const buildSearchOr = async (
  rawQ: string,
  profileEmailField: string,
  profilePhoneField: string,
  profileNameField: string,
  extraNameFields: string[] = [],
): Promise<Record<string, unknown>[] | null> => {
  const q = rawQ.trim();
  if (!q) return null;

  // Contact details are private, so search matches names/usernames only (never email or phone).
  // @username or general name search
  const nameStr = q.startsWith('@') ? q.slice(1) : q;
  const nameSafe = nameStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRe = new RegExp(nameSafe, 'i');

  return [
    { [profileNameField]: nameRe },
    { username: nameRe },
    ...extraNameFields.map((f) => ({ [f]: nameRe })),
  ];
};

export const searchProfiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      type = 'athlete', q, sport, state, city, gender, ageMin, ageMax,
      heightMin, heightMax, weightMin, weightMax, isParaAthlete, availability,
      sort,
    } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const sortQuery: Record<string, 1 | -1> = sort === 'popular'
      ? { connectionCount: -1, followerCount: -1 }
      : sort === 'recent' ? { createdAt: -1 } : {};

    const query: Record<string, unknown> = {};

    // Build search condition using regex (works without text indexes)
    if (q && typeof q === 'string' && q.trim()) {
      const orClauses = await buildSearchOr(q as string, 'email', 'phone', 'fullName', ['tagline']);
      if (orClauses?.length) query.$or = orClauses;
    }

    if (sport) query.primarySport = sport;
    if (state) query['location.state'] = state;
    if (city) query['location.city'] = city;
    if (gender) query.gender = gender;
    if (isParaAthlete) query.isParaAthlete = isParaAthlete === 'true';
    if (heightMin || heightMax) {
      query.height = {};
      if (heightMin) (query.height as Record<string, number>).$gte = Number(heightMin);
      if (heightMax) (query.height as Record<string, number>).$lte = Number(heightMax);
    }
    if (weightMin || weightMax) {
      query.weight = {};
      if (weightMin) (query.weight as Record<string, number>).$gte = Number(weightMin);
      if (weightMax) (query.weight as Record<string, number>).$lte = Number(weightMax);
    }
    if (availability) query.availabilityStatus = availability;

    query.visibility = 'public';

    let profiles;
    let total;

    if (type === 'athlete') {
      if (ageMin || ageMax) {
        const now = new Date();
        if (ageMax) query.dob = { ...((query.dob as object) || {}), $gte: new Date(now.getFullYear() - Number(ageMax), 0) };
        if (ageMin) query.dob = { ...((query.dob as object) || {}), $lte: new Date(now.getFullYear() - Number(ageMin), 12) };
      }
      [profiles, total] = await Promise.all([
        AthleteProfile.find(query).sort(sortQuery).skip(skip).limit(limit).select('-media -achievements -tournaments -email -phone -dob -userId -coachReferences'),
        AthleteProfile.countDocuments(query),
      ]);
    } else if (type === 'coach') {
      if (sport) { delete query.primarySport; query.sportsSpecialization = sport; }
      [profiles, total] = await Promise.all([
        CoachProfile.find(query).sort(sortQuery).skip(skip).limit(limit).select('-email -phone -dob -userId'),
        CoachProfile.countDocuments(query),
      ]);
    } else {
      // Organization search
      const orgQuery: Record<string, unknown> = {};
      if (q && typeof q === 'string' && q.trim()) {
        const orClauses = await buildSearchOr(q as string, 'contact.email', 'contact.phone', 'name', ['description']);
        if (orClauses?.length) orgQuery.$or = orClauses;
      }
      if (sport) orgQuery.sports = sport;
      if (state) orgQuery['contact.address'] = new RegExp((state as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const orgSort: Record<string, 1 | -1> = sort === 'popular' ? { connectionCount: -1, followerCount: -1 } : sort === 'recent' ? { createdAt: -1 } : {};
      [profiles, total] = await Promise.all([
        Organization.find(orgQuery).sort(orgSort).skip(skip).limit(limit).select('-verificationDocuments -rejectionReason -alternatePhone -userId'),
        Organization.countDocuments(orgQuery),
      ]);
    }

    sendSuccess(res, profiles, 'Profiles fetched', 200, {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    console.error('searchProfiles error:', err);
    sendError(res, 'Search failed', 500);
  }
};
