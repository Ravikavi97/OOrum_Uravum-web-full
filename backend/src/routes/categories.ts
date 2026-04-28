import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import {
  getCached,
  setCached,
  invalidateByTags,
  addTagsToKey,
  CATEGORY_TTL,
} from '../lib/cache';
import { generateUniqueSlug } from '../lib/slug';
import { revalidateFrontend } from '../lib/revalidate';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

// ─── GET / — List all categories with hierarchy ──────────────────────────────

router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const cacheKey = 'categories:list';

    const cached = await getCached<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const categories = await prisma.category.findMany({
      include: {
        children: { select: { id: true, name: true, slug: true, description: true, parentId: true } },
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { articles: true } },
      },
      orderBy: { name: 'asc' },
    });

    await setCached(cacheKey, categories, CATEGORY_TTL);
    await addTagsToKey(cacheKey, ['categories']);

    res.json(categories);
  } catch (err) {
    console.error('[categories] GET / error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories' },
    });
  }
});


// ─── POST / — Create category (Editor+ role) ────────────────────────────────

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createCategorySchema.safeParse(req.body);
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
      const { name, description, parentId } = parsed.data;

      // Verify parent exists if provided
      if (parentId) {
        const parent = await prisma.category.findUnique({ where: { id: parentId } });
        if (!parent) {
          res.status(400).json({
            error: { code: 'INVALID_PARENT', message: 'Parent category not found' },
          });
          return;
        }
      }

      const slug = await generateUniqueSlug(name, 'category');

      const category = await prisma.category.create({
        data: {
          name,
          slug,
          description: description ?? null,
          parentId: parentId ?? null,
        },
        include: {
          children: { select: { id: true, name: true, slug: true, description: true, parentId: true } },
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { articles: true } },
        },
      });

      // Invalidate category list cache
      await invalidateByTags(['categories']);
      revalidateFrontend();

      res.status(201).json(category);
    } catch (err) {
      console.error('[categories] POST / error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create category' },
      });
    }
  },
);

// ─── PUT /:id — Update category (Editor+ role) ──────────────────────────────

router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateCategorySchema.safeParse(req.body);
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

      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Category not found' },
        });
        return;
      }

      const { name, description, parentId } = parsed.data;

      // Verify parent exists if changing
      if (parentId !== undefined && parentId !== null) {
        // Prevent self-referencing
        if (parentId === id) {
          res.status(400).json({
            error: { code: 'INVALID_PARENT', message: 'Category cannot be its own parent' },
          });
          return;
        }

        const parent = await prisma.category.findUnique({ where: { id: parentId } });
        if (!parent) {
          res.status(400).json({
            error: { code: 'INVALID_PARENT', message: 'Parent category not found' },
          });
          return;
        }
      }

      // Regenerate slug if name changed
      let newSlug: string | undefined;
      if (name && name !== existing.name) {
        newSlug = await generateUniqueSlug(name, 'category');
      }

      const category = await prisma.category.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(newSlug && { slug: newSlug }),
          ...(description !== undefined && { description }),
          ...(parentId !== undefined && { parentId }),
        },
        include: {
          children: { select: { id: true, name: true, slug: true, description: true, parentId: true } },
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { articles: true } },
        },
      });

      // Invalidate caches
      await invalidateByTags(['categories', `category:${id}`]);
      revalidateFrontend();

      res.json(category);
    } catch (err) {
      console.error('[categories] PUT /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update category' },
      });
    }
  },
);

// ─── DELETE /:id — Delete category (Admin only) ─────────────────────────────
// Rejects deletion if articles are associated (Restrict on delete per Req 15.5)

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { articles: true } } },
      });

      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Category not found' },
        });
        return;
      }

      // Reject if articles are associated
      if (existing._count.articles > 0) {
        res.status(409).json({
          error: {
            code: 'HAS_ARTICLES',
            message: `Cannot delete category with ${existing._count.articles} associated article(s). Reassign or delete them first.`,
          },
        });
        return;
      }

      await prisma.category.delete({ where: { id } });

      // Invalidate caches
      await invalidateByTags(['categories', `category:${id}`]);
      revalidateFrontend();

      res.json({ message: 'Category deleted successfully' });
    } catch (err) {
      console.error('[categories] DELETE /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete category' },
      });
    }
  },
);

export default router;
