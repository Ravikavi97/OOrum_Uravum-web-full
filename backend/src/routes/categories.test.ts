import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCategoryFindMany = vi.fn();
const mockCategoryFindUnique = vi.fn();
const mockCategoryCreate = vi.fn();
const mockCategoryUpdate = vi.fn();
const mockCategoryDelete = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    category: {
      findMany: (...args: any[]) => mockCategoryFindMany(...args),
      findUnique: (...args: any[]) => mockCategoryFindUnique(...args),
      create: (...args: any[]) => mockCategoryCreate(...args),
      update: (...args: any[]) => mockCategoryUpdate(...args),
      delete: (...args: any[]) => mockCategoryDelete(...args),
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
