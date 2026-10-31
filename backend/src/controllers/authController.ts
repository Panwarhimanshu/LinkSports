import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { AthleteProfile } from '../models/AthleteProfile';
import { CoachProfile } from '../models/CoachProfile';
import { Organization } from '../models/Organization';
import { generateAccessToken, generateRefreshToken, generateOTP, generateSlug, verifyRefreshToken } from '../utils/jwt';
import { sendEmail, emailTemplates } from '../utils/email';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';
import { signupsAllowed, SIGNUPS_CLOSED_MSG } from '../models/SiteSettings';
import { deviceFromUserAgent, logEvent } from '../utils/activity';
import { hashCode, safeEqual } from '../utils/security';
import { OAuthCode } from '../models/OAuthCode';
import crypto from 'crypto';

const OTP_MAX_ATTEMPTS = 5;
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // 'none' for cross-origin production; 'lax' for dev (strict blocks cross-port cookies)
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password, role, fullName, organizationName, organizationType, phone, contactPerson, city } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      sendError(res, 'Enter a valid email address', 400, 'VALIDATION_ERROR');
      return;
    }
    // Only these account types can be created here. Admin accounts are never created through sign-up.
    if (!['athlete', 'coach', 'organization', 'professional'].includes(role)) {
      sendError(res, 'Invalid account type', 400, 'INVALID_ROLE');
      return;
    }
    if (typeof password !== 'string' || !PASSWORD_RULE.test(password)) {
      sendError(res, 'Password must be 8+ characters with an uppercase letter, a lowercase letter and a number', 400, 'WEAK_PASSWORD');
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      sendError(res, 'Email already registered', 409, 'DUPLICATE_EMAIL');
      return;
    }

    if (!(await signupsAllowed())) { sendError(res, SIGNUPS_CLOSED_MSG, 403, 'SIGNUPS_CLOSED'); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const user = await User.create({
      email,
      passwordHash,
      role,
      // the phone number is NOT stored on the account here: it is only trusted once it is proven with an SMS code
      emailOtp: hashCode(otp, email, 'verify'),
      emailOtpExpiry: otpExpiry,
      isVerified: false,
      isApproved: role === 'professional' ? false : true,
    });

    const slug = generateSlug(fullName || organizationName || email.split('@')[0]);

    if (role === 'athlete') {
      await AthleteProfile.create({ userId: user._id, fullName: fullName || email.split('@')[0], profileUrl: slug });
    } else if (role === 'coach') {
      await CoachProfile.create({ userId: user._id, fullName: fullName || email.split('@')[0], profileUrl: slug });
    } else if (role === 'organization') {
      await Organization.create({
        userId: user._id,
        name: organizationName || email.split('@')[0],
        contactPerson: contactPerson || undefined,
        city: city || undefined,
        type: organizationType || 'academy',
        contact: { phone, email },
        profileUrl: slug,
        verificationStatus: 'pending',
        isVerified: false,
      });
    }

    // One-time codes are never written to the logs.
    void sendEmail({ to: email, ...emailTemplates.verifyEmail(otp, String(fullName || 'User').slice(0, 60)) });

    sendSuccess(res, { userId: user._id, email: user.email, role: user.role }, 'Registration successful. Please verify your email.', 201);
  } catch (error: unknown) {
    console.error('Register error:', error);
    if ((error as { code?: number })?.code === 11000) {
      sendError(res, 'Email already registered', 409, 'DUPLICATE_EMAIL');
      return;
    }
    sendError(res, 'Registration failed', 500, 'REGISTER_ERROR');
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const code = String(otp ?? '').trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+emailOtp +emailOtpExpiry +otpAttempts');

    if (!user || user.isVerified || !user.emailOtp || !/^\d{6}$/.test(code)) { sendError(res, 'Invalid or expired code', 400, 'INVALID_OTP'); return; }
    if (user.emailOtpExpiry && user.emailOtpExpiry < new Date()) { sendError(res, 'This code has expired. Request a new one.', 400, 'OTP_EXPIRED'); return; }
    if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      user.emailOtp = undefined; user.emailOtpExpiry = undefined; user.otpAttempts = 0;
      await user.save();
      sendError(res, 'Too many wrong attempts. Request a new code.', 429, 'OTP_LOCKED'); return;
    }
    if (!safeEqual(user.emailOtp, hashCode(code, normalizedEmail, 'verify'))) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      sendError(res, 'Incorrect code', 400, 'INVALID_OTP'); return;
    }

    user.isVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpiry = undefined;
    user.otpAttempts = 0;
    await user.save();

    sendSuccess(res, null, 'Email verified successfully');
  } catch (error) {
    sendError(res, 'Verification failed', 500, 'VERIFY_ERROR');
  }
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const user = await User.findOne({ email: normalizedEmail }).select('+emailOtp +emailOtpExpiry +otpAttempts');

    // Same answer whether or not the account exists, so this can't be used to check who is registered.
    if (user && !user.isVerified) {
      const otp = generateOTP();
      user.emailOtp = hashCode(otp, normalizedEmail, 'verify');
      user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user.otpAttempts = 0;
      await user.save();
      void sendEmail({ to: normalizedEmail, ...emailTemplates.verifyEmail(otp, normalizedEmail.split('@')[0]) });
    }

    sendSuccess(res, null, 'If that account needs verifying, a new code has been sent');
  } catch (err) {
    console.error('resendOtp error:', err);
    sendError(res, 'Failed to resend OTP', 500);
  }
};

const MAX_FAILED_ATTEMPTS = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body; // 'email' acts as identifier (email, username, or slug)
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 254 || password.length > 128) {
      sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
      return;
    }
    let user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +refreshTokens +failedLoginAttempts +lockUntil') as any;

    if (!user) {
      const identifier = email.toLowerCase().trim();
      // Use exact string match ($eq) to prevent regex injection / ReDoS attacks
      const athlete = await AthleteProfile.findOne({
        $or: [
          { username: { $eq: identifier } },
          { profileUrl: { $eq: identifier } },
        ],
      }).select('userId');

      if (athlete) {
        user = await User.findById(athlete.userId).select('+passwordHash +refreshTokens +failedLoginAttempts +lockUntil');
      } else {
        const coach = await CoachProfile.findOne({ profileUrl: { $eq: identifier } }).select('userId');
        if (coach) {
          user = await User.findById(coach.userId).select('+passwordHash +refreshTokens +failedLoginAttempts +lockUntil');
        } else {
          const org = await Organization.findOne({ profileUrl: { $eq: identifier } }).select('userId');
          if (org) user = await User.findById(org.userId).select('+passwordHash +refreshTokens +failedLoginAttempts +lockUntil');
        }
      }
    }

    if (!user || !user.passwordHash) {
      sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
      return;
    }

    // Admin accounts never sign in with a password (it could be guessed or left over from set-up);
    // they use the emailed one-time code. Publicly known default passwords are refused for everyone.
    if (user.role === 'admin' || ['Admin@123', 'admin123', 'athlete123', 'Password@123'].includes(password)) {
      sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
      return;
    }

    // Check account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      sendError(res, `Account temporarily locked. Try again in ${minutesLeft} minute(s).`, 429, 'ACCOUNT_LOCKED');
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0;
        await user.save();
        sendError(res, 'Too many failed attempts. Account locked for 15 minutes.', 429, 'ACCOUNT_LOCKED');
      } else {
        await user.save();
        sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }
      return;
    }

    // Reset failed attempts on successful password match
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
    }

    if (!user.isVerified) {
      await user.save();
      sendError(res, 'Please verify your email first', 401, 'EMAIL_NOT_VERIFIED');
      return;
    }

    if (user.isSuspended) {
      sendError(res, 'Your account has been suspended', 403, 'SUSPENDED');
      return;
    }

    const payload = { id: user._id.toString(), role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
    user.lastLoginAt = new Date();
    await user.save();

    res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    void logEvent(user._id.toString(), 'USER_LOGIN', {
      meta: { device: deviceFromUserAgent(req.headers['user-agent'], req.headers['x-app-platform'] as string | undefined) },
    });

    sendSuccess(res, {
      accessToken,
      refreshToken, // also returned in body for native clients that cannot use cookies
      user: { id: user._id, email: user.email, role: user.role, isVerified: user.isVerified },
    }, 'Login successful');
  } catch {
    sendError(res, 'Login failed', 500, 'LOGIN_ERROR');
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) { sendError(res, 'Refresh token required', 401); return; }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshTokens');

    if (!user || !user.refreshTokens?.includes(token)) {
      sendError(res, 'Invalid refresh token', 401); return;
    }

    const payload = { id: user._id.toString(), role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);

    sendSuccess(res, { accessToken, refreshToken: newRefreshToken }, 'Token refreshed');
  } catch {
    sendError(res, 'Token refresh failed', 401);
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (req.user) {
      const user = await User.findById(req.user._id).select('+refreshTokens');
      if (user) {
        // drop the refresh token that was sent; if none was sent, drop all of them so nothing stays usable
        user.refreshTokens = token ? (user.refreshTokens || []).filter((t) => t !== token) : [];
        user.tokensValidAfter = new Date(); // the access token used for this request stops working too
        await user.save();
      }
    }
    res.clearCookie('accessToken', { ...COOKIE_OPTIONS, maxAge: undefined });
    res.clearCookie('refreshToken', { ...COOKIE_OPTIONS, maxAge: undefined });
    sendSuccess(res, null, 'Logged out successfully');
  } catch {
    sendError(res, 'Logout failed', 500);
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  // Normalize email — DB stores lowercase, query must match
  const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
  if (!normalizedEmail) { sendError(res, 'Email is required', 400); return; }

  const user = await User.findOne({ email: normalizedEmail }).select('+emailOtp +emailOtpExpiry +otpAttempts');

  // Always respond the same way so we don't leak which emails exist
  if (user) {
    const otp = generateOTP();
    user.emailOtp = hashCode(otp, normalizedEmail, 'reset');
    user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();
    void sendEmail({ to: normalizedEmail, ...emailTemplates.resetPassword(otp, normalizedEmail.split('@')[0]) });
  }
  sendSuccess(res, null, 'If that email is registered, a code has been sent');
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;

    if (typeof email !== 'string' || typeof newPassword !== 'string' || !otp) {
      sendError(res, 'Email, OTP and new password are required', 400); return;
    }
    if (!PASSWORD_RULE.test(newPassword)) {
      sendError(res, 'Password must be 8+ characters with an uppercase letter, a lowercase letter and a number', 400); return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const code = String(otp).trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+emailOtp +emailOtpExpiry +passwordHash +otpAttempts');

    if (!user || !user.emailOtp || !/^\d{6}$/.test(code)) {
      sendError(res, 'Invalid or expired code. Please request a new one.', 400, 'INVALID_OTP'); return;
    }
    if (user.emailOtpExpiry && user.emailOtpExpiry < new Date()) {
      sendError(res, 'This code has expired. Please request a new one.', 400, 'OTP_EXPIRED'); return;
    }
    if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      user.emailOtp = undefined; user.emailOtpExpiry = undefined; user.otpAttempts = 0;
      await user.save();
      sendError(res, 'Too many wrong attempts. Request a new code.', 429, 'OTP_LOCKED'); return;
    }
    if (!safeEqual(user.emailOtp, hashCode(code, normalizedEmail, 'reset'))) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      sendError(res, 'Incorrect code. Please check and try again.', 400, 'INVALID_OTP'); return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.emailOtp = undefined;
    user.emailOtpExpiry = undefined;
    user.otpAttempts = 0;
    user.refreshTokens = [];
    user.tokensValidAfter = new Date(); // every session signed in with the old password stops working
    await user.save();

    sendSuccess(res, null, 'Password reset successfully. You can now log in.');
  } catch (err) {
    console.error('resetPassword error:', err);
    sendError(res, 'Password reset failed', 500);
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) { sendError(res, 'User not found', 404); return; }

    let profile = null;
    if (user.role === 'athlete') {
      profile = await AthleteProfile.findOne({ userId: user._id });
    } else if (user.role === 'coach') {
      profile = await CoachProfile.findOne({ userId: user._id });
    } else if (user.role === 'organization') {
      profile = await Organization.findOne({ userId: user._id });
    }

    sendSuccess(res, { user, profile });
  } catch {
    sendError(res, 'Failed to get user', 500);
  }
};

export const googleCallback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.redirect(`${process.env.CLIENT_URL}/auth/login?error=oauth_failed`); return; }

    const user = req.user;
    void logEvent(user._id.toString(), 'USER_LOGIN', { meta: { device: deviceFromUserAgent(req.headers['user-agent']), provider: 'google' } });
    if (user.needsRoleSelection === true) void logEvent(user._id.toString(), 'USER_SIGNUP', { meta: { provider: 'google' } });
    const needsRole = user.needsRoleSelection === true;
    const payload = { id: user._id.toString(), role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const dbUser = await User.findById(user._id).select('+refreshTokens');
    if (dbUser) {
      dbUser.refreshTokens = [...(dbUser.refreshTokens || []).slice(-4), refreshToken];
      dbUser.lastLoginAt = new Date();
      await dbUser.save();
    }

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    // The access token must never travel in the URL (it would end up in history, logs and referrers).
    // The browser gets a short-lived one-time code instead and swaps it for the token.
    void accessToken;
    const code = crypto.randomBytes(32).toString('hex');
    await OAuthCode.create({ codeHash: crypto.createHash('sha256').update(code).digest('hex'), userId: user._id, expiresAt: new Date(Date.now() + 2 * 60 * 1000) });
    const newUserParam = needsRole ? '&newUser=true' : '';
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?code=${code}${newUserParam}`);
  } catch {
    res.redirect(`${process.env.CLIENT_URL}/auth/login?error=oauth_failed`);
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      sendError(res, 'Current and new password are required', 400); return;
    }
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') { sendError(res, 'Invalid request', 400); return; }
    if (!PASSWORD_RULE.test(newPassword)) {
      sendError(res, 'Password must be 8+ characters with an uppercase letter, a lowercase letter and a number', 400); return;
    }

    const user = await User.findById(req.user!._id).select('+passwordHash +refreshTokens');
    if (!user) { sendError(res, 'User not found', 404); return; }

    if (!user.passwordHash) {
      sendError(res, 'Cannot change password for social login accounts', 400, 'SOCIAL_ACCOUNT'); return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) { sendError(res, 'Current password is incorrect', 401, 'INVALID_PASSWORD'); return; }

    // Changing the password signs out every other device; this device gets fresh tokens so it stays signed in.
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokensValidAfter = new Date(Date.now() - 1000);
    const payload = { id: user._id.toString(), role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    user.refreshTokens = [refreshToken];
    await user.save();
    res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    sendSuccess(res, { accessToken, refreshToken }, 'Password changed successfully');
  } catch (error) {
    console.error('changePassword error:', error);
    sendError(res, 'Failed to change password', 500);
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;

    // Remove all associated data
    await Promise.allSettled([
      AthleteProfile.deleteOne({ userId }),
      CoachProfile.deleteOne({ userId }),
      Organization.deleteOne({ userId }),
    ]);

    await User.findByIdAndDelete(userId);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Account deleted successfully');
  } catch (error) {
    console.error('deleteAccount error:', error);
    sendError(res, 'Failed to delete account', 500);
  }
};

export const updateRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body;
    const validRoles = ['athlete', 'coach', 'professional', 'organization'];
    if (!validRoles.includes(role)) { sendError(res, 'Invalid role', 400, 'INVALID_ROLE'); return; }

    const user = await User.findById(req.user!._id);
    if (!user) { sendError(res, 'User not found', 404); return; }
    // The account type is chosen once, right after the first sign-in. After that it can't be changed here,
    // otherwise anyone could turn themselves into an organization or a professional at will.
    if (!user.needsRoleSelection) { sendError(res, 'Your account type is already set', 409, 'ROLE_ALREADY_SET'); return; }

    const oldRole = user.role;
    user.role = role;
    user.needsRoleSelection = false;
    if (role === 'professional') user.isApproved = false; // professionals wait for admin approval
    await user.save();

    const slug = generateSlug(user.email.split('@')[0]);

    if (role === 'coach' && oldRole !== 'coach') {
      await CoachProfile.findOneAndUpdate(
        { userId: user._id },
        { $setOnInsert: { userId: user._id, fullName: user.email.split('@')[0], profileUrl: slug } },
        { upsert: true, new: true }
      );
    } else if (role === 'organization' && oldRole !== 'organization') {
      await Organization.findOneAndUpdate(
        { userId: user._id },
        { $setOnInsert: { userId: user._id, name: user.email.split('@')[0], type: 'academy', contact: { email: user.email }, profileUrl: slug, verificationStatus: 'pending', isVerified: false } },
        { upsert: true, new: true }
      );
    }

    const payload = { id: user._id.toString(), role: user.role, email: user.email };
    const newAccessToken = generateAccessToken(payload);
    sendSuccess(res, { accessToken: newAccessToken, role: user.role }, 'Role updated');
  } catch (error) {
    console.error('updateRole error:', error);
    sendError(res, 'Failed to update role', 500);
  }
};

// ── DEV ONLY: one-click test login ───────────────────────────────────────────
// Disabled (404) unless NODE_ENV !== 'production' AND DEV_LOGIN=true. Creates/reuses a single
// verified test athlete so the CV flow can be tested without email OTP or Google.
const DEV_EMAIL = 'dev.testplayer@linksports.local';

export const devLogin = async (_req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.DEV_LOGIN !== 'true') {
    sendError(res, 'Not found', 404, 'NOT_FOUND');
    return;
  }
  try {
    let user = await User.findOne({ email: DEV_EMAIL }).select('+refreshTokens');
    if (!user) {
      user = await User.create({ email: DEV_EMAIL, role: 'athlete', isVerified: true, isApproved: true });
      await AthleteProfile.create({ userId: user._id, fullName: 'Test Player', profileUrl: generateSlug('test-player') });
    }
    const payload = { id: user._id.toString(), role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
    await user.save();

    res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: { id: user._id, email: user.email, role: user.role, isVerified: true },
    }, 'Dev login');
  } catch {
    sendError(res, 'Dev login failed', 500);
  }
};

/** Swaps the one-time code from the Google redirect for an access token. Works once, for two minutes. */
export const exchangeOAuthCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!/^[a-f0-9]{64}$/.test(code)) { sendError(res, 'Invalid code', 400, 'INVALID_CODE'); return; }
    const record = await OAuthCode.findOneAndDelete({ codeHash: crypto.createHash('sha256').update(code).digest('hex'), expiresAt: { $gt: new Date() } });
    if (!record) { sendError(res, 'This sign-in link has expired. Please try again.', 400, 'INVALID_CODE'); return; }
    const user = await User.findById(record.userId);
    if (!user || user.isSuspended) { sendError(res, 'Account unavailable', 403); return; }
    const accessToken = generateAccessToken({ id: user._id.toString(), role: user.role, email: user.email });
    sendSuccess(res, { accessToken, user: { id: user._id, email: user.email, role: user.role } }, 'Signed in');
  } catch {
    sendError(res, 'Sign-in failed', 500);
  }
};
