import crypto from 'crypto';
import { Request, Response } from 'express';
import { User } from '../models/User';
import { AthleteProfile } from '../models/AthleteProfile';
import { PhoneOtp } from '../models/PhoneOtp';
import { generateOTP, generateSlug } from '../utils/jwt';
import { sendSms } from '../utils/sms';
import { isWhatsAppConfigured, sendWhatsApp } from '../utils/whatsapp';
import { safeEqual } from '../utils/security';
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

    const text = `${otp} is your LinkSports verification code. It is valid for 10 minutes. Don't share it with anyone.`;
    try {
      // WhatsApp first, because that's what we actually have set up. SMS is only the fallback.
      if (isWhatsAppConfigured()) await sendWhatsApp(`91${phone}`, text);
      else await sendSms(`+91${phone}`, text);
    } catch (err) {
      console.error('OTP delivery failed:', (err as Error).message);
      await PhoneOtp.deleteOne({ phone });
      sendError(res, 'Could not send the code right now. Try Google sign-in or try again later.', 503, 'SMS_UNAVAILABLE');
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

    // Count the try first, in one atomic step. If we read the counter, compared, and only then bumped it,
    // a burst of parallel requests would all see "0 attempts" and get far more than 5 guesses.
    const record = await PhoneOtp.findOneAndUpdate(
      { phone, expiresAt: { $gt: new Date() } },
      { $inc: { attempts: 1 } },
      { new: true },
    );
    if (!record) {
      sendError(res, 'This code has expired. Request a new one.', 400, 'OTP_EXPIRED');
      return;
    }
    if (record.attempts > MAX_ATTEMPTS) {
      await PhoneOtp.deleteOne({ phone });
      sendError(res, 'Too many wrong attempts. Request a new code.', 429, 'OTP_LOCKED');
      return;
    }
    if (!safeEqual(record.otpHash, hashOtp(otp, phone))) {
      sendError(res, 'Incorrect code', 400, 'INVALID_OTP');
      return;
    }
    // Single use. Only one of several parallel correct submissions gets to delete the row.
    const spent = await PhoneOtp.deleteOne({ phone, otpHash: record.otpHash });
    if (spent.deletedCount !== 1) {
      sendError(res, 'This code has expired. Request a new one.', 400, 'OTP_EXPIRED');
      return;
    }

    // Existing accounts might have the number stored as +91..., 91... or just the 10 digits.
    let user = await User.findOne({ phone: { $in: [`+91${phone}`, `91${phone}`, phone] } }).select('+refreshTokens');
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
      (user as any).passwordHash = undefined; // a password set by someone else before this proof is not trusted
      user.refreshTokens = [];
      user.tokensValidAfter = new Date(Date.now() - 1000);
    }

    await startSession(req, res, user, isNew, 'phone');
  } catch {
    sendError(res, 'Verification failed', 500);
  }
};
