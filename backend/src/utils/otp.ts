import crypto from 'crypto';

/** Peppered hash for one-time codes. `purpose` stops a code issued for one flow being replayed in another. */
export const hashCode = (purpose: string, code: string, subject: string): string =>
  crypto.createHmac('sha256', process.env.JWT_SECRET as string).update(`${purpose}:${subject}:${code}`).digest('hex');

export const safeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

export const MAX_OTP_ATTEMPTS = 5;
