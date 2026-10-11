import { API_URL, SITE_URL_CONFIG, api } from './api';

// Public site that hosts the shareable profile page. Set EXPO_PUBLIC_SITE_URL in the root .env.
export const SITE_URL = (SITE_URL_CONFIG || 'https://www.linksports.in').replace(/\/$/, '');
export const shareUrlFor = (profileUrl?: string) => (profileUrl ? `${SITE_URL}/athlete/${profileUrl}` : SITE_URL);
export const MIN_COMPLETE = 60; // same threshold the admin portal uses for "completed CV"

export const SPORTS = [
  ['Football', '⚽'], ['Cricket', '🏏'], ['Badminton', '🏸'], ['Athletics', '🏃'], ['Kabaddi', '🤼'], ['Basketball', '🏀'],
  ['Hockey', '🏑'], ['Volleyball', '🏐'], ['Tennis', '🎾'], ['Table Tennis', '🏓'], ['Swimming', '🏊'], ['Boxing', '🥊'],
  ['Wrestling', '🤼'], ['Kho Kho', '🏃'], ['Archery', '🏹'], ['Shooting', '🎯'], ['Weightlifting', '🏋️'], ['Judo', '🥋'],
  ['Chess', '♟️'], ['Cycling', '🚴'], ['Gymnastics', '🤸'], ['Squash', '🎾'], ['Handball', '🤾'], ['Other', '🏅'],
].map(([name, emoji]) => ({ name, emoji }));

export type Row = Record<string, string>;
export interface CvForm {
  fullName: string; dob: string; gender: string; city: string; state: string; phone: string;
  position: string; height: string; weight: string; tagline: string; photo: string;
  teams: Row[]; tournaments: Row[]; achievements: Row[]; videos: Row[]; instagram: string;
}

export const emptyForm: CvForm = {
  fullName: '', dob: '', gender: '', city: '', state: '', phone: '', position: '', height: '', weight: '',
  tagline: '', photo: '', teams: [{ organization: '', role: '' }], tournaments: [{ name: '', year: '', result: '' }],
  achievements: [{ title: '', year: '', level: '' }], videos: [{ url: '' }], instagram: '',
};

const nonEmpty = (rows: Row[], key: string) => rows.filter((r) => r[key]?.trim());
const num = (v: string) => (v?.trim() && !isNaN(Number(v)) ? Number(v) : undefined);

export function fromProfile(p: Record<string, any>): CvForm {
  const rows = (arr: Row[] | undefined, fallback: Row[]) => (arr && arr.length ? arr : fallback);
  return {
    fullName: p.fullName && p.fullName !== 'Player' ? p.fullName : '', dob: p.dob ? String(p.dob).slice(0, 10) : '', gender: p.gender || '',
    city: p.location?.city || '', state: p.location?.state || '', phone: p.phone || '', position: p.position || '',
    height: p.height != null ? String(p.height) : '', weight: p.weight != null ? String(p.weight) : '',
    tagline: p.tagline || '', photo: p.photo || '',
    teams: rows(p.playingHistory?.map((h: any) => ({ organization: h.organization || '', role: h.role || '' })), emptyForm.teams),
    tournaments: rows(p.tournaments?.map((t: any) => ({ name: t.name || '', year: t.year ? String(t.year) : '', result: t.result || '' })), emptyForm.tournaments),
    achievements: rows(p.achievements?.map((a: any) => ({ title: a.title || '', year: a.year ? String(a.year) : '', level: a.level || '' })), emptyForm.achievements),
    videos: rows((p.media || []).filter((m: any) => m.type === 'video').map((m: any) => ({ url: m.url || '' })), emptyForm.videos),
    instagram: p.socialLinks?.instagram || '',
  };
}

export function toPayload(sport: string, f: CvForm) {
  return {
    primarySport: sport,
    fullName: f.fullName.trim() || undefined,
    dob: f.dob || undefined,
    gender: f.gender || undefined,
    phone: f.phone.trim() || undefined,
    location: { city: f.city.trim(), state: f.state.trim() },
    position: f.position.trim() || undefined,
    height: num(f.height), weight: num(f.weight),
    tagline: f.tagline.trim() || undefined,
    photo: f.photo || undefined,
    playingHistory: nonEmpty(f.teams, 'organization').map((t) => ({ organization: t.organization.trim(), role: t.role?.trim() || undefined })),
    tournaments: nonEmpty(f.tournaments, 'name').map((t) => ({ name: t.name.trim(), year: num(t.year), result: t.result?.trim() || undefined })),
    achievements: nonEmpty(f.achievements, 'title').map((a) => ({ title: a.title.trim(), year: num(a.year), level: a.level?.trim() || undefined })),
    media: nonEmpty(f.videos, 'url').map((v) => ({
      type: 'video', url: v.url.trim(),
      platform: /youtu/i.test(v.url) ? 'YouTube' : /instagram/i.test(v.url) ? 'Instagram' : /vimeo/i.test(v.url) ? 'Vimeo' : 'Other',
    })),
    socialLinks: { instagram: f.instagram.trim() || undefined },
  };
}

export interface StoryData {
  fullName: string; photo?: string; sport: string; position?: string; club?: string; stats: string[]; shareUrl: string;
}

export function buildStoryData(p: Record<string, any>, photoUrl?: string): StoryData {
  const ach: string[] = (p.achievements || []).filter((a: any) => a?.title).map((a: any) => `${a.title}${a.year ? ` (${a.year})` : ''}`);
  const tour: string[] = (p.tournaments || []).filter((t: any) => t?.name)
    .map((t: any) => `${t.result ? `${t.result} — ` : ''}${t.name}${t.year ? ` (${t.year})` : ''}`);
  return {
    fullName: p.fullName || 'Athlete',
    photo: photoUrl,
    sport: p.primarySport || '',
    position: p.position,
    club: (p.playingHistory || []).find((h: any) => h?.organization)?.organization || p.institutionName,
    stats: [...ach, ...tour].slice(0, 3),
    shareUrl: shareUrlFor(p.profileUrl),
  };
}

/** Analytics must never block the user, so failures are swallowed. */
export const logEvent = (eventType: 'SPORT_SELECTED' | 'PDF_DOWNLOADED' | 'STORY_CARD_EXPORTED', data: { sport?: string; format?: string } = {}) =>
  api.post('/events', { eventType, ...data }).catch(() => undefined);

/** Uploaded photos may be stored as relative backend paths; make them absolute. */
export const absoluteUrl = (u?: string) => {
  if (!u) return undefined;
  // full URLs and inline images (data:, file:, content: from the picker) are used as-is
  if (/^(https?:|data:|file:|content:)/.test(u)) return u;
  const origin = API_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}/${u.replace(/^\//, '')}`;
};
