import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import { createPaymentRecord } from '../../helpers/payments';

const URL = '/api/payments';

describe('GET /api/payments', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('403 — coach', () => {
    it('403 for coach', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent.get(URL);
      expect(res.status).toBe(403);
    });
  });

  describe('200 — student sees only own payments', () => {
    it('student receives only their own payments', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: s1 } = await loginAs('student');
      const s2 = await createUser('student');

      await createPaymentRecord(s1.id, session.id);
      await createPaymentRecord(s2.id, session.id);

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.payments)).toBe(true);
      const ids = res.body.payments.map((p: { studentId: string }) => p.studentId);
      expect(ids.every((id: string) => id === s1.id)).toBe(true);
    });

    it('student cannot see other students\' payments', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');
      const other = await createUser('student');
      const p = await createPaymentRecord(other.id, session.id);

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const ids = res.body.payments.map((pay: { id: string }) => pay.id);
      expect(ids).not.toContain(p.id);
    });
  });

  describe('200 — admin/teacher see all with filters', () => {
    it('admin sees all payments', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      await createPaymentRecord(s1.id, session.id);
      await createPaymentRecord(s2.id, session.id);

      const { agent } = await loginAs('admin');
      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.payments.length).toBeGreaterThanOrEqual(2);

      // Every payment has embedded relations and receiptUrl
      for (const p of res.body.payments) {
        expect(p.receiptUrl).toMatch(/^\/api\/payments\/.+\/receipt$/);
        expect(p.receiptFilePath).toBeUndefined();
        expect(p.student).toBeDefined();
        expect(p.student.id).toBeDefined();
        expect(p.session).toBeDefined();
        expect(p.session.id).toBe(session.id);
      }
    });

    it('teacher sees all payments', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUser('student');
      await createPaymentRecord(s1.id, session.id);

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.payments.length).toBeGreaterThanOrEqual(1);
    });

    it('admin filters by ?status=pending', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const admin = await createUser('admin');
      await createPaymentRecord(student.id, session.id, { status: 'pending' });
      await createPaymentRecord(student.id, session.id, { status: 'approved', reviewedById: admin.id });

      const { agent } = await loginAs('admin');
      const res = await agent.get(`${URL}?status=pending`);

      expect(res.status).toBe(200);
      for (const p of res.body.payments) {
        expect(p.status).toBe('pending');
      }
    });

    it('admin filters by ?studentId=', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      await createPaymentRecord(s1.id, session.id);
      await createPaymentRecord(s2.id, session.id);

      const { agent } = await loginAs('admin');
      const res = await agent.get(`${URL}?studentId=${s1.id}`);

      expect(res.status).toBe(200);
      const ids = res.body.payments.map((p: { studentId: string }) => p.studentId);
      expect(ids.every((id: string) => id === s1.id)).toBe(true);
    });

    it('admin filters by ?sessionId=', async () => {
      const teacher = await createUser('teacher');
      const s1 = await createSessionRecord(teacher.id);
      const s2 = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const p1 = await createPaymentRecord(student.id, s1.id);
      await createPaymentRecord(student.id, s2.id);

      const { agent } = await loginAs('admin');
      const res = await agent.get(`${URL}?sessionId=${s1.id}`);

      expect(res.status).toBe(200);
      const ids = res.body.payments.map((p: { id: string }) => p.id);
      expect(ids).toContain(p1.id);
      for (const p of res.body.payments) {
        expect(p.sessionId).toBe(s1.id);
      }
    });
  });

  describe('200 — ordering', () => {
    it('payments ordered desc by uploadedAt', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');

      const p1 = await createPaymentRecord(student.id, session.id);
      await new Promise((r) => setTimeout(r, 10));
      const p2 = await createPaymentRecord(student.id, session.id);

      const { agent } = await loginAs('admin');
      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const ids = res.body.payments.map((p: { id: string }) => p.id);
      const i1 = ids.indexOf(p1.id);
      const i2 = ids.indexOf(p2.id);
      expect(i2).toBeLessThan(i1); // p2 (newer) appears before p1
    });
  });
});
