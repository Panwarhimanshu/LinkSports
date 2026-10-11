import { Request, Response } from 'express';
import { generateAccessToken, generateRefreshToken } from './jwt';
import { sendSuccess } from './response';
import { deviceFromUserAgent, logEvent } from './activity';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Signs a user in after a passwordless check (phone or email OTP): issues access + refresh tokens,
 * sets the cookies, records the login and sends the standard login response.
 * `user` must have been loaded with `.select('+refreshTokens')`.
 */
export const startSession = async (
  req: Request, res: Response, user: any, isNew: boolean, provider: 'phone' | 'email_otp',
): Promise<void> => {
  const payload = { id: user._id.toString(), role: user.role, email: user.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  user.lastLoginAt = new Date();
  await user.save();

  res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

  void logEvent(user._id.toString(), 'USER_LOGIN', {
    meta: { device: deviceFromUserAgent(req.headers['user-agent'], req.headers['x-app-platform'] as string | undefined), provider },
  });

  sendSuccess(res, {
    accessToken,
    refreshToken,
    isNew,
    user: { id: user._id, email: user.email, role: user.role, isVerified: true },
  }, 'Login successful');
};
