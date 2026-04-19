import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';

const URL = (id: string) => `/api/sessions/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('PATCH /api/sessions/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without auth', async () => {
      const res = await request(app).patch(URL(UNKNOWN_ID)).send({ place: 'New Place' });
      expect(res.status).toBe(401);
    });
  });

  describe('403 — wrong role', () => {
    it('403 for student', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent.patch(URL(session.id)).send({ place: 'New Place' });
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('coach');

      const res = await agent.patch(URL(session.id)).send({ place: 'New Place' });
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown id', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(UNKNOWN_ID)).send({ place: 'New Place' });
      expect(res.status).toBe(404);
    });
  });

  describe('200 — field updates', () => {
    it('admin can update place and notes', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('admin');

      const res = await agent.patch(URL(session.id)).send({
        place: 'New Venue',
        notes: 'Updated notes',
      });

      expect(res.status).toBe(200);
      expect(res.body.session.place).toBe('New Venue');
      expect(res.body.session.notes).toBe('Updated notes');

      // DB readback
      const record = await prisma.session.findUnique({ where: { id: session.id } });
      expect(record!.place).toBe('New Venue');
      expect(record!.notes).toBe('Updated notes');
    });

    it('teacher can update place and notes', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.patch(URL(session.id)).send({ place: 'Teacher Venue' });

      expect(res.status).toBe(200);
      expect(res.body.session.place).toBe('Teacher Venue');
    });
  });

  describe('200 — cancel', () => {
    it('sets cancelledAt + cancelledById from req.user — not from client body', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('admin');

      const before = new Date();
      const res = await agent.patch(URL(session.id)).send({
        isCancelled: true,
        // Client tries to set these directly — must be ignored
        cancelledAt: '2020-01-01T00:00:00Z',
        cancelledById: 'fake-id',
      });
      const after = new Date();

      expect(res.status).toBe(200);
      expect(res.body.session.isCancelled).toBe(true);

      // DB readback
      const record = await prisma.session.findUnique({ where: { id: session.id } });
      expect(record!.isCancelled).toBe(true);
      expect(record!.cancelledById).toBe(user.id);
      expect(record!.cancelledAt).not.toBeNull();
      const cancelledAt = new Date(record!.cancelledAt!);
      expect(cancelledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(cancelledAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('teacher can cancel a session', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('teacher');

      const res = await agent.patch(URL(session.id)).send({ isCancelled: true });

      expect(res.status).toBe(200);
      const record = await prisma.session.findUnique({ where: { id: session.id } });
      expect(record!.isCancelled).toBe(true);
      expect(record!.cancelledById).toBe(user.id);
    });
  });

  describe('200 — un-cancel', () => {
    it('admin can un-cancel: clears isCancelled, cancelledAt, cancelledById', async () => {
      const admin = await createUser('admin');
      const session = await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });
      const { agent } = await loginAs('admin');

      const res = await agent.patch(URL(session.id)).send({ isCancelled: false });

      expect(res.status).toBe(200);
      expect(res.body.session.isCancelled).toBe(false);

      // DB readback
      const record = await prisma.session.findUnique({ where: { id: session.id } });
      expect(record!.isCancelled).toBe(false);
      expect(record!.cancelledAt).toBeNull();
      expect(record!.cancelledById).toBeNull();
    });
  });

  describe('409 — cancelled session edit rules', () => {
    it('403 when teacher tries to un-cancel (admin-only operation)', async () => {
      const admin = await createUser('admin');
      const session = await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.patch(URL(session.id)).send({ isCancelled: false });

      expect(res.status).toBe(403);
    });

    it('409 when editing any other field on a cancelled session', async () => {
      const admin = await createUser('admin');
      const session = await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });
      const { agent } = await loginAs('admin');

      const res = await agent.patch(URL(session.id)).send({ place: 'New Place' });
      expect(res.status).toBe(409);
    });

    it('409 when admin sends isCancelled:true on already-cancelled session', async () => {
      const admin = await createUser('admin');
      const session = await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });
      const { agent } = await loginAs('admin');

      const res = await agent.patch(URL(session.id)).send({ isCancelled: true });
      expect(res.status).toBe(409);
    });
  });

  describe('400 — validation on update', () => {
    it('400 when updated startTime >= endTime (both supplied)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.patch(URL(session.id)).send({
        startTime: '11:00',
        endTime: '09:00',
      });
      expect(res.status).toBe(400);
    });
  });
});
