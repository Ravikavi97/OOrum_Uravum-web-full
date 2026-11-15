import { Prisma } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { getCached, setCached, addTagsToKey, SEARCH_TTL } from '../lib/cache';
import { prisma } from '../lib/prisma';

const router = Router();
const MAX_QUERY_LENGTH = 120;
const MAX_QUERY_TERMS = 8;
const MAX_PAGE_SIZE = 50;

type SearchType = 'article' | 'obituary' | 'video';

interface SearchResult {
  id: string;
  type: SearchType;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: Date | string | null;
}

interface SearchResponse {
  data: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function escapeLikeTerm(term: string): string {
  return term.replace(/[!%_]/g, '!$&');
}

function containsPattern(term: string): string {
  return `%${escapeLikeTerm(term)}%`;
}

function buildArticleTerm(term: string): Prisma.Sql {
  const pattern = containsPattern(term);
  return Prisma.sql`(
    a.title LIKE ${pattern} ESCAPE '!'
    OR a.slug LIKE ${pattern} ESCAPE '!'
    OR a.excerpt LIKE ${pattern} ESCAPE '!'
    OR a.content LIKE ${pattern} ESCAPE '!'
    OR EXISTS (
      SELECT 1 FROM article_tags at2
      JOIN tags t ON t.id = at2.tag_id
      WHERE at2.article_id = a.id
        AND (t.name LIKE ${pattern} ESCAPE '!' OR t.slug LIKE ${pattern} ESCAPE '!')
    )
    OR EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = a.category_id
        AND (c.name LIKE ${pattern} ESCAPE '!' OR c.slug LIKE ${pattern} ESCAPE '!')
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = a.author_id
        AND (u.name LIKE ${pattern} ESCAPE '!' OR u.slug LIKE ${pattern} ESCAPE '!')
    )
  )`;
}

function buildObituaryTerm(term: string): Prisma.Sql {
  const pattern = containsPattern(term);
  return Prisma.sql`(
    o.name LIKE ${pattern} ESCAPE '!'
    OR o.slug LIKE ${pattern} ESCAPE '!'
    OR o.content LIKE ${pattern} ESCAPE '!'
    OR o.first_name LIKE ${pattern} ESCAPE '!'
    OR o.middle_name LIKE ${pattern} ESCAPE '!'
    OR o.surname LIKE ${pattern} ESCAPE '!'
    OR o.other_names LIKE ${pattern} ESCAPE '!'
    OR o.place_of_birth LIKE ${pattern} ESCAPE '!'
    OR o.last_residential_address LIKE ${pattern} ESCAPE '!'
    OR o.father_name LIKE ${pattern} ESCAPE '!'
    OR o.mother_name LIKE ${pattern} ESCAPE '!'
    OR o.spouse_name LIKE ${pattern} ESCAPE '!'
    OR o.brothers_names LIKE ${pattern} ESCAPE '!'
    OR o.sisters_names LIKE ${pattern} ESCAPE '!'
    OR o.father_in_law_name LIKE ${pattern} ESCAPE '!'
    OR o.mother_in_law_name LIKE ${pattern} ESCAPE '!'
    OR o.sons_names LIKE ${pattern} ESCAPE '!'
    OR o.daughters_names LIKE ${pattern} ESCAPE '!'
    OR o.sons_in_law_names LIKE ${pattern} ESCAPE '!'
    OR o.daughters_in_law_names LIKE ${pattern} ESCAPE '!'
    OR o.grandchildren_names LIKE ${pattern} ESCAPE '!'
    OR o.occupations LIKE ${pattern} ESCAPE '!'
    OR o.hobbies_interests LIKE ${pattern} ESCAPE '!'
    OR o.community_activities LIKE ${pattern} ESCAPE '!'
    OR o.other_details LIKE ${pattern} ESCAPE '!'
    OR o.life_story LIKE ${pattern} ESCAPE '!'
  )`;
}

function buildVideoTerm(term: string): Prisma.Sql {
  const pattern = containsPattern(term);
  return Prisma.sql`(
    vp.title LIKE ${pattern} ESCAPE '!'
    OR vp.slug LIKE ${pattern} ESCAPE '!'
    OR vp.description LIKE ${pattern} ESCAPE '!'
    OR EXISTS (
      SELECT 1 FROM video_categories vc
      WHERE vc.id = vp.category_id
        AND (vc.name LIKE ${pattern} ESCAPE '!' OR vc.slug LIKE ${pattern} ESCAPE '!')
    )
  )`;
}

function allTermsMatch(
  terms: string[],
  buildTerm: (term: string) => Prisma.Sql,
): Prisma.Sql {
  return Prisma.join(terms.map(buildTerm), ' AND ');
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const rawQuery = req.query.q;
    if (typeof rawQuery !== 'string') {
      res.status(400).json({
        error: { code: 'INVALID_QUERY', message: 'A valid search query is required' },
      });
      return;
    }

    const normalizedQuery = rawQuery.trim().replace(/\s+/g, ' ');
    const terms = normalizedQuery.split(' ').filter(Boolean);
    if (
      !normalizedQuery
      || normalizedQuery.length > MAX_QUERY_LENGTH
      || terms.length > MAX_QUERY_TERMS
    ) {
      res.status(400).json({
        error: {
          code: 'INVALID_QUERY',
          message: `Search must contain 1-${MAX_QUERY_TERMS} words and be at most ${MAX_QUERY_LENGTH} characters`,
        },
      });
      return;
    }

    const pageParam = typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : 1;
    const pageSizeParam = typeof req.query.pageSize === 'string'
      ? Number.parseInt(req.query.pageSize, 10)
      : 10;
    const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = Number.isSafeInteger(pageSizeParam)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeParam))
      : 10;
    const offset = (page - 1) * pageSize;
    if (!Number.isSafeInteger(offset)) {
      res.status(400).json({
        error: { code: 'INVALID_PAGE', message: 'The requested page is invalid' },
      });
      return;
    }

    const cacheKey = `search:${encodeURIComponent(normalizedQuery.toLocaleLowerCase())}:${page}:${pageSize}`;
    const cached = await getCached<SearchResponse>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const articleWhere = allTermsMatch(terms, buildArticleTerm);
    const obituaryWhere = allTermsMatch(terms, buildObituaryTerm);
    const videoWhere = allTermsMatch(terms, buildVideoTerm);
    const exactPattern = escapeLikeTerm(normalizedQuery);
    const prefixPattern = `${exactPattern}%`;

    const countResult = await prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
      SELECT COUNT(*) AS total
      FROM (
        SELECT a.id FROM articles a
        WHERE a.status = 'PUBLISHED' AND ${articleWhere}
        UNION ALL
        SELECT o.id FROM obituaries o
        WHERE o.status = 'APPROVED' AND ${obituaryWhere}
        UNION ALL
        SELECT vp.id FROM video_posts vp
        WHERE vp.active = 1 AND ${videoWhere}
      ) AS matching_content
    `);

    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / pageSize);
    let rows: SearchResult[] = [];

    if (total > 0) {
      rows = await prisma.$queryRaw<SearchResult[]>(Prisma.sql`
        SELECT
          a.id,
          'article' AS type,
          a.title,
          a.slug,
          COALESCE(a.excerpt, SUBSTRING(a.content, 1, 320)) AS description,
          a.featured_image AS imageUrl,
          a.published_at AS publishedAt,
          CASE
            WHEN a.title LIKE ${exactPattern} ESCAPE '!' THEN 0
            WHEN a.title LIKE ${prefixPattern} ESCAPE '!' THEN 1
            ELSE 2
          END AS relevance
        FROM articles a
        WHERE a.status = 'PUBLISHED' AND ${articleWhere}

        UNION ALL

        SELECT
          o.id,
          'obituary' AS type,
          o.name AS title,
          o.slug,
          SUBSTRING(o.content, 1, 320) AS description,
          CASE
            WHEN o.image_mime_type IS NOT NULL
              THEN CONCAT('/api/obituaries/', o.id, '/image')
            ELSE o.image_url
          END AS imageUrl,
          o.published_at AS publishedAt,
          CASE
            WHEN o.name LIKE ${exactPattern} ESCAPE '!' THEN 0
            WHEN o.name LIKE ${prefixPattern} ESCAPE '!' THEN 1
            ELSE 2
          END AS relevance
        FROM obituaries o
        WHERE o.status = 'APPROVED' AND ${obituaryWhere}

        UNION ALL

        SELECT
          vp.id,
          'video' AS type,
          vp.title,
          vp.slug,
          vp.description,
          vp.thumbnail_url AS imageUrl,
          vp.published_at AS publishedAt,
          CASE
            WHEN vp.title LIKE ${exactPattern} ESCAPE '!' THEN 0
            WHEN vp.title LIKE ${prefixPattern} ESCAPE '!' THEN 1
            ELSE 2
          END AS relevance
        FROM video_posts vp
        WHERE vp.active = 1 AND ${videoWhere}

        ORDER BY relevance ASC, publishedAt DESC, type ASC, id ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `);
    }

    const result: SearchResponse = {
      data: rows.map(({ id, type, title, slug, description, imageUrl, publishedAt }) => ({
        id, type, title, slug, description, imageUrl, publishedAt,
      })),
      total,
      page,
      pageSize,
      totalPages,
    };

    await setCached(cacheKey, result, SEARCH_TTL);
    await addTagsToKey(cacheKey, ['search']);
    res.json(result);
  } catch (err) {
    console.error('[search] GET / error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Search failed' } });
  }
});

export default router;
