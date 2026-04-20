import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import { createPaymentRecord } from '../../helpers/payments';

const drainEvents = () => new Promise<void>((resolve) => setTimeout(resolve, 100));

const URL = (id: string) => `/api/payments/${id}/review`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('PATCH /api/payments/:id/review', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).patch(URL(UNKNOWN_ID)).send({ decision: 'approve' });
      expect(res.status).toBe(401);
    });
  });

  describe('403 — student/coach', () => {
    it('403 for student', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const { agent } = await loginAs('student');
      const res = await agent.patch(URL(payment.id)).send({ decision: 'approve' });
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const { agent } = await loginAs('coach');
      const res = await agent.patch(URL(payment.id)).send({ decision: 'approve' });
      expect(res.status).toBe(403);
    });
  });

  describe('400 — invalid decision', () => {
    it('400 for invalid decision value', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(payment.id)).send({ decision: 'maybe' });
      expect(res.status).toBe(400);
    });

    it('400 for missing decision', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(payment.id)).send({});
      expect(res.status).toBe(400);
    });
  });

  describe('409 — non-pending payment', () => {
    it('409 when approving an already-approved payment', async () => {
      const admin = await createUser('admin');
      const session = await createSessionRecord(admin.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id, {
        status: 'approved',
        reviewedById: admin.id,
      });

      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(payment.id)).send({ decision: 'approve' });
      expect(res.status).toBe(409);
    });

    it('409 when rejecting an already-rejected payment', async () => {
      const admin = await createUser('admin');
      const session = await createSessionRecord(admin.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id, {
        status: 'rejected',
        reviewedById: admin.id,
      });

      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(payment.id)).send({ decision: 'reject' });
      expect(res.status).toBe(409);
    });
  });

  describe('200 — valid review', () => {
    it('admin approves pending payment — status=approved, reviewedById set', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);
      const before = new Date();

      const { agent, user: admin } = await loginAs('admin');
      const res = await agent.patch(URL(payment.id)).send({ decision: 'approve' });
      const after = new Date();

      expect(res.status).toBe(200);
      expect(res.body.payment.status).toBe('approved');
      expect(res.body.payment.reviewedById).toBe(admin.id);

      // embedded reviewedBy populated after review
      expect(res.body.payment.reviewedBy).toBeDefined();
      expect(res.body.payment.reviewedBy.id).toBe(admin.id);
      expect(res.body.payment.reviewedBy.name).toBeDefined();

      // embedded student/session still present
      expect(res.body.payment.student.id).toBeDefined();
      expect(res.body.payment.session.id).toBeDefined();

      // DB readback
      const row = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(row!.status).toBe('approved');
      expect(row!.reviewedById).toBe(admin.id);
      expect(row!.reviewedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(row!.reviewedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('teacher rejects pending payment — status=rejected', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const { agent, user: reviewer } = await loginAs('teacher');
      const res = await agent.patch(URL(payment.id)).send({ decision: 'reject' });

      expect(res.status).toBe(200);
      expect(res.body.payment.status).toBe('rejected');
      expect(res.body.payment.reviewedById).toBe(reviewer.id);
    });

    it('admin approves with optional note — still 200', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const { agent } = await loginAs('admin');
      const res = await agent
        .patch(URL(payment.id))
        .send({ decision: 'approve', note: 'Looks good' });

      expect(res.status).toBe(200);
      expect(res.body.payment.status).toBe('approved');
    });
  });

  describe('notifications — payment_reviewed emission', () => {
    it('approve → student gets payment_reviewed notification with "approved" in title', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);
      const { agent } = await loginAs('admin');

      await agent.patch(URL(payment.id)).send({ decision: 'approve' });
      await drainEvents();

      const notifications = await prisma.notification.findMany({
        where: { userId: student.id, type: 'payment_reviewed' },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toMatch(/approved/i);
    });

    it('reject → student gets payment_reviewed notification with "rejected" in title', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const payment = await createPaymentRecord(student.id, session.id);
      const { agent } = await loginAs('admin');

      await agent.patch(URL(payment.id)).send({ decision: 'reject' });
      await drainEvents();

      const notifications = await prisma.notification.findMany({
        where: { userId: student.id, type: 'payment_reviewed' },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toMatch(/rejected/i);
    });
  });
});
