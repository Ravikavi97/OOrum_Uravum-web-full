import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import { getCached, setCached, invalidateByPattern, SETTINGS_TTL } from '../lib/cache';
import { revalidateFrontend } from '../lib/revalidate';

const router = Router();

const SETTINGS_CACHE_KEY = 'settings:all';
const PUBLIC_SETTINGS_CACHE_KEY = 'settings:public';

// Keys that are safe to expose publicly (no analytics IDs, secrets, etc.)
const PUBLIC_SETTING_KEYS = [
  'siteTitle',
  'siteDescription',
  'siteTagline',
  'socialLinks',
  'homeLayout',
  'heroConfig',
  'headerLogo',
  'footerLogo',
  'themeColors',
];

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const updateSettingsSchema = z.object({
  siteTitle: z.string().min(1).optional(),
  siteDescription: z.string().optional(),
  siteTagline: z.string().optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
  analyticsId: z.string().optional(),
  // Generic key/value for custom settings like homeLayout
  key: z.string().optional(),
  value: z.string().optional(),
});

// ─── GET /public — Get non-sensitive settings (no auth) ──────────────────────

router.get('/public', async (_req, res: Response) => {
  try {
    const cached = await getCached<Record<string, string>>(PUBLIC_SETTINGS_CACHE_KEY);
    if (cached) {
      res.json(cached);
      return;
    }

    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: PUBLIC_SETTING_KEYS } },
    });
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    await setCached(PUBLIC_SETTINGS_CACHE_KEY, settings, SETTINGS_TTL);

    res.json(settings);
  } catch (err) {
    console.error('[settings] GET /public error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch public settings' },
    });
  }
});

// ─── GET / — Get all settings (Admin only) ───────────────────────────────────

router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await prisma.siteSetting.findMany();
      const result = rows.map((row) => ({ key: row.key, value: row.value }));
      res.json(result);
    } catch (err) {
      console.error('[settings] GET / error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch settings' },
      });
    }
  },
);

// ─── PUT / — Update settings (Admin only) ────────────────────────────────────

router.put(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      });
      return;
    }

    try {
      const entries: Array<{ key: string; value: string }> = [];

      if (parsed.data.siteTitle !== undefined) {
        entries.push({ key: 'siteTitle', value: parsed.data.siteTitle });
      }
      if (parsed.data.siteDescription !== undefined) {
        entries.push({ key: 'siteDescription', value: parsed.data.siteDescription });
      }
      if (parsed.data.siteTagline !== undefined) {
        entries.push({ key: 'siteTagline', value: parsed.data.siteTagline });
      }
      if (parsed.data.socialLinks !== undefined) {
        entries.push({ key: 'socialLinks', value: JSON.stringify(parsed.data.socialLinks) });
      }
      if (parsed.data.analyticsId !== undefined) {
        entries.push({ key: 'analyticsId', value: parsed.data.analyticsId });
      }

      // Handle generic key/value pairs (e.g., homeLayout)
      if (parsed.data.key && parsed.data.value !== undefined) {
        entries.push({ key: parsed.data.key, value: parsed.data.value });
      }

      // Upsert each setting
      for (const { key, value } of entries) {
        await prisma.siteSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }

      // Invalidate settings cache
      await invalidateByPattern('settings:*');
      revalidateFrontend();

      // Return updated settings
      const rows = await prisma.siteSetting.findMany();
      const result = rows.map((row) => ({ key: row.key, value: row.value }));

      res.json(result);
    } catch (err) {
      console.error('[settings] PUT / error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' },
      });
    }
  },
);

export default router;
