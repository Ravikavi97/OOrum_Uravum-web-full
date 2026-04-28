import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockQueryRaw = vi.fn();
const mockArticleTagFindMany = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: any[]) => mockQueryRaw(...args),
    articleTag: {
      findMany: (...args: any[]) => mockArticleTagFindMany(...args),
    },
  },
}));

const mockGetCached = vi.fn();
const mockSetCached = vi.fn();
const mockAddTagsToKey = vi.fn();

vi.mock('../lib/cache', () => ({
  getCached: (...args: any[]) => mockGetCached(...args),
  setCached: (...args: any[]) => mockSetCached(...args),
  addTagsToKey: (...args: any[]) => mockAddTagsToKey(...args),
  SEARCH_TTL: 120,
}));

// ─── Test App Setup ──────────────────────────────────────────────────────────

import searchRouter from './search';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/search', searchRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();

const sampleRow = {
  id: 'art-1',
  title: 'தமிழ் செய்தி',
  slug: 'tamil-seithi',
  excerpt: 'A Tamil news excerpt',
  content: 'Full content here',
  status: 'PUBLISHED',
  is_breaking: 0,
  featured_image: null,
  published_at: now,
  created_at: now,
  updated_at: now,
  relevance: 1.5,
  author_id: 'user-1',
  author_name: 'Author One',
  author_slug: 'author-one',
  author_profile_image: null,
  category_id: 'cat-1',
  category_name: 'அரசியல்',
  category_slug: 'arasiyal',
};

const sampleTag = {
  articleId: 'art-1',
  tagId: 'tag-1',
  tag: { id: 'tag-1', name: 'செய்தி', slug: 'seithi' },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCached.mockResolvedValue(null);
  mockSetCached.mockResolvedValue(undefined);
  mockAddTagsToKey.mockResolvedValue(undefined);
});

describe('GET /api/search', () => {
  // ─── Validation ──────────────────────────────────────────────────────

  it('returns 400 when query is missing', async () => {
    const app = createApp();
    const res = await request(app).get('/api/search');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });

  it('returns 400 when query is empty string', async () => {
    const app = createApp();
    const res = await request(app).get('/api/search?q=');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });

  it('returns 400 when query is whitespace only', async () => {
    const app = createApp();
    const res = await request(app).get('/api/search?q=%20%20%20');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });

  // ─── Successful search ──────────────────────────────────────────────

  it('returns paginated results for a valid Tamil query', async () => {
    // First call: count query
    mockQueryRaw.mockResolvedValueOnce([{ total: BigInt(1) }]);
    // Second call: data query
    mockQueryRaw.mockResolvedValueOnce([sampleRow]);
    mockArticleTagFindMany.mockResolvedValue([sampleTag]);

    const app = createApp();
    const res = await request(app).get('/api/search?q=தமிழ்');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 10);
    expect(res.body).toHaveProperty('totalPages', 1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('தமிழ் செய்தி');
    expect(res.body.data[0].author.name).toBe('Author One');
    expect(res.body.data[0].category.name).toBe('அரசியல்');
    expect(res.body.data[0].tags).toHaveLength(1);
    expect(res.body.data[0].tags[0].name).toBe('செய்தி');
  });

  // ─── Pagination ─────────────────────────────────────────────────────

  it('respects page and pageSize query params', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: BigInt(25) }]);
    mockQueryRaw.mockResolvedValueOnce([sampleRow]);
    mockArticleTagFindMany.mockResolvedValue([]);

    const app = createApp();
    const res = await request(app).get('/api/search?q=test&page=2&pageSize=5');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(5);
    expect(res.body.total).toBe(25);
    expect(res.body.totalPages).toBe(5);
  });

  it('defaults to page 1 and pageSize 10', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: BigInt(0) }]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const app = createApp();
    const res = await request(app).get('/api/search?q=test');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
  });

  // ─── Caching ────────────────────────────────────────────────────────

  it('returns cached result when available', async () => {
    const cachedResult = {
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };
    mockGetCached.mockResolvedValue(cachedResult);

    const app = createApp();
    const res = await request(app).get('/api/search?q=cached');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedResult);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('caches results with SEARCH_TTL (120s)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: BigInt(1) }]);
    mockQueryRaw.mockResolvedValueOnce([sampleRow]);
    mockArticleTagFindMany.mockResolvedValue([]);

    const app = createApp();
    await request(app).get('/api/search?q=cache-test');

    expect(mockSetCached).toHaveBeenCalledWith(
      expect.stringContaining('search:'),
      expect.objectContaining({ total: 1, page: 1, pageSize: 10 }),
      120,
    );
    expect(mockAddTagsToKey).toHaveBeenCalledWith(
      expect.stringContaining('search:'),
      ['search'],
    );
  });

  // ─── Empty results ──────────────────────────────────────────────────

  it('returns empty data array when no results match', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: BigInt(0) }]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const app = createApp();
    const res = await request(app).get('/api/search?q=nonexistent');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(0);
  });

  // ─── Error handling ─────────────────────────────────────────────────

  it('returns 500 on database error', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('DB connection failed'));

    const app = createApp();
    const res = await request(app).get('/api/search?q=error');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
