import crypto from 'crypto';

// Small shared helpers for the security hardening: output escaping, URL checks, one-time codes.

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

/** Escapes user text before it goes into an HTML email. */
export const escapeHtml = (v: unknown): string => String(v ?? '').replace(/[&<>"'`]/g, (c) => HTML_ESCAPES[c]);

export const escapeRegex = (v: string): string => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Query-string values arrive as string | string[] | object; this keeps only a plain, length-capped string. */
export const asString = (v: unknown, max = 100): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** A link that is safe to render in href: http(s) only (blocks javascript:, data:, file:). Returns '' when not allowed. */
export const safeHttpUrl = (v: unknown, max = 500): string => {
  const s = String(v ?? '').trim();
  if (!s || s.length > max) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
};

/** Image hosts we trust: our Cloudinary account and Google profile pictures (Google sign-in). */
export const TRUSTED_IMAGE_HOST = /^https:\/\/(res\.cloudinary\.com|lh3\.googleusercontent\.com)\//i;

/**
 * Photos may only point at places we control: our own stored images (relative path), Cloudinary, or a small
 * inline data URL (old profiles). Anything else (other hosts, javascript:, internal addresses) is dropped,
 * which also keeps the PDF generator from being pointed at arbitrary URLs.
 */
export const safeImageRef = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(s) && s.length < 700_000) return s;
  if (TRUSTED_IMAGE_HOST.test(s) && safeHttpUrl(s)) return s;
  // relative paths: api/v1/images/<id>, uploads/<file> (no scheme, no traversal)
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && !s.startsWith('//') && !s.includes('..') && /^[\w./-]{1,300}$/.test(s)) return s;
  // our own API host (absolute link to a stored image)
  const own = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  if (own && s.startsWith(`${own}/`) && safeHttpUrl(s)) return s;
  if (/^https:\/\/linksport-api\.vercel\.app\/api\/v1\/images\/[a-f0-9]{24}$/i.test(s)) return s;
  return '';
};

/** One-time codes are stored only as a hash, bound to who they are for and what they are for. */
export const hashCode = (code: string, subject: string, purpose: string): string =>
  crypto.createHash('sha256').update(`${purpose}:${subject}:${code}:${process.env.JWT_SECRET}`).digest('hex');

/** Constant-time string comparison. */
export const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Looks at the first bytes of a file and says which image type it really is (never trusts the client's label). */
export const sniffImageType = (buf: Buffer): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null => {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
};

/** Spreadsheet programs run cells that start with = + - @ as formulas; prefix them so exported text stays text. */
export const csvSafe = (v: unknown): string => {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};
