import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import { createAttendance } from '../../helpers/attendance';
import { createPaymentRecord } from '../../helpers/payments';

const URL = '/api/dashboard/stats';

describe('GET /api/dashboard/stats', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('403 — wrong role', () => {
    it('403 for coach', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent.get(URL);
      expect(res.status).toBe(403);
    });
  });

  describe('200 — student stats', () => {
    it('returns correct totalSessions, sessionsJoined, pendingPayments', async () => {
      const teacher = await createUser('teacher');
      const { agent, user: student } = await loginAs('student');

      const s1 = await createSessionRecord(teacher.id);
      const s2 = await createSessionRecord(teacher.id);
      await createSessionRecord(teacher.id);

      // student attended 2 sessions (present:true)
      await createAttendance(s1.id, student.id, teacher.id, { present: true });
      await createAttendance(s2.id, student.id, teacher.id, { present: true });

      // 1 pending payment
      await createPaymentRecord(student.id, s1.id, { status: 'pending' });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalSessions).toBe(3);
      expect(res.body.stats.sessionsJoined).toBe(2);
      expect(res.body.stats.pendingPayments).toBe(1);
    });

    it('sessionsJoined counts only present:true rows', async () => {
      const teacher = await createUser('teacher');
      const { agent, user: student } = await loginAs('student');
      const session = await createSessionRecord(teacher.id);
      await createAttendance(session.id, student.id, teacher.id, { present: false });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.stats.sessionsJoined).toBe(0);
    });

    it('student response has no totalStudents or totalTeachers fields', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.stats.totalStudents).toBeUndefined();
      expect(res.body.stats.totalTeachers).toBeUndefined();
    });
  });

  describe('200 — teacher stats', () => {
    it('returns correct totalSessions and totalStudents', async () => {
      const { agent, user: teacher } = await loginAs('teacher');
      await createSessionRecord(teacher.id);
      await createSessionRecord(teacher.id);
      await createUser('student');
      await createUser('student');
      await createUser('student', { isActive: false });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalSessions).toBe(2);
      expect(res.body.stats.totalStudents).toBe(2);
      expect(res.body.stats.totalTeachers).toBeUndefined();
      expect(res.body.stats.pendingPayments).toBeUndefined();
    });
  });

  describe('200 — admin stats', () => {
    it('returns correct totalSessions, totalStudents, totalTeachers', async () => {
      const { agent, user: admin } = await loginAs('admin');
      await createSessionRecord(admin.id);
      await createUser('student');
      await createUser('student');
      await createUser('teacher');
      await createUser('teacher', { isActive: false });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalSessions).toBe(1);
      expect(res.body.stats.totalStudents).toBe(2);
      expect(res.body.stats.totalTeachers).toBe(1);
      expect(res.body.stats.pendingPayments).toBeUndefined();
    });
  });

  describe('cancelled sessions excluded from totalSessions', () => {
    it('cancelled session not counted for student', async () => {
      const teacher = await createUser('teacher');
      const { agent } = await loginAs('student');
      await createSessionRecord(teacher.id);
      await createSessionRecord(teacher.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: teacher.id,
      });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalSessions).toBe(1);
    });

    it('cancelled session not counted for teacher', async () => {
      const { agent, user: teacher } = await loginAs('teacher');
      await createSessionRecord(teacher.id);
      await createSessionRecord(teacher.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: teacher.id,
      });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalSessions).toBe(1);
    });

    it('cancelled session not counted for admin', async () => {
      const { agent, user: admin } = await loginAs('admin');
      await createSessionRecord(admin.id);
      await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalSessions).toBe(1);
    });
  });

  describe('inactive users excluded from counts', () => {
    it('inactive student not counted in totalStudents (teacher view)', async () => {
      const { agent } = await loginAs('teacher');
      await createUser('student', { isActive: true });
      await createUser('student', { isActive: false });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalStudents).toBe(1);
    });

    it('inactive teacher not counted in totalTeachers (admin view)', async () => {
      const { agent } = await loginAs('admin');
      await createUser('teacher', { isActive: true });
      await createUser('teacher', { isActive: false });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalTeachers).toBe(1);
    });
  });
});
