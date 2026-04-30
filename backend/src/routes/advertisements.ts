import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  position: z.enum(['sidebar', 'banner', 'header']).optional(),
  cropPosition: z.string().optional().nullable(),
  active: z.boolean().optional(),
  order: z.number().optional(),
});

// GET / — List ads (public: only active; admin: all)
router.get('/', async (req: Request, res: Response) => {
  try {
    const isAdmin = req.headers.authorization?.startsWith('Bearer ');
    const where = isAdmin ? {} : { active: true };
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
    res.json(ad);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update ad' } });
  }
});

// DELETE /:id — Delete ad (Admin only)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.advertisement.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Ad deleted' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete ad' } });
  }
});

export default router;
