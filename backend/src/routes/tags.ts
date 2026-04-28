import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import {
  getCached,
  setCached,
  invalidateByTags,
  addTagsToKey,
  TAG_TTL,
} from '../lib/cache';
import { generateUniqueSlug } from '../lib/slug';
import { revalidateFrontend } from '../lib/revalidate';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const updateTagSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
});

// ─── GET / — List all tags ───────────────────────────────────────────────────

router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const cacheKey = 'tags:list';

    const cached = await getCached<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const tags = await prisma.tag.findMany({
      include: {
        _count: { select: { articles: true } },
      },
      orderBy: { name: 'asc' },
    });

    await setCached(cacheKey, tags, TAG_TTL);
    await addTagsToKey(cacheKey, ['tags']);

    res.json(tags);
  } catch (err) {
    console.error('[tags] GET / error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tags' },
    });
  }
});

// ─── POST / — Create tag (Editor+ role) ─────────────────────────────────────

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createTagSchema.safeParse(req.body);
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
      const { name } = parsed.data;

      const slug = await generateUniqueSlug(name, 'tag');

      const tag = await prisma.tag.create({
        data: { name, slug },
        include: {
          _count: { select: { articles: true } },
        },
      });

      // Invalidate tag list cache
      await invalidateByTags(['tags']);
      revalidateFrontend();

      res.status(201).json(tag);
    } catch (err) {
      console.error('[tags] POST / error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create tag' },
      });
    }
  },
);

// ─── PUT /:id — Update tag (Editor+ role) ───────────────────────────────────

router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateTagSchema.safeParse(req.body);
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

      const existing = await prisma.tag.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Tag not found' },
        });
        return;
      }

      const { name } = parsed.data;

      // Regenerate slug if name changed
      let newSlug: string | undefined;
      if (name && name !== existing.name) {
        newSlug = await generateUniqueSlug(name, 'tag');
      }

      const tag = await prisma.tag.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(newSlug && { slug: newSlug }),
        },
        include: {
          _count: { select: { articles: true } },
        },
      });

      // Invalidate caches
      await invalidateByTags(['tags', `tag:${id}`]);
      revalidateFrontend();

      res.json(tag);
    } catch (err) {
      console.error('[tags] PUT /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update tag' },
      });
    }
  },
);

// ─── DELETE /:id — Delete tag (Editor+ role) ────────────────────────────────

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.tag.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Tag not found' },
        });
        return;
      }

      await prisma.tag.delete({ where: { id } });

      // Invalidate caches
      await invalidateByTags(['tags', `tag:${id}`]);
      revalidateFrontend();

      res.json({ message: 'Tag deleted successfully' });
    } catch (err) {
      console.error('[tags] DELETE /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete tag' },
      });
    }
  },
);

export default router;
