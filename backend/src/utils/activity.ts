import crypto from 'crypto';
import { ActivityEvent, EventType } from '../models/ActivityEvent';
import { AthleteProfile } from '../models/AthleteProfile';

/** "Android Chrome", "iOS Safari", "LinkSports App (iOS)"… — coarse label for the admin feed. */
export const deviceFromUserAgent = (ua = '', appHeader?: string): string => {
  if (appHeader) return `LinkSports App (${appHeader})`;
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'macOS' : 'Other';
  const browser = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : /firefox/i.test(ua) ? 'Firefox' : 'Browser';
  return `${os} ${browser}`;
};

/**
 * Fire-and-forget audit event. Never throws: analytics must not break login or saving a CV.
 */
export const logEvent = async (
  userId: string,
  eventType: EventType,
  opts: { sport?: string; meta?: Record<string, unknown> } = {}
): Promise<void> => {
  try {
    const profile = await AthleteProfile.findOne({ userId }).select('fullName primarySport media profileCompletion');
    await ActivityEvent.create({
      eventId: `evt_${crypto.randomBytes(5).toString('hex')}`,
      userId,
      userName: profile?.fullName || '',
      sport: opts.sport || profile?.primarySport,
      eventType,
      meta: {
        photos_count: ((profile?.media as any[]) || []).filter((m) => m?.type === 'photo').length,
        completion: `${profile?.profileCompletion ?? 0}%`,
        ...(opts.meta || {}),
      },
    });
  } catch (err) {
    console.error('logEvent failed:', (err as Error).message);
  }
};
