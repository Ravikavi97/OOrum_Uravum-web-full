import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import { generateUniqueSlug } from '../lib/slug';

const router = Router();

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const ingestArticleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().optional(),
  sourceUrl: z.string().url('Valid source URL is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  authorId: z.string().min(1, 'Author ID is required'),
  tagIds: z.array(z.string()).optional(),
  featuredImage: z.string().optional(),
  isBreaking: z.boolean().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

// ─── POST / — Ingest article (Admin only) ────────────────────────────────────

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = ingestArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      // Log validation failure
      const sourceUrl = req.body?.sourceUrl || 'unknown';
      await logIngestion(sourceUrl, 'failure', `Validation error: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      });
      return;
    }

    const { title, content, excerpt, sourceUrl, categoryId, authorId, tagIds, featuredImage, isBreaking, status } =
      parsed.data;

    try {
      // Check for duplicates by sourceUrl
      const dupByUrl = await prisma.article.findUnique({ where: { sourceUrl } });
      if (dupByUrl) {
        await logIngestion(sourceUrl, 'failure', 'Duplicate: article with this sourceUrl already exists');
        res.status(409).json({
          error: { code: 'DUPLICATE_SOURCE_URL', message: 'An article with this source URL already exists' },
        });
        return;
      }

      // Check for duplicates by title
      const dupByTitle = await prisma.article.findFirst({ where: { title } });
      if (dupByTitle) {
        await logIngestion(sourceUrl, 'failure', `Duplicate: article with title "${title}" already exists`);
        res.status(409).json({
          error: { code: 'DUPLICATE_TITLE', message: 'An article with this title already exists' },
        });
        return;
      }

      // Verify category exists
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        await logIngestion(sourceUrl, 'failure', `Category not found: ${categoryId}`);
        res.status(400).json({
          error: { code: 'INVALID_CATEGORY', message: 'Category not found' },
        });
        return;
      }

      // Verify author exists
      const author = await prisma.user.findUnique({ where: { id: authorId } });
      if (!author) {
        await logIngestion(sourceUrl, 'failure', `Author not found: ${authorId}`);
        res.status(400).json({
          error: { code: 'INVALID_AUTHOR', message: 'Author not found' },
        });
        return;
      }

      const slug = await generateUniqueSlug(title, 'article');
      const isPublished = status === 'PUBLISHED';

      const article = await prisma.article.create({
        data: {
          title,
          slug,
          content,
          excerpt: excerpt ?? null,
          sourceUrl,
          status: status ?? 'DRAFT',
          isBreaking: isBreaking ?? false,
          featuredImage: featuredImage ?? null,
          publishedAt: isPublished ? new Date() : null,
          authorId,
          categoryId,
          tags: tagIds?.length
            ? { create: tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
        include: {
          author: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        },
      });

      await logIngestion(sourceUrl, 'success', `Article created: ${article.id}`);

      res.status(201).json(article);
    } catch (err) {
      console.error('[ingest] POST / error:', err);
      await logIngestion(parsed.data.sourceUrl, 'failure', `Internal error: ${(err as Error).message}`);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to ingest article' },
      });
    }
  },
);

// ─── Ingestion logging helper ────────────────────────────────────────────────

async function logIngestion(sourceUrl: string, status: string, message: string): Promise<void> {
  try {
    await prisma.ingestionLog.create({
      data: { sourceUrl, status, message },
    });
  } catch (err) {
    console.error('[ingest] Failed to write ingestion log:', err);
  }
}

export default router;
