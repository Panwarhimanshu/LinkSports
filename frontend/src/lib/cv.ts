import { getPhotoUrl } from './utils';

/** Sprint mode: root opens the CV creator and networking features are off. Set NEXT_PUBLIC_CV_ONLY=false to restore the old site. */
export const CV_ONLY = process.env.NEXT_PUBLIC_CV_ONLY !== 'false';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.linksports.in').replace(/\/$/, '');

/** Public CV link, e.g. https://www.linksports.in/cv/rahul-sharma-a1b2c3 */
export const shareUrlFor = (profileUrl?: string) => (profileUrl ? `${SITE_URL}/cv/${profileUrl}` : SITE_URL);

export const MAX_ACTION_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 800 * 1024;

/** Phone sign-ups start with the placeholder name "Player"; treat it as not filled in. */
export const realName = (name?: string) => (name && name !== 'Player' ? name : '');

export const photosOf = (p?: Record<string, any> | null): { url: string }[] => ((p?.media as any[]) || []).filter((m) => m?.type === 'photo' && m.url);
export const videosOf = (p?: Record<string, any> | null): { url: string; platform?: string }[] => ((p?.media as any[]) || []).filter((m) => m?.type === 'video' && m.url);

/** A profile is "onboarded" once it has a sport and a real name; before that the app shows the setup steps. */
export const isOnboarded = (p?: Record<string, any> | null) => !!p?.primarySport && !!realName(p?.fullName);

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
    shareUrl: shareUrlFor(p.profileUrl),
  };
}
