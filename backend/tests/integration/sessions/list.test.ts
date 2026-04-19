import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createSessionRecord, futureDate, pastDate } from '../../helpers/sessions';
import { createPreAttendance } from '../../helpers/attendance';

const URL = '/api/sessions';

describe('GET /api/sessions', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — any authenticated role can list', () => {
    it('student can list sessions', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.sessions).toBeDefined();
      expect(Array.isArray(res.body.sessions)).toBe(true);
    });

    it('coach can list sessions', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });

    it('teacher can list sessions', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });

    it('admin can list sessions', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });
  });

  describe('200 — response shape and data', () => {
    it('returns sessions with _count.preAttendances', async () => {
      const teacher = await createUser('teacher');
      await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.sessions.length).toBeGreaterThan(0);
      const session = res.body.sessions[0];
      expect(session._count).toBeDefined();
      expect(typeof session._count.preAttendances).toBe('number');
    });

    it('results are ordered by date asc', async () => {
      const teacher = await createUser('teacher');
      await createSessionRecord(teacher.id, { date: new Date(futureDate(60)) });
      await createSessionRecord(teacher.id, { date: new Date(futureDate(10)) });
      await createSessionRecord(teacher.id, { date: new Date(futureDate(30)) });

      const { agent } = await loginAs('student');
      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const dates = res.body.sessions.map((s: { date: string }) => s.date);
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
    });
  });

  describe('200 — myPreAttended field', () => {
    it('student who pre-attended gets myPreAttended: true on that session', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      await createPreAttendance(session.id, user.id);

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const item = res.body.sessions.find((s: { id: string }) => s.id === session.id);
      expect(item).toBeDefined();
      expect(item.myPreAttended).toBe(true);
    });

    it('student who has NOT pre-attended gets myPreAttended: false', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const item = res.body.sessions.find((s: { id: string }) => s.id === session.id);
      expect(item).toBeDefined();
      expect(item.myPreAttended).toBe(false);
    });

    it('teacher gets myPreAttended: undefined (field absent)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const item = res.body.sessions.find((s: { id: string }) => s.id === session.id);
      expect(item).toBeDefined();
      expect(item.myPreAttended).toBeUndefined();
    });

    it('admin gets myPreAttended: undefined (field absent)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const item = res.body.sessions.find((s: { id: string }) => s.id === session.id);
      expect(item).toBeDefined();
      expect(item.myPreAttended).toBeUndefined();
    });
  });

  describe('200 — filtering', () => {
    it('?includeCancelled=false excludes cancelled sessions', async () => {
      const teacher = await createUser('teacher');
      await createSessionRecord(teacher.id, { isCancelled: false });
      await createSessionRecord(teacher.id, { isCancelled: true, cancelledAt: new Date(), cancelledById: teacher.id });

      const { agent } = await loginAs('student');
      const res = await agent.get(`${URL}?includeCancelled=false`);

      expect(res.status).toBe(200);
      const cancelled = res.body.sessions.filter((s: { isCancelled: boolean }) => s.isCancelled);
      expect(cancelled).toHaveLength(0);
    });

    it('without includeCancelled param — includes cancelled sessions by default', async () => {
      const teacher = await createUser('teacher');
      await createSessionRecord(teacher.id, { isCancelled: false });
      await createSessionRecord(teacher.id, { isCancelled: true, cancelledAt: new Date(), cancelledById: teacher.id });

      const { agent } = await loginAs('student');
      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const cancelled = res.body.sessions.filter((s: { isCancelled: boolean }) => s.isCancelled);
      expect(cancelled.length).toBeGreaterThan(0);
    });

    it('?from and ?to filter by date range', async () => {
      const teacher = await createUser('teacher');
      const inRange = futureDate(10);
      const outOfRange = futureDate(60);

      await createSessionRecord(teacher.id, { date: new Date(inRange) });
      await createSessionRecord(teacher.id, { date: new Date(outOfRange) });

      const { agent } = await loginAs('student');
      const from = futureDate(5);
      const to = futureDate(20);
      const res = await agent.get(`${URL}?from=${from}&to=${to}`);

      expect(res.status).toBe(200);
      for (const s of res.body.sessions) {
        const d = s.date.slice(0, 10);
        expect(d >= from).toBe(true);
        expect(d <= to).toBe(true);
      }
    });
  });
});
