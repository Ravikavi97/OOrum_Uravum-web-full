import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { sanitizeText } from '../lib/sanitize';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';

const router = Router();
const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return secret;
}

function signToken(payload: { userId: string; email: string; name: string }): string {
  return jwt.sign(payload, getSecret(), { algorithm: 'HS256', expiresIn: '7d' });
}

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Too many attempts. Try again later.' } });
  },
});

// ─── Schemas with strong validation ──────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).transform((v) => sanitizeText(v.trim())),
  email: z.string().email('Valid email required').max(255).transform((v) => v.toLowerCase().trim()),
  phone: z.string().max(20).optional().transform((v) => v ? sanitizeText(v.trim()) : undefined),
  address: z.string().max(500).optional().transform((v) => v ? sanitizeText(v.trim()) : undefined),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password too long')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

const loginSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

// ─── POST /register ──────────────────────────────────────────────────────────

router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.flatten().fieldErrors } });
    return;
  }

  const { name, email, phone, address, password } = parsed.data;

  try {
    const existing = await prisma.frontendUser.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' } });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await prisma.frontendUser.create({
      data: { name, email, phone: phone || null, address: address || null, passwordHash },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
    });

    const token = signToken({ userId: user.id, email: user.email, name: user.name });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl },
    });
  } catch (err) {
    console.error('[frontendAuth] register error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Registration failed' } });
  }
});

// ─── POST /login ─────────────────────────────────────────────────────────────

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.frontendUser.findUnique({ where: { email } });

    if (!user) {
      await bcrypt.hash('dummy', BCRYPT_COST);
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    // Check if account is deactivated by admin
    if (!user.active) {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'உங்கள் கணக்கு முடக்கப்பட்டுள்ளது. நிர்வாகியை தொடர்பு கொள்ளவும். Your account has been disabled. Please contact the admin at admin@oorumuravum.today',
        },
      });
      return;
    }

    // Check if account is locked due to failed attempts
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `உங்கள் கணக்கு தற்காலிகமாக பூட்டப்பட்டுள்ளது. ${minsLeft} நிமிடங்களுக்குப் பிறகு மீண்டும் முயற்சிக்கவும் அல்லது நிர்வாகியை தொடர்பு கொள்ளவும்: admin@oorumuravum.today. Your account is temporarily locked. Try again in ${minsLeft} minutes or contact admin.`,
        },
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const newFailed = user.failedLogins + 1;
      const lockData: { failedLogins: number; lockedUntil?: Date | null } = { failedLogins: newFailed };
      if (newFailed >= MAX_FAILED_ATTEMPTS) {
        lockData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await prisma.frontendUser.update({ where: { id: user.id }, data: lockData });

      if (newFailed >= MAX_FAILED_ATTEMPTS) {
        res.status(423).json({
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'பல தவறான முயற்சிகளால் உங்கள் கணக்கு பூட்டப்பட்டுள்ளது. 30 நிமிடங்களுக்குப் பிறகு மீண்டும் முயற்சிக்கவும் அல்லது நிர்வாகியை தொடர்பு கொள்ளவும்: admin@oorumuravum.today. Account locked due to multiple failed attempts. Try again in 30 minutes or contact admin.',
          },
        });
      } else {
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }
      return;
    }

    // Successful login — reset failed attempts
    await prisma.frontendUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

    const token = signToken({ userId: user.id, email: user.email, name: user.name });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl },
    });
  } catch (err) {
    console.error('[frontendAuth] login error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Login failed' } });
  }
});

// ─── GET /me — Get current user profile ──────────────────────────────────────

router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), getSecret()) as { userId: string };
    const user = await prisma.frontendUser.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
    });
    if (!user) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }
    res.json(user);
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
});

// ─── Admin: GET /admin/list — List frontend users (CMS admin only) ───────────

router.get('/admin/list', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const search = (req.query.search as string || '').trim();
    const offset = (page - 1) * pageSize;

    const where = search ? {
      OR: [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ],
    } : {};

    const [data, total] = await Promise.all([
      prisma.frontendUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
        select: { id: true, name: true, email: true, phone: true, address: true, active: true, failedLogins: true, lockedUntil: true, createdAt: true, updatedAt: true },
      }),
      prisma.frontendUser.count({ where }),
    ]);

    res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error('[frontendAuth] admin/list error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list users' } });
  }
});

// ─── Admin: PUT /admin/:id/toggle — Enable/disable frontend user ─────────────

router.put('/admin/:id/toggle', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.frontendUser.findUnique({ where: { id: req.params.id as string } });
    if (!user) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }

    const updated = await prisma.frontendUser.update({
      where: { id: user.id },
      data: { active: !user.active },
      select: { id: true, name: true, email: true, active: true },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' } });
  }
});

// ─── Admin: PUT /admin/:id/unlock — Unlock a locked frontend user ────────────

router.put('/admin/:id/unlock', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.frontendUser.findUnique({ where: { id: req.params.id as string } });
    if (!user) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }

    await prisma.frontendUser.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    res.json({ message: 'User unlocked successfully' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to unlock user' } });
  }
});

// ─── Admin: DELETE /admin/:id — Delete frontend user ─────────────────────────

router.delete('/admin/:id', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.frontendUser.findUnique({ where: { id: req.params.id as string } });
    if (!user) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }

    await prisma.frontendUser.delete({ where: { id: user.id } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' } });
  }
});

export default router;
