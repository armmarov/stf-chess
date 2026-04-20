import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createPollRecord, createVoteRecord } from '../../helpers/polls';

const URL = '/api/polls';
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/polls', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — any authed role', () => {
    it('admin gets 200 with polls array', async () => {
      const { agent, user: admin } = await loginAs('admin');
      await createPollRecord(admin.id);
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.polls)).toBe(true);
      expect(res.body.polls.length).toBeGreaterThanOrEqual(1);
    });

    it('teacher gets 200', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.polls)).toBe(true);
    });

    it('student gets 200', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });

    it('empty list when no polls', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.polls).toHaveLength(0);
    });
  });

  describe('isActive — computed field', () => {
    it('isActive: true when now is within startDate–endDate', async () => {
      const admin = await createUser('admin');
      await createPollRecord(admin.id, {
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(Date.now() + 60 * 60 * 1000),
      });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.body.polls[0].isActive).toBe(true);
    });

    it('isActive: false before startDate', async () => {
      const admin = await createUser('admin');
      await createPollRecord(admin.id, {
        startDate: new Date(Date.now() + 60 * 60 * 1000),
        endDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.body.polls[0].isActive).toBe(false);
    });

    it('isActive: false after endDate', async () => {
      const admin = await createUser('admin');
      await createPollRecord(admin.id, {
        startDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 60 * 60 * 1000),
      });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.body.polls[0].isActive).toBe(false);
    });
  });

  describe('myVoted flag', () => {
    it('myVoted: false when user has not voted', async () => {
      const admin = await createUser('admin');
      await createPollRecord(admin.id);
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.body.polls[0].myVoted).toBe(false);
    });

    it('myVoted: true after user has voted', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent, user: student } = await loginAs('student');
      await createVoteRecord(poll.id, poll.options[0].id, student.id);

      const res = await agent.get(URL);
      expect(res.body.polls[0].myVoted).toBe(true);
    });

    it('myVoted is per-user — other user vote does not affect own flag', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const otherStudent = await createUser('student');
      await createVoteRecord(poll.id, poll.options[0].id, otherStudent.id);

      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.body.polls[0].myVoted).toBe(false);
    });
  });

  describe('list item shape', () => {
    it('list items do not expose imagePath', async () => {
      const admin = await createUser('admin');
      await createPollRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      const item = res.body.polls[0];
      expect(item.imagePath).toBeUndefined();
      expect(item.options).toBeUndefined();
    });

    it('list items have id, title, startDate, endDate, isActive, myVoted', async () => {
      const admin = await createUser('admin');
      await createPollRecord(admin.id, { title: 'Shape Test Poll' });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      const item = res.body.polls[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('startDate');
      expect(item).toHaveProperty('endDate');
      expect(item).toHaveProperty('isActive');
      expect(item).toHaveProperty('myVoted');
    });
  });

  describe('ordering — endDate desc', () => {
    it('polls ordered by endDate desc', async () => {
      const admin = await createUser('admin');
      const now = Date.now();
      const p1 = await createPollRecord(admin.id, {
        title: 'Ends Soon',
        startDate: new Date(now - 3600000),
        endDate: new Date(now + 3600000),
      });
      const p2 = await createPollRecord(admin.id, {
        title: 'Ends Later',
        startDate: new Date(now - 3600000),
        endDate: new Date(now + 7200000),
      });

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      const ids = res.body.polls.map((p: { id: string }) => p.id);
      expect(ids.indexOf(p2.id)).toBeLessThan(ids.indexOf(p1.id));
    });
  });
});
