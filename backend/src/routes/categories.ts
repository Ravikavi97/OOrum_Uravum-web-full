import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import {
  getCached,
  setCached,
  invalidateByTags,
  addTagsToKey,
  CATEGORY_TTL,
} from '../lib/cache';
import { generateUniqueSlug, isValidSlug } from '../lib/slug';
import { revalidateFrontend } from '../lib/revalidate';
import { CATEGORY_ICON_KEYS, isCategoryIconKey } from '../lib/categoryIcons';
import { storeCategoryIcon, isValidIconUrl } from '../lib/categoryIconUpload';
import { isValidPath } from '../lib/path';

const router = Router();

const UPLOAD_PATH = process.env.MEDIA_UPLOAD_PATH;
if (!UPLOAD_PATH) {
  throw new Error('MEDIA_UPLOAD_PATH environment variable is not set');
}

const iconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024, files: 1 },
});

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const iconUrlSchema = z
  .string()
  .max(500)
  .refine(isValidIconUrl, { message: 'Icon URL must be an uploaded icon or an http(s) URL' });

const iconKeySchema = z
  .string()
  .refine(isCategoryIconKey, { message: 'Unknown icon key' });

const slugSchema = z
  .string()
  .min(1, 'Slug cannot be empty')
  .max(100, 'Slug is too long')
  .refine(isValidSlug, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
  .optional();

const pathSchema = z
  .string()
  .max(100, 'Path is too long')
  .refine(isValidPath, { message: 'Path must start with / and contain only lowercase letters, numbers, and hyphens' })
  .optional()
  .nullable();

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  iconUrl: iconUrlSchema.optional().nullable(),
  iconKey: iconKeySchema.optional().nullable(),
  slug: slugSchema,
  path: pathSchema,
});

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  iconUrl: iconUrlSchema.optional().nullable(),
  iconKey: iconKeySchema.optional().nullable(),
  slug: slugSchema,
  path: pathSchema,
});

// ─── GET / — List all categories with hierarchy ───────────────────────────────

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
        children: { select: { id: true, name: true, slug: true, description: true, parentId: true, iconUrl: true, iconKey: true } },
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


// ─── GET /with-latest — Categories with their latest published article ────────

router.get('/with-latest', async (req: Request, res: Response) => {
  try {
    const rootOnly = req.query.rootOnly !== 'false';
    const cacheKey = `categories:with-latest:${rootOnly ? 'root' : 'all'}`;

    const cached = await getCached<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const categories = await prisma.category.findMany({
      where: rootOnly ? { parentId: null } : undefined,
      select: { id: true, name: true, slug: true, description: true, iconUrl: true, iconKey: true },
      orderBy: { name: 'asc' },
    });

    // Fetch all latest articles in a single query to avoid N+1
    const categoryIds = categories.map((c) => c.id);
    const latestArticles = await prisma.article.findMany({
      where: {
        categoryId: { in: categoryIds },
        status: 'PUBLISHED',
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        publishedAt: true,
        categoryId: true,
      },
    });

    // Create a map of categoryId -> latest article
    const articleMap = new Map<string, typeof latestArticles[0]>();
    for (const article of latestArticles) {
      if (!articleMap.has(article.categoryId)) {
        articleMap.set(article.categoryId, article);
      }
    }

    // Map articles to categories
    const withLatest = categories.map((cat) => ({
      ...cat,
      article: articleMap.get(cat.id) || null,
    }));

    await setCached(cacheKey, withLatest, CATEGORY_TTL);
    await addTagsToKey(cacheKey, ['categories', 'articles']);

    res.json(withLatest);
  } catch (err) {
    console.error('[categories] GET /with-latest error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories with latest article' },
    });
  }
});


// ─── GET /meta/icons — Built-in icon keys for the dashboard picker ────────────

router.get('/meta/icons', (_req: Request, res: Response) => {
  res.json({ icons: CATEGORY_ICON_KEYS });
});

// ─── POST /icon — Upload a category icon (Editor+ role) ───────────────────────
//
// Returns { url, width, height }. The stored file is always a sanitized,
// rasterized PNG — see lib/categoryIconUpload.ts.

router.post(
  '/icon',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  (req: AuthenticatedRequest, res: Response, next) => {
    iconUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: { code: 'FILE_TOO_LARGE', message: 'Icon must be smaller than 512KB' },
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
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      if (!_req.file) {
        res.status(400).json({
          error: { code: 'NO_FILE', message: 'No file provided' },
        });
        return;
      }

      const stored = await storeCategoryIcon(_req.file.buffer, UPLOAD_PATH);
      res.status(201).json(stored);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process icon';
      console.error('[categories] POST /icon error:', err);
      res.status(400).json({
        error: { code: 'INVALID_ICON', message },
      });
    }
  },
);


// ─── POST / — Create category (Editor+ role) ──────────────────────────────────

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
      const { name, description, parentId, iconUrl, iconKey, slug: customSlug, path: customPath } = parsed.data;

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

      // Use custom slug if provided, otherwise generate from name
      let slug: string;
      if (customSlug) {
        // Check if custom slug already exists
        const existing = await prisma.category.findUnique({ where: { slug: customSlug } });
        if (existing) {
          res.status(400).json({
            error: { code: 'SLUG_EXISTS', message: 'A category with this slug already exists' },
          });
          return;
        }
        slug = customSlug;
      } else {
        slug = await generateUniqueSlug(name, 'category');
      }

      const category = await prisma.category.create({
        data: {
          name,
          slug,
          path: customPath ?? null,
          description: description ?? null,
          parentId: parentId ?? null,
          iconUrl: iconUrl ?? null,
          iconKey: iconKey ?? null,
        },
        include: {
          children: { select: { id: true, name: true, slug: true, description: true, parentId: true, iconUrl: true, iconKey: true } },
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

// ─── PUT /:id — Update category (Editor+ role) ────────────────────────────────

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

const { name, description, parentId, iconUrl, iconKey, slug: customSlug, path: customPath } = parsed.data;

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

      // Handle slug changes
      let newSlug: string | undefined;
      if (customSlug !== undefined) {
        // Custom slug provided - validate uniqueness
        if (customSlug !== existing.slug) {
          const existingWithSlug = await prisma.category.findUnique({ where: { slug: customSlug } });
          if (existingWithSlug && existingWithSlug.id !== id) {
            res.status(400).json({
              error: { code: 'SLUG_EXISTS', message: 'A category with this slug already exists' },
            });
            return;
          }
          newSlug = customSlug;
        }
      } else if (name && name !== existing.name) {
        // Name changed without custom slug - regenerate from name
        newSlug = await generateUniqueSlug(name, 'category');
      }

      // Handle path changes - validate uniqueness
      let newPath: string | null | undefined;
      if (customPath !== undefined) {
        if (customPath !== existing.path) {
          const existingWithPath = await prisma.category.findUnique({ where: { path: customPath! } });
          if (existingWithPath && existingWithPath.id !== id) {
            res.status(400).json({
              error: { code: 'PATH_EXISTS', message: 'A category with this custom path already exists' },
            });
            return;
          }
          newPath = customPath;
        }
      }

      const category = await prisma.category.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(newSlug && { slug: newSlug }),
          ...(customPath !== undefined && { path: customPath }),
          ...(description !== undefined && { description }),
          ...(parentId !== undefined && { parentId }),
          ...(iconUrl !== undefined && { iconUrl }),
          ...(iconKey !== undefined && { iconKey }),
        },
        include: {
          children: { select: { id: true, name: true, slug: true, description: true, parentId: true, iconUrl: true, iconKey: true } },
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

// ─── DELETE /:id — Delete category (Admin only) ───────────────────────────────
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
