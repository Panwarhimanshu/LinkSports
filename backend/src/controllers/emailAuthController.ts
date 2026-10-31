import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import { Request, Response } from 'express';
import { User } from '../models/User';
import { AthleteProfile } from '../models/AthleteProfile';
import { EmailOtp } from '../models/EmailOtp';
import { generateOTP, generateSlug } from '../utils/jwt';
import { emailTemplates, isEmailConfigured, sendEmail } from '../utils/email';
import { sendSuccess, sendError } from '../utils/response';
import { signupsAllowed, SIGNUPS_CLOSED_MSG } from '../models/SiteSettings';
import { safeEqual } from '../utils/otp';
import { startSession } from '../utils/session';

// Passwordless sign-in: a 6-digit code is emailed with nodemailer (SMTP settings in the root .env)
// and exchanged for a session. The same code signs in an existing account or creates a new player.

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_GAP_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const normalizeEmail = (raw: unknown): string | null => {
  const e = String(raw ?? '').trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
};

const hashOtp = (otp: string, email: string) =>
  crypto.createHash('sha256').update(`${otp}:${email}:${process.env.JWT_SECRET}`).digest('hex');

export const sendEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      sendError(res, 'Enter a valid email address', 400, 'INVALID_EMAIL');
      return;
    }

    const existing = await EmailOtp.findOne({ email });
    if (existing && Date.now() - existing.sentAt.getTime() < RESEND_GAP_MS) {
      sendError(res, 'Please wait 30 seconds before requesting another code', 429, 'OTP_TOO_SOON');
      return;
    }

    const otp = generateOTP();
    const sentAtStamp = new Date();
    await EmailOtp.findOneAndUpdate(
      { email },
      { email, otpHash: hashOtp(otp, email), attempts: 0, sentAt: sentAtStamp, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
      { upsert: true },
    );

    const isProd = process.env.NODE_ENV === 'production';
    if (isEmailConfigured()) {
      // Reply straight away and deliver in the background: SMTP from a serverless host can take 5-10s, which used
      // to time the request out before the mail went. waitUntil keeps the function alive until it is sent.
      const delivery = (async () => {
        const started = Date.now();
        const sent = await sendEmail({ to: email, ...emailTemplates.loginOtp(otp, OTP_TTL_MS / 60_000) });
        console.log(`[Email OTP] ${email} ${sent ? 'sent' : 'FAILED'} in ${Date.now() - started}ms`);
        // A failed send must not leave a code the player never received (it would also block "Resend" for 30s).
        if (!sent) await EmailOtp.deleteOne({ email, sentAt: sentAtStamp }).catch(() => undefined);
      })();
      if (process.env.VERCEL) waitUntil(delivery);
      else await delivery;
    } else if (isProd) {
      await EmailOtp.deleteOne({ email });
      sendError(res, 'Email sign-in is not available right now.', 503, 'EMAIL_UNAVAILABLE');
      return;
    } else {
      // Local development without SMTP settings: print the code so sign-in can still be tested.
      console.log(`[Email OTP:dev] ${email} → ${otp}`);
    }

    // Local testing only: hand the code back so it can be filled in without reading the terminal.
    const exposeForDev = !isProd && process.env.DEV_LOGIN === 'true';
    sendSuccess(res, exposeForDev ? { devOtp: otp } : null, 'OTP sent');
  } catch (err) {
    console.error('sendEmailOtp failed:', (err as Error).message);
    // Don't leave a half-finished request behind: it would block the retry for 30 seconds.
    const email = normalizeEmail(req.body?.email);
    if (email) await EmailOtp.deleteOne({ email }).catch(() => undefined);
    sendError(res, 'Could not send the code. Please try again.', 500);
  }
};

export const verifyEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp ?? '').trim();
    if (!email || !/^\d{6}$/.test(otp)) {
      sendError(res, 'Enter the 6-digit code', 400, 'VALIDATION_ERROR');
      return;
    }

    // Count the attempt atomically before comparing so parallel guesses cannot exceed the cap.
    const record = await EmailOtp.findOneAndUpdate(
      { email, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true },
    );
    if (!record) {
      sendError(res, 'This code has expired or was tried too many times. Request a new one.', 400, 'OTP_EXPIRED');
      return;
    }
    if (!safeEqual(record.otpHash, hashOtp(otp, email))) {
      sendError(res, 'Incorrect code', 400, 'INVALID_OTP');
      return;
    }
    await EmailOtp.deleteOne({ email }); // single use

    let user = await User.findOne({ email }).select('+refreshTokens');
    let isNew = false;

    if (user?.isSuspended) {
      sendError(res, 'Your account has been suspended', 403, 'SUSPENDED');
      return;
    }

    if (!user) {
      if (!(await signupsAllowed())) { sendError(res, SIGNUPS_CLOSED_MSG, 403, 'SIGNUPS_CLOSED'); return; }
      isNew = true;
      user = await User.create({ email, role: 'athlete', isVerified: true, isApproved: true, needsRoleSelection: true });
      const name = email.split('@')[0];
      await AthleteProfile.create({ userId: user._id, fullName: 'Player', profileUrl: generateSlug(name) });
    } else if (!user.isVerified) {
      // They just proved they own this inbox. Anything stored by whoever pre-registered this address
      // (a password, live sessions) must not survive that.
      user.isVerified = true;
      user.passwordHash = undefined;
      user.refreshTokens = [];
    }

    await startSession(req, res, user, isNew, 'email_otp');
  } catch {
    sendError(res, 'Verification failed', 500);
  }
};
