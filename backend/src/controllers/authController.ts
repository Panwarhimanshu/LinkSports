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

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'strict') as 'none' | 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role, fullName, organizationName, organizationType, phone, contactPerson, city } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      sendError(res, 'Email already registered', 409, 'DUPLICATE_EMAIL');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const user = await User.create({
      email,
      passwordHash,
      role,
      phone,
      emailOtp: otp,
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

    await sendEmail({ to: email, ...emailTemplates.verifyEmail(otp, fullName || 'User') });

    sendSuccess(res, { userId: user._id, email: user.email, role: user.role }, 'Registration successful. Please verify your email.', 201);
  } catch (error) {
    console.error('Register error:', error);
    sendError(res, 'Registration failed', 500, 'REGISTER_ERROR');
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select('+emailOtp +emailOtpExpiry');

    if (!user) { sendError(res, 'User not found', 404, 'NOT_FOUND'); return; }
    if (user.isVerified) { sendError(res, 'Email already verified', 400, 'ALREADY_VERIFIED'); return; }
    if (!user.emailOtp || user.emailOtp !== otp) { sendError(res, 'Invalid OTP', 400, 'INVALID_OTP'); return; }
    if (user.emailOtpExpiry && user.emailOtpExpiry < new Date()) { sendError(res, 'OTP expired', 400, 'OTP_EXPIRED'); return; }

    user.isVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpiry = undefined;
    await user.save();

    sendSuccess(res, null, 'Email verified successfully');
  } catch (error) {
    sendError(res, 'Verification failed', 500, 'VERIFY_ERROR');
  }
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.toLowerCase()?.trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+emailOtp +emailOtpExpiry');
    if (!user) { sendError(res, 'User not found', 404, 'NOT_FOUND'); return; }
    if (user.isVerified) { sendError(res, 'Email already verified', 400, 'ALREADY_VERIFIED'); return; }

    const otp = generateOTP();
    user.emailOtp = otp;
    user.emailOtpExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendEmail({ to: normalizedEmail, ...emailTemplates.verifyEmail(otp, normalizedEmail.split('@')[0]) });
    sendSuccess(res, null, 'OTP resent successfully');
  } catch (err) {
    console.error('resendOtp error:', err);
    sendError(res, 'Failed to resend OTP', 500);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body; // 'email' acts as identifier (email, username, or slug)
    let user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +refreshTokens') as any;

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
        user = await User.findById(athlete.userId).select('+passwordHash +refreshTokens');
      } else {
        const coach = await CoachProfile.findOne({ profileUrl: { $eq: identifier } }).select('userId');
        if (coach) {
          user = await User.findById(coach.userId).select('+passwordHash +refreshTokens');
        } else {
          const org = await Organization.findOne({ profileUrl: { $eq: identifier } }).select('userId');
          if (org) user = await User.findById(org.userId).select('+passwordHash +refreshTokens');
        }
      }
    }

    if (!user || !user.passwordHash) {
      sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
      return;
    }

    if (!user.isVerified) {
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

    sendSuccess(res, {
      accessToken,
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

    sendSuccess(res, { accessToken }, 'Token refreshed');
  } catch {
    sendError(res, 'Token refresh failed', 401);
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;
    if (token && req.user) {
      const user = await User.findById(req.user._id).select('+refreshTokens');
      if (user) {
        user.refreshTokens = (user.refreshTokens || []).filter((t) => t !== token);
        await user.save();
      }
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Logged out successfully');
  } catch {
    sendError(res, 'Logout failed', 500);
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  // Normalize email — DB stores lowercase, query must match
  const normalizedEmail = email?.toLowerCase()?.trim();
  if (!normalizedEmail) { sendError(res, 'Email is required', 400); return; }

  const user = await User.findOne({ email: normalizedEmail }).select('+emailOtp +emailOtpExpiry');

  // Always respond the same way so we don't leak which emails exist
  if (!user) { sendSuccess(res, null, 'If that email is registered, an OTP has been sent'); return; }

  const otp = generateOTP();
  user.emailOtp = otp;
  user.emailOtpExpiry = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  try {
    await sendEmail({ to: normalizedEmail, ...emailTemplates.resetPassword(otp, normalizedEmail.split('@')[0]) });
    sendSuccess(res, null, 'OTP sent to your email');
  } catch {
    sendError(res, 'Failed to send OTP email. Please try again later.', 500);
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      sendError(res, 'Email, OTP and new password are required', 400); return;
    }
    if (newPassword.length < 8) {
      sendError(res, 'Password must be at least 8 characters', 400); return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      sendError(res, 'Password must contain uppercase, lowercase, and a number', 400); return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+emailOtp +emailOtpExpiry +passwordHash');

    if (!user || !user.emailOtp) {
      sendError(res, 'Invalid or expired OTP. Please request a new one.', 400, 'INVALID_OTP'); return;
    }
    if (user.emailOtp !== String(otp).trim()) {
      sendError(res, 'Incorrect OTP. Please check and try again.', 400, 'INVALID_OTP'); return;
    }
    if (user.emailOtpExpiry && user.emailOtpExpiry < new Date()) {
      sendError(res, 'OTP has expired. Please request a new one.', 400, 'OTP_EXPIRED'); return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.emailOtp = undefined;
    user.emailOtpExpiry = undefined;
    user.refreshTokens = [];
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

    // Pass the access token via URL so the frontend can store it in localStorage.
    // This is necessary because cookies set on the API domain (Render) are not
    // accessible to the frontend domain (Vercel) after an OAuth redirect.
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${accessToken}`);
  } catch {
    res.redirect(`${process.env.CLIENT_URL}/auth/login?error=oauth_failed`);
  }
};
