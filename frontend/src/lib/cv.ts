import { getPhotoUrl } from './utils';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.linksports.in').replace(/\/$/, '');

/** The player's public handle: their username, or the older link slug if they have none yet. */
export const profileHandle = (p?: Record<string, any> | null): string => String(p?.username || p?.profileUrl || '');

/** Public CV link, e.g. https://www.linksports.in/cv/rahul-sharma */
export const shareUrlFor = (handle?: string) => (handle ? `${SITE_URL}/cv/${handle}` : SITE_URL);

export const MAX_ACTION_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 800 * 1024;

/** New accounts start with the placeholder name "Player" (or "Coach"); treat it as not filled in. */
export const realName = (name?: string) => (name && name !== 'Player' && name !== 'Coach' ? name : '');

export const photosOf = (p?: Record<string, any> | null): { url: string }[] => ((p?.media as any[]) || []).filter((m) => m?.type === 'photo' && m.url);
export const videosOf = (p?: Record<string, any> | null): { url: string; platform?: string }[] => ((p?.media as any[]) || []).filter((m) => m?.type === 'video' && m.url);

/** A profile is "onboarded" once it has a sport and a real name; before that the app shows the setup steps. */
export const isOnboarded = (p?: Record<string, any> | null) => !!p?.primarySport && !!realName(p?.fullName);

/** Same check for a coach, whose sports are a list. */
export const isCoachOnboarded = (p?: Record<string, any> | null) => !!p?.sportsSpecialization?.length && !!realName(p?.fullName);

/** Onboarding check for whichever account type is signed in. */
export const isOnboardedFor = (role?: string, p?: Record<string, any> | null) => (role === 'coach' ? isCoachOnboarded(p) : isOnboarded(p));

/**
 * Shrinks a photo in the browser before upload so it stays under `maxBytes` (default 800 KB):
 * scales the longest side down to 1600px, then lowers JPEG quality until it fits.
 */
export async function compressImage(file: File, maxBytes = MAX_PHOTO_BYTES): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    if (file.size <= maxBytes) return file; // can't decode (e.g. HEIC) but it's small enough already
    throw new Error('This photo format is not supported. Please use a JPG or PNG.');
  }
  let side = Math.min(1600, Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const ratio = side / Math.max(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * Math.min(1, ratio)));
    canvas.height = Math.max(1, Math.round(bitmap.height * Math.min(1, ratio)));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= maxBytes) {
        bitmap.close?.();
        return new File([blob], file.name.replace(/[.][^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
      }
    }
    side = Math.round(side * 0.8); // still too big: shrink the pixels and try again
  }
  bitmap.close?.();
  throw new Error('Could not shrink this photo enough. Try a different one.');
}

export const MIN_COMPLETE = 60; // matches the admin "completed CV" threshold

export function ageFromDob(dob?: string | Date): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/** Fetch an image and inline it as a data URL so html-to-image can render it without CORS/taint problems. */
export async function toDataUrl(src?: string | null): Promise<string | null> {
  // "/logo.png"-style paths are this site's own public files; everything else is a stored photo
  const url = src?.startsWith('/') && !src.startsWith('//') ? src : getPhotoUrl(src);
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface StoryData {
  fullName: string;
  photo: string | null;
  sport: string;
  position?: string;
  club?: string;
  stats: string[]; // up to 3 headline items
  shareUrl: string;
  /** Badge in the card's header; "Player Profile" when empty. */
  label?: string;
}

/** Top-3 career stats/medals: achievements first, then tournament results. */
export function buildStoryData(p: Record<string, any>): Omit<StoryData, 'photo'> {
  const ach: string[] = (p.achievements || []).filter((a: any) => a?.title).map((a: any) => `${a.title}${a.year ? ` (${a.year})` : ''}`);
  const tour: string[] = (p.tournaments || [])
    .filter((t: any) => t?.name)
    .map((t: any) => `${t.result ? `${t.result} — ` : ''}${t.name}${t.year ? ` (${t.year})` : ''}`);
  const club = (p.playingHistory || []).find((h: any) => h?.organization)?.organization || p.institutionName;
  return {
    fullName: p.fullName || 'Athlete',
    sport: p.primarySport || '',
    position: p.position,
    club,
    stats: [...ach, ...tour].slice(0, 3),
    shareUrl: shareUrlFor(profileHandle(p)),
  };
}

/** Story card data for a coach: certifications, awards and results play the part of a player's medals. */
export function buildCoachStoryData(p: Record<string, any>): Omit<StoryData, 'photo'> {
  const quals: string[] = (p.qualifications || []).filter((q: any) => q?.name).map((q: any) => q.name);
  const awards: string[] = (p.achievements || []).filter((a: any) => a?.title).map((a: any) => `${a.title}${a.year ? ` (${a.year})` : ''}`);
  const results: string[] = (p.playersTrained || []).filter((t: any) => t?.name && t?.result).map((t: any) => `${t.result} — ${t.name}`);
  const current = (p.experience || []).find((e: any) => e?.current) || (p.experience || [])[0];
  return {
    fullName: p.fullName || 'Coach',
    sport: (p.sportsSpecialization || []).slice(0, 2).join(' · '),
    position: p.coachingLevel || 'Coach',
    club: current?.organization,
    stats: [...awards, ...quals, ...results].slice(0, 3),
    shareUrl: shareUrlFor(profileHandle(p)),
    label: 'Coach Profile',
  };
}
