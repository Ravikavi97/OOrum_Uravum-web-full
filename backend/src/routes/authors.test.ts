import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUserFindMany = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findMany: (...args: any[]) => mockUserFindMany(...args),
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
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
  AUTHOR_TTL: 600,
}));

// ─── Test App Setup ──────────────────────────────────────────────────────────

import authorsRouter from './authors';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/authors', authorsRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();

const sampleAuthor = {
  id: 'user-1',
  name: 'முருகன்',
  slug: 'murugan',
  role: 'AUTHOR',
  bio: 'Tamil news writer',
  profileImage: 'https://example.com/murugan.jpg',
  socialLinks: { twitter: '@murugan' },
  createdAt: now,
  _count: { articles: 5 },
};

const sampleEditor = {
  id: 'user-2',
  name: 'செல்வி',
  slug: 'selvi',
  role: 'EDITOR',
  bio: 'Senior editor',
  profileImage: null,
  socialLinks: null,
  createdAt: now,
  _count: { articles: 12 },
};

const sampleAdmin = {
  id: 'user-3',
  name: 'அருண்',
  slug: 'arun',
  role: 'ADMIN',
  bio: 'Platform admin',
  profileImage: null,
  socialLinks: null,
  createdAt: now,
  _count: { articles: 3 },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCached.mockResolvedValue(null);
  mockSetCached.mockResolvedValue(undefined);
  mockAddTagsToKey.mockResolvedValue(undefined);
});

// ─── GET / — List authors ────────────────────────────────────────────────────

describe('GET /api/authors', () => {
  it('returns list of authors filtered by role', async () => {
    mockUserFindMany.mockResolvedValue([sampleAuthor, sampleEditor, sampleAdmin]);

    const app = createApp();
    const res = await request(app).get('/api/authors');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    // Verify role filter was applied
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { in: ['AUTHOR', 'EDITOR', 'ADMIN'] } },
      }),
    );
  });

  it('does not expose password hash', async () => {
    mockUserFindMany.mockResolvedValue([sampleAuthor]);

    const app = createApp();
    const res = await request(app).get('/api/authors');

    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty('passwordHash');
    expect(res.body[0]).not.toHaveProperty('password_hash');
    expect(res.body[0]).not.toHaveProperty('email');
  });

  it('includes published article count', async () => {
    mockUserFindMany.mockResolvedValue([sampleAuthor]);

    const app = createApp();
    const res = await request(app).get('/api/authors');

    expect(res.body[0]._count.articles).toBe(5);
  });

  it('returns cached result when available', async () => {
    const cached = [sampleAuthor];
    mockGetCached.mockResolvedValue(cached);

    const app = createApp();
    const res = await request(app).get('/api/authors');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(sampleAuthor.id);
    expect(mockUserFindMany).not.toHaveBeenCalled();
  });

  it('caches result with AUTHOR_TTL (600s)', async () => {
    mockUserFindMany.mockResolvedValue([sampleAuthor]);

    const app = createApp();
    await request(app).get('/api/authors');

    expect(mockSetCached).toHaveBeenCalledWith('authors:list', [sampleAuthor], 600);
    expect(mockAddTagsToKey).toHaveBeenCalledWith('authors:list', ['authors']);
  });

  it('returns 500 on database error', async () => {
    mockUserFindMany.mockRejectedValue(new Error('DB error'));

    const app = createApp();
    const res = await request(app).get('/api/authors');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

// ─── GET /:slug — Author profile ────────────────────────────────────────────

describe('GET /api/authors/:slug', () => {
  it('returns author profile by slug', async () => {
    mockUserFindUnique.mockResolvedValue(sampleAuthor);

    const app = createApp();
    const res = await request(app).get('/api/authors/murugan');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('முருகன்');
    expect(res.body.slug).toBe('murugan');
    expect(res.body.bio).toBe('Tamil news writer');
    expect(res.body.profileImage).toBe('https://example.com/murugan.jpg');
    expect(res.body.socialLinks).toEqual({ twitter: '@murugan' });
  });

  it('includes published article count', async () => {
    mockUserFindUnique.mockResolvedValue(sampleAuthor);

    const app = createApp();
    const res = await request(app).get('/api/authors/murugan');

    expect(res.body._count.articles).toBe(5);
  });

  it('returns 404 for non-existent author', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get('/api/authors/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns cached result when available', async () => {
    mockGetCached.mockResolvedValue(sampleAuthor);

    const app = createApp();
    const res = await request(app).get('/api/authors/murugan');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sampleAuthor.id);
    expect(res.body.name).toBe(sampleAuthor.name);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('caches result with AUTHOR_TTL and proper tags', async () => {
    mockUserFindUnique.mockResolvedValue(sampleAuthor);

    const app = createApp();
    await request(app).get('/api/authors/murugan');

    expect(mockSetCached).toHaveBeenCalledWith('authors:detail:murugan', sampleAuthor, 600);
    expect(mockAddTagsToKey).toHaveBeenCalledWith('authors:detail:murugan', ['authors', 'author:user-1']);
  });

  it('returns 500 on database error', async () => {
    mockUserFindUnique.mockRejectedValue(new Error('DB error'));

    const app = createApp();
    const res = await request(app).get('/api/authors/murugan');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
