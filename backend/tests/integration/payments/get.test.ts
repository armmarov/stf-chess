import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import { createPaymentRecord } from '../../helpers/payments';

const URL = (id: string) => `/api/payments/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/payments/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('403 — coach', () => {
    it('403 for coach', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const { agent } = await loginAs('coach');
      const res = await agent.get(URL(payment.id));
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown payment id', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — student access own payment', () => {
    it('student can get their own payment', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      const payment = await createPaymentRecord(user.id, session.id);

      const res = await agent.get(URL(payment.id));

      expect(res.status).toBe(200);
      expect(res.body.payment.id).toBe(payment.id);
      expect(res.body.payment.studentId).toBe(user.id);

      // embedded relations + receiptUrl
      expect(res.body.payment.receiptUrl).toBe(`/api/payments/${payment.id}/receipt`);
      expect(res.body.payment.student.id).toBe(user.id);
      expect(res.body.payment.student.username).toBeDefined();
      expect(res.body.payment.session.id).toBe(session.id);
      expect(res.body.payment.session.isCancelled).toBe(false);
      expect(res.body.payment.reviewedBy).toBeNull();
    });
  });

  describe('403 — student accessing another student\'s payment', () => {
    it('403 when student tries to get another student\'s payment', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const other = await createUser('student');
      const payment = await createPaymentRecord(other.id, session.id);

      const { agent } = await loginAs('student');
      const res = await agent.get(URL(payment.id));
      expect(res.status).toBe(403);
    });
  });

  describe('200 — admin/teacher access any payment', () => {
    it('admin can get any payment', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(payment.id));

      expect(res.status).toBe(200);
      expect(res.body.payment.id).toBe(payment.id);
    });

    it('teacher can get any payment', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(payment.id));

      expect(res.status).toBe(200);
      expect(res.body.payment.id).toBe(payment.id);
    });
  });
});
