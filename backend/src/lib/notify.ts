import { prisma } from './prisma';

/**
 * Create an admin notification. Fire-and-forget — errors are logged but don't block.
 */
export async function createAdminNotification(data: {
  type: string;
  title: string;
  message: string;
  link: string;
}): Promise<void> {
  try {
    await prisma.adminNotification.create({ data });
  } catch (err) {
    console.error('[notify] Failed to create notification:', err);
  }
}
