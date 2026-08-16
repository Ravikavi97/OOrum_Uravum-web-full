import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import { generateUniqueSlug } from '../lib/slug';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.string().min(1).max(50).optional(),
  bio: z.string().optional(),
  profileImage: z.string().optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(1).optional(),
  role: z.string().min(1).max(50).optional(),
  bio: z.string().nullable().optional(),
  profileImage: z.string().nullable().optional(),
  socialLinks: z.record(z.string(), z.string()).nullable().optional(),
});

const BCRYPT_COST = 10;

// ─── POST / — Create user (Admin only) ──────────────────────────────────────

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      });
      return;
    }

    try {
      const { email, password, name, role, bio, profileImage, socialLinks } = parsed.data;

      // Check for duplicate email
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({
          error: { code: 'DUPLICATE_EMAIL', message: 'A user with this email already exists' },
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const slug = await generateUniqueSlug(name, 'user');

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          slug,
          role: role ?? 'AUTHOR',
          bio: bio ?? null,
          profileImage: profileImage ?? null,
          // Prisma v6: nullable JSON field requires Prisma.JsonNull instead of null
          socialLinks: socialLinks === undefined ? undefined : (socialLinks === null ? Prisma.JsonNull : socialLinks),
        },
        select: {
          id: true, email: true, name: true, slug: true, role: true,
          bio: true, profileImage: true, socialLinks: true, createdAt: true, updatedAt: true,
        },
      });

      res.status(201).json(user);
    } catch (err) {
      console.error('[users] POST / error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create user' },
      });
    }
  },
);

// ─── GET / — List users (Admin only), paginated ─────────────────────────────

router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 10));
      const skip = (page - 1) * pageSize;

      const [data, total] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true, email: true, name: true, slug: true, role: true,
            bio: true, profileImage: true, socialLinks: true, createdAt: true, updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.user.count(),
      ]);

      const totalPages = Math.ceil(total / pageSize);
      res.json({ data, total, page, pageSize, totalPages });
    } catch (err) {
      console.error('[users] GET / error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch users' },
      });
    }
  },
);

// ─── PUT /:id — Update user (Admin only) ────────────────────────────────────

router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      });
      return;
    }

    try {
      const id = req.params.id as string;

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
        return;
      }

      const { email, password, name, role, bio, profileImage, socialLinks } = parsed.data;

      // Check email uniqueness if changing
      if (email && email !== existing.email) {
        const dup = await prisma.user.findUnique({ where: { email } });
        if (dup) {
          res.status(409).json({
            error: { code: 'DUPLICATE_EMAIL', message: 'A user with this email already exists' },
          });
          return;
        }
      }

      let newSlug: string | undefined;
      if (name && name !== existing.name) {
        newSlug = await generateUniqueSlug(name, 'user');
      }

      let passwordHash: string | undefined;
      if (password) {
        passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(email !== undefined && { email }),
          ...(passwordHash && { passwordHash }),
          ...(name !== undefined && { name }),
          ...(newSlug && { slug: newSlug }),
          ...(role !== undefined && { role }),
          ...(bio !== undefined && { bio }),
          ...(profileImage !== undefined && { profileImage }),
          ...(socialLinks !== undefined && { socialLinks: socialLinks === null ? Prisma.JsonNull : socialLinks }),
        },
        select: {
          id: true, email: true, name: true, slug: true, role: true,
          bio: true, profileImage: true, socialLinks: true, createdAt: true, updatedAt: true,
        },
      });

      res.json(user);
    } catch (err) {
      console.error('[users] PUT /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' },
      });
    }
  },
);

// ─── DELETE /:id — Delete user (Admin only) ──────────────────────────────────

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.user.findUnique({
        where: { id },
        include: { _count: { select: { articles: true } } },
      });

      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
        return;
      }

      // Prevent deleting users with articles (referential integrity)
      if (existing._count.articles > 0) {
        res.status(409).json({
          error: {
            code: 'HAS_ARTICLES',
            message: `Cannot delete user with ${existing._count.articles} associated article(s). Reassign or delete them first.`,
          },
        });
        return;
      }

      await prisma.user.delete({ where: { id } });

      res.json({ message: 'User deleted successfully' });
    } catch (err) {
      console.error('[users] DELETE /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' },
      });
    }
  },
);

export default router;
