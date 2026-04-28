import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockMediaCreate = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    media: {
      create: (...args: any[]) => mockMediaCreate(...args),
    },
  },
}));

// Mock sharp — returns chainable object
vi.mock('sharp', () => {
  const mockToFile = vi.fn().mockResolvedValue({});
  const mockResize = vi.fn().mockReturnValue({ toFile: mockToFile });
  const sharpFn = vi.fn().mockReturnValue({ resize: mockResize });
  (sharpFn as any).__mockResize = mockResize;
  (sharpFn as any).__mockToFile = mockToFile;
  return { default: sharpFn };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock multer — factory cannot reference outer variables (hoisted)
vi.mock('multer', () => {
  const mockSingle = vi.fn();
  const multerFn: any = vi.fn().mockReturnValue({ single: mockSingle });
  multerFn.memoryStorage = vi.fn().mockReturnValue({});
  multerFn.MulterError = class MulterError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  };
  multerFn.__mockSingle = mockSingle;
  return { default: multerFn };
});

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

import mediaRouter from './media';
import multer from 'multer';
import sharp from 'sharp';

// Access internal mock handles
const mockMulterSingle = (multer as any).__mockSingle;
const mockResize = (sharp as any).__mockResize;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/media', mediaRouter);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const authorUser = JSON.stringify({ userId: 'user-1', email: 'author@test.com', role: 'AUTHOR' });

const sampleMedia = {
  id: 'media-1',
  filename: 'photo.jpg',
  originalUrl: '/uploads/original/uuid.jpg',
  thumbnailUrl: '/uploads/thumbnail/uuid-thumbnail.jpg',
  mediumUrl: '/uploads/medium/uuid-medium.jpg',
  largeUrl: '/uploads/large/uuid-large.jpg',
  mimeType: 'image/jpeg',
  size: 500000,
  articleId: null,
  createdAt: new Date(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: multer single passes through with a valid file on req
  mockMulterSingle.mockImplementation((_fieldName: string) => (req: any, _res: any, cb: any) => {
    req.file = {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 500000,
      buffer: Buffer.from('fake-image-data'),
    };
    cb(null);
  });
});

// ─── POST /upload — File type validation ─────────────────────────────────────

describe('POST /api/media/upload — file type validation', () => {
  it('rejects unsupported file type', async () => {
    mockMulterSingle.mockImplementation((_fieldName: string) => (_req: any, _res: any, cb: any) => {
      cb(new Error('Unsupported file type: application/pdf. Allowed: JPEG, PNG, WebP, AVIF'));
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UPLOAD_ERROR');
    expect(res.body.error.message).toContain('Unsupported file type');
  });
});

// ─── POST /upload — Size limit enforcement ───────────────────────────────────

describe('POST /api/media/upload — size limit', () => {
  it('rejects file exceeding 10MB', async () => {
    const MulterError = multer.MulterError;
    mockMulterSingle.mockImplementation((_fieldName: string) => (_req: any, _res: any, cb: any) => {
      const err = new MulterError('LIMIT_FILE_SIZE');
      cb(err);
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    expect(res.body.error.message).toContain('10MB');
  });
});

// ─── POST /upload — Successful upload with variant generation ────────────────

describe('POST /api/media/upload — success', () => {
  it('uploads file and generates variants (thumbnail, medium, large)', async () => {
    mockMediaCreate.mockResolvedValue(sampleMedia);

    const app = createApp();
    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(201);
    // sharp.resize should be called 3 times (thumbnail, medium, large)
    expect(mockResize).toHaveBeenCalledTimes(3);
    expect(mockResize).toHaveBeenCalledWith(150, undefined, { withoutEnlargement: true });
    expect(mockResize).toHaveBeenCalledWith(600, undefined, { withoutEnlargement: true });
    expect(mockResize).toHaveBeenCalledWith(1200, undefined, { withoutEnlargement: true });
    // Media record created in DB
    expect(mockMediaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mimeType: 'image/jpeg',
          size: 500000,
        }),
      }),
    );
  });

  it('returns 400 when no file is provided', async () => {
    mockMulterSingle.mockImplementation((_fieldName: string) => (req: any, _res: any, cb: any) => {
      req.file = undefined;
      cb(null);
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user', authorUser);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE');
  });
});

// ─── RBAC ────────────────────────────────────────────────────────────────────

describe('POST /api/media/upload — RBAC', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await request(app).post('/api/media/upload');
    expect(res.status).toBe(401);
  });
});
