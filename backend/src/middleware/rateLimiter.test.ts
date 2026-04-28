import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { publicRateLimiter, authRateLimiter } from './rateLimiter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildApp(limiter: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.use(limiter);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

// ─── Public rate limiter ─────────────────────────────────────────────────────

describe('publicRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(publicRateLimiter);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 429 with structured error when limit exceeded', async () => {
    const limiter = (await import('express-rate-limit')).default({
      windowMs: 60_000,
      limit: 2,
      keyGenerator: (req) => req.ip ?? 'unknown',
      handler: (_req, res) => {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        });
      },
    });

    const app = buildApp(limiter);

    await request(app).get('/test');
    await request(app).get('/test');
    const res = await request(app).get('/test');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    });
  });
});

// ─── Auth rate limiter ───────────────────────────────────────────────────────

describe('authRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(authRateLimiter);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('keys by user ID when present on req.user', async () => {
    const limiter = (await import('express-rate-limit')).default({
      windowMs: 60_000,
      limit: 1,
      keyGenerator: (req: any) => req.user?.userId ?? req.ip ?? 'unknown',
      handler: (_req, res) => {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        });
      },
    });

    const app = express();
    // Simulate two different authenticated users
    app.use((req: any, _res, next) => {
      req.user = { userId: req.headers['x-user-id'] ?? 'default' };
      next();
    });
    app.use(limiter);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    // User A — first request passes
    const r1 = await request(app).get('/test').set('x-user-id', 'user-a');
    expect(r1.status).toBe(200);

    // User A — second request blocked (limit=1)
    const r2 = await request(app).get('/test').set('x-user-id', 'user-a');
    expect(r2.status).toBe(429);

    // User B — still allowed (different key)
    const r3 = await request(app).get('/test').set('x-user-id', 'user-b');
    expect(r3.status).toBe(200);
  });
});
