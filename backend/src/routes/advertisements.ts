import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest, verifyToken } from '../lib/auth';
import { invalidateByTags } from '../lib/cache';
import { revalidateFrontend } from '../lib/revalidate';

const router = Router();

const positionSchema = z.enum(['sidebar', 'banner', 'header']);
const variantSchema = z.enum(['default', 'event', 'book']);

export const AD_ICON_KEYS = [
  'calendar', 'book', 'ticket', 'megaphone', 'gift',
  'users', 'heart', 'sparkles', 'star', 'globe',
] as const;

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  position: positionSchema.optional(),
  cropPosition: z.string().optional().nullable(),
  active: z.boolean().optional(),
  order: z.number().optional(),
  variant: variantSchema.optional(),
  badge: z.string().max(50).optional().nullable(),
  metaText: z.string().max(255).optional().nullable(),
  icon: z.enum(AD_ICON_KEYS).optional().nullable(),
  linkLabel: z.string().max(100).optional().nullable(),
});

// GET / — List ads (public: only active; admin: all)
// Optional ?position=sidebar|banner|header filter
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated admin by attempting to verify token
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        if (decoded && decoded.role === 'ADMIN') {
          isAdmin = true;
        }
      } catch {
        // Invalid token - treat as non-admin
        isAdmin = false;
      }
    }

    let position: string | undefined;
    if (req.query.position !== undefined) {
      const parsed = positionSchema.safeParse(req.query.position);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid position', details: parsed.error.flatten().fieldErrors } });
        return;
      }
      position = parsed.data;
    }

    const where = {
      ...(isAdmin ? {} : { active: true }),
      ...(position ? { position } : {}),
    };
    const ads = await prisma.advertisement.findMany({
      where,
      orderBy: { order: 'asc' },
    });
    res.json(ads);
  } catch (err) {
    console.error('[ads] GET / error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch ads' } });
  }
});

router.get('/meta/icons', (_req: Request, res: Response) => {
  res.json({ icons: AD_ICON_KEYS, variants: ['default', 'event', 'book'], positions: ['sidebar', 'banner', 'header'] });
});

// GET /:id — Get single ad
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const ad = await prisma.advertisement.findUnique({ where: { id: req.params.id as string } });
    if (!ad) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ad not found' } }); return; }
    res.json(ad);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch ad' } });
  }
});

// POST / — Create ad (Admin only)
router.post('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.flatten().fieldErrors } });
    return;
  }
  try {
    const ad = await prisma.advertisement.create({ data: parsed.data });
    await invalidateByTags(['ads']);
    revalidateFrontend();
    res.status(201).json(ad);
  } catch (err) {
    console.error('[ads] POST / error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create ad' } });
  }
});

// PUT /:id — Update ad (Admin only)
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } });
    return;
  }
  try {
    const ad = await prisma.advertisement.update({ where: { id: req.params.id as string }, data: parsed.data });
    await invalidateByTags(['ads']);
    revalidateFrontend();
    res.json(ad);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update ad' } });
  }
});

// DELETE /:id — Delete ad (Admin only)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.advertisement.delete({ where: { id: req.params.id as string } });
    await invalidateByTags(['ads']);
    revalidateFrontend();
    res.json({ message: 'Ad deleted' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete ad' } });
  }
});

export default router;
