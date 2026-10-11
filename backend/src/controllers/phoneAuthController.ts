import crypto from 'crypto';
import { Request, Response } from 'express';
import { User } from '../models/User';
import { AthleteProfile } from '../models/AthleteProfile';
import { PhoneOtp } from '../models/PhoneOtp';
import { generateOTP, generateSlug } from '../utils/jwt';
import { sendSms } from '../utils/sms';
import { sendSuccess, sendError } from '../utils/response';
import { signupsAllowed, SIGNUPS_CLOSED_MSG } from '../models/SiteSettings';
import { startSession } from '../utils/session';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_GAP_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

/** Accepts 9876543210, +91 98765 43210, 919876543210, 09876543210 → "9876543210" (Indian mobile numbers only). */
export const normalizePhone = (raw: unknown): string | null => {
  const d = String(raw ?? '').replace(/\D/g, '');
  const ten = d.length === 10 ? d : d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 11 && d.startsWith('0') ? d.slice(1) : null;
  return ten && /^[6-9]\d{9}$/.test(ten) ? ten : null;
};

const hashOtp = (otp: string, phone: string) =>
  crypto.createHash('sha256').update(`${otp}:${phone}:${process.env.JWT_SECRET}`).digest('hex');

export const sendPhoneOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = normalizePhone(req.body?.phone);
    if (!phone) {
      sendError(res, 'Enter a valid 10-digit mobile number', 400, 'INVALID_PHONE');
      return;
    }

    const existing = await PhoneOtp.findOne({ phone });
    if (existing && Date.now() - existing.sentAt.getTime() < RESEND_GAP_MS) {
      sendError(res, 'Please wait 30 seconds before requesting another code', 429, 'OTP_TOO_SOON');
      return;
    }

    const otp = generateOTP();
    await PhoneOtp.findOneAndUpdate(
      { phone },
      { phone, otpHash: hashOtp(otp, phone), attempts: 0, sentAt: new Date(), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
      { upsert: true }
    );

    try {
      await sendSms(`+91${phone}`, `${otp} is your LinkSports verification code. It is valid for 10 minutes.`);
    } catch (err) {
      console.error('sendSms failed:', (err as Error).message);
      await PhoneOtp.deleteOne({ phone });
      sendError(res, 'Could not send the SMS right now. Try Google sign-in or try again later.', 503, 'SMS_UNAVAILABLE');
      return;
    }

    // Local testing only: hand the code back so it can be filled in without reading the terminal.
    const exposeForDev = process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN === 'true';
    sendSuccess(res, exposeForDev ? { devOtp: otp } : null, 'OTP sent');
  } catch {
    sendError(res, 'Could not send the code', 500);
  }
};

export const verifyPhoneOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const otp = String(req.body?.otp ?? '').trim();
    if (!phone || !/^\d{6}$/.test(otp)) {
      sendError(res, 'Enter the 6-digit code', 400, 'VALIDATION_ERROR');
      return;
    }

    const record = await PhoneOtp.findOne({ phone });
    if (!record || record.expiresAt < new Date()) {
      sendError(res, 'This code has expired. Request a new one.', 400, 'OTP_EXPIRED');
      return;
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      await PhoneOtp.deleteOne({ phone });
      sendError(res, 'Too many wrong attempts. Request a new code.', 429, 'OTP_LOCKED');
      return;
    }
    if (record.otpHash !== hashOtp(otp, phone)) {
      record.attempts += 1;
      await record.save();
      sendError(res, 'Incorrect code', 400, 'INVALID_OTP');
      return;
    }
    await PhoneOtp.deleteOne({ phone }); // single use

    // Match existing accounts whatever format their number was stored in (e.g. migrated "98765 43210").
    let user = await User.findOne({ phone: new RegExp(`${phone}$`) }).select('+refreshTokens');
    let isNew = false;

    if (user?.isSuspended) {
      sendError(res, 'Your account has been suspended', 403, 'SUSPENDED');
      return;
    }

    if (!user) {
      if (!(await signupsAllowed())) { sendError(res, SIGNUPS_CLOSED_MSG, 403, 'SIGNUPS_CLOSED'); return; }
      isNew = true;
      user = await User.create({
        email: `p${phone}@phone.linksports.local`, // email is required + unique; real email can be added later
        role: 'athlete',
        phone: `+91${phone}`,
        isVerified: true,
        isApproved: true,
      });
      await AthleteProfile.create({ userId: user._id, fullName: 'Player', phone: `+91${phone}`, profileUrl: generateSlug('player') });
    } else if (!user.isVerified) {
      user.isVerified = true; // they just proved they own this number
    }

    await startSession(req, res, user, isNew, 'phone');
  } catch {
    sendError(res, 'Verification failed', 500);
  }
};
