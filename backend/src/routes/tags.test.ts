import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockTagFindMany = vi.fn();
const mockTagCreate = vi.fn();
const mockTagFindUnique = vi.fn();
const mockTagUpdate = vi.fn();
const mockTagDelete = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    tag: {
      findMany: (...args: any[]) => mockTagFindMany(...args),
      create: (...args: any[]) => mockTagCreate(...args),
      findUnique: (...args: any[]) => mockTagFindUnique(...args),
      update: (...args: any[]) => mockTagUpdate(...args),
      delete: (...args: any[]) => mockTagDelete(...args),
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
  TAG_TTL: 600,
}));

// Mock slug generator
vi.mock('../lib/slug', () => ({
  generateUniqueSlug: vi.fn().mockResolvedValue('test-tag-slug'),
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

import tagsRouter from './tags';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tags', tagsRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();

const sampleTag = {
  id: 'tag-1',
  name: 'செய்தி',
  slug: 'seithi',
  createdAt: now,
  _count: { articles: 5 },
};

const sampleTag2 = {
  id: 'tag-2',
  name: 'விளையாட்டு',
  slug: 'vilaiyaattu',
  createdAt: now,
  _count: { articles: 12 },
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

// ─── GET / — List tags ───────────────────────────────────────────────────────

describe('GET /api/tags', () => {
  it('returns tag list with article counts', async () => {
    mockTagFindMany.mockResolvedValue([sampleTag, sampleTag2]);

    const app = createApp();
    const res = await request(app).get('/api/tags');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('செய்தி');
    expect(res.body[0]._count.articles).toBe(5);
    expect(res.body[1]._count.articles).toBe(12);
  });

  it('returns cached result when available', async () => {
    const cached = [sampleTag];
    mockGetCached.mockResolvedValue(cached);

    const app = createApp();
    const res = await request(app).get('/api/tags');

    expect(res.status).toBe(200);
    expect(mockTagFindMany).not.toHaveBeenCalled();
  });

  it('caches result after fetching from DB', async () => {
    mockTagFindMany.mockResolvedValue([sampleTag]);

    const app = createApp();
    await request(app).get('/api/tags');

    expect(mockSetCached).toHaveBeenCalledWith('tags:list', [sampleTag], 600);
    expect(mockAddTagsToKey).toHaveBeenCalledWith('tags:list', ['tags']);
  });
});

// ─── POST / — Create tag ─────────────────────────────────────────────────────

describe('POST /api/tags', () => {
  const validBody = { name: 'புதிய குறிச்சொல்' };

  it('requires authentication (401 without token)', async () => {
    const app = createApp();
    const res = await request(app).post('/api/tags').send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('requires Editor+ role (403 for Author)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates request body (400 on empty name)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('validates request body (400 on missing name)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates tag with Editor role', async () => {
    mockTagCreate.mockResolvedValue(sampleTag);

    const app = createApp();
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(mockTagCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'புதிய குறிச்சொல்',
          slug: 'test-tag-slug',
        }),
      }),
    );
  });

  it('creates tag with Admin role', async () => {
    mockTagCreate.mockResolvedValue(sampleTag);

    const app = createApp();
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('invalidates tag cache on create', async () => {
    mockTagCreate.mockResolvedValue(sampleTag);

    const app = createApp();
    await request(app)
      .post('/api/tags')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send(validBody);

    expect(mockInvalidateByTags).toHaveBeenCalledWith(['tags']);
  });
});

// ─── PUT /:id — Update tag ───────────────────────────────────────────────────

describe('PUT /api/tags/:id', () => {
  const validBody = { name: 'Updated Tag Name' };

  it('requires authentication (401 without token)', async () => {
    const app = createApp();
    const res = await request(app).put('/api/tags/tag-1').send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('requires Editor+ role (403 for Author)', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when tag does not exist', async () => {
    mockTagFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .put('/api/tags/nonexistent')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('validates request body (400 on empty name)', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('updates tag with Editor role and regenerates slug on name change', async () => {
    mockTagFindUnique.mockResolvedValue(sampleTag);
    const updatedTag = { ...sampleTag, name: 'Updated Tag Name', slug: 'test-tag-slug' };
    mockTagUpdate.mockResolvedValue(updatedTag);

    const app = createApp();
    const res = await request(app)
      .put('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(mockTagUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tag-1' },
        data: expect.objectContaining({
          name: 'Updated Tag Name',
          slug: 'test-tag-slug',
        }),
      }),
    );
  });

  it('updates tag with Admin role', async () => {
    mockTagFindUnique.mockResolvedValue(sampleTag);
    mockTagUpdate.mockResolvedValue({ ...sampleTag, name: 'Updated Tag Name' });

    const app = createApp();
    const res = await request(app)
      .put('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(200);
  });

  it('does not regenerate slug when name is unchanged', async () => {
    mockTagFindUnique.mockResolvedValue(sampleTag);
    mockTagUpdate.mockResolvedValue(sampleTag);

    const app = createApp();
    const res = await request(app)
      .put('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ name: sampleTag.name });

    expect(res.status).toBe(200);
    // slug should not be in the update data since name didn't change
    expect(mockTagUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ slug: expect.any(String) }),
      }),
    );
  });

  it('invalidates tag cache on update', async () => {
    mockTagFindUnique.mockResolvedValue(sampleTag);
    mockTagUpdate.mockResolvedValue(sampleTag);

    const app = createApp();
    await request(app)
      .put('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send(validBody);

    expect(mockInvalidateByTags).toHaveBeenCalledWith(['tags', 'tag:tag-1']);
  });
});

// ─── DELETE /:id — Delete tag ────────────────────────────────────────────────

describe('DELETE /api/tags/:id', () => {
  it('requires authentication (401 without token)', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/tags/tag-1');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('requires Editor+ role (403 for Author)', async () => {
    const app = createApp();
    const res = await request(app)
      .delete('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when tag does not exist', async () => {
    mockTagFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .delete('/api/tags/nonexistent')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('deletes tag with Editor role', async () => {
    mockTagFindUnique.mockResolvedValue(sampleTag);
    mockTagDelete.mockResolvedValue(sampleTag);

    const app = createApp();
    const res = await request(app)
      .delete('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Tag deleted successfully');
    expect(mockTagDelete).toHaveBeenCalledWith({ where: { id: 'tag-1' } });
  });

  it('deletes tag with Admin role', async () => {
    mockTagFindUnique.mockResolvedValue(sampleTag);
    mockTagDelete.mockResolvedValue(sampleTag);

    const app = createApp();
    const res = await request(app)
      .delete('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Tag deleted successfully');
  });

  it('invalidates tag cache on delete', async () => {
    mockTagFindUnique.mockResolvedValue(sampleTag);
    mockTagDelete.mockResolvedValue(sampleTag);

    const app = createApp();
    await request(app)
      .delete('/api/tags/tag-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(mockInvalidateByTags).toHaveBeenCalledWith(['tags', 'tag:tag-1']);
  });
});
