import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';

const URL = (sessionId: string) => `/api/sessions/${sessionId}/attendance`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('PUT /api/sessions/:id/attendance', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app)
        .put(URL(UNKNOWN_ID))
        .send({ entries: [{ studentId: 'x', present: true, paidCash: false }] });
      expect(res.status).toBe(401);
    });
  });

  describe('403 — wrong role', () => {
    it('403 for student', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');
      const res = await agent.put(URL(session.id)).send({ entries: [] });
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('coach');
      const res = await agent.put(URL(session.id)).send({ entries: [] });
      expect(res.status).toBe(403);
    });
  });

  describe('404 — session not found', () => {
    it('404 for unknown session id', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('teacher');
      const res = await agent.put(URL(UNKNOWN_ID)).send({
        entries: [{ studentId: student.id, present: true, paidCash: false }],
      });
      expect(res.status).toBe(404);
    });
  });

  describe('409 — cancelled session', () => {
    it('409 when session is cancelled', async () => {
      const admin = await createUser('admin');
      const student = await createUser('student');
      const session = await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.put(URL(session.id)).send({
        entries: [{ studentId: student.id, present: true, paidCash: false }],
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/cancelled/i);
    });
  });

  describe('400 — invalid entries', () => {
    it('400 when entry contains a non-student userId (teacher id)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.put(URL(session.id)).send({
        entries: [{ studentId: teacher.id, present: true, paidCash: false }],
      });
      expect(res.status).toBe(400);
    });

    it('400 when entry contains an inactive student id', async () => {
      const teacher = await createUser('teacher');
      const inactiveStudent = await createUser('student', { isActive: false });
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.put(URL(session.id)).send({
        entries: [{ studentId: inactiveStudent.id, present: true, paidCash: false }],
      });
      expect(res.status).toBe(400);
    });

    it('400 when entry contains a completely unknown id', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.put(URL(session.id)).send({
        entries: [{ studentId: UNKNOWN_ID, present: true, paidCash: false }],
      });
      expect(res.status).toBe(400);
    });

    it('400 when entries array is empty (Zod min(1))', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.put(URL(session.id)).send({ entries: [] });
      expect(res.status).toBe(400);
    });

    it('400 when entries is missing', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.put(URL(session.id)).send({});
      expect(res.status).toBe(400);
    });

    it('400 when entry missing studentId', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.put(URL(session.id)).send({
        entries: [{ present: true, paidCash: false }],
      });
      expect(res.status).toBe(400);
    });

    it('400 when present is non-boolean', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.put(URL(session.id)).send({
        entries: [{ studentId: student.id, present: 'yes', paidCash: false }],
      });
      expect(res.status).toBe(400);
    });

    it('rejects entire batch if any single entry is invalid', async () => {
      const teacher = await createUser('teacher');
      const validStudent = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.put(URL(session.id)).send({
        entries: [
          { studentId: validStudent.id, present: true, paidCash: false },
          { studentId: UNKNOWN_ID, present: false, paidCash: false },
        ],
      });
      expect(res.status).toBe(400);

      // Valid student must NOT have been marked (entire batch rejected)
      const row = await prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: validStudent.id } },
      });
      expect(row).toBeNull();
    });
  });

  describe('200 — valid mark', () => {
    it('teacher marks roster and returns { updated: N }', async () => {
      const teacher = await createUser('teacher');
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('teacher');

      const before = new Date();
      const res = await agent.put(URL(session.id)).send({
        entries: [
          { studentId: s1.id, present: true, paidCash: true },
          { studentId: s2.id, present: false, paidCash: false },
        ],
      });
      const after = new Date();

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);

      // DB readback — s1
      const a1 = await prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: s1.id } },
      });
      expect(a1!.present).toBe(true);
      expect(a1!.paidCash).toBe(true);
      expect(a1!.markedById).toBe(user.id);
      expect(a1!.markedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(a1!.markedAt.getTime()).toBeLessThanOrEqual(after.getTime());

      // DB readback — s2
      const a2 = await prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: s2.id } },
      });
      expect(a2!.present).toBe(false);
      expect(a2!.paidCash).toBe(false);
    });

    it('admin can also mark attendance', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('admin');

      const res = await agent.put(URL(session.id)).send({
        entries: [{ studentId: student.id, present: true, paidCash: false }],
      });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(1);
    });

    it('re-marking is idempotent (second PUT with same data succeeds)', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');
      const payload = { entries: [{ studentId: student.id, present: true, paidCash: true }] };

      const first = await agent.put(URL(session.id)).send(payload);
      const second = await agent.put(URL(session.id)).send(payload);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      // Still only one row
      const rows = await prisma.attendance.findMany({
        where: { sessionId: session.id, studentId: student.id },
      });
      expect(rows).toHaveLength(1);
    });

    it('second PUT updates existing row (upsert)', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      await agent.put(URL(session.id)).send({
        entries: [{ studentId: student.id, present: false, paidCash: false }],
      });
      await agent.put(URL(session.id)).send({
        entries: [{ studentId: student.id, present: true, paidCash: true }],
      });

      const row = await prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      });
      expect(row!.present).toBe(true);
      expect(row!.paidCash).toBe(true);
    });
  });
});
