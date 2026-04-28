import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../lib/auth';

// ─── Shared 429 handler ──────────────────────────────────────────────────────

function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  });
}

// ─── Public rate limiter: 100 req/min per IP ─────────────────────────────────

export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip ?? 'unknown',
  handler: rateLimitHandler,
});

// ─── Authenticated rate limiter: 30 req/min per user ─────────────────────────

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.user?.userId ?? req.ip ?? 'unknown';
  },
  handler: rateLimitHandler,
});
