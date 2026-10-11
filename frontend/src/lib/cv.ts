import { getPhotoUrl } from './utils';

/** Sprint mode: root opens the CV creator and networking features are off. Set NEXT_PUBLIC_CV_ONLY=false to restore the old site. */
export const CV_ONLY = process.env.NEXT_PUBLIC_CV_ONLY !== 'false';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.linksports.in').replace(/\/$/, '');

export const shareUrlFor = (profileUrl?: string) => (profileUrl ? `${SITE_URL}/athlete/${profileUrl}` : SITE_URL);

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
