import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

interface SitemapEntry {
  url: string;
  lastModified: string;
  changeFrequency: string;
  priority: number;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [articles, categories, tags, authors] = await Promise.all([
      prisma.article.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.category.findMany({
        select: { slug: true, updatedAt: true },
      }),
      prisma.tag.findMany({
        select: { slug: true, createdAt: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ['AUTHOR', 'EDITOR', 'ADMIN'] } },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    const entries: SitemapEntry[] = [
      // Home page
      { url: SITE_URL, lastModified: new Date().toISOString(), changeFrequency: 'hourly', priority: 1.0 },
      // Articles
      ...articles.map((a) => ({
        url: `${SITE_URL}/news/${a.slug}`,
        lastModified: a.updatedAt.toISOString(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
      // Categories
      ...categories.map((c) => ({
        url: `${SITE_URL}/category/${c.slug}`,
        lastModified: c.updatedAt.toISOString(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      // Tags
      ...tags.map((t) => ({
        url: `${SITE_URL}/tag/${t.slug}`,
        lastModified: t.createdAt.toISOString(),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
      // Authors
      ...authors.map((a) => ({
        url: `${SITE_URL}/author/${a.slug}`,
        lastModified: a.updatedAt.toISOString(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ];

    res.json(entries);
  } catch (err) {
    console.error('[sitemap] GET / error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate sitemap' },
    });
  }
});

export default router;
