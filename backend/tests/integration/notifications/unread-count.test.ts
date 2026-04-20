import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createNotificationRecord } from '../../helpers/notifications';

const URL = '/api/notifications/unread-count';

describe('GET /api/notifications/unread-count', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — correct count', () => {
    it('returns count of own unread notifications', async () => {
      const { agent, user } = await loginAs('student');
      await createNotificationRecord(user.id);
      await createNotificationRecord(user.id);
      await createNotificationRecord(user.id, { readAt: new Date() });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });

    it('returns 0 when all are read', async () => {
      const { agent, user } = await loginAs('student');
      await createNotificationRecord(user.id, { readAt: new Date() });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });

    it('returns 0 when user has no notifications', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });
});
