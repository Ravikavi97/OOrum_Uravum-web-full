import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyToken, AuthPayload } from '../lib/auth';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ─── POST /login ─────────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    return;
  }

  // Check account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    res.status(423).json({
      error: {
        code: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.',
      },
    });
    return;
  }

  // Compare password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    const newFailedCount = user.failedLogins + 1;
    const updateData: { failedLogins: number; lockedUntil?: Date | null } = {
      failedLogins: newFailedCount,
    };

    if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    return;
  }

  // Successful login — reset failed attempts
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null },
  });

  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// ─── POST /refresh ───────────────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { refreshToken } = parsed.data;

  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Server configuration error' },
    });
    return;
  }

  const decoded = verifyToken(refreshToken, refreshSecret);
  if (!decoded) {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
    });
    return;
  }

  // Verify user still exists
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'User no longer exists' },
    });
    return;
  }

  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const newAccessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);

  res.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

// ─── POST /reset-password ────────────────────────────────────────────────────

router.post('/reset-password', async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { email } = parsed.data;

  // Always return success to prevent email enumeration
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Generate a time-limited reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Log the reset request (in production, send email with reset link)
    console.log(`Password reset requested for ${email}. Token: ${resetToken}, Expires: ${resetExpiry.toISOString()}`);
  }

  res.json({
    message: 'If an account with that email exists, a password reset link has been sent.',
  });
});

export default router;
