import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'EDITOR' | 'AUTHOR';

export interface AuthPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

function getAccessSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  return secret;
}

// ─── Token helpers ───────────────────────────────────────────────────────────

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, getAccessSecret(), {
    algorithm: 'HS256',
    expiresIn: '15m',
  });
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, getRefreshSecret(), {
    algorithm: 'HS256',
    expiresIn: '1d',
  });
}

export function verifyToken(token: string, secret?: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, secret ?? getAccessSecret(), {
      algorithms: ['HS256'],
    });
    return decoded as AuthPayload;
  } catch {
    return null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Express middleware that validates the JWT from the Authorization header.
 * Attaches the decoded payload to `req.user`.
 * Returns 401 if the token is missing, invalid, or expired.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
      },
    });
    return;
  }

  const token = header.slice(7); // strip "Bearer "
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
    return;
  }

  req.user = payload;
  next();
}

/**
 * Express middleware factory that checks the authenticated user's role
 * against a list of allowed roles. Must be used after `requireAuth`.
 * Returns 403 if the user's role is not in the allowed list.
 */
export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    next();
  };
}
