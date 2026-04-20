import { NotificationType } from '@prisma/client';
import { prisma } from './db';

export async function createNotificationRecord(
  userId: string,
  overrides: {
    type?: NotificationType;
    title?: string;
    message?: string;
    readAt?: Date | null;
  } = {},
) {
  return prisma.notification.create({
    data: {
      userId,
      type: overrides.type ?? 'session_created',
      title: overrides.title ?? 'Test Notification',
      message: overrides.message ?? 'Test message',
      readAt: overrides.readAt !== undefined ? overrides.readAt : null,
    },
  });
}
