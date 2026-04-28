import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { generateRssFeed, generateJsonFeed } from '../lib/feed';

const router = Router();

async function getLatestArticles() {
  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      author: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  return articles.map((a) => ({
    ...a,
    tags: a.tags.map((at) => at.tag),
  }));
}

// GET /api/feed/rss — RSS 2.0 XML feed
router.get('/rss', async (_req: Request, res: Response) => {
  try {
    const articles = await getLatestArticles();
    const xml = generateRssFeed(articles);
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error('[feed] GET /rss error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate RSS feed' },
    });
  }
});

// GET /api/feed/json — JSON Feed 1.1
router.get('/json', async (_req: Request, res: Response) => {
  try {
    const articles = await getLatestArticles();
    const json = generateJsonFeed(articles);
    res.set('Content-Type', 'application/feed+json; charset=utf-8');
    res.send(json);
  } catch (err) {
    console.error('[feed] GET /json error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate JSON feed' },
    });
  }
});

export default router;
