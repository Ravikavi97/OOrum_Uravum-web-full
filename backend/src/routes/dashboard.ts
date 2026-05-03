import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';

const router = Router();

// GET /stats — All dashboard statistics
router.get('/stats', requireAuth, requireRole('ADMIN', 'EDITOR'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      articlesPublished, articlesDraft, articlesArchived,
      categories, tags,
      cmsUsers,
      frontendUsers, frontendUsersToday,
      commentsTotal, commentsPending,
      obituariesTotal, obituariesPending,
      videosTotal, videoCategories,
      adsTotal, adsActive,
      visitorTotal, visitorToday,
      notificationsUnread,
      recentArticles, recentObituaries,
    ] = await Promise.all([
      prisma.article.count({ where: { status: 'PUBLISHED' } }),
      prisma.article.count({ where: { status: 'DRAFT' } }),
      prisma.article.count({ where: { status: 'ARCHIVED' } }),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.user.count(),
      prisma.frontendUser.count(),
      prisma.frontendUser.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.comment.count(),
      prisma.comment.count({ where: { status: 'PENDING' } }),
      prisma.obituary.count(),
      prisma.obituary.count({ where: { status: 'PENDING' } }),
      prisma.videoPost.count({ where: { active: true } }),
      prisma.videoCat.count(),
      prisma.advertisement.count(),
      prisma.advertisement.count({ where: { active: true } }),
      prisma.visitorTotal.findUnique({ where: { id: 'visitor-total' } }).then((r) => r?.total ?? 0),
      prisma.visitorCount.findFirst({ where: { date: todayStart } }).then((r) => r?.count ?? 0),
      prisma.adminNotification.count({ where: { read: false } }),
      prisma.article.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, title: true, status: true, updatedAt: true, author: { select: { name: true } } } }),
      prisma.obituary.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, submitterName: true, createdAt: true } }),
    ]);

    res.json({
      articles: { published: articlesPublished, draft: articlesDraft, archived: articlesArchived, total: articlesPublished + articlesDraft + articlesArchived },
      categories,
      tags,
      users: { cms: cmsUsers, frontend: frontendUsers, frontendToday: frontendUsersToday },
      comments: { total: commentsTotal, pending: commentsPending },
      obituaries: { total: obituariesTotal, pending: obituariesPending },
      videos: { total: videosTotal, categories: videoCategories },
      ads: { total: adsTotal, active: adsActive },
      visitors: { total: visitorTotal, today: visitorToday },
      notifications: { unread: notificationsUnread },
      recentArticles,
      pendingObituaries: recentObituaries,
    });
  } catch (err) {
    console.error('[dashboard] stats error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stats' } });
  }
});

export default router;
