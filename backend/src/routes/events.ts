import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth';
import { AuthRequest } from '../types';
import { EVENT_TYPES, EventType } from '../models/ActivityEvent';
import { deviceFromUserAgent, logEvent } from '../utils/activity';
import { sendError, sendSuccess } from '../utils/response';

const router = Router();

const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many events.' } },
});

// Client-reported activity (SPORT_SELECTED, PDF_DOWNLOADED, STORY_CARD_EXPORTED).
// USER_LOGIN and CV_SAVED are logged server-side (auth + profile controllers) so they can't be forged or duplicated.
const CLIENT_EVENTS = EVENT_TYPES.filter((t) => t !== 'USER_LOGIN' && t !== 'CV_SAVED');

router.post('/', protect, eventLimiter, async (req: AuthRequest, res: Response) => {
  const { eventType, sport, format } = req.body || {};
  if (!CLIENT_EVENTS.includes(eventType)) {
    sendError(res, 'Invalid event type', 400, 'VALIDATION_ERROR');
    return;
  }
  await logEvent(req.user!._id.toString(), eventType as EventType, {
    sport: typeof sport === 'string' ? sport.slice(0, 50) : undefined,
    meta: {
      ...(typeof format === 'string' ? { format: format.toUpperCase().slice(0, 10) } : {}),
      device: deviceFromUserAgent(req.headers['user-agent'], req.headers['x-app-platform'] as string | undefined),
    },
  });
  sendSuccess(res, null, 'Logged', 201);
});

export default router;
