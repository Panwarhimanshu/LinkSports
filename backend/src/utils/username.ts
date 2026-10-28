import crypto from 'crypto';
import { AthleteProfile } from '../models/AthleteProfile';
import { CoachProfile } from '../models/CoachProfile';

// A player's username is their public CV link: linksports.in/cv/{username}.

const RESERVED = new Set([
  'admin', 'api', 'auth', 'cv', 'edit', 'me', 'home', 'login', 'logout', 'register', 'about', 'privacy', 'terms',
  'settings', 'search', 'jobs', 'listings', 'linksports', 'support', 'help', 'athlete', 'coach', 'org',
]);

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "  @Rahul_S " → "rahul_s" */
export const normalizeUsername = (raw: unknown): string => String(raw ?? '').trim().replace(/^@/, '').toLowerCase();

/** 3–30 characters: letters, numbers, "-" and "_", starting with a letter or number. */
export const isValidUsername = (u: string): boolean => /^[a-z0-9][a-z0-9_-]{2,29}$/.test(u) && !RESERVED.has(u);

/** "Rahul Sharma" → "rahul-sharma" */
export const slugifyName = (name: string): string =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);

/** The placeholder name phone/email sign-ups start with. */
export const isRealName = (name?: string): boolean => !!name && name.trim().length >= 2 && name !== 'Player';

/** True when another profile already uses this username (case-insensitive) or this value as its link slug. */
export const usernameTaken = async (username: string, exceptProfileId?: unknown): Promise<boolean> => {
  const notMe = exceptProfileId ? { _id: { $ne: exceptProfileId } } : {};
  const match = { $or: [{ username: new RegExp(`^${escapeRegex(username)}$`, 'i') }, { profileUrl: username }] };
  // players and coaches share one namespace because both live at /cv/{username}
  const [a, c] = await Promise.all([AthleteProfile.exists({ ...notMe, ...match }), CoachProfile.exists({ ...notMe, ...match })]);
  return !!(a || c);
};

/** A free username built from the player's name: rahul-sharma, then rahul-sharma-2, -3, ... */
export const uniqueUsername = async (name: string, exceptProfileId?: unknown): Promise<string> => {
  let base = slugifyName(name) || 'player';
  if (base.length < 3) base = `${base}-cv`;
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (isValidUsername(candidate) && !(await usernameTaken(candidate, exceptProfileId))) return candidate;
  }
  return `${base}-${crypto.randomBytes(2).toString('hex')}`;
};

/** Filter that finds an athlete by id, link slug or username (what /cv/{id} and the PDF route receive). */
export const athleteLookup = (id: string): Record<string, unknown> => {
  const byUsername = { username: new RegExp(`^${escapeRegex(id)}$`, 'i') };
  const looksLikeObjectId = id.length === 24 && !id.includes('-');
  return looksLikeObjectId
    ? { $or: [{ _id: id }, { profileUrl: id }, { userId: id }, byUsername] }
    : { $or: [{ profileUrl: id }, byUsername] };
};

/** Same filter, for coach profiles. */
export const coachLookup = athleteLookup;
