import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import {
  getCached,
  setCached,
  invalidateByTags,
  addTagsToKey,
  ARTICLE_TTL,
} from '../lib/cache';
import { generateUniqueSlug } from '../lib/slug';
import { revalidateFrontend } from '../lib/revalidate';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().optional(),
  categoryId: z.string().min(1, 'Category ID is required'),
  featuredImage: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  isBreaking: z.boolean().optional(),
  tagIds: z.array(z.string()).optional(),
});

const updateArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  content: z.string().min(1, 'Content is required').optional(),
  excerpt: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  featuredImage: z.string().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  isBreaking: z.boolean().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  tagIds: z.array(z.string()).optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${prefix}:${sorted}`;
}

const articleInclude = {
  author: { select: { id: true, name: true, slug: true, profileImage: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeArticle(article: any) {
  const { tags, ...rest } = article;
  return {
    ...rest,
    tags: (tags as Array<{ tag: { id: string; name: string; slug: string } }>).map((at) => at.tag),
  };
}


// ─── GET / — Paginated article list ──────────────────────────────────────────

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 10));
    const skip = (page - 1) * pageSize;

    const { category, tag, author, status, dateFrom, dateTo } = req.query;

    // Build cache key
    const cacheKey = buildCacheKey('articles:list', {
      page, pageSize, category, tag, author, status, dateFrom, dateTo,
    });

    const cached = await getCached<{
      data: unknown[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status && typeof status === 'string') {
      where.status = status;
    } else {
      // Default: only published articles for public access
      where.status = 'PUBLISHED';
    }

    if (category && typeof category === 'string') {
      where.category = { slug: category };
    }

    if (author && typeof author === 'string') {
      where.author = { slug: author };
    }

    if (tag && typeof tag === 'string') {
      where.tags = { some: { tag: { slug: tag } } };
    }

    if (dateFrom || dateTo) {
      const publishedAt: Record<string, Date> = {};
      if (dateFrom && typeof dateFrom === 'string') {
        publishedAt.gte = new Date(dateFrom);
      }
      if (dateTo && typeof dateTo === 'string') {
        publishedAt.lte = new Date(dateTo);
      }
      where.publishedAt = publishedAt;
    }

    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: articleInclude,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.article.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    // Flatten tags for response
    const serialized = data.map((article) => serializeArticle(article));

    const result = { data: serialized, total, page, pageSize, totalPages };

    // Cache the result
    await setCached(cacheKey, result, ARTICLE_TTL);
    await addTagsToKey(cacheKey, ['articles']);

    res.json(result);
  } catch (err) {
    console.error('[articles] GET / error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch articles' },
    });
  }
});


// ─── GET /:slug — Single article by slug ─────────────────────────────────────

router.get('/:slug', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const cacheKey = `articles:detail:${slug}`;

    const cached = await getCached<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const article = await prisma.article.findUnique({
      where: { slug },
      include: articleInclude,
    });

    if (!article) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Article not found' },
      });
      return;
    }

    const serialized = serializeArticle(article);

    await setCached(cacheKey, serialized, ARTICLE_TTL);
    await addTagsToKey(cacheKey, ['articles', `article:${article.id}`]);

    res.json(serialized);
  } catch (err) {
    console.error('[articles] GET /:slug error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch article' },
    });
  }
});


// ─── POST / — Create article (Author+ role) ─────────────────────────────────

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createArticleSchema.safeParse(req.body);
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
      const { title, content, excerpt, categoryId, featuredImage, sourceUrl, isBreaking, tagIds } =
        parsed.data;

      // Verify category exists
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        res.status(400).json({
          error: { code: 'INVALID_CATEGORY', message: 'Category not found' },
        });
        return;
      }

      // Generate Tamil slug
      const slug = await generateUniqueSlug(title, 'article');

      const article = await prisma.article.create({
        data: {
          title,
          slug,
          content,
          excerpt: excerpt ?? null,
          status: 'DRAFT',
          isBreaking: isBreaking ?? false,
          featuredImage: featuredImage ?? null,
          sourceUrl: sourceUrl ?? null,
          authorId: req.user!.userId,
          categoryId,
          tags: tagIds?.length
            ? { create: tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
        include: articleInclude,
      });

      const serialized = serializeArticle(article);

      // Invalidate article list cache
      await invalidateByTags(['articles']);
      revalidateFrontend();

      res.status(201).json(serialized);
    } catch (err) {
      console.error('[articles] POST / error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create article' },
      });
    }
  },
);


// ─── PUT /:id — Update article ───────────────────────────────────────────────
// Author can update own articles; Editor+ can update any article.

router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateArticleSchema.safeParse(req.body);
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

      // Fetch existing article
      const existing = await prisma.article.findUnique({
        where: { id },
        include: { category: true },
      });

      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Article not found' },
        });
        return;
      }

      // RBAC: Authors can only update their own articles
      if (req.user!.role === 'AUTHOR' && existing.authorId !== req.user!.userId) {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'You can only update your own articles' },
        });
        return;
      }

      const { title, content, excerpt, categoryId, featuredImage, sourceUrl, isBreaking, status, tagIds } =
        parsed.data;

      // Verify category if changing
      if (categoryId && categoryId !== existing.categoryId) {
        const category = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!category) {
          res.status(400).json({
            error: { code: 'INVALID_CATEGORY', message: 'Category not found' },
          });
          return;
        }
      }

      // Regenerate slug if title changed
      let newSlug: string | undefined;
      if (title && title !== existing.title) {
        newSlug = await generateUniqueSlug(title, 'article');
      }

      // Handle publish: set publishedAt when transitioning to PUBLISHED
      let publishedAt: Date | undefined;
      const isPublishing = status === 'PUBLISHED' && existing.status !== 'PUBLISHED';
      if (isPublishing) {
        publishedAt = new Date();
      }

      // Update tags if provided
      if (tagIds !== undefined) {
        // Remove existing tags and re-create
        await prisma.articleTag.deleteMany({ where: { articleId: id } });
      }

      const article = await prisma.article.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(newSlug && { slug: newSlug }),
          ...(content !== undefined && { content }),
          ...(excerpt !== undefined && { excerpt }),
          ...(categoryId !== undefined && { categoryId }),
          ...(featuredImage !== undefined && { featuredImage }),
          ...(sourceUrl !== undefined && { sourceUrl }),
          ...(isBreaking !== undefined && { isBreaking }),
          ...(status !== undefined && { status }),
          ...(publishedAt !== undefined && { publishedAt }),
          ...(tagIds !== undefined && tagIds.length > 0 && {
            tags: { create: tagIds.map((tagId) => ({ tagId })) },
          }),
        },
        include: articleInclude,
      });

      const serialized = serializeArticle(article);

      // Invalidate caches
      const cacheTags = ['articles', `article:${id}`];
      if (isPublishing) {
        cacheTags.push('home', `category:${article.categoryId}`);
      }
      await invalidateByTags(cacheTags);
      revalidateFrontend();

      res.json(serialized);
    } catch (err) {
      console.error('[articles] PUT /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update article' },
      });
    }
  },
);


// ─── DELETE /:id — Delete article (Editor+ role) ─────────────────────────────

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.article.findUnique({ where: { id } });

      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Article not found' },
        });
        return;
      }

      await prisma.article.delete({ where: { id } });

      // Invalidate caches
      await invalidateByTags([
        'articles',
        `article:${id}`,
        'home',
        `category:${existing.categoryId}`,
      ]);
      revalidateFrontend();

      res.json({ message: 'Article deleted successfully' });
    } catch (err) {
      console.error('[articles] DELETE /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete article' },
      });
    }
  },
);

export default router;
