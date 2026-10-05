import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCategoryFindMany = vi.fn();
const mockCategoryFindUnique = vi.fn();
const mockCategoryCreate = vi.fn();
const mockCategoryUpdate = vi.fn();
const mockCategoryDelete = vi.fn();
const mockArticleFindFirst = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    category: {
      findMany: (...args: any[]) => mockCategoryFindMany(...args),
      findUnique: (...args: any[]) => mockCategoryFindUnique(...args),
      create: (...args: any[]) => mockCategoryCreate(...args),
      update: (...args: any[]) => mockCategoryUpdate(...args),
      delete: (...args: any[]) => mockCategoryDelete(...args),
    },
    article: {
      findFirst: (...args: any[]) => mockArticleFindFirst(...args),
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
  CATEGORY_TTL: 600,
}));

// Mock slug generator
vi.mock('../lib/slug', () => ({
  generateUniqueSlug: vi.fn().mockResolvedValue('test-category-slug'),
}));

// Mock auth middleware
vi.mock('../lib/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
      });
    }
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

// Mock icon upload pipeline (real sharp/FS work is covered by
// src/lib/categoryIconUpload.test.ts). isValidIconUrl stays real so the route
// tests still exercise URL validation.
const mockStoreCategoryIcon = vi.fn();

vi.mock('../lib/categoryIconUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/categoryIconUpload')>();
  return { ...actual, storeCategoryIcon: (...args: any[]) => mockStoreCategoryIcon(...args) };
});

// ─── Test App Setup ──────────────────────────────────────────────────────────

import categoriesRouter from './categories';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoriesRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();

const sampleCategory = {
  id: 'cat-1',
  name: 'அரசியல்',
  slug: 'arasiyal',
  description: 'Political news',
  parentId: null,
  createdAt: now,
  updatedAt: now,
  children: [],
  parent: null,
  _count: { articles: 0 },
};

const parentCategory = {
  id: 'cat-parent',
  name: 'செய்திகள்',
  slug: 'seithigal',
  description: 'News',
  parentId: null,
  createdAt: now,
  updatedAt: now,
  children: [{ id: 'cat-1', name: 'அரசியல்', slug: 'arasiyal', description: 'Political news', parentId: 'cat-parent' }],
  parent: null,
  _count: { articles: 5 },
};

const childCategory = {
  id: 'cat-1',
  name: 'அரசியல்',
  slug: 'arasiyal',
  description: 'Political news',
  parentId: 'cat-parent',
  createdAt: now,
  updatedAt: now,
  children: [],
  parent: { id: 'cat-parent', name: 'செய்திகள்', slug: 'seithigal' },
  _count: { articles: 2 },
};

const editorUser = JSON.stringify({ userId: 'user-2', email: 'editor@test.com', role: 'EDITOR' });
const adminUser = JSON.stringify({ userId: 'user-3', email: 'admin@test.com', role: 'ADMIN' });
const authorUser = JSON.stringify({ userId: 'user-1', email: 'author@test.com', role: 'AUTHOR' });

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCached.mockResolvedValue(null);
  mockSetCached.mockResolvedValue(undefined);
  mockInvalidateByTags.mockResolvedValue(undefined);
  mockAddTagsToKey.mockResolvedValue(undefined);
  mockStoreCategoryIcon.mockResolvedValue({
    url: '/uploads/icons/abc-123.png',
    width: 96,
    height: 96,
  });
});

// ─── GET / — List categories with hierarchy ──────────────────────────────────

describe('GET /api/categories', () => {
  it('returns category list with hierarchy (parent/children)', async () => {
    mockCategoryFindMany.mockResolvedValue([parentCategory, childCategory]);

    const app = createApp();
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    // Parent has children
    expect(res.body[0].children).toHaveLength(1);
    expect(res.body[0].children[0].name).toBe('அரசியல்');
    // Child has parent
    expect(res.body[1].parent).toEqual({ id: 'cat-parent', name: 'செய்திகள்', slug: 'seithigal' });
  });

  it('returns cached result when available', async () => {
    const cached = [sampleCategory];
    mockGetCached.mockResolvedValue(cached);

    const app = createApp();
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(mockCategoryFindMany).not.toHaveBeenCalled();
  });

  it('caches result after fetching from DB', async () => {
    mockCategoryFindMany.mockResolvedValue([sampleCategory]);

    const app = createApp();
    await request(app).get('/api/categories');

    expect(mockSetCached).toHaveBeenCalledWith('categories:list', [sampleCategory], 600);
    expect(mockAddTagsToKey).toHaveBeenCalledWith('categories:list', ['categories']);
  });

  it('includes article count in response', async () => {
    mockCategoryFindMany.mockResolvedValue([parentCategory]);

    const app = createApp();
    const res = await request(app).get('/api/categories');

    expect(res.body[0]._count.articles).toBe(5);
  });
});

// ─── GET /with-latest — Categories with latest article ──────────────────────

describe('GET /api/categories/with-latest', () => {
  const latestArticle = {
    id: 'art-1',
    title: 'மன்னாரில் வேலைவாய்ப்பு கண்காட்சி',
    slug: 'mannar-kankaaatchi',
    excerpt: 'பற்றிய செய்தி.',
    featuredImage: 'https://example.com/a.jpg',
    publishedAt: now.toISOString(),
  };

  it('returns root categories with their latest published article', async () => {
    mockCategoryFindMany.mockResolvedValue([
      { id: 'cat-1', name: 'செய்திகள்', slug: 'seithigal', description: 'News' },
    ]);
    mockArticleFindFirst.mockResolvedValue(latestArticle);

    const res = await request(createApp()).get('/api/categories/with-latest');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      id: 'cat-1',
      name: 'செய்திகள்',
      slug: 'seithigal',
      description: 'News',
      article: latestArticle,
    });
  });

  it('filters to root categories and selects only the fields the cards need', async () => {
    mockCategoryFindMany.mockResolvedValue([]);
    mockArticleFindFirst.mockResolvedValue(null);

    await request(createApp()).get('/api/categories/with-latest');

    expect(mockCategoryFindMany).toHaveBeenCalledWith({
      where: { parentId: null },
      select: { id: true, name: true, slug: true, description: true, iconUrl: true, iconKey: true },
      orderBy: { name: 'asc' },
    });
  });

  it('includes child categories when rootOnly=false', async () => {
    mockCategoryFindMany.mockResolvedValue([]);
    mockArticleFindFirst.mockResolvedValue(null);

    await request(createApp()).get('/api/categories/with-latest?rootOnly=false');

    expect(mockCategoryFindMany).toHaveBeenCalledWith({
      where: undefined,
      select: { id: true, name: true, slug: true, description: true, iconUrl: true, iconKey: true },
      orderBy: { name: 'asc' },
    });
  });

  it('queries only published articles, newest first', async () => {
    mockCategoryFindMany.mockResolvedValue([
      { id: 'cat-1', name: 'செய்திகள்', slug: 'seithigal', description: null },
    ]);
    mockArticleFindFirst.mockResolvedValue(latestArticle);

    await request(createApp()).get('/api/categories/with-latest');

    expect(mockArticleFindFirst).toHaveBeenCalledWith({
      where: { categoryId: 'cat-1', status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        publishedAt: true,
      },
    });
  });

  it('returns article: null for a category with no published articles', async () => {
    mockCategoryFindMany.mockResolvedValue([
      { id: 'cat-empty', name: 'தொழில்நுட்பம்', slug: 'thozhilnutpam', description: null },
    ]);
    mockArticleFindFirst.mockResolvedValue(null);

    const res = await request(createApp()).get('/api/categories/with-latest');

    expect(res.status).toBe(200);
    expect(res.body[0].article).toBeNull();
  });

  it('caches the result under both categories and articles tags', async () => {
    mockCategoryFindMany.mockResolvedValue([]);
    mockArticleFindFirst.mockResolvedValue(null);

    await request(createApp()).get('/api/categories/with-latest');

    expect(mockSetCached).toHaveBeenCalledWith('categories:with-latest:root', [], 600);
    expect(mockAddTagsToKey).toHaveBeenCalledWith('categories:with-latest:root', ['categories', 'articles']);
  });

  it('serves the cached result without hitting the DB', async () => {
    mockGetCached.mockResolvedValue([
      { id: 'cat-1', name: 'செய்திகள்', slug: 'seithigal', description: null, article: null },
    ]);

    const res = await request(createApp()).get('/api/categories/with-latest');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockCategoryFindMany).not.toHaveBeenCalled();
    expect(mockArticleFindFirst).not.toHaveBeenCalled();
  });

  it('uses a separate cache key when rootOnly=false', async () => {
    mockCategoryFindMany.mockResolvedValue([]);
    mockArticleFindFirst.mockResolvedValue(null);

    await request(createApp()).get('/api/categories/with-latest?rootOnly=false');

    expect(mockSetCached).toHaveBeenCalledWith('categories:with-latest:all', [], 600);
  });

  it('returns 500 when the lookup fails', async () => {
    mockCategoryFindMany.mockRejectedValue(new Error('db down'));

    const res = await request(createApp()).get('/api/categories/with-latest');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

// ─── POST / — Create category ────────────────────────────────────────────────

describe('POST /api/categories', () => {
  const validBody = { name: 'விளையாட்டு', description: 'Sports news' };

  it('requires authentication (401 without token)', async () => {
    const app = createApp();
    const res = await request(app).post('/api/categories').send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('requires Editor+ role (403 for Author)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates request body (400 on empty name)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('creates category with Editor role', async () => {
    mockCategoryCreate.mockResolvedValue(sampleCategory);

    const app = createApp();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(mockCategoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'விளையாட்டு',
          slug: 'test-category-slug',
        }),
      }),
    );
  });

  it('creates category with Admin role', async () => {
    mockCategoryCreate.mockResolvedValue(sampleCategory);

    const app = createApp();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('creates category with parentId for hierarchy', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-parent', name: 'செய்திகள்' });
    mockCategoryCreate.mockResolvedValue(childCategory);

    const app = createApp();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ name: 'அரசியல்', parentId: 'cat-parent' });

    expect(res.status).toBe(201);
    expect(mockCategoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: 'cat-parent',
        }),
      }),
    );
  });

  it('returns 400 for invalid parentId', async () => {
    mockCategoryFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ name: 'அரசியல்', parentId: 'nonexistent' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PARENT');
  });

  it('invalidates category cache on create', async () => {
    mockCategoryCreate.mockResolvedValue(sampleCategory);

    const app = createApp();
    await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send(validBody);

    expect(mockInvalidateByTags).toHaveBeenCalledWith(['categories']);
  });
});

// ─── DELETE /:id — Delete category ───────────────────────────────────────────

describe('DELETE /api/categories/:id', () => {
  it('requires Admin role (403 for Editor)', async () => {
    const app = createApp();
    const res = await request(app)
      .delete('/api/categories/cat-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('requires Admin role (403 for Author)', async () => {
    const app = createApp();
    const res = await request(app)
      .delete('/api/categories/cat-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(403);
  });

  it('rejects deletion if articles are associated (409)', async () => {
    mockCategoryFindUnique.mockResolvedValue({
      id: 'cat-1',
      name: 'அரசியல்',
      _count: { articles: 3 },
    });

    const app = createApp();
    const res = await request(app)
      .delete('/api/categories/cat-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_ARTICLES');
    expect(res.body.error.message).toContain('3');
    expect(mockCategoryDelete).not.toHaveBeenCalled();
  });

  it('allows Admin to delete category with no articles', async () => {
    mockCategoryFindUnique.mockResolvedValue({
      id: 'cat-1',
      name: 'அரசியல்',
      _count: { articles: 0 },
    });
    mockCategoryDelete.mockResolvedValue({});

    const app = createApp();
    const res = await request(app)
      .delete('/api/categories/cat-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Category deleted successfully');
    expect(mockCategoryDelete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
  });

  it('returns 404 for non-existent category', async () => {
    mockCategoryFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .delete('/api/categories/nonexistent')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('invalidates cache on delete', async () => {
    mockCategoryFindUnique.mockResolvedValue({
      id: 'cat-1',
      name: 'அரசியல்',
      _count: { articles: 0 },
    });
    mockCategoryDelete.mockResolvedValue({});

    const app = createApp();
    await request(app)
      .delete('/api/categories/cat-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(mockInvalidateByTags).toHaveBeenCalledWith(['categories', 'category:cat-1']);
  });
});

// ─── GET /meta/icons — Icon picker metadata ──────────────────────────────────

describe('GET /api/categories/meta/icons', () => {
  it('returns the built-in icon keys without requiring auth', async () => {
    const res = await request(createApp()).get('/api/categories/meta/icons');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.icons)).toBe(true);
    expect(res.body.icons).toContain('map');
    expect(res.body.icons).toContain('globe');
  });
});

// ─── POST /icon — Icon upload ────────────────────────────────────────────────

describe('POST /api/categories/icon', () => {
  const pngFixture = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  function attach(res: request.Response, name = 'icon.png') {
    return res.attach('file', pngFixture, { filename: name, contentType: 'image/png' });
  }

  it('requires authentication (401 without token)', async () => {
    const req = attach(request(createApp()).post('/api/categories/icon'));
    const res = await req;

    expect(res.status).toBe(401);
    expect(mockStoreCategoryIcon).not.toHaveBeenCalled();
  });

  it('requires Editor+ role (403 for Author)', async () => {
    const req = attach(
      request(createApp())
        .post('/api/categories/icon')
        .set('Authorization', 'Bearer test-token')
        .set('x-test-user', authorUser),
    );
    const res = await req;

    expect(res.status).toBe(403);
    expect(mockStoreCategoryIcon).not.toHaveBeenCalled();
  });

  it('returns the stored icon URL for an Editor', async () => {
    const req = attach(
      request(createApp())
        .post('/api/categories/icon')
        .set('Authorization', 'Bearer test-token')
        .set('x-test-user', editorUser),
    );
    const res = await req;

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('/uploads/icons/abc-123.png');
    expect(mockStoreCategoryIcon).toHaveBeenCalledTimes(1);
  });

  it('accepts an SVG upload', async () => {
    const req = attach(
      request(createApp())
        .post('/api/categories/icon')
        .set('Authorization', 'Bearer test-token')
        .set('x-test-user', editorUser),
      'icon.svg',
    );
    const res = await req;

    expect(res.status).toBe(201);
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(createApp())
      .post('/api/categories/icon')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE');
  });

  it('returns 400 when the icon cannot be processed', async () => {
    mockStoreCategoryIcon.mockRejectedValue(new Error('Unsupported file: upload a PNG, JPG, WebP or SVG icon'));

    const req = attach(
      request(createApp())
        .post('/api/categories/icon')
        .set('Authorization', 'Bearer test-token')
        .set('x-test-user', editorUser),
    );
    const res = await req;

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ICON');
    expect(res.body.error.message).toMatch(/Unsupported file/);
  });
});

// ─── Icon fields on create / update ──────────────────────────────────────────

describe('category icon fields', () => {
  const authed = (method: 'post' | 'put', path: string) =>
    request(createApp())[method](path)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

  it('persists iconUrl and iconKey on create', async () => {
    mockCategoryCreate.mockResolvedValue(sampleCategory);

    const res = await authed('post', '/api/categories').send({
      name: 'செய்திகள்',
      iconKey: 'map',
      iconUrl: '/uploads/icons/abc-123.png',
    });

    expect(res.status).toBe(201);
    expect(mockCategoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ iconKey: 'map', iconUrl: '/uploads/icons/abc-123.png' }),
      }),
    );
  });

  it('stores null icon fields when none are supplied on create', async () => {
    mockCategoryCreate.mockResolvedValue(sampleCategory);

    await authed('post', '/api/categories').send({ name: 'செய்திகள்' });

    expect(mockCategoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ iconUrl: null, iconKey: null }),
      }),
    );
  });

  it('rejects an unknown icon key', async () => {
    const res = await authed('post', '/api/categories').send({
      name: 'செய்திகள்',
      iconKey: 'not-a-real-icon',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockCategoryCreate).not.toHaveBeenCalled();
  });

  it('rejects a javascript: icon URL', async () => {
    const res = await authed('post', '/api/categories').send({
      name: 'செய்திகள்',
      iconUrl: 'javascript:alert(1)',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockCategoryCreate).not.toHaveBeenCalled();
  });

  it('accepts an absolute https icon URL', async () => {
    mockCategoryCreate.mockResolvedValue(sampleCategory);

    const res = await authed('post', '/api/categories').send({
      name: 'செய்திகள்',
      iconUrl: 'https://api.oorumuravum.com/uploads/icons/abc.png',
    });

    expect(res.status).toBe(201);
  });

  it('updates the icon fields on an existing category', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', name: 'அரசியல்' });
    mockCategoryUpdate.mockResolvedValue(sampleCategory);

    const res = await authed('put', '/api/categories/cat-1').send({ iconKey: 'globe' });

    expect(res.status).toBe(200);
    expect(mockCategoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ iconKey: 'globe' }),
      }),
    );
  });

  it('clears the icon when null is sent', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', name: 'அரசியல்', iconKey: 'map' });
    mockCategoryUpdate.mockResolvedValue(sampleCategory);

    await authed('put', '/api/categories/cat-1').send({ iconKey: null, iconUrl: null });

    expect(mockCategoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ iconKey: null, iconUrl: null }),
      }),
    );
  });

  it('leaves the icon untouched when the fields are omitted', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', name: 'அரசியல்', iconKey: 'map' });
    mockCategoryUpdate.mockResolvedValue(sampleCategory);

    await authed('put', '/api/categories/cat-1').send({ name: 'அரசியல் புதிய பெயர்' });

    const data = mockCategoryUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('iconKey');
    expect(data).not.toHaveProperty('iconUrl');
  });

  it('returns icon fields in the category list for the header nav', async () => {
    mockCategoryFindMany.mockResolvedValue([
      { id: 'cat-1', name: 'செய்திகள்', slug: 'seithigal', iconKey: 'map', iconUrl: null },
    ]);

    const res = await request(createApp()).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body[0].iconKey).toBe('map');
    expect(res.body[0]).toHaveProperty('iconUrl');
  });

  it('requests icon fields for child categories in the header nav', async () => {
    mockCategoryFindMany.mockResolvedValue([parentCategory]);

    await request(createApp()).get('/api/categories');

    expect(mockCategoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          children: {
            select: expect.objectContaining({ iconUrl: true, iconKey: true }),
          },
        }),
      }),
    );
  });

  it('includes icon fields in the with-latest payload', async () => {
    mockCategoryFindMany.mockResolvedValue([]);
    mockArticleFindFirst.mockResolvedValue(null);

    await request(createApp()).get('/api/categories/with-latest');

    expect(mockCategoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ iconUrl: true, iconKey: true }),
      }),
    );
  });
});
