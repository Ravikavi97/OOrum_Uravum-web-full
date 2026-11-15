import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockQueryRaw = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

const mockGetCached = vi.fn();
const mockSetCached = vi.fn();
const mockAddTagsToKey = vi.fn();

vi.mock('../lib/cache', () => ({
  getCached: (...args: unknown[]) => mockGetCached(...args),
  setCached: (...args: unknown[]) => mockSetCached(...args),
  addTagsToKey: (...args: unknown[]) => mockAddTagsToKey(...args),
  SEARCH_TTL: 120,
}));

import searchRouter from './search';

function createApp() {
  const app = express();
  app.use('/api/search', searchRouter);
  return app;
}

const publishedAt = new Date('2026-01-15T12:00:00.000Z');

const sampleRows = [
  {
    id: 'article-1',
    type: 'article',
    title: 'தமிழ் செய்திகள்',
    slug: 'tamil-news',
    description: 'A Tamil news excerpt',
    imageUrl: '/uploads/news.jpg',
    publishedAt,
    relevance: 0,
  },
  {
    id: 'obituary-1',
    type: 'obituary',
    title: 'தமிழ் குடும்ப அஞ்சலி',
    slug: 'tamil-family',
    description: 'Obituary details',
    imageUrl: null,
    publishedAt,
    relevance: 1,
  },
  {
    id: 'video-1',
    type: 'video',
    title: 'தமிழ் காணொளி',
    slug: 'tamil-video',
    description: 'Video description',
    imageUrl: 'https://example.com/video.jpg',
    publishedAt,
    relevance: 2,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCached.mockResolvedValue(null);
  mockSetCached.mockResolvedValue(undefined);
  mockAddTagsToKey.mockResolvedValue(undefined);
});

describe('GET /api/search', () => {
  it.each([
    ['/api/search', 'missing query'],
    ['/api/search?q=', 'empty query'],
    ['/api/search?q=%20%20%20', 'whitespace query'],
    ['/api/search?q=one+two+three+four+five+six+seven+eight+nine', 'too many terms'],
    [`/api/search?q=${'a'.repeat(121)}`, 'query that is too long'],
  ])('returns 400 for a %s', async (path) => {
    const res = await request(createApp()).get(path);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('returns articles, approved obituaries, and active videos in one paginated result', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: BigInt(3) }]);
    mockQueryRaw.mockResolvedValueOnce(sampleRows);

    const res = await request(createApp()).get('/api/search?q=தமிழ்');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 3,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });
    expect(res.body.data.map((item: { type: string }) => item.type)).toEqual([
      'article',
      'obituary',
      'video',
    ]);
    expect(res.body.data[0]).toMatchObject({
      id: 'article-1',
      title: 'தமிழ் செய்திகள்',
      slug: 'tamil-news',
    });

    const countSql = mockQueryRaw.mock.calls[0][0] as { sql: string };
    expect(countSql.sql).toContain("a.status = 'PUBLISHED'");
    expect(countSql.sql).toContain("o.status = 'APPROVED'");
    expect(countSql.sql).toContain('vp.active = 1');
  });

  it('normalizes whitespace and case in the search cache key', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: BigInt(0) }]);

    const res = await request(createApp()).get('/api/search?q=News%20%20UPDATE');

    expect(res.status).toBe(200);
    expect(mockSetCached).toHaveBeenCalledWith(
      'search:news%20update:1:10',
      expect.objectContaining({ total: 0, page: 1, pageSize: 10 }),
      120,
    );
    expect(mockAddTagsToKey).toHaveBeenCalledWith('search:news%20update:1:10', ['search']);
  });

  it('respects page parameters and caps page size', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: BigInt(25) }]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const res = await request(createApp()).get('/api/search?q=test&page=2&pageSize=500');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(50);
    expect(res.body.total).toBe(25);
    expect(res.body.totalPages).toBe(1);
  });

  it('returns cached results without querying the database', async () => {
    const cachedResult = JSON.parse(JSON.stringify({
      data: sampleRows,
      total: 3,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }));
    mockGetCached.mockResolvedValue(cachedResult);

    const res = await request(createApp()).get('/api/search?q=cached');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedResult);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('returns an empty result set for no matches', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: BigInt(0) }]);

    const res = await request(createApp()).get('/api/search?q=nonexistent');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(0);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on a database error', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('DB connection failed'));

    const res = await request(createApp()).get('/api/search?q=error');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
