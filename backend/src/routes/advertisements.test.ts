import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockAdFindMany = vi.fn();
const mockAdFindUnique = vi.fn();
const mockAdCreate = vi.fn();
const mockAdUpdate = vi.fn();
const mockAdDelete = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    advertisement: {
      findMany: (...args: any[]) => mockAdFindMany(...args),
      findUnique: (...args: any[]) => mockAdFindUnique(...args),
      create: (...args: any[]) => mockAdCreate(...args),
      update: (...args: any[]) => mockAdUpdate(...args),
      delete: (...args: any[]) => mockAdDelete(...args),
    },
  },
}));

const mockInvalidateByTags = vi.fn();
vi.mock('../lib/cache', () => ({
  invalidateByTags: (...args: any[]) => mockInvalidateByTags(...args),
}));

const mockRevalidateFrontend = vi.fn();
vi.mock('../lib/revalidate', () => ({
  revalidateFrontend: (...args: any[]) => mockRevalidateFrontend(...args),
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
    req.user = testUser ? JSON.parse(testUser) : { userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };
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

import advertisementsRouter from './advertisements';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/ads', advertisementsRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const sidebarAd = {
  id: 'ad-1',
  title: 'International Tamil Literature Conference',
  description: 'Join global scholars, writers, and artists for a 3-day cultural forum.',
  imageUrl: 'https://example.com/event.jpg',
  linkUrl: 'https://example.com/register',
  position: 'sidebar',
  cropPosition: null,
  active: true,
  order: 0,
  variant: 'event',
  badge: 'UPCOMING EVENT',
  metaText: 'Tamil Cultural Fest 2026',
  icon: null,
  linkLabel: 'Register & Sponsor',
};

const headerAd = {
  id: 'ad-2',
  title: 'Header Promo',
  description: null,
  imageUrl: null,
  linkUrl: null,
  position: 'header',
  cropPosition: null,
  active: true,
  order: 1,
  variant: 'default',
  badge: null,
  metaText: null,
  icon: null,
  linkLabel: null,
};

const adminUser = JSON.stringify({ userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' });
const editorUser = JSON.stringify({ userId: 'editor-1', email: 'editor@test.com', role: 'EDITOR' });

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockInvalidateByTags.mockResolvedValue(undefined);
  mockRevalidateFrontend.mockResolvedValue(undefined);
});

// ─── GET / — List ads ────────────────────────────────────────────────────────

describe('GET /api/ads', () => {
  it('returns only active ads for public requests', async () => {
    mockAdFindMany.mockResolvedValue([sidebarAd]);

    const res = await request(createApp()).get('/api/ads');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockAdFindMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { order: 'asc' },
    });
  });

  it('returns all ads (active and inactive) for admin requests', async () => {
    mockAdFindMany.mockResolvedValue([sidebarAd, headerAd]);

    const res = await request(createApp())
      .get('/api/ads')
      .set('Authorization', 'Bearer token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockAdFindMany).toHaveBeenCalledWith({ where: {}, orderBy: { order: 'asc' } });
  });

  it('filters by position for public requests', async () => {
    mockAdFindMany.mockResolvedValue([sidebarAd]);

    const res = await request(createApp()).get('/api/ads?position=sidebar');

    expect(res.status).toBe(200);
    expect(mockAdFindMany).toHaveBeenCalledWith({
      where: { active: true, position: 'sidebar' },
      orderBy: { order: 'asc' },
    });
  });

  it('combines position filter with the admin visibility rule', async () => {
    mockAdFindMany.mockResolvedValue([]);

    await request(createApp())
      .get('/api/ads?position=banner')
      .set('Authorization', 'Bearer token')
      .set('x-test-user', adminUser);

    expect(mockAdFindMany).toHaveBeenCalledWith({
      where: { position: 'banner' },
      orderBy: { order: 'asc' },
    });
  });

  it('rejects an unknown position with 400', async () => {
    const res = await request(createApp()).get('/api/ads?position=bogus');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockAdFindMany).not.toHaveBeenCalled();
  });

  it('exposes the ad fields the frontend sidebar renders', async () => {
    mockAdFindMany.mockResolvedValue([sidebarAd]);

    const res = await request(createApp()).get('/api/ads?position=sidebar');

    expect(res.body[0]).toMatchObject({
      id: 'ad-1',
      title: sidebarAd.title,
      description: sidebarAd.description,
      imageUrl: sidebarAd.imageUrl,
      linkUrl: sidebarAd.linkUrl,
      position: 'sidebar',
      active: true,
      variant: 'event',
      badge: 'UPCOMING EVENT',
      metaText: 'Tamil Cultural Fest 2026',
      linkLabel: 'Register & Sponsor',
    });
  });
});

// ─── Card presentation fields ────────────────────────────────────────────────

describe('ad card presentation fields', () => {
  const post = (body: Record<string, unknown>) =>
    request(createApp())
      .post('/api/ads')
      .set('Authorization', 'Bearer token')
      .set('x-test-user', adminUser)
      .send(body);

  it('accepts a badge, meta text, variant and link label', async () => {
    mockAdCreate.mockResolvedValue(sidebarAd);

    const res = await post({
      title: 'Tamil Cultural Fest 2026',
      variant: 'event',
      badge: 'UPCOMING EVENT',
      metaText: 'Tamil Cultural Fest 2026',
      linkLabel: 'Register & Sponsor',
    });

    expect(res.status).toBe(201);
    expect(mockAdCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Tamil Cultural Fest 2026',
        variant: 'event',
        badge: 'UPCOMING EVENT',
        metaText: 'Tamil Cultural Fest 2026',
        linkLabel: 'Register & Sponsor',
      }),
    });
  });

  it('accepts each supported icon key', async () => {
    for (const icon of ['calendar', 'book', 'ticket', 'megaphone', 'gift', 'users', 'heart', 'sparkles', 'star', 'globe']) {
      mockAdCreate.mockResolvedValue({ ...sidebarAd, icon });
      const res = await post({ title: 'Icon ad', icon });
      expect(res.status).toBe(201);
    }
  });

  it('rejects an unknown icon key with 400', async () => {
    const res = await post({ title: 'Bad icon', icon: 'rocket' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockAdCreate).not.toHaveBeenCalled();
  });

  it('rejects an unknown variant with 400', async () => {
    const res = await post({ title: 'Bad variant', variant: 'giant' });

    expect(res.status).toBe(400);
    expect(mockAdCreate).not.toHaveBeenCalled();
  });

  it('rejects a badge longer than 50 characters with 400', async () => {
    const res = await post({ title: 'Long badge', badge: 'x'.repeat(51) });

    expect(res.status).toBe(400);
    expect(mockAdCreate).not.toHaveBeenCalled();
  });

  it('rejects a meta text longer than 255 characters with 400', async () => {
    const res = await post({ title: 'Long meta', metaText: 'x'.repeat(256) });

    expect(res.status).toBe(400);
    expect(mockAdCreate).not.toHaveBeenCalled();
  });

  it('accepts null to clear the presentation fields on update', async () => {
    mockAdUpdate.mockResolvedValue(headerAd);

    const res = await request(createApp())
      .put('/api/ads/ad-1')
      .set('Authorization', 'Bearer token')
      .set('x-test-user', adminUser)
      .send({ badge: null, metaText: null, icon: null, linkLabel: null });

    expect(res.status).toBe(200);
    expect(mockAdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ad-1' },
        data: expect.objectContaining({ badge: null, metaText: null, icon: null, linkLabel: null }),
      })
    );
  });
});

// ─── GET /meta/icons — allowed values for the dashboard ─────────────────────

describe('GET /api/ads/meta/icons', () => {
  it('returns the icon keys, variants and positions', async () => {
    const res = await request(createApp()).get('/api/ads/meta/icons');

    expect(res.status).toBe(200);
    expect(res.body.icons).toContain('calendar');
    expect(res.body.icons).toContain('book');
    expect(res.body.variants).toEqual(['default', 'event', 'book']);
    expect(res.body.positions).toEqual(['sidebar', 'banner', 'header']);
  });
});

// ─── Cache invalidation on mutations ─────────────────────────────────────────

describe('ad mutations invalidate cache', () => {
  it('invalidates the ads tag and notifies the frontend on create', async () => {
    mockAdCreate.mockResolvedValue(sidebarAd);

    const res = await request(createApp())
      .post('/api/ads')
      .set('Authorization', 'Bearer token')
      .set('x-test-user', adminUser)
      .send({ title: 'New Ad', position: 'sidebar' });

    expect(res.status).toBe(201);
    expect(mockInvalidateByTags).toHaveBeenCalledWith(['ads']);
    expect(mockRevalidateFrontend).toHaveBeenCalled();
  });

  it('invalidates the ads tag and notifies the frontend on update', async () => {
    mockAdUpdate.mockResolvedValue({ ...sidebarAd, active: false });

    const res = await request(createApp())
      .put('/api/ads/ad-1')
      .set('Authorization', 'Bearer token')
      .set('x-test-user', adminUser)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(mockInvalidateByTags).toHaveBeenCalledWith(['ads']);
    expect(mockRevalidateFrontend).toHaveBeenCalled();
  });

  it('invalidates the ads tag and notifies the frontend on delete', async () => {
    mockAdDelete.mockResolvedValue({});

    const res = await request(createApp())
      .delete('/api/ads/ad-1')
      .set('Authorization', 'Bearer token')
      .set('x-test-user', adminUser);

    expect(res.status).toBe(200);
    expect(mockInvalidateByTags).toHaveBeenCalledWith(['ads']);
    expect(mockRevalidateFrontend).toHaveBeenCalled();
  });
});

// ─── Authorization ───────────────────────────────────────────────────────────

describe('ad mutations require ADMIN', () => {
  it('rejects unauthenticated create (401)', async () => {
    const res = await request(createApp()).post('/api/ads').send({ title: 'Ad' });
    expect(res.status).toBe(401);
    expect(mockAdCreate).not.toHaveBeenCalled();
  });

  it('rejects EDITOR create (403)', async () => {
    const res = await request(createApp())
      .post('/api/ads')
      .set('Authorization', 'Bearer token')
      .set('x-test-user', editorUser)
      .send({ title: 'Ad' });

    expect(res.status).toBe(403);
    expect(mockAdCreate).not.toHaveBeenCalled();
  });
});