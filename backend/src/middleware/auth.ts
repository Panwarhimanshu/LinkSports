import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/User';
import { sendError } from '../utils/response';

/** True when the token was issued before the user's last logout / password change. */
const isRevoked = (iat?: number, validAfter?: Date): boolean =>
  !!validAfter && !!iat && iat < Math.floor(validAfter.getTime() / 1000);

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      sendError(res, 'Not authorized, no token', 401, 'UNAUTHORIZED');
      return;
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('+refreshTokens');

    if (!user) {
      sendError(res, 'User not found', 401, 'UNAUTHORIZED');
      return;
    }

    if (user.isSuspended) {
      sendError(res, 'Your account has been suspended', 403, 'SUSPENDED');
      return;
    }

    if (isRevoked(decoded.iat, user.tokensValidAfter)) {
      sendError(res, 'Session expired. Please sign in again.', 401, 'UNAUTHORIZED');
      return;
    }

    req.user = user;
    next();
  } catch {
    sendError(res, 'Not authorized, token failed', 401, 'UNAUTHORIZED');
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      sendError(res, 'Access denied: insufficient permissions', 403, 'FORBIDDEN');
      return;
    }
    next();
  };
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (user && !user.isSuspended && !isRevoked(decoded.iat, user.tokensValidAfter)) req.user = user;
    }
  } catch {
    // Continue without auth — optional
  }
  next();
};
