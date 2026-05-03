import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';

const router = Router();

// GET / — List notifications (latest 50, unread first)
router.get('/', requireAuth, requireRole('ADMIN', 'EDITOR'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await prisma.adminNotification.findMany({
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    console.error('[notifications] GET / error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' } });
  }
});

// GET /unread-count — Get count of unread notifications
router.get('/unread-count', requireAuth, requireRole('ADMIN', 'EDITOR'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await prisma.adminNotification.count({ where: { read: false } });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to count notifications' } });
  }
});

// PUT /:id/read — Mark notification as read
router.put('/:id/read', requireAuth, requireRole('ADMIN', 'EDITOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.adminNotification.update({ where: { id: req.params.id as string }, data: { read: true } });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update notification' } });
  }
});

// PUT /read-all — Mark all notifications as read
router.put('/read-all', requireAuth, requireRole('ADMIN', 'EDITOR'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.adminNotification.updateMany({ where: { read: false }, data: { read: true } });
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update notifications' } });
  }
});

export default router;
