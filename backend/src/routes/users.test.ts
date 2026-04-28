import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();
const mockUserCount = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserDelete = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
      findMany: (...args: any[]) => mockUserFindMany(...args),
      count: (...args: any[]) => mockUserCount(...args),
      create: (...args: any[]) => mockUserCreate(...args),
      update: (...args: any[]) => mockUserUpdate(...args),
      delete: (...args: any[]) => mockUserDelete(...args),
    },
  },
}));

vi.mock('../lib/slug', () => ({
  generateUniqueSlug: vi.fn().mockResolvedValue('test-slug'),
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

import usersRouter from './users';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', usersRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();
const adminUser = JSON.stringify({ userId: 'user-1', email: 'admin@test.com', role: 'ADMIN' });
const editorUser = JSON.stringify({ userId: 'user-2', email: 'editor@test.com', role: 'EDITOR' });
const authorUser = JSON.stringify({ userId: 'user-3', email: 'author@test.com', role: 'AUTHOR' });

const sampleUser = {
  id: 'usr-1',
  email: 'test@example.com',
  name: 'Test User',
  slug: 'test-user',
  role: 'AUTHOR',
  bio: null,
  profileImage: null,
  socialLinks: null,
  createdAt: now,
  updatedAt: now,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── RBAC: Admin-only enforcement ────────────────────────────────────────────

describe('RBAC enforcement — Admin only', () => {
  it('returns 403 for EDITOR on POST /api/users', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .send({ email: 'new@test.com', password: 'password123', name: 'New User' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 for AUTHOR on GET /api/users', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);
    expect(res.status).toBe(403);
  });

  it('returns 401 without auth token', async () => {
    const app = createApp();
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

// ─── POST / — Create user ───────────────────────────────────────────────────

describe('POST /api/users', () => {
  const validBody = { email: 'new@example.com', password: 'securepass123', name: 'New Author' };

  it('creates user with hashed password (Admin)', async () => {
    mockUserFindUnique.mockResolvedValue(null); // no duplicate
    mockUserCreate.mockResolvedValue(sampleUser);

    const app = createApp();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(201);
    // Verify bcrypt hash was passed (not plain password)
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          email: 'new@example.com',
        }),
      }),
    );
    // passwordHash should NOT equal the plain password
    const callData = mockUserCreate.mock.calls[0][0].data;
    expect(callData.passwordHash).not.toBe('securepass123');
  });

  it('returns 409 for duplicate email', async () => {
    mockUserFindUnique.mockResolvedValue(sampleUser); // duplicate exists

    const app = createApp();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('returns 400 for invalid body (missing required fields)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send({ email: 'bad' }); // invalid email, missing password & name

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── GET / — List users (paginated) ─────────────────────────────────────────

describe('GET /api/users', () => {
  it('returns paginated response for Admin', async () => {
    mockUserFindMany.mockResolvedValue([sampleUser]);
    mockUserCount.mockResolvedValue(1);

    const app = createApp();
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 10);
    expect(res.body).toHaveProperty('totalPages', 1);
  });

  it('respects page and pageSize params', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockUserCount.mockResolvedValue(25);

    const app = createApp();
    const res = await request(app)
      .get('/api/users?page=2&pageSize=5')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(5);
    expect(res.body.totalPages).toBe(5);
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });
});

// ─── PUT /:id — Update user ─────────────────────────────────────────────────

describe('PUT /api/users/:id', () => {
  it('updates user name (Admin)', async () => {
    mockUserFindUnique.mockResolvedValue(sampleUser);
    mockUserUpdate.mockResolvedValue({ ...sampleUser, name: 'Updated Name' });

    const app = createApp();
    const res = await request(app)
      .put('/api/users/usr-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalled();
  });

  it('returns 404 for non-existent user', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .put('/api/users/nonexistent')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── DELETE /:id — Delete user ───────────────────────────────────────────────

describe('DELETE /api/users/:id', () => {
  it('deletes user with no articles', async () => {
    mockUserFindUnique.mockResolvedValue({ ...sampleUser, _count: { articles: 0 } });
    mockUserDelete.mockResolvedValue({});

    const app = createApp();
    const res = await request(app)
      .delete('/api/users/usr-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User deleted successfully');
  });

  it('returns 409 when user has associated articles', async () => {
    mockUserFindUnique.mockResolvedValue({ ...sampleUser, _count: { articles: 3 } });

    const app = createApp();
    const res = await request(app)
      .delete('/api/users/usr-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_ARTICLES');
  });

  it('returns 404 for non-existent user', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .delete('/api/users/nonexistent')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
