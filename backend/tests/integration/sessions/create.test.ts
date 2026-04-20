import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { validSessionBody, pastDate, futureDate } from '../../helpers/sessions';

const drainEvents = () => new Promise<void>((resolve) => setTimeout(resolve, 100));

const URL = '/api/sessions';

describe('POST /api/sessions', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without auth', async () => {
      const res = await request(app).post(URL).send(validSessionBody());
      expect(res.status).toBe(401);
    });
  });

  describe('403 — wrong role', () => {
    it('403 for student', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL).send(validSessionBody());
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent.post(URL).send(validSessionBody());
      expect(res.status).toBe(403);
    });
  });

  describe('201 — created', () => {
    it('201 for admin — returns session with correct fields', async () => {
      const { agent, user } = await loginAs('admin');
      const body = validSessionBody();

      const res = await agent.post(URL).send(body);

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.place).toBe(body.place);
      expect(res.body.session.notes).toBe(body.notes);
      expect(res.body.session.isCancelled).toBe(false);
      expect(res.body.session.createdBy.id).toBe(user.id);

      // Verify DB state
      const record = await prisma.session.findUnique({ where: { id: res.body.session.id } });
      expect(record).not.toBeNull();
      expect(record!.createdById).toBe(user.id);
    });

    it('201 for teacher', async () => {
      const { agent, user } = await loginAs('teacher');
      const res = await agent.post(URL).send(validSessionBody());

      expect(res.status).toBe(201);
      expect(res.body.session.createdBy.id).toBe(user.id);
    });

    it('sets startTime and endTime from date + HH:MM strings', async () => {
      const { agent } = await loginAs('teacher');
      const date = futureDate(10);
      const res = await agent.post(URL).send({
        date,
        startTime: '14:00',
        endTime: '15:30',
        place: 'Room B',
      });

      expect(res.status).toBe(201);
      // startTime and endTime are ISO strings containing the given time
      expect(res.body.session.startTime).toContain('14:00');
      expect(res.body.session.endTime).toContain('15:30');
    });

    it('client cannot set cancelledAt or cancelledById', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send({
        ...validSessionBody(),
        cancelledAt: '2020-01-01T00:00:00Z',
        cancelledById: 'fake-id',
        isCancelled: true,
      });

      // isCancelled is not in createSchema so this should still succeed or 400
      // Either way cancelledAt/cancelledById must NOT be set to client values
      if (res.status === 201) {
        expect(res.body.session.cancelledAt).toBeNull();
        expect(res.body.session.cancelledById).toBeNull();
      } else {
        // Zod strips unknown fields — 400 is also acceptable
        expect(res.status).toBe(400);
      }
    });
  });

  describe('400 — validation', () => {
    it('400 for past date', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL).send({
        ...validSessionBody(),
        date: pastDate(1),
      });
      expect(res.status).toBe(400);
    });

    it('400 when startTime >= endTime', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL).send({
        ...validSessionBody(),
        startTime: '10:00',
        endTime: '09:00',
      });
      expect(res.status).toBe(400);
    });

    it('400 when startTime === endTime', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL).send({
        ...validSessionBody(),
        startTime: '10:00',
        endTime: '10:00',
      });
      expect(res.status).toBe(400);
    });

    it('400 for missing date', async () => {
      const { agent } = await loginAs('teacher');
      const { date: _omit, ...body } = validSessionBody();
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(400);
    });

    it('400 for missing startTime', async () => {
      const { agent } = await loginAs('teacher');
      const { startTime: _omit, ...body } = validSessionBody();
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(400);
    });

    it('400 for missing endTime', async () => {
      const { agent } = await loginAs('teacher');
      const { endTime: _omit, ...body } = validSessionBody();
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(400);
    });

    it('400 for missing place', async () => {
      const { agent } = await loginAs('teacher');
      const { place: _omit, ...body } = validSessionBody();
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(400);
    });

    it('400 for wrong date format', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL).send({ ...validSessionBody(), date: '19-04-2099' });
      expect(res.status).toBe(400);
    });
  });

  describe('notifications — session_created emission', () => {
    it('all active students get a session_created notification', async () => {
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      await createUser('student', { isActive: false });
      const { agent } = await loginAs('teacher');

      const res = await agent.post(URL).send(validSessionBody());
      expect(res.status).toBe(201);

      await drainEvents();

      const notifications = await prisma.notification.findMany({
        where: { type: 'session_created' },
      });
      expect(notifications).toHaveLength(2);
      const userIds = notifications.map((n) => n.userId);
      expect(userIds).toContain(s1.id);
      expect(userIds).toContain(s2.id);
    });

    it('inactive students do NOT receive session_created notification', async () => {
      const inactive = await createUser('student', { isActive: false });
      const { agent } = await loginAs('teacher');

      await agent.post(URL).send(validSessionBody());
      await drainEvents();

      const notif = await prisma.notification.findFirst({
        where: { userId: inactive.id, type: 'session_created' },
      });
      expect(notif).toBeNull();
    });
  });
});
