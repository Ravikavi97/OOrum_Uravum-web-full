import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock Prisma
const mockArticleFindMany = vi.fn();
const mockArticleCount = vi.fn();
const mockArticleFindUnique = vi.fn();
const mockArticleCreate = vi.fn();
const mockArticleUpdate = vi.fn();
const mockArticleDelete = vi.fn();
const mockCategoryFindUnique = vi.fn();
const mockArticleTagDeleteMany = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    article: {
      findMany: (...args: any[]) => mockArticleFindMany(...args),
      count: (...args: any[]) => mockArticleCount(...args),
      findUnique: (...args: any[]) => mockArticleFindUnique(...args),
      create: (...args: any[]) => mockArticleCreate(...args),
      update: (...args: any[]) => mockArticleUpdate(...args),
      delete: (...args: any[]) => mockArticleDelete(...args),
    },
    category: {
      findUnique: (...args: any[]) => mockCategoryFindUnique(...args),
    },
    articleTag: {
      deleteMany: (...args: any[]) => mockArticleTagDeleteMany(...args),
    },
  },
}));

// Mock cache
const mockGetCached = vi.fn();
const mockSetCached = vi.fn();
const mockInvalidateByTags = vi.fn();
const mockAddTagsToKey = vi.fn();

vi.mock('../lib/cache', () => ({
  getCached: (...args: any[]) => mockGetCached(...args),
  setCached: (...args: any[]) => mockSetCached(...args),
  invalidateByTags: (...args: any[]) => mockInvalidateByTags(...args),
  addTagsToKey: (...args: any[]) => mockAddTagsToKey(...args),
  ARTICLE_TTL: 300,
}));

// Mock slug generator
vi.mock('../lib/slug', () => ({
  generateUniqueSlug: vi.fn().mockResolvedValue('test-slug'),
}));

// Mock auth middleware — inject test user via custom header
vi.mock('../lib/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
      });
    }
    // Decode test user from x-test-user header
    const testUser = req.headers['x-test-user'];
    if (testUser) {
      req.user = JSON.parse(testUser);
    } else {
      req.user = { userId: 'user-1', email: 'author@test.com', role: 'AUTHOR' };
    }
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
    next();
  },
  AuthenticatedRequest: {},
}));

// ─── Test App Setup ──────────────────────────────────────────────────────────

import articlesRouter from './articles';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/articles', articlesRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();

const sampleDbArticle = {
  id: 'art-1',
  title: 'சோதனை கட்டுரை',
  slug: 'sothanai-katturai',
  content: '<p>Test content</p>',
  excerpt: 'Test excerpt',
  status: 'PUBLISHED',
  isBreaking: false,
  featuredImage: null,
  sourceUrl: null,
  publishedAt: now,
  createdAt: now,
  updatedAt: now,
  authorId: 'user-1',
  categoryId: 'cat-1',
  author: { id: 'user-1', name: 'Test Author', slug: 'test-author', profileImage: null },
  category: { id: 'cat-1', name: 'Politics', slug: 'politics' },
  tags: [{ tag: { id: 'tag-1', name: 'News', slug: 'news' } }],
};


const authorUser = JSON.stringify({ userId: 'user-1', email: 'author@test.com', role: 'AUTHOR' });
const editorUser = JSON.stringify({ userId: 'user-2', email: 'editor@test.com', role: 'EDITOR' });
const adminUser = JSON.stringify({ userId: 'user-3', email: 'admin@test.com', role: 'ADMIN' });
const otherAuthorUser = JSON.stringify({ userId: 'user-99', email: 'other@test.com', role: 'AUTHOR' });

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCached.mockResolvedValue(null);
  mockSetCached.mockResolvedValue(undefined);
  mockInvalidateByTags.mockResolvedValue(undefined);
  mockAddTagsToKey.mockResolvedValue(undefined);
});

// ─── GET / — Paginated article list ──────────────────────────────────────────

describe('GET /api/articles', () => {
  it('returns paginated response format { data, total, page, pageSize, totalPages }', async () => {
    mockArticleFindMany.mockResolvedValue([sampleDbArticle]);
    mockArticleCount.mockResolvedValue(1);

    const app = createApp();
    const res = await request(app).get('/api/articles');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 10);
    expect(res.body).toHaveProperty('totalPages', 1);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].tags).toEqual([{ id: 'tag-1', name: 'News', slug: 'news' }]);
  });

  it('returns cached result when available', async () => {
    const cachedResult = { data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
    mockGetCached.mockResolvedValue(cachedResult);

    const app = createApp();
    const res = await request(app).get('/api/articles');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedResult);
    expect(mockArticleFindMany).not.toHaveBeenCalled();
  });

  it('caches result after fetching from DB', async () => {
    mockArticleFindMany.mockResolvedValue([]);
    mockArticleCount.mockResolvedValue(0);

    const app = createApp();
    await request(app).get('/api/articles');

    expect(mockSetCached).toHaveBeenCalledTimes(1);
    expect(mockAddTagsToKey).toHaveBeenCalledWith(expect.any(String), ['articles']);
  });

  it('respects page and pageSize query params', async () => {
    mockArticleFindMany.mockResolvedValue([]);
    mockArticleCount.mockResolvedValue(50);

    const app = createApp();
    const res = await request(app).get('/api/articles?page=3&pageSize=5');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(res.body.pageSize).toBe(5);
    expect(res.body.totalPages).toBe(10);
    // Verify skip = (3-1)*5 = 10
    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });

  it('defaults to PUBLISHED status filter', async () => {
    mockArticleFindMany.mockResolvedValue([]);
    mockArticleCount.mockResolvedValue(0);

    const app = createApp();
    await request(app).get('/api/articles');

    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
  });
});

// ─── GET /:slug — Single article ─────────────────────────────────────────────

describe('GET /api/articles/:slug', () => {
  it('returns article with relations', async () => {
    mockArticleFindUnique.mockResolvedValue(sampleDbArticle);

    const app = createApp();
    const res = await request(app).get('/api/articles/sothanai-katturai');

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('சோதனை கட்டுரை');
    expect(res.body.author).toEqual({ id: 'user-1', name: 'Test Author', slug: 'test-author', profileImage: null });
    expect(res.body.category).toEqual({ id: 'cat-1', name: 'Politics', slug: 'politics' });
    expect(res.body.tags).toEqual([{ id: 'tag-1', name: 'News', slug: 'news' }]);
  });

  it('returns 404 for non-existent slug', async () => {
    mockArticleFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get('/api/articles/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns cached article when available', async () => {
    const cached = { ...sampleDbArticle, tags: [{ id: 'tag-1', name: 'News', slug: 'news' }] };
    mockGetCached.mockResolvedValue(cached);

    const app = createApp();
    const res = await request(app).get('/api/articles/sothanai-katturai');

    expect(res.status).toBe(200);
    expect(mockArticleFindUnique).not.toHaveBeenCalled();
  });

  it('caches article detail after DB fetch', async () => {
    mockArticleFindUnique.mockResolvedValue(sampleDbArticle);

    const app = createApp();
    await request(app).get('/api/articles/sothanai-katturai');

    expect(mockSetCached).toHaveBeenCalledWith(
      'articles:detail:sothanai-katturai',
      expect.any(Object),
      300,
    );
    expect(mockAddTagsToKey).toHaveBeenCalledWith(
      'articles:detail:sothanai-katturai',
      ['articles', 'article:art-1'],
    );
  });
});


// ─── POST / — Create article ─────────────────────────────────────────────────

describe('POST /api/articles', () => {
  const validBody = {
    title: 'புதிய கட்டுரை',
    content: '<p>Article content</p>',
    categoryId: 'cat-1',
  };

  it('requires authentication (401 without token)', async () => {
    const app = createApp();
    const res = await request(app).post('/api/articles').send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('validates request body with Zod (400 on invalid)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/articles')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .send({ title: '' }); // missing content and categoryId, empty title

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('creates article with DRAFT status for Author role', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', name: 'Politics' });
    mockArticleCreate.mockResolvedValue(sampleDbArticle);

    const app = createApp();
    const res = await request(app)
      .post('/api/articles')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(mockArticleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          authorId: 'user-1',
        }),
      }),
    );
  });

  it('invalidates article list cache on create', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', name: 'Politics' });
    mockArticleCreate.mockResolvedValue(sampleDbArticle);

    const app = createApp();
    await request(app)
      .post('/api/articles')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .send(validBody);

    expect(mockInvalidateByTags).toHaveBeenCalledWith(['articles']);
  });

  it('returns 400 for invalid category', async () => {
    mockCategoryFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .post('/api/articles')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CATEGORY');
  });
});

// ─── PUT /:id — Update article ───────────────────────────────────────────────

describe('PUT /api/articles/:id', () => {
  const existingArticle = {
    id: 'art-1',
    title: 'Old Title',
    slug: 'old-title',
    status: 'DRAFT',
    authorId: 'user-1',
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Politics' },
  };

  it('allows Author to update own article', async () => {
    mockArticleFindUnique.mockResolvedValue(existingArticle);
    mockArticleUpdate.mockResolvedValue({ ...sampleDbArticle, title: 'Updated' });

    const app = createApp();
    const res = await request(app)
      .put('/api/articles/art-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
  });

  it('returns 403 when Author tries to update another authors article', async () => {
    mockArticleFindUnique.mockResolvedValue(existingArticle);

    const app = createApp();
    const res = await request(app)
      .put('/api/articles/art-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', otherAuthorUser)
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows Editor to update any article', async () => {
    mockArticleFindUnique.mockResolvedValue(existingArticle);
    mockArticleUpdate.mockResolvedValue({ ...sampleDbArticle, title: 'Editor Updated' });

    const app = createApp();
    const res = await request(app)
      .put('/api/articles/art-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ title: 'Editor Updated' });

    expect(res.status).toBe(200);
  });

  it('invalidates cache on publish (status change to PUBLISHED)', async () => {
    mockArticleFindUnique.mockResolvedValue(existingArticle);
    mockArticleUpdate.mockResolvedValue({
      ...sampleDbArticle,
      status: 'PUBLISHED',
      categoryId: 'cat-1',
    });

    const app = createApp();
    await request(app)
      .put('/api/articles/art-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ status: 'PUBLISHED' });

    expect(mockInvalidateByTags).toHaveBeenCalledWith(
      expect.arrayContaining(['articles', 'article:art-1', 'home', 'category:cat-1']),
    );
  });

  it('returns 404 for non-existent article', async () => {
    mockArticleFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .put('/api/articles/nonexistent')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── DELETE /:id — Delete article ────────────────────────────────────────────

describe('DELETE /api/articles/:id', () => {
  it('requires Editor+ role (403 for Author)', async () => {
    const app = createApp();
    const res = await request(app)
      .delete('/api/articles/art-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows Editor to delete article', async () => {
    mockArticleFindUnique.mockResolvedValue({ id: 'art-1', categoryId: 'cat-1' });
    mockArticleDelete.mockResolvedValue({});

    const app = createApp();
    const res = await request(app)
      .delete('/api/articles/art-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Article deleted successfully');
  });

  it('allows Admin to delete article', async () => {
    mockArticleFindUnique.mockResolvedValue({ id: 'art-1', categoryId: 'cat-1' });
    mockArticleDelete.mockResolvedValue({});

    const app = createApp();
    const res = await request(app)
      .delete('/api/articles/art-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(200);
  });

  it('invalidates cache on delete', async () => {
    mockArticleFindUnique.mockResolvedValue({ id: 'art-1', categoryId: 'cat-1' });
    mockArticleDelete.mockResolvedValue({});

    const app = createApp();
    await request(app)
      .delete('/api/articles/art-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(mockInvalidateByTags).toHaveBeenCalledWith(
      expect.arrayContaining(['articles', 'article:art-1', 'home', 'category:cat-1']),
    );
  });

  it('returns 404 for non-existent article', async () => {
    mockArticleFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .delete('/api/articles/nonexistent')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
