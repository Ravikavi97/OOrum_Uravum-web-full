import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockFindMany = vi.fn();
const mockUpsert = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const mockGetCached = vi.fn();
const mockSetCached = vi.fn();
const mockInvalidateByPattern = vi.fn();

vi.mock('../lib/cache', () => ({
  getCached: (...args: unknown[]) => mockGetCached(...args),
  setCached: (...args: unknown[]) => mockSetCached(...args),
  invalidateByPattern: (...args: unknown[]) => mockInvalidateByPattern(...args),
  SETTINGS_TTL: 300,
}));

vi.mock('../lib/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockRevalidateFrontend = vi.fn();

vi.mock('../lib/revalidate', () => ({
  revalidateFrontend: (...args: unknown[]) => mockRevalidateFrontend(...args),
}));

import settingsRouter from './settings';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/settings', settingsRouter);
  return app;
}

describe('settings routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCached.mockResolvedValue(null);
    mockSetCached.mockResolvedValue(undefined);
    mockInvalidateByPattern.mockResolvedValue(undefined);
    mockRevalidateFrontend.mockResolvedValue(undefined);
    mockUpsert.mockImplementation(({ where, update }) => Promise.resolve({
      key: where.key,
      value: update.value,
    }));
    mockTransaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
  });

  it('exposes the public analytics measurement ID without exposing unrelated secrets', async () => {
    const rows = [
      { key: 'analyticsId', value: 'G-ABCDEF1234' },
      { key: 'jwtSecret', value: 'never-public' },
    ];
    mockFindMany.mockImplementation((args: { where?: { key?: { in?: string[] } } }) => (
      Promise.resolve(rows.filter((row) => args.where?.key?.in?.includes(row.key)))
    ));

    const response = await request(createApp()).get('/api/settings/public');

    expect(response.status).toBe(200);
    expect(response.body.analyticsId).toBe('G-ABCDEF1234');
    expect(response.body.jwtSecret).toBeUndefined();
  });

  it('saves a settings draft in one transaction and revalidates the frontend', async () => {
    mockFindMany.mockResolvedValue([
      { key: 'siteTitle', value: 'Updated site' },
      { key: 'themeColors', value: '{"primaryDark":"#285430"}' },
    ]);

    const response = await request(createApp())
      .put('/api/settings')
      .send({
        settings: {
          siteTitle: 'Updated site',
          themeColors: '{"primaryDark":"#285430"}',
        },
      });

    expect(response.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTransaction.mock.calls[0][0]).toHaveLength(2);
    expect(mockInvalidateByPattern).toHaveBeenCalledWith('settings:*');
    expect(mockRevalidateFrontend).toHaveBeenCalledOnce();
  });
});
