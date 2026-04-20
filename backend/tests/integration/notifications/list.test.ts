import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createNotificationRecord } from '../../helpers/notifications';

const URL = '/api/notifications';

describe('GET /api/notifications', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — own notifications only', () => {
    it('returns only own notifications, not other users\'', async () => {
      const { agent, user } = await loginAs('student');
      const other = await createUser('student');
      await createNotificationRecord(user.id, { title: 'Mine 1' });
      await createNotificationRecord(user.id, { title: 'Mine 2' });
      await createNotificationRecord(other.id, { title: 'Theirs' });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(2);
      const titles = res.body.notifications.map((n: { title: string }) => n.title);
      expect(titles).toContain('Mine 1');
      expect(titles).toContain('Mine 2');
      expect(titles).not.toContain('Theirs');
    });

    it('response shape includes expected fields', async () => {
      const { agent, user } = await loginAs('student');
      await createNotificationRecord(user.id, { title: 'Shape Test' });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const n = res.body.notifications[0];
      expect(n.id).toBeDefined();
      expect(n.type).toBeDefined();
      expect(n.title).toBe('Shape Test');
      expect(n.message).toBeDefined();
      expect('readAt' in n).toBe(true);
      expect(n.createdAt).toBeDefined();
    });

    it('empty list when user has no notifications', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.notifications).toEqual([]);
    });
  });

  describe('200 — unread filter', () => {
    it('?unread=true returns only unread notifications', async () => {
      const { agent, user } = await loginAs('student');
      await createNotificationRecord(user.id, { title: 'Unread' });
      await createNotificationRecord(user.id, { title: 'Read', readAt: new Date() });

      const res = await agent.get(`${URL}?unread=true`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0].title).toBe('Unread');
      expect(res.body.notifications[0].readAt).toBeNull();
    });

    it('?unread=false returns all notifications including read ones', async () => {
      const { agent, user } = await loginAs('student');
      await createNotificationRecord(user.id);
      await createNotificationRecord(user.id, { readAt: new Date() });

      const res = await agent.get(`${URL}?unread=false`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(2);
    });
  });
});
