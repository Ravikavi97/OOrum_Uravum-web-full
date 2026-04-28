import { describe, it, expect, beforeAll } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  requireAuth,
  requireRole,
  type AuthPayload,
  type AuthenticatedRequest,
} from './auth.js';

// Set env vars for tests
beforeAll(() => {
  process.env.JWT_SECRET = 'test-access-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
});

const samplePayload: AuthPayload = {
  userId: 'user-123',
  email: 'test@example.com',
  role: 'AUTHOR',
};

// ─── Token sign/verify ──────────────────────────────────────────────────────

describe('signAccessToken / verifyToken', () => {
  it('should sign and verify an access token round-trip', () => {
    const token = signAccessToken(samplePayload);
    const decoded = verifyToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(samplePayload.userId);
    expect(decoded!.email).toBe(samplePayload.email);
    expect(decoded!.role).toBe(samplePayload.role);
  });

  it('should return null for a tampered token', () => {
    const token = signAccessToken(samplePayload);
    const tampered = token.slice(0, -4) + 'xxxx';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('should return null for a completely invalid string', () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
  });
});

describe('signRefreshToken', () => {
  it('should sign a refresh token verifiable with the refresh secret', () => {
    const token = signRefreshToken(samplePayload);
    // Refresh token uses a different secret, so verifyToken with default secret should fail
    expect(verifyToken(token)).toBeNull();
    // But with the refresh secret it should work
    const decoded = verifyToken(token, process.env.JWT_REFRESH_SECRET);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(samplePayload.userId);
  });
});

// ─── requireAuth middleware ─────────────────────────────────────────────────

describe('requireAuth', () => {
  function createMockRes() {
    const res: any = {
      statusCode: 0,
      body: null,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(data: any) {
        res.body = data;
        return res;
      },
    };
    return res;
  }

  it('should return 401 when no Authorization header is present', () => {
    const req = { headers: {} } as AuthenticatedRequest;
    const res = createMockRes();
    let nextCalled = false;

    requireAuth(req, res, () => { nextCalled = true; });

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(nextCalled).toBe(false);
  });

  it('should return 401 when Authorization header has wrong scheme', () => {
    const req = { headers: { authorization: 'Basic abc123' } } as AuthenticatedRequest;
    const res = createMockRes();
    let nextCalled = false;

    requireAuth(req, res, () => { nextCalled = true; });

    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('should return 401 for an invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } } as AuthenticatedRequest;
    const res = createMockRes();
    let nextCalled = false;

    requireAuth(req, res, () => { nextCalled = true; });

    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('should attach user and call next for a valid token', () => {
    const token = signAccessToken(samplePayload);
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthenticatedRequest;
    const res = createMockRes();
    let nextCalled = false;

    requireAuth(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe(samplePayload.userId);
    expect(req.user!.role).toBe(samplePayload.role);
  });
});

// ─── requireRole middleware ─────────────────────────────────────────────────

describe('requireRole', () => {
  function createMockRes() {
    const res: any = {
      statusCode: 0,
      body: null,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(data: any) {
        res.body = data;
        return res;
      },
    };
    return res;
  }

  it('should return 401 when req.user is not set', () => {
    const req = { headers: {} } as AuthenticatedRequest;
    const res = createMockRes();
    let nextCalled = false;

    requireRole('ADMIN')(req, res, () => { nextCalled = true; });

    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('should return 403 when user role is not in allowed roles', () => {
    const req = { headers: {}, user: { ...samplePayload, role: 'AUTHOR' as const } } as AuthenticatedRequest;
    const res = createMockRes();
    let nextCalled = false;

    requireRole('ADMIN', 'EDITOR')(req, res, () => { nextCalled = true; });

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(nextCalled).toBe(false);
  });

  it('should call next when user role matches', () => {
    const req = { headers: {}, user: { ...samplePayload, role: 'EDITOR' as const } } as AuthenticatedRequest;
    const res = createMockRes();
    let nextCalled = false;

    requireRole('ADMIN', 'EDITOR')(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it('should allow ADMIN for admin-only routes', () => {
    const req = { headers: {}, user: { ...samplePayload, role: 'ADMIN' as const } } as AuthenticatedRequest;
    const res = createMockRes();
    let nextCalled = false;

    requireRole('ADMIN')(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });
});
