import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  getCached,
  setCached,
  addTagsToKey,
  AUTHOR_TTL,
} from '../lib/cache';

const router = Router();

// Fields to return for public author profiles (no passwordHash)
const authorSelect = {
  id: true,
  name: true,
  slug: true,
  role: true,
  bio: true,
  profileImage: true,
  socialLinks: true,
  createdAt: true,
} as const;

// ─── GET / — List all authors (users with AUTHOR, EDITOR, or ADMIN roles) ───

router.get('/', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'authors:list';

    const cached = await getCached<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const authors = await prisma.user.findMany({
      where: {
        role: { in: ['AUTHOR', 'EDITOR', 'ADMIN'] },
      },
      select: {
        ...authorSelect,
        _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
      },
      orderBy: { name: 'asc' },
    });

    await setCached(cacheKey, authors, AUTHOR_TTL);
    await addTagsToKey(cacheKey, ['authors']);

    res.json(authors);
  } catch (err) {
    console.error('[authors] GET / error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch authors' },
    });
  }
});


// ─── GET /:slug — Author profile with published article count ────────────────

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const cacheKey = `authors:detail:${slug}`;

    const cached = await getCached<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const author = await prisma.user.findUnique({
      where: { slug },
      select: {
        ...authorSelect,
        _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
      },
    });

    if (!author) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Author not found' },
      });
      return;
    }

    await setCached(cacheKey, author, AUTHOR_TTL);
    await addTagsToKey(cacheKey, ['authors', `author:${author.id}`]);

    res.json(author);
  } catch (err) {
    console.error('[authors] GET /:slug error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch author' },
    });
  }
});

export default router;
