import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockArticleFindUnique = vi.fn();
const mockArticleFindFirst = vi.fn();
const mockArticleCreate = vi.fn();
const mockCategoryFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
const mockIngestionLogCreate = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    article: {
      findUnique: (...args: any[]) => mockArticleFindUnique(...args),
      findFirst: (...args: any[]) => mockArticleFindFirst(...args),
      create: (...args: any[]) => mockArticleCreate(...args),
    },
    category: {
      findUnique: (...args: any[]) => mockCategoryFindUnique(...args),
    },
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
    },
    ingestionLog: {
      create: (...args: any[]) => mockIngestionLogCreate(...args),
    },
  },
}));

vi.mock('../lib/slug', () => ({
  generateUniqueSlug: vi.fn().mockResolvedValue('ingested-slug'),
}));

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
      req.user = { userId: 'user-1', email: 'admin@test.com', role: 'ADMIN' };
    }
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    next();
  },
  AuthenticatedRequest: {},
}));

// ─── Test App Setup ──────────────────────────────────────────────────────────

import ingestRouter from './ingest';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/ingest', ingestRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();
const adminUser = JSON.stringify({ userId: 'user-1', email: 'admin@test.com', role: 'ADMIN' });
const editorUser = JSON.stringify({ userId: 'user-2', email: 'editor@test.com', role: 'EDITOR' });

const validBody = {
  title: 'Ingested Article Title',
  content: '<p>Article content from external source</p>',
  sourceUrl: 'https://external-source.com/article-1',
  categoryId: 'cat-1',
  authorId: 'author-1',
};

const sampleCreatedArticle = {
  id: 'art-new',
  title: 'Ingested Article Title',
  slug: 'ingested-slug',
  content: '<p>Article content from external source</p>',
  status: 'DRAFT',
  sourceUrl: 'https://external-source.com/article-1',
  authorId: 'author-1',
  categoryId: 'cat-1',
  createdAt: now,
  updatedAt: now,
  author: { id: 'author-1', name: 'Author', slug: 'author' },
  category: { id: 'cat-1', name: 'Politics', slug: 'politics' },
  tags: [],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockIngestionLogCreate.mockResolvedValue({});
});

// ─── RBAC: Admin only ────────────────────────────────────────────────────────

describe('POST /api/ingest — RBAC', () => {
  it('returns 403 for Editor role', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/ingest')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await request(app).post('/api/ingest').send(validBody);
    expect(res.status).toBe(401);
  });
});

// ─── Validation ──────────────────────────────────────────────────────────────

describe('POST /api/ingest — validation', () => {
  it('returns 400 for missing required fields', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/ingest')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send({ title: 'Only title' }); // missing content, sourceUrl, categoryId, authorId

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    // Should log the validation failure
    expect(mockIngestionLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failure' }),
      }),
    );
  });
});

// ─── Duplicate detection ─────────────────────────────────────────────────────

describe('POST /api/ingest — duplicate detection', () => {
  it('rejects duplicate by sourceUrl', async () => {
    mockArticleFindUnique.mockResolvedValue({ id: 'existing-art' }); // duplicate by URL

    const app = createApp();
    const res = await request(app)
      .post('/api/ingest')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_SOURCE_URL');
    expect(mockIngestionLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failure', sourceUrl: validBody.sourceUrl }),
      }),
    );
  });

  it('rejects duplicate by title', async () => {
    mockArticleFindUnique.mockResolvedValue(null); // no URL duplicate
    mockArticleFindFirst.mockResolvedValue({ id: 'existing-art', title: validBody.title }); // title duplicate

    const app = createApp();
    const res = await request(app)
      .post('/api/ingest')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_TITLE');
    expect(mockIngestionLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failure' }),
      }),
    );
  });
});

// ─── Successful ingestion with audit logging ─────────────────────────────────

describe('POST /api/ingest — success', () => {
  it('creates article and logs success', async () => {
    mockArticleFindUnique.mockResolvedValue(null); // no URL duplicate
    mockArticleFindFirst.mockResolvedValue(null); // no title duplicate
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', name: 'Politics' });
    mockUserFindUnique.mockResolvedValue({ id: 'author-1', name: 'Author' });
    mockArticleCreate.mockResolvedValue(sampleCreatedArticle);

    const app = createApp();
    const res = await request(app)
      .post('/api/ingest')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(mockArticleCreate).toHaveBeenCalled();
    // Audit log: success entry
    expect(mockIngestionLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceUrl: validBody.sourceUrl,
          status: 'success',
        }),
      }),
    );
  });

  it('returns 400 for invalid category', async () => {
    mockArticleFindUnique.mockResolvedValue(null);
    mockArticleFindFirst.mockResolvedValue(null);
    mockCategoryFindUnique.mockResolvedValue(null); // category not found
    mockUserFindUnique.mockResolvedValue({ id: 'author-1' });

    const app = createApp();
    const res = await request(app)
      .post('/api/ingest')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CATEGORY');
  });

  it('returns 400 for invalid author', async () => {
    mockArticleFindUnique.mockResolvedValue(null);
    mockArticleFindFirst.mockResolvedValue(null);
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1' });
    mockUserFindUnique.mockResolvedValue(null); // author not found

    const app = createApp();
    const res = await request(app)
      .post('/api/ingest')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_AUTHOR');
  });
});
