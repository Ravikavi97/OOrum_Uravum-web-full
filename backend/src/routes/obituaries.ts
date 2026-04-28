import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import { invalidateByTags } from '../lib/cache';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createObituarySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  content: z.string().min(1, 'Content is required'),
  publishedAt: z.string().datetime().optional(),
});

const updateObituarySchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  content: z.string().min(1, 'Content is required').optional(),
  publishedAt: z.string().datetime().optional(),
});

// ─── Multer setup (memory storage for image bytes) ───────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ─── GET / — List obituaries ─────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 10));
    const offset = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.obituary.findMany({
        orderBy: { publishedAt: 'desc' },
        skip: offset,
        take: pageSize,
        select: { id: true, name: true, content: true, sourceUrl: true, publishedAt: true, createdAt: true },
      }),
      prisma.obituary.count(),
    ]);

    res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error('[obituaries] GET / error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch obituaries' } });
  }
});

// ─── GET /:id/image — Serve obituary image ──────────────────────────────────

router.get('/:id/image', async (req: Request, res: Response) => {
  try {
    const obit = await prisma.obituary.findUnique({
      where: { id: req.params.id as string },
      select: { imageData: true },
    });
    if (!obit?.imageData) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found' } });
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(Buffer.from(obit.imageData));
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch image' } });
  }
});

// ─── POST / — Create obituary (Author+ role) ────────────────────────────────

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  (req: AuthenticatedRequest, res: Response, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum size of 10MB' },
          });
          return;
        }
        res.status(400).json({
          error: { code: 'UPLOAD_ERROR', message: err.message },
        });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createObituarySchema.safeParse(req.body);
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
      const { name, content, publishedAt } = parsed.data;

      const obituary = await prisma.obituary.create({
        data: {
          name,
          content,
          publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
          ...(req.file && { imageData: new Uint8Array(req.file.buffer) }),
        },
        select: { id: true, name: true, content: true, sourceUrl: true, publishedAt: true, createdAt: true },
      });

      // Invalidate obituary caches
      await invalidateByTags(['obituaries']);

      res.status(201).json(obituary);
    } catch (err) {
      console.error('[obituaries] POST / error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create obituary' },
      });
    }
  },
);

// ─── PUT /:id — Update obituary (Author+ role) ──────────────────────────────

router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  (req: AuthenticatedRequest, res: Response, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum size of 10MB' },
          });
          return;
        }
        res.status(400).json({
          error: { code: 'UPLOAD_ERROR', message: err.message },
        });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateObituarySchema.safeParse(req.body);
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

      const existing = await prisma.obituary.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Obituary not found' },
        });
        return;
      }

      const { name, content, publishedAt } = parsed.data;

      const obituary = await prisma.obituary.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(content !== undefined && { content }),
          ...(publishedAt !== undefined && { publishedAt: new Date(publishedAt) }),
          ...(req.file && { imageData: new Uint8Array(req.file.buffer) }),
        },
        select: { id: true, name: true, content: true, sourceUrl: true, publishedAt: true, createdAt: true },
      });

      // Invalidate obituary caches
      await invalidateByTags(['obituaries', `obituary:${id}`]);

      res.json(obituary);
    } catch (err) {
      console.error('[obituaries] PUT /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update obituary' },
      });
    }
  },
);

// ─── DELETE /:id — Delete obituary (Editor+ role) ───────────────────────────

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.obituary.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Obituary not found' },
        });
        return;
      }

      await prisma.obituary.delete({ where: { id } });

      // Invalidate obituary caches
      await invalidateByTags(['obituaries', `obituary:${id}`]);

      res.json({ message: 'Obituary deleted successfully' });
    } catch (err) {
      console.error('[obituaries] DELETE /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete obituary' },
      });
    }
  },
);

export default router;
