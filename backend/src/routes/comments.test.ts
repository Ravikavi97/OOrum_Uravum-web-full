import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockArticleFindUnique = vi.fn();
const mockCommentCreate = vi.fn();
const mockCommentFindMany = vi.fn();
const mockCommentCount = vi.fn();
const mockCommentFindUnique = vi.fn();
const mockCommentUpdate = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    article: {
      findUnique: (...args: any[]) => mockArticleFindUnique(...args),
    },
    comment: {
      create: (...args: any[]) => mockCommentCreate(...args),
      findMany: (...args: any[]) => mockCommentFindMany(...args),
      count: (...args: any[]) => mockCommentCount(...args),
      findUnique: (...args: any[]) => mockCommentFindUnique(...args),
      update: (...args: any[]) => mockCommentUpdate(...args),
    },
  },
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
      req.user = { userId: 'user-1', email: 'editor@test.com', role: 'EDITOR' };
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

import commentsRouter from './comments';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/comments', commentsRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();
const editorUser = JSON.stringify({ userId: 'user-1', email: 'editor@test.com', role: 'EDITOR' });
const authorUser = JSON.stringify({ userId: 'user-2', email: 'author@test.com', role: 'AUTHOR' });

const sampleComment = {
  id: 'cmt-1',
  displayName: 'Visitor',
  email: 'visitor@example.com',
  content: 'Great article!',
  status: 'PENDING',
  articleId: 'art-1',
  createdAt: now,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST / — Submit comment (public) ────────────────────────────────────────

describe('POST /api/comments', () => {
  const validBody = {
    articleId: 'art-1',
    displayName: 'Visitor',
    email: 'visitor@example.com',
    content: 'Great article!',
  };

  it('creates comment with PENDING status', async () => {
    mockArticleFindUnique.mockResolvedValue({ id: 'art-1' });
    mockCommentCreate.mockResolvedValue(sampleComment);

    const app = createApp();
    const res = await request(app).post('/api/comments').send(validBody);

    expect(res.status).toBe(201);
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
  });

  it('flags comment containing prohibited keywords', async () => {
    mockArticleFindUnique.mockResolvedValue({ id: 'art-1' });
    mockCommentCreate.mockResolvedValue({ ...sampleComment, status: 'FLAGGED' });

    const app = createApp();
    const res = await request(app)
      .post('/api/comments')
      .send({ ...validBody, content: 'This is spam content' });

    expect(res.status).toBe(201);
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FLAGGED' }),
      }),
    );
  });

  it('returns 404 for non-existent article', async () => {
    mockArticleFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).post('/api/comments').send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for invalid body', async () => {
    const app = createApp();
    const res = await request(app).post('/api/comments').send({ articleId: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── GET /:articleId — Approved comments, paginated ──────────────────────────

describe('GET /api/comments/:articleId', () => {
  it('returns only APPROVED comments with pagination', async () => {
    mockCommentFindMany.mockResolvedValue([{ ...sampleComment, status: 'APPROVED' }]);
    mockCommentCount.mockResolvedValue(1);

    const app = createApp();
    const res = await request(app).get('/api/comments/art-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 20);
    expect(res.body).toHaveProperty('totalPages', 1);
    // Verify the query filters by APPROVED status
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { articleId: 'art-1', status: 'APPROVED' },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('supports pagination via page query param', async () => {
    mockCommentFindMany.mockResolvedValue([]);
    mockCommentCount.mockResolvedValue(40);

    const app = createApp();
    const res = await request(app).get('/api/comments/art-1?page=2');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.totalPages).toBe(2);
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
  });
});

// ─── GET /admin/all — Admin comment listing ──────────────────────────────────

describe('GET /api/comments/admin/all', () => {
  const commentWithArticle = {
    ...sampleComment,
    article: { title: 'Test Article' },
  };

  it('returns paginated comments with article title for Editor', async () => {
    mockCommentFindMany.mockResolvedValue([commentWithArticle]);
    mockCommentCount.mockResolvedValue(1);

    const app = createApp();
    const res = await request(app)
      .get('/api/comments/admin/all')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 10);
    expect(res.body).toHaveProperty('totalPages', 1);
    expect(res.body.data[0].article).toEqual({ title: 'Test Article' });
  });

  it('filters by status query param', async () => {
    mockCommentFindMany.mockResolvedValue([]);
    mockCommentCount.mockResolvedValue(0);

    const app = createApp();
    const res = await request(app)
      .get('/api/comments/admin/all?status=PENDING')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(200);
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
      }),
    );
  });

  it('ignores invalid status values', async () => {
    mockCommentFindMany.mockResolvedValue([]);
    mockCommentCount.mockResolvedValue(0);

    const app = createApp();
    const res = await request(app)
      .get('/api/comments/admin/all?status=INVALID')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(200);
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('supports pagination via page and pageSize params', async () => {
    mockCommentFindMany.mockResolvedValue([]);
    mockCommentCount.mockResolvedValue(25);

    const app = createApp();
    const res = await request(app)
      .get('/api/comments/admin/all?page=2&pageSize=10')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.totalPages).toBe(3);
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await request(app).get('/api/comments/admin/all');

    expect(res.status).toBe(401);
  });

  it('returns 403 for Author role', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/comments/admin/all')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(403);
  });
});

// ─── PUT /:id/approve — Approve comment (Editor+) ───────────────────────────

describe('PUT /api/comments/:id/approve', () => {
  it('approves comment for Editor', async () => {
    mockCommentFindUnique.mockResolvedValue(sampleComment);
    mockCommentUpdate.mockResolvedValue({ ...sampleComment, status: 'APPROVED' });

    const app = createApp();
    const res = await request(app)
      .put('/api/comments/cmt-1/approve')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(200);
    expect(mockCommentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'APPROVED' } }),
    );
  });

  it('returns 403 for Author role', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/comments/cmt-1/approve')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent comment', async () => {
    mockCommentFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .put('/api/comments/nonexistent/approve')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── PUT /:id/reject — Reject comment (Editor+) ─────────────────────────────

describe('PUT /api/comments/:id/reject', () => {
  it('rejects comment for Editor', async () => {
    mockCommentFindUnique.mockResolvedValue(sampleComment);
    mockCommentUpdate.mockResolvedValue({ ...sampleComment, status: 'REJECTED' });

    const app = createApp();
    const res = await request(app)
      .put('/api/comments/cmt-1/reject')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(200);
    expect(mockCommentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED' } }),
    );
  });

  it('returns 403 for Author role', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/comments/cmt-1/reject')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(403);
  });
});
