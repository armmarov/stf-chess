import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createNotificationRecord } from '../../helpers/notifications';

const URL = '/api/notifications/read-all';

describe('POST /api/notifications/read-all', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app).post(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('204 — marks all own unread as read', () => {
    it('204 and all own unread notifications have readAt set', async () => {
      const { agent, user } = await loginAs('student');
      const n1 = await createNotificationRecord(user.id);
      const n2 = await createNotificationRecord(user.id);

      const res = await agent.post(URL);

      expect(res.status).toBe(204);

      const rows = await prisma.notification.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(2);
      expect(rows.every((n) => n.readAt !== null)).toBe(true);
    });

    it('does not mark other users\' notifications as read', async () => {
      const { agent } = await loginAs('student');
      const other = await createUser('student');
      const othersNotif = await createNotificationRecord(other.id);

      await agent.post(URL);

      const row = await prisma.notification.findUnique({ where: { id: othersNotif.id } });
      expect(row!.readAt).toBeNull();
    });

    it('204 with no unread notifications is a no-op', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL);
      expect(res.status).toBe(204);
    });
  });
});
