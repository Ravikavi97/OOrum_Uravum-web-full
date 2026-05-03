import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import { createAdminNotification } from '../lib/notify';

const router = Router();

// ─── Prohibited keyword filter ───────────────────────────────────────────────

const PROHIBITED_KEYWORDS = [
  'spam', 'scam', 'viagra', 'casino', 'porn', 'xxx',
  'abuse', 'hate', 'kill', 'threat', 'bomb',
];

function containsProhibitedContent(text: string): boolean {
  const lower = text.toLowerCase();
  return PROHIBITED_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const submitCommentSchema = z.object({
  articleId: z.string().min(1, 'Article ID is required'),
  displayName: z.string().min(1, 'Display name is required'),
  email: z.string().email('Valid email is required'),
  content: z.string().min(1, 'Comment content is required'),
});

// ─── POST / — Submit comment (public) ────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const parsed = submitCommentSchema.safeParse(req.body);
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
    const { articleId, displayName, email, content } = parsed.data;

    // Verify article exists
    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (!article) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Article not found' },
      });
      return;
    }

    // Keyword filter: flag if prohibited content detected
    const isFlagged = containsProhibitedContent(content);

    const comment = await prisma.comment.create({
      data: {
        displayName,
        email,
        content,
        status: isFlagged ? 'FLAGGED' : 'PENDING',
        articleId,
      },
    });

    // Notify admin
    createAdminNotification({
      type: 'comment_pending',
      title: 'புதிய கருத்து',
      message: `${displayName} posted a comment${isFlagged ? ' (FLAGGED)' : ''}`,
      link: '/comments',
    });

    res.status(201).json(comment);
  } catch (err) {
    console.error('[comments] POST / error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit comment' },
    });
  }
});

// ─── GET /admin/all — List all comments for admin moderation ─────────────────

router.get(
  '/admin/all',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 10));
      const skip = (page - 1) * pageSize;

      const status = req.query.status as string | undefined;
      const validStatuses = ['PENDING', 'FLAGGED', 'APPROVED', 'REJECTED'];
      const where = status && validStatuses.includes(status) ? { status: status as any } : {};

      const [data, total] = await Promise.all([
        prisma.comment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            article: {
              select: { title: true },
            },
          },
        }),
        prisma.comment.count({ where }),
      ]);

      res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (err) {
      console.error('[comments] GET /admin/all error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch comments' },
      });
    }
  },
);

// ─── GET /:articleId — Get approved comments for article, paginated ──────────

router.get('/:articleId', async (req: Request, res: Response) => {
  try {
    const articleId = req.params.articleId as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.comment.findMany({
        where: { articleId, status: 'APPROVED' },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.comment.count({ where: { articleId, status: 'APPROVED' } }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    res.json({ data, total, page, pageSize, totalPages });
  } catch (err) {
    console.error('[comments] GET /:articleId error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch comments' },
    });
  }
});

// ─── PUT /:id/approve — Approve comment (Editor+ role) ──────────────────────

router.put(
  '/:id/approve',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.comment.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Comment not found' },
        });
        return;
      }

      const comment = await prisma.comment.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      res.json(comment);
    } catch (err) {
      console.error('[comments] PUT /:id/approve error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to approve comment' },
      });
    }
  },
);

// ─── PUT /:id/reject — Reject comment (Editor+ role) ────────────────────────

router.put(
  '/:id/reject',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.comment.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Comment not found' },
        });
        return;
      }

      const comment = await prisma.comment.update({
        where: { id },
        data: { status: 'REJECTED' },
      });

      res.json(comment);
    } catch (err) {
      console.error('[comments] PUT /:id/reject error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to reject comment' },
      });
    }
  },
);

export default router;
