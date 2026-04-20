import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createSessionRecord, futureSessionInMinutes } from '../../helpers/sessions';
import { createPreAttendance } from '../../helpers/attendance';

const drainEvents = () => new Promise<void>((resolve) => setTimeout(resolve, 100));

const URL = (sessionId: string) => `/api/sessions/${sessionId}/pre-attendance`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('POST /api/sessions/:id/pre-attendance', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).post(URL(UNKNOWN_ID)).send({ confirmed: true });
      expect(res.status).toBe(401);
    });
  });

  describe('403 — wrong role', () => {
    it('403 for teacher', async () => {
      const { agent } = await loginAs('teacher');
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 60);
      const res = await agent.post(URL(session.id)).send({ confirmed: true });
      expect(res.status).toBe(403);
    });

    it('403 for admin', async () => {
      const { agent } = await loginAs('admin');
      const admin = await createUser('admin');
      const session = await futureSessionInMinutes(admin.id, 60);
      const res = await agent.post(URL(session.id)).send({ confirmed: true });
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const { agent } = await loginAs('coach');
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 60);
      const res = await agent.post(URL(session.id)).send({ confirmed: true });
      expect(res.status).toBe(403);
    });
  });

  describe('404 — session not found', () => {
    it('404 for unknown session id', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(UNKNOWN_ID)).send({ confirmed: true });
      expect(res.status).toBe(404);
    });
  });

  describe('409 — cancelled session', () => {
    it('409 when session is cancelled', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: teacher.id,
      });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(session.id)).send({ confirmed: true });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/cancelled/i);
    });
  });

  describe('409 — cutoff has passed', () => {
    it('409 when startTime is 5 min away (within 10-min cutoff)', async () => {
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 5);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(session.id)).send({ confirmed: true });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/cutoff/i);
    });

    it('409 when startTime is exactly 10 min away (at boundary, now >= cutoff)', async () => {
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 10);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(session.id)).send({ confirmed: true });
      expect(res.status).toBe(409);
    });
  });

  describe('200 — pre-attendance operations', () => {
    it('200 exactly 11 min before start (just past the 10-min boundary)', async () => {
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 11);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(session.id)).send({ confirmed: true });
      expect(res.status).toBe(200);
    });

    it('confirmed:true creates row and returns preAttendance object', async () => {
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 60);
      const { agent, user } = await loginAs('student');

      const res = await agent.post(URL(session.id)).send({ confirmed: true });

      expect(res.status).toBe(200);
      expect(res.body.preAttendance).toBeDefined();
      expect(res.body.preAttendance.sessionId).toBe(session.id);
      expect(res.body.preAttendance.studentId).toBe(user.id);
      expect(res.body.preAttendance.confirmedAt).toBeDefined();

      // DB readback
      const row = await prisma.preAttendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: user.id } },
      });
      expect(row).not.toBeNull();
    });

    it('confirmed:false with existing row deletes it and returns null', async () => {
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 60);
      const { agent, user } = await loginAs('student');
      await createPreAttendance(session.id, user.id);

      const res = await agent.post(URL(session.id)).send({ confirmed: false });

      expect(res.status).toBe(200);
      expect(res.body.preAttendance).toBeNull();

      // DB readback — row must be gone
      const row = await prisma.preAttendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: user.id } },
      });
      expect(row).toBeNull();
    });

    it('confirmed:false with no existing row is a no-op and returns null', async () => {
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 60);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(session.id)).send({ confirmed: false });
      expect(res.status).toBe(200);
      expect(res.body.preAttendance).toBeNull();
    });

    it('toggling confirmed:true twice is idempotent (upsert)', async () => {
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 60);
      const { agent, user } = await loginAs('student');

      await agent.post(URL(session.id)).send({ confirmed: true });
      const res = await agent.post(URL(session.id)).send({ confirmed: true });

      expect(res.status).toBe(200);
      expect(res.body.preAttendance.studentId).toBe(user.id);

      // Only one row in DB
      const rows = await prisma.preAttendance.findMany({
        where: { sessionId: session.id, studentId: user.id },
      });
      expect(rows).toHaveLength(1);
    });
  });

  describe('notifications — pre_attendance_set emission', () => {
    it('confirmed=true (first time) → all active teachers + admins notified, student excluded', async () => {
      const teacher = await createUser('teacher');
      const admin = await createUser('admin');
      await createUser('teacher', { isActive: false });
      const session = await futureSessionInMinutes(teacher.id, 60);
      const { agent, user: student } = await loginAs('student');

      await agent.post(URL(session.id)).send({ confirmed: true });
      await drainEvents();

      const notifications = await prisma.notification.findMany({
        where: { type: 'pre_attendance_set' },
      });
      const userIds = notifications.map((n) => n.userId);
      expect(userIds).toContain(teacher.id);
      expect(userIds).toContain(admin.id);
      expect(userIds).not.toContain(student.id);
    });

    it('confirmed=true second time → no new notification (isNew guard)', async () => {
      const teacher = await createUser('teacher');
      const session = await futureSessionInMinutes(teacher.id, 60);
      const { agent } = await loginAs('student');

      await agent.post(URL(session.id)).send({ confirmed: true });
      await drainEvents();
      const countAfterFirst = await prisma.notification.count({ where: { type: 'pre_attendance_set' } });

      await agent.post(URL(session.id)).send({ confirmed: true });
      await drainEvents();
      const countAfterSecond = await prisma.notification.count({ where: { type: 'pre_attendance_set' } });

      expect(countAfterSecond).toBe(countAfterFirst);
    });

    it('confirmed=false → no pre_attendance_set notification emitted', async () => {
      const teacher = await createUser('teacher');
      await createUser('admin');
      const session = await futureSessionInMinutes(teacher.id, 60);
      const { agent, user } = await loginAs('student');
      await createPreAttendance(session.id, user.id);

      await agent.post(URL(session.id)).send({ confirmed: false });
      await drainEvents();

      const count = await prisma.notification.count({ where: { type: 'pre_attendance_set' } });
      expect(count).toBe(0);
    });
  });
});
