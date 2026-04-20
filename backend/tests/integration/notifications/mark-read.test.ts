import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createNotificationRecord } from '../../helpers/notifications';

const URL = (id: string) => `/api/notifications/${id}/read`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('POST /api/notifications/:id/read', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app).post(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('204 — marks own notification as read', () => {
    it('204 and readAt is set in DB', async () => {
      const { agent, user } = await loginAs('student');
      const notification = await createNotificationRecord(user.id);

      const res = await agent.post(URL(notification.id));

      expect(res.status).toBe(204);

      const row = await prisma.notification.findUnique({ where: { id: notification.id } });
      expect(row!.readAt).not.toBeNull();
    });

    it('calling read twice is idempotent — stays 204', async () => {
      const { agent, user } = await loginAs('student');
      const notification = await createNotificationRecord(user.id);

      await agent.post(URL(notification.id));
      const res = await agent.post(URL(notification.id));

      expect(res.status).toBe(204);
    });
  });

  describe('404 — not found or not owned', () => {
    it('404 for another user\'s notification', async () => {
      const other = await createUser('student');
      const notification = await createNotificationRecord(other.id);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(notification.id));

      expect(res.status).toBe(404);
    });

    it('404 for unknown notification id', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });
});
