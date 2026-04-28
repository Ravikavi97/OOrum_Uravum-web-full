import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getCached, setCached, addTagsToKey, SEARCH_TTL } from '../lib/cache';

const router = Router();

function buildSearchCacheKey(query: string, page: number, pageSize: number): string {
  return `search:${encodeURIComponent(query)}:${page}:${pageSize}`;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string | undefined) ?? '';
    const trimmed = q.trim();

    if (!trimmed) {
      res.status(400).json({
        error: { code: 'INVALID_QUERY', message: 'A valid search query is required' },
      });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 10));
    const offset = (page - 1) * pageSize;

    const cacheKey = buildSearchCacheKey(trimmed, page, pageSize);
    const cached = await getCached<{
      data: unknown[]; total: number; page: number; pageSize: number; totalPages: number;
    }>(cacheKey);
    if (cached) { res.json(cached); return; }

    const likeTerm = `%${trimmed}%`;

    // Use LIKE for broad matching (works with both Tamil and English/slug text)
    const countResult = await prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(DISTINCT a.id) AS total
      FROM articles a
      LEFT JOIN article_tags at2 ON at2.article_id = a.id
      LEFT JOIN tags t ON t.id = at2.tag_id
      LEFT JOIN categories c ON c.id = a.category_id
      LEFT JOIN users u ON u.id = a.author_id
      WHERE a.status = 'PUBLISHED'
        AND (
          a.title LIKE ${likeTerm}
          OR a.slug LIKE ${likeTerm}
          OR a.excerpt LIKE ${likeTerm}
          OR a.content LIKE ${likeTerm}
          OR t.name LIKE ${likeTerm}
          OR t.slug LIKE ${likeTerm}
          OR c.name LIKE ${likeTerm}
          OR c.slug LIKE ${likeTerm}
          OR u.name LIKE ${likeTerm}
          OR u.slug LIKE ${likeTerm}
        )
    `;

    const total = Number(countResult[0].total);
    const totalPages = Math.ceil(total / pageSize);

    const rows = await prisma.$queryRaw<Array<{
      id: string; title: string; slug: string; excerpt: string | null;
      content: string; status: string; is_breaking: number;
      featured_image: string | null; published_at: Date | null;
      created_at: Date; updated_at: Date; author_id: string;
      author_name: string; author_slug: string;
      author_profile_image: string | null; category_id: string;
      category_name: string; category_slug: string;
    }>>`
      SELECT
        a.id, a.title, a.slug, a.excerpt, a.content, a.status,
        a.is_breaking, a.featured_image, a.published_at,
        a.created_at, a.updated_at, a.author_id,
        u.name AS author_name, u.slug AS author_slug,
        u.profile_image AS author_profile_image,
        c.id AS category_id, c.name AS category_name, c.slug AS category_slug
      FROM articles a
      JOIN users u ON u.id = a.author_id
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN article_tags at2 ON at2.article_id = a.id
      LEFT JOIN tags t ON t.id = at2.tag_id
      WHERE a.status = 'PUBLISHED'
        AND (
          a.title LIKE ${likeTerm}
          OR a.slug LIKE ${likeTerm}
          OR a.excerpt LIKE ${likeTerm}
          OR a.content LIKE ${likeTerm}
          OR t.name LIKE ${likeTerm}
          OR t.slug LIKE ${likeTerm}
          OR c.name LIKE ${likeTerm}
          OR c.slug LIKE ${likeTerm}
          OR u.name LIKE ${likeTerm}
          OR u.slug LIKE ${likeTerm}
        )
      GROUP BY a.id
      ORDER BY a.published_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const articleIds = rows.map((r) => r.id);
    let tagsByArticle: Record<string, Array<{ id: string; name: string; slug: string }>> = {};
    if (articleIds.length > 0) {
      const tagRows = await prisma.articleTag.findMany({
        where: { articleId: { in: articleIds } },
        include: { tag: { select: { id: true, name: true, slug: true } } },
      });
      for (const tr of tagRows) {
        if (!tagsByArticle[tr.articleId]) tagsByArticle[tr.articleId] = [];
        tagsByArticle[tr.articleId].push(tr.tag);
      }
    }

    const data = rows.map((row) => ({
      id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt,
      status: row.status, isBreaking: Boolean(row.is_breaking),
      featuredImage: row.featured_image, publishedAt: row.published_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
      author: { id: row.author_id, name: row.author_name, slug: row.author_slug, profileImage: row.author_profile_image },
      category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
      tags: tagsByArticle[row.id] ?? [],
    }));

    const result = { data, total, page, pageSize, totalPages };
    await setCached(cacheKey, result, SEARCH_TTL);
    await addTagsToKey(cacheKey, ['search']);
    res.json(result);
  } catch (err) {
    console.error('[search] GET / error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Search failed' } });
  }
});

export default router;
