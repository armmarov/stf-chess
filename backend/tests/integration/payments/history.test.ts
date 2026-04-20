import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import { createAttendance } from '../../helpers/attendance';
import { createPaymentRecord } from '../../helpers/payments';

const HISTORY_URL = '/api/payments/history';
const RECEIPT_URL = (entryId: string) => `/api/payments/history/${encodeURIComponent(entryId)}/receipt`;
const UNKNOWN_UUID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/payments/history', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app).get(HISTORY_URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — student history', () => {
    it('returns 1 online + 1 cash entry with correct methods, amounts, sorted paidAt desc', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: student } = await loginAs('student');

      const olderTime = new Date(Date.now() - 5000);
      const newerTime = new Date(Date.now() - 1000);

      const admin = await createUser('admin');
      await createPaymentRecord(student.id, session.id, {
        status: 'approved',
        reviewedById: admin.id,
        reviewedAt: olderTime,
        amount: 50,
      });
      await createAttendance(session.id, student.id, teacher.id, {
        present: true,
        paidCash: true,
        markedAt: newerTime,
      });

      const res = await agent.get(HISTORY_URL);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(2);

      const [first, second] = res.body.entries;
      expect(first.method).toBe('cash');
      expect(second.method).toBe('online');

      expect(first.id).toMatch(/^cash:/);
      expect(second.id).toMatch(/^online:/);

      expect(new Date(first.paidAt).getTime()).toBeGreaterThan(new Date(second.paidAt).getTime());
    });

    it('student with no history returns entries: []', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(HISTORY_URL);
      expect(res.status).toBe(200);
      expect(res.body.entries).toEqual([]);
    });

    it('student GET /history?studentId=<other> → studentId ignored, returns own history', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: student } = await loginAs('student');
      const otherStudent = await createUser('student');
      const admin = await createUser('admin');
      await createPaymentRecord(student.id, session.id, {
        status: 'approved',
        reviewedById: admin.id,
      });

      const res = await agent.get(`${HISTORY_URL}?studentId=${otherStudent.id}`);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].id).toContain('online:');
    });
  });

  describe('200 — admin / teacher with studentId', () => {
    it('admin GET /history?studentId=<uuid> → 200 with correct entries', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const admin = await createUser('admin');
      await createPaymentRecord(student.id, session.id, {
        status: 'approved',
        reviewedById: admin.id,
      });

      const { agent } = await loginAs('admin');
      const res = await agent.get(`${HISTORY_URL}?studentId=${student.id}`);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].method).toBe('online');
    });

    it('teacher GET /history?studentId=<uuid> → 200', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      await createAttendance(session.id, student.id, teacher.id, { present: true, paidCash: true });

      const { agent } = await loginAs('teacher');
      const res = await agent.get(`${HISTORY_URL}?studentId=${student.id}`);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].method).toBe('cash');
    });
  });

  describe('200 — pending + rejected online entries included', () => {
    it('pending payment appears with status="pending" and method="online"', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: student } = await loginAs('student');
      await createPaymentRecord(student.id, session.id, { status: 'pending' });

      const res = await agent.get(HISTORY_URL);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].status).toBe('pending');
      expect(res.body.entries[0].method).toBe('online');
    });

    it('rejected payment appears with status="rejected"', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: student } = await loginAs('student');
      const admin = await createUser('admin');
      await createPaymentRecord(student.id, session.id, { status: 'rejected', reviewedById: admin.id });

      const res = await agent.get(HISTORY_URL);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].status).toBe('rejected');
    });

    it('cash entry always has status="approved"', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: student } = await loginAs('student');
      await createAttendance(session.id, student.id, teacher.id, { present: true, paidCash: true });

      const res = await agent.get(HISTORY_URL);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].status).toBe('approved');
      expect(res.body.entries[0].method).toBe('cash');
    });

    it('paidAt for pending entry equals uploadedAt (not reviewedAt)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: student } = await loginAs('student');
      const uploadedAt = new Date(Date.now() - 5000);
      await createPaymentRecord(student.id, session.id, { status: 'pending', uploadedAt });

      const res = await agent.get(HISTORY_URL);

      expect(res.status).toBe(200);
      expect(new Date(res.body.entries[0].paidAt).getTime()).toBe(uploadedAt.getTime());
    });

    it('paidAt for approved entry equals reviewedAt', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: student } = await loginAs('student');
      const admin = await createUser('admin');
      const reviewedAt = new Date(Date.now() - 3000);
      const uploadedAt = new Date(Date.now() - 10000);
      await createPaymentRecord(student.id, session.id, {
        status: 'approved',
        reviewedById: admin.id,
        reviewedAt,
        uploadedAt,
      });

      const res = await agent.get(HISTORY_URL);

      expect(res.status).toBe(200);
      expect(new Date(res.body.entries[0].paidAt).getTime()).toBe(reviewedAt.getTime());
    });
  });

  describe('400 — admin/teacher missing studentId', () => {
    it('admin GET /history without studentId → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.get(HISTORY_URL);
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('teacher GET /history without studentId → 400', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(HISTORY_URL);
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});

describe('GET /api/payments/history/:entryId/receipt', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app).get(RECEIPT_URL(`online:${UNKNOWN_UUID}`));
      expect(res.status).toBe(401);
    });
  });

  describe('200 — valid receipts', () => {
    it('admin fetches online receipt → 200, Content-Type: application/pdf', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const admin = await createUser('admin');
      const payment = await createPaymentRecord(student.id, session.id, {
        status: 'approved',
        reviewedById: admin.id,
      });

      const { agent } = await loginAs('admin');
      const res = await agent.get(RECEIPT_URL(`online:${payment.id}`));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });

    it('student owner fetches cash receipt → 200, Content-Type: application/pdf', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: student } = await loginAs('student');
      await createAttendance(session.id, student.id, teacher.id, { present: true, paidCash: true });

      const res = await agent.get(RECEIPT_URL(`cash:${session.id}:${student.id}`));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });
  });

  describe('409 — receipt for non-approved online payment', () => {
    it('pending online payment → 409', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id, { status: 'pending' });

      const { agent } = await loginAs('admin');
      const res = await agent.get(RECEIPT_URL(`online:${payment.id}`));

      expect(res.status).toBe(409);
    });

    it('rejected online payment → 409', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const admin = await createUser('admin');
      const payment = await createPaymentRecord(student.id, session.id, {
        status: 'rejected',
        reviewedById: admin.id,
      });

      const { agent } = await loginAs('admin');
      const res = await agent.get(RECEIPT_URL(`online:${payment.id}`));

      expect(res.status).toBe(409);
    });

    it('student accessing another student\'s pending receipt → 403 not 409 (authz checked first)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const otherStudent = await createUser('student');
      const payment = await createPaymentRecord(otherStudent.id, session.id, { status: 'pending' });

      const { agent } = await loginAs('student');
      const res = await agent.get(RECEIPT_URL(`online:${payment.id}`));

      expect(res.status).toBe(403);
    });
  });

  describe('403 — student accessing another student\'s receipt', () => {
    it('student requests cash receipt for another studentId → 403', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const otherStudent = await createUser('student');
      await createAttendance(session.id, otherStudent.id, teacher.id, { present: true, paidCash: true });

      const { agent } = await loginAs('student');
      const res = await agent.get(RECEIPT_URL(`cash:${session.id}:${otherStudent.id}`));

      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('unknown entryId format → 404', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.get(RECEIPT_URL('unknown:abc'));
      expect(res.status).toBe(404);
    });

    it('online:<unknownPaymentId> → 404', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.get(RECEIPT_URL(`online:${UNKNOWN_UUID}`));
      expect(res.status).toBe(404);
    });

    it('cash entry where paidCash=false → 404', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      await createAttendance(session.id, student.id, teacher.id, { present: true, paidCash: false });

      const { agent } = await loginAs('admin');
      const res = await agent.get(RECEIPT_URL(`cash:${session.id}:${student.id}`));

      expect(res.status).toBe(404);
    });
  });
});
