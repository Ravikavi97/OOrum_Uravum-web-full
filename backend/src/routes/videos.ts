import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import { revalidateFrontend } from '../lib/revalidate';
import { generateUniqueSlug } from '../lib/slug';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  videoUrl: z.string().url().min(1),
  thumbnailUrl: z.string().optional(),
  platform: z.enum(['youtube', 'vimeo', 'dailymotion', 'other']).optional(),
  active: z.boolean().optional(),
  order: z.number().optional(),
  categoryId: z.string().optional().nullable(),
});

function parseVideoUrl(url: string): { platform: string; embedUrl: string; thumbnailUrl: string | null } {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return { platform: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`, thumbnailUrl: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg` };
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { platform: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`, thumbnailUrl: null };
  }
  const dmMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dmMatch) {
    return { platform: 'dailymotion', embedUrl: `https://www.dailymotion.com/embed/video/${dmMatch[1]}`, thumbnailUrl: `https://www.dailymotion.com/thumbnail/video/${dmMatch[1]}` };
  }
  return { platform: 'other', embedUrl: url, thumbnailUrl: null };
}

// ─── Video Categories ────────────────────────────────────────────────────────

const catSchema = z.object({ name: z.string().min(1), slug: z.string().min(1) });

// GET /categories — list video categories
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const cats = await prisma.videoCat.findMany({ orderBy: { name: 'asc' } });
    res.json(cats);
  } catch (err) {
    console.error('[videos] GET /categories error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch video categories' } });
  }
});

// POST /categories — create video category
router.post('/categories', requireAuth, requireRole('ADMIN', 'EDITOR'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = catSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.flatten().fieldErrors } });
    return;
  }
  try {
    const cat = await prisma.videoCat.create({ data: parsed.data });
    res.status(201).json(cat);
  } catch (err) {
    console.error('[videos] POST /categories error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create video category' } });
  }
});

// DELETE /categories/:id
router.delete('/categories/:id', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.videoCat.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Video category deleted' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete video category' } });
  }
});

// ─── Video Posts ─────────────────────────────────────────────────────────────

// GET / — List videos (public: only active; admin: all)
router.get('/', async (req: Request, res: Response) => {
  try {
    const isAdmin = req.headers.authorization?.startsWith('Bearer ');
    const where = isAdmin ? {} : { active: true };
    const videos = await prisma.videoPost.findMany({
      where,
      include: { category: true },
      orderBy: [{ order: 'asc' }, { publishedAt: 'desc' }],
    });
    res.json(videos);
  } catch (err) {
    console.error('[videos] GET / error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch videos' } });
  }
});

// GET /:id — Get single video (supports both ID and slug)
router.get('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const param = req.params.idOrSlug as string;
    // Try by slug first, then by ID
    let video = await prisma.videoPost.findUnique({ where: { slug: param }, include: { category: true } });
    if (!video) {
      video = await prisma.videoPost.findUnique({ where: { id: param }, include: { category: true } });
    }
    if (!video) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Video not found' } }); return; }
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch video' } });
  }
});

// POST / — Create video
router.post('/', requireAuth, requireRole('ADMIN', 'EDITOR'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.flatten().fieldErrors } });
    return;
  }
  try {
    const { platform: detectedPlatform, thumbnailUrl: autoThumb } = parseVideoUrl(parsed.data.videoUrl);
    const slug = await generateUniqueSlug(parsed.data.title, 'videoPost');
    const video = await prisma.videoPost.create({
      data: {
        title: parsed.data.title,
        slug,
        description: parsed.data.description,
        videoUrl: parsed.data.videoUrl,
        thumbnailUrl: parsed.data.thumbnailUrl || autoThumb || undefined,
        platform: parsed.data.platform || detectedPlatform,
        active: parsed.data.active,
        order: parsed.data.order,
        categoryId: parsed.data.categoryId || null,
      },
      include: { category: true },
    });
    revalidateFrontend();
    res.status(201).json(video);
  } catch (err) {
    console.error('[videos] POST / error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create video' } });
  }
});

// PUT /:id — Update video
router.put('/:id', requireAuth, requireRole('ADMIN', 'EDITOR'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } });
    return;
  }
  try {
    const data: Record<string, unknown> = { ...parsed.data };
    if (data.videoUrl) {
      const { platform: detectedPlatform, thumbnailUrl: autoThumb } = parseVideoUrl(data.videoUrl as string);
      if (!data.platform) data.platform = detectedPlatform;
      if (!data.thumbnailUrl && autoThumb) data.thumbnailUrl = autoThumb;
    }
    if (data.categoryId === '') data.categoryId = null;
    const video = await prisma.videoPost.update({ where: { id: req.params.id as string }, data, include: { category: true } });
    revalidateFrontend();
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update video' } });
  }
});

// DELETE /:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.videoPost.delete({ where: { id: req.params.id as string } });
    revalidateFrontend();
    res.json({ message: 'Video deleted' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete video' } });
  }
});

export { parseVideoUrl };
export default router;
