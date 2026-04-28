import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockObituaryFindMany = vi.fn();
const mockObituaryCount = vi.fn();
const mockObituaryFindUnique = vi.fn();
const mockObituaryCreate = vi.fn();
const mockObituaryUpdate = vi.fn();
const mockObituaryDelete = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    obituary: {
      findMany: (...args: any[]) => mockObituaryFindMany(...args),
      count: (...args: any[]) => mockObituaryCount(...args),
      findUnique: (...args: any[]) => mockObituaryFindUnique(...args),
      create: (...args: any[]) => mockObituaryCreate(...args),
      update: (...args: any[]) => mockObituaryUpdate(...args),
      delete: (...args: any[]) => mockObituaryDelete(...args),
    },
  },
}));

// Mock cache
const mockInvalidateByTags = vi.fn();

vi.mock('../lib/cache', () => ({
  invalidateByTags: (...args: any[]) => mockInvalidateByTags(...args),
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

import obituariesRouter from './obituaries';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/obituaries', obituariesRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();

const sampleObituary = {
  id: 'obit-1',
  name: 'திரு. முருகன்',
  content: 'அன்னாரின் இழப்பு ஈடு செய்ய முடியாதது.',
  sourceUrl: null,
  publishedAt: now,
  createdAt: now,
};

const sampleObituary2 = {
  id: 'obit-2',
  name: 'திருமதி. லட்சுமி',
  content: 'அமைதியாக இறைவனடி சேர்ந்தார்.',
  sourceUrl: null,
  publishedAt: now,
  createdAt: now,
};

const editorUser = JSON.stringify({ userId: 'user-2', email: 'editor@test.com', role: 'EDITOR' });
const adminUser = JSON.stringify({ userId: 'user-3', email: 'admin@test.com', role: 'ADMIN' });
const authorUser = JSON.stringify({ userId: 'user-1', email: 'author@test.com', role: 'AUTHOR' });

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockInvalidateByTags.mockResolvedValue(undefined);
});

// ─── GET / — List obituaries ─────────────────────────────────────────────────

describe('GET /api/obituaries', () => {
  it('returns paginated obituary list', async () => {
    mockObituaryFindMany.mockResolvedValue([sampleObituary, sampleObituary2]);
    mockObituaryCount.mockResolvedValue(2);

    const app = createApp();
    const res = await request(app).get('/api/obituaries');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.data[0].name).toBe('திரு. முருகன்');
  });
});

// ─── POST / — Create obituary ────────────────────────────────────────────────

describe('POST /api/obituaries', () => {
  const validBody = { name: 'புதிய நினைவஞ்சலி', content: 'நினைவஞ்சலி உள்ளடக்கம்' };

  it('requires authentication (401 without token)', async () => {
    const app = createApp();
    const res = await request(app).post('/api/obituaries').send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows Author role to create obituary', async () => {
    mockObituaryCreate.mockResolvedValue(sampleObituary);

    const app = createApp();
    const res = await request(app)
      .post('/api/obituaries')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .field('name', validBody.name)
      .field('content', validBody.content);

    expect(res.status).toBe(201);
  });

  it('allows Editor role to create obituary', async () => {
    mockObituaryCreate.mockResolvedValue(sampleObituary);

    const app = createApp();
    const res = await request(app)
      .post('/api/obituaries')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('name', validBody.name)
      .field('content', validBody.content);

    expect(res.status).toBe(201);
  });

  it('allows Admin role to create obituary', async () => {
    mockObituaryCreate.mockResolvedValue(sampleObituary);

    const app = createApp();
    const res = await request(app)
      .post('/api/obituaries')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser)
      .field('name', validBody.name)
      .field('content', validBody.content);

    expect(res.status).toBe(201);
  });

  it('validates request body (400 on missing name)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/obituaries')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('content', 'some content');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates request body (400 on missing content)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/obituaries')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('name', 'Test Name');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates obituary with image upload', async () => {
    mockObituaryCreate.mockResolvedValue(sampleObituary);

    const app = createApp();
    const res = await request(app)
      .post('/api/obituaries')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('name', validBody.name)
      .field('content', validBody.content)
      .attach('image', Buffer.from('fake-image-data'), 'photo.jpg');

    expect(res.status).toBe(201);
    expect(mockObituaryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: validBody.name,
          content: validBody.content,
          imageData: expect.any(Uint8Array),
        }),
      }),
    );
  });

  it('creates obituary with optional publishedAt', async () => {
    mockObituaryCreate.mockResolvedValue(sampleObituary);
    const publishedAt = '2025-01-15T10:00:00.000Z';

    const app = createApp();
    const res = await request(app)
      .post('/api/obituaries')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('name', validBody.name)
      .field('content', validBody.content)
      .field('publishedAt', publishedAt);

    expect(res.status).toBe(201);
    expect(mockObituaryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishedAt: new Date(publishedAt),
        }),
      }),
    );
  });

  it('invalidates obituary cache on create', async () => {
    mockObituaryCreate.mockResolvedValue(sampleObituary);

    const app = createApp();
    await request(app)
      .post('/api/obituaries')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('name', validBody.name)
      .field('content', validBody.content);

    expect(mockInvalidateByTags).toHaveBeenCalledWith(['obituaries']);
  });
});

// ─── PUT /:id — Update obituary ──────────────────────────────────────────────

describe('PUT /api/obituaries/:id', () => {
  it('requires authentication (401 without token)', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/obituaries/obit-1')
      .field('name', 'Updated Name');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows Author role to update obituary', async () => {
    mockObituaryFindUnique.mockResolvedValue(sampleObituary);
    mockObituaryUpdate.mockResolvedValue({ ...sampleObituary, name: 'Updated' });

    const app = createApp();
    const res = await request(app)
      .put('/api/obituaries/obit-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser)
      .field('name', 'Updated');

    expect(res.status).toBe(200);
  });

  it('returns 404 when obituary does not exist', async () => {
    mockObituaryFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .put('/api/obituaries/nonexistent')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('name', 'Updated');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('updates obituary name and content', async () => {
    mockObituaryFindUnique.mockResolvedValue(sampleObituary);
    const updated = { ...sampleObituary, name: 'Updated Name', content: 'Updated content' };
    mockObituaryUpdate.mockResolvedValue(updated);

    const app = createApp();
    const res = await request(app)
      .put('/api/obituaries/obit-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('name', 'Updated Name')
      .field('content', 'Updated content');

    expect(res.status).toBe(200);
    expect(mockObituaryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'obit-1' },
        data: expect.objectContaining({
          name: 'Updated Name',
          content: 'Updated content',
        }),
      }),
    );
  });

  it('updates obituary with new image', async () => {
    mockObituaryFindUnique.mockResolvedValue(sampleObituary);
    mockObituaryUpdate.mockResolvedValue(sampleObituary);

    const app = createApp();
    const res = await request(app)
      .put('/api/obituaries/obit-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('name', 'Updated')
      .attach('image', Buffer.from('new-image-data'), 'new-photo.jpg');

    expect(res.status).toBe(200);
    expect(mockObituaryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageData: expect.any(Uint8Array),
        }),
      }),
    );
  });

  it('updates obituary publishedAt', async () => {
    mockObituaryFindUnique.mockResolvedValue(sampleObituary);
    mockObituaryUpdate.mockResolvedValue(sampleObituary);
    const publishedAt = '2025-06-01T12:00:00.000Z';

    const app = createApp();
    const res = await request(app)
      .put('/api/obituaries/obit-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('publishedAt', publishedAt);

    expect(res.status).toBe(200);
    expect(mockObituaryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishedAt: new Date(publishedAt),
        }),
      }),
    );
  });

  it('invalidates obituary cache on update', async () => {
    mockObituaryFindUnique.mockResolvedValue(sampleObituary);
    mockObituaryUpdate.mockResolvedValue(sampleObituary);

    const app = createApp();
    await request(app)
      .put('/api/obituaries/obit-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser)
      .field('name', 'Updated');

    expect(mockInvalidateByTags).toHaveBeenCalledWith(['obituaries', 'obituary:obit-1']);
  });
});

// ─── DELETE /:id — Delete obituary ───────────────────────────────────────────

describe('DELETE /api/obituaries/:id', () => {
  it('requires authentication (401 without token)', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/obituaries/obit-1');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('requires Editor+ role (403 for Author)', async () => {
    const app = createApp();
    const res = await request(app)
      .delete('/api/obituaries/obit-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when obituary does not exist', async () => {
    mockObituaryFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .delete('/api/obituaries/nonexistent')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('deletes obituary with Editor role', async () => {
    mockObituaryFindUnique.mockResolvedValue(sampleObituary);
    mockObituaryDelete.mockResolvedValue(sampleObituary);

    const app = createApp();
    const res = await request(app)
      .delete('/api/obituaries/obit-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Obituary deleted successfully');
    expect(mockObituaryDelete).toHaveBeenCalledWith({ where: { id: 'obit-1' } });
  });

  it('deletes obituary with Admin role', async () => {
    mockObituaryFindUnique.mockResolvedValue(sampleObituary);
    mockObituaryDelete.mockResolvedValue(sampleObituary);

    const app = createApp();
    const res = await request(app)
      .delete('/api/obituaries/obit-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Obituary deleted successfully');
  });

  it('invalidates obituary cache on delete', async () => {
    mockObituaryFindUnique.mockResolvedValue(sampleObituary);
    mockObituaryDelete.mockResolvedValue(sampleObituary);

    const app = createApp();
    await request(app)
      .delete('/api/obituaries/obit-1')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', editorUser);

    expect(mockInvalidateByTags).toHaveBeenCalledWith(['obituaries', 'obituary:obit-1']);
  });
});
