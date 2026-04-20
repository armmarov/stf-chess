import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import { createPreAttendance, createAttendance } from '../../helpers/attendance';
import { createPaymentRecord } from '../../helpers/payments';

const URL = (sessionId: string) => `/api/sessions/${sessionId}/attendance`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/sessions/:id/attendance', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('403 — wrong role', () => {
    it('403 for student', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(session.id));
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('coach');
      const res = await agent.get(URL(session.id));
      expect(res.status).toBe(403);
    });
  });

  describe('404 — session not found', () => {
    it('404 for unknown session id', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — roster shape', () => {
    it('returns session and roster of active students', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.id).toBe(session.id);
      expect(Array.isArray(res.body.roster)).toBe(true);

      const entry = res.body.roster.find(
        (r: { student: { id: string } }) => r.student.id === student.id,
      );
      expect(entry).toBeDefined();
      expect(entry.student.id).toBe(student.id);
    });

    it('inactive students are excluded from roster', async () => {
      const teacher = await createUser('teacher');
      const activeStudent = await createUser('student');
      const inactiveStudent = await createUser('student', { isActive: false });
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      const ids = res.body.roster.map((r: { student: { id: string } }) => r.student.id);
      expect(ids).toContain(activeStudent.id);
      expect(ids).not.toContain(inactiveStudent.id);
    });

    it('preAttended defaults false when no PreAttendance row', async () => {
      const teacher = await createUser('teacher');
      await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      for (const entry of res.body.roster) {
        expect(entry.preAttended).toBe(false);
      }
    });

    it('present and paidCash default false when no Attendance row', async () => {
      const teacher = await createUser('teacher');
      await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      for (const entry of res.body.roster) {
        expect(entry.present).toBe(false);
        expect(entry.paidCash).toBe(false);
      }
    });

    it('preAttended is true when PreAttendance row exists', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      await createPreAttendance(session.id, student.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      const entry = res.body.roster.find(
        (r: { student: { id: string } }) => r.student.id === student.id,
      );
      expect(entry.preAttended).toBe(true);
    });

    it('present and paidCash reflect Attendance row values', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      await createAttendance(session.id, student.id, teacher.id, { present: true, paidCash: true });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      const entry = res.body.roster.find(
        (r: { student: { id: string } }) => r.student.id === student.id,
      );
      expect(entry.present).toBe(true);
      expect(entry.paidCash).toBe(true);
    });

    it('student with pending payment → onlinePaymentStatus === "pending"', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      await createPaymentRecord(student.id, session.id, { status: 'pending' });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      const entry = res.body.roster.find(
        (r: { student: { id: string } }) => r.student.id === student.id,
      );
      expect(entry.onlinePaymentStatus).toBe('pending');
    });

    it('student with no payment → onlinePaymentStatus === null', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      const entry = res.body.roster.find(
        (r: { student: { id: string } }) => r.student.id === student.id,
      );
      expect(entry.onlinePaymentStatus).toBeNull();
    });

    it('student with rejected then pending payments → onlinePaymentStatus === "pending" (most recent wins)', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const admin = await createUser('admin');
      await createPaymentRecord(student.id, session.id, {
        status: 'rejected',
        reviewedById: admin.id,
        uploadedAt: new Date(Date.now() - 5000),
      });
      await createPaymentRecord(student.id, session.id, {
        status: 'pending',
        uploadedAt: new Date(Date.now() - 1000),
      });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      const entry = res.body.roster.find(
        (r: { student: { id: string } }) => r.student.id === student.id,
      );
      expect(entry.onlinePaymentStatus).toBe('pending');
    });

    it('admin can also fetch roster', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(session.id));
      expect(res.status).toBe(200);
    });
  });
});
