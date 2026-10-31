import './config/env';
import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import passport from 'passport';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

import { connectDB } from './config/database';
import { configurePassport } from './config/passport';
import { AppError, errorHandler, notFound } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import profileRoutes from './routes/profiles';
import connectionRoutes from './routes/connections';
import listingRoutes from './routes/listings';
import jobRoutes from './routes/jobs';
import messageRoutes from './routes/messages';
import notificationRoutes from './routes/notifications';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';
import imageRoutes from './routes/images';
import eventRoutes from './routes/events';
import settingsRoutes from './routes/settings';
import userReviewRoutes, { reviewRouter } from './routes/reviews';

// Signing secrets must be long and random, or session tokens can be forged. In production a weak one is reported
// loudly in the logs on every start (set JWT_SECRET and JWT_REFRESH_SECRET to 64+ random characters, and make them
// different from each other). Set STRICT_SECRETS=true to make the server refuse to start instead.
if (process.env.NODE_ENV === 'production') {
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = process.env[key] || '';
    if (v.length < 32 || /^your_|change_me|secret$/i.test(v)) {
      console.error(`[security] WEAK SECRET: ${key} is missing or too short (need 32+ random characters). Sessions can be forged until this is fixed.`);
      if (process.env.STRICT_SECRETS === 'true') throw new Error(`${key} is not configured securely`);
    }
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    console.error('[security] JWT_SECRET and JWT_REFRESH_SECRET are identical; they should be different.');
  }
  if (process.env.DEV_LOGIN === 'true') {
    console.error('[security] DEV_LOGIN is on in production; ignoring it.');
    process.env.DEV_LOGIN = 'false';
  }
}

const app = express();
const server = http.createServer(app);
app.disable('x-powered-by');

// Trust Render/proxy X-Forwarded-For headers (required for express-rate-limit on Render)
app.set('trust proxy', 1);

// ── Socket.IO (authenticated) ─────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
});

// Verify JWT on every socket connection
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    (socket as any).userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const authenticatedUserId = (socket as any).userId as string;

  // Only allow joining own room
  socket.join(`user_${authenticatedUserId}`);

  // Messages are never relayed from the client: a client could put any sender or text in them. The server
  // saves a message (POST /messages/...) and then pushes the stored copy to the recipient itself.
  socket.on('typing', (data) => {
    const recipientId = String(data?.recipientId ?? '');
    if (!/^[a-f0-9]{24}$/i.test(recipientId)) return;
    io.to(`user_${recipientId}`).emit('user_typing', { senderId: authenticatedUserId });
  });

  socket.on('disconnect', () => {
    // Intentionally silent
  });
});

// ── Security Middleware ───────────────────────────────────────────────────────
// This host only serves JSON and images, so the policy can be very strict: nothing may run or embed from it.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'https://www.linksports.in',
  'https://linksports.in',
  // extra web origins for this deployment, comma-separated (e.g. a *.vercel.app alias next to the custom domain)
  ...(process.env.CORS_EXTRA_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
];

app.use(cors({
  origin: (origin, callback) => {
    // Native mobile apps send no Origin header — always allow
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any localhost/192.168.x.x origin in development
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new AppError('This website is not allowed to use the API', 403, 'CORS_BLOCKED'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CSRF guard. Cookie sign-in is cross-site by design (web app and API are on different hosts), so a request that
// changes data and authenticates only with cookies must come from one of our own web origins. Requests that send
// an Authorization header (the web app's normal path, and the mobile app) cannot be forged by another site.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers.authorization) return next();
  const usesCookies = !!(req.cookies?.accessToken || req.cookies?.refreshToken);
  if (!usesCookies) return next();
  const origin = req.headers.origin as string | undefined;
  const sameSite = origin && allowedOrigins.includes(origin);
  if (sameSite) return next();
  if (process.env.NODE_ENV !== 'production' && (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) return next();
  res.status(403).json({ success: false, error: { code: 'CSRF_BLOCKED', message: 'Request blocked' } });
});

// Sanitize all incoming data — strip MongoDB operators ($, .) from user input
app.use(mongoSanitize({ replaceWith: '_' }));

app.use(passport.initialize());
configurePassport();

// On Vercel the app runs as a serverless function with no start-up phase, so connect on first use.
if (process.env.VERCEL) {
  app.use(async (_req, _res, next) => {
    try {
      await connectDB();
      next();
    } catch (err) {
      next(err);
    }
  });
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  },
}));
app.use('/api/v1/images', imageRoutes);

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later.' } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 50 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many authentication attempts.' } },
});

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many search requests.' } },
});

// Tighter limits on the routes that cost money, write data or can be used to spam people.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 300 : 3000, standardHeaders: true, legacyHeaders: false,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many changes, please slow down.' } },
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 40 : 1000, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many uploads, please wait a few minutes.' } },
});
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 30 : 1000, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many payment requests.' } },
});

app.use(globalLimiter);
app.use('/api/v1', writeLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
// OAuth redirect routes are excluded from the auth rate limiter (not brute-force targets)
app.use('/api/v1/auth/oauth', authRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/v1/connections', connectionRoutes);
app.use('/api/v1/listings', listingRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/payments', paymentLimiter, paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/upload', uploadLimiter, uploadRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/users', userReviewRoutes);
app.use('/api/v1/reviews', reviewRouter);

// ── Global search (rate-limited, sanitized) ───────────────────────────────────
app.get('/api/v1/search', searchLimiter, async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    const safePage = Math.max(1, Math.min(100, parseInt(page as string) || 1));
    const safeLimit = Math.max(1, Math.min(20, parseInt(limit as string) || 20));
    const skip = (safePage - 1) * safeLimit;

    const { AthleteProfile } = await import('./models/AthleteProfile');
    const { CoachProfile }   = await import('./models/CoachProfile');
    const { Organization }   = await import('./models/Organization');
    const { Listing }        = await import('./models/Listing');
    const { Job }            = await import('./models/Job');

    let profileFilter: Record<string, unknown> = {};

    if (q && typeof q === 'string' && q.trim()) {
      const raw = q.trim().slice(0, 200);
      const safe = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(safe, 'i');

      // Names and usernames only. Searching by email or phone would let anyone check who is registered.
      const nameStr = raw.startsWith('@') ? raw.slice(1) : raw;
      const nameRe = new RegExp(nameStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      profileFilter.$or = [{ fullName: nameRe }, { username: nameRe }, { name: nameRe }, { tagline: nameRe }];
    }

    const [athletes, coaches, organizations, listings, jobs] = await Promise.all([
      AthleteProfile.find({ ...profileFilter, visibility: 'public' })
        .limit(safeLimit).skip(skip)
        .select('fullName photo primarySport location profileUrl username'),
      CoachProfile.find({ ...profileFilter, visibility: 'public' })
        .limit(safeLimit).skip(skip)
        .select('fullName photo sportsSpecialization location profileUrl username'),
      Organization.find({ ...profileFilter, verificationStatus: 'verified' })
        .limit(safeLimit).skip(skip)
        .select('name logo sports profileUrl'),
      Listing.find({ status: 'published' })
        .limit(5).select('title type sports startDate location')
        .populate('organizationId', 'name logo'),
      Job.find({ status: 'published' })
        .limit(5).select('title category location jobType'),
    ]);

    res.json({ success: true, data: { athletes, coaches, organizations, listings, jobs } });
  } catch {
    res.status(500).json({ success: false, error: { message: 'Search failed' } });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Opening the API host in a browser should explain itself instead of showing "Route not found".
app.get('/', (_req, res) => res.json({
  name: 'LinkSports API',
  status: 'ok',
  api: '/api/v1',
  health: '/health',
  website: process.env.CLIENT_URL || 'https://www.linksports.in',
}));

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`LinkSports backend running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
};

// Vercel imports the default export and serves it as a function; it cannot keep a port (or
// Socket.IO connections) open, so only listen when running as a normal server.
if (!process.env.VERCEL) start().catch(console.error);

app.set('io', io);

export { io };
export default app;
