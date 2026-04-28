import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

const router = Router();

// Live threshold: sessions active in the last 5 minutes
const LIVE_THRESHOLD_MS = 5 * 60 * 1000;

function todayDate(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ─── POST /ping — Record a visitor heartbeat ────────────────────────────────

router.post('/ping', async (req: Request, res: Response) => {
  try {
    // Get or create session ID from body
    let sessionId = req.body?.sessionId as string | undefined;
    const isNew = !sessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500);
    const now = new Date();

    // Upsert session
    await prisma.visitorSession.upsert({
      where: { sessionId },
      update: { lastSeen: now, ip, userAgent },
      create: { sessionId, ip, userAgent, lastSeen: now },
    });

    // If new session, increment today's count and total
    if (isNew) {
      const today = todayDate();
      await prisma.visitorCount.upsert({
        where: { date: today },
        update: { count: { increment: 1 } },
        create: { date: today, count: 1 },
      });

      await prisma.visitorTotal.upsert({
        where: { id: 'total' },
        update: { total: { increment: 1 } },
        create: { id: 'total', total: 1 },
      });
    }

    res.json({ sessionId });
  } catch (err) {
    console.error('[visitors] POST /ping error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to record visit' } });
  }
});

// ─── GET /stats — Get visitor statistics ─────────────────────────────────────

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const liveThreshold = new Date(now.getTime() - LIVE_THRESHOLD_MS);
    const today = todayDate();

    const [liveCount, todayRow, totalRow] = await Promise.all([
      prisma.visitorSession.count({ where: { lastSeen: { gte: liveThreshold } } }),
      prisma.visitorCount.findUnique({ where: { date: today } }),
      prisma.visitorTotal.findUnique({ where: { id: 'total' } }),
    ]);

    res.json({
      live: liveCount,
      today: todayRow?.count ?? 0,
      total: totalRow?.total ?? 0,
    });
  } catch (err) {
    console.error('[visitors] GET /stats error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stats' } });
  }
});

export default router;
