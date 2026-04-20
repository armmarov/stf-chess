import { NotificationType } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  linkPath?: string,
) {
  return prisma.notification.create({
    data: { userId, type, title, message, linkPath },
  });
}

export async function createManyNotifications(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  linkPath?: string,
) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, message, linkPath })),
  });
}

export async function listForUser(
  userId: string,
  opts: { limit: number; unreadOnly: boolean },
) {
  return prisma.notification.findMany({
    where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: opts.limit,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      linkPath: true,
      payload: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, notificationId: string) {
  const n = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!n || n.userId !== userId) throw new AppError(404, 'Notification not found');
  if (n.readAt) return n;
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
