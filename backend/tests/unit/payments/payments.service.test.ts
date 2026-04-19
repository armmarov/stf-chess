import {
  uploadPaymentSchema,
  reviewPaymentSchema,
  listPaymentsQuerySchema,
} from '../../../src/modules/payments/payments.validators';
import { setFeeSchema } from '../../../src/modules/config/config.validators';
import {
  uploadPayment,
  reviewPayment,
  listPayments,
  getPayment,
} from '../../../src/modules/payments/payments.service';
import { prisma, resetDb } from '../../helpers/db';
import { createUser as createUserHelper } from '../../helpers/auth';
import { createPaymentRecord, setFeeConfig } from '../../helpers/payments';
import { createSessionRecord } from '../../helpers/sessions';
import { Express } from 'express';

// ---------------------------------------------------------------------------
// Schema validator tests — no DB required
// ---------------------------------------------------------------------------

describe('uploadPaymentSchema', () => {
  it('accepts valid UUID sessionId', () => {
    expect(
      uploadPaymentSchema.safeParse({ sessionId: '00000000-0000-0000-0000-000000000001' }).success,
    ).toBe(true);
  });

  it('rejects non-UUID sessionId', () => {
    expect(uploadPaymentSchema.safeParse({ sessionId: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects missing sessionId', () => {
    expect(uploadPaymentSchema.safeParse({}).success).toBe(false);
  });
});

describe('reviewPaymentSchema', () => {
  it('accepts decision=approve', () => {
    expect(reviewPaymentSchema.safeParse({ decision: 'approve' }).success).toBe(true);
  });

  it('accepts decision=reject', () => {
    expect(reviewPaymentSchema.safeParse({ decision: 'reject' }).success).toBe(true);
  });

  it('rejects invalid decision', () => {
    expect(reviewPaymentSchema.safeParse({ decision: 'maybe' }).success).toBe(false);
  });

  it('rejects missing decision', () => {
    expect(reviewPaymentSchema.safeParse({}).success).toBe(false);
  });

  it('accepts optional note', () => {
    expect(reviewPaymentSchema.safeParse({ decision: 'approve', note: 'Looks good' }).success).toBe(true);
  });

  it('rejects note exceeding 500 chars', () => {
    expect(
      reviewPaymentSchema.safeParse({ decision: 'approve', note: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('listPaymentsQuerySchema', () => {
  it('accepts valid status filter', () => {
    expect(listPaymentsQuerySchema.safeParse({ status: 'pending' }).success).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(listPaymentsQuerySchema.safeParse({ status: 'unknown' }).success).toBe(false);
  });

  it('accepts empty object (all optional)', () => {
    expect(listPaymentsQuerySchema.safeParse({}).success).toBe(true);
  });
});

describe('setFeeSchema', () => {
  it('accepts valid positive fee', () => {
    expect(setFeeSchema.safeParse({ fee: 50 }).success).toBe(true);
  });

  it('rejects zero', () => {
    expect(setFeeSchema.safeParse({ fee: 0 }).success).toBe(false);
  });

  it('rejects negative', () => {
    expect(setFeeSchema.safeParse({ fee: -1 }).success).toBe(false);
  });

  it('rejects fee > 10000', () => {
    expect(setFeeSchema.safeParse({ fee: 10001 }).success).toBe(false);
  });

  it('rejects more than 2 decimal places', () => {
    expect(setFeeSchema.safeParse({ fee: 10.123 }).success).toBe(false);
  });

  it('accepts exactly 2 decimal places', () => {
    expect(setFeeSchema.safeParse({ fee: 49.99 }).success).toBe(true);
  });

  it('accepts 10000 (max boundary)', () => {
    expect(setFeeSchema.safeParse({ fee: 10000 }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Service tests — require DB
// ---------------------------------------------------------------------------

describe('payments.service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('uploadPayment() — fee snapshot', () => {
    it('snapshots fee at time of upload', async () => {
      const admin = await createUserHelper('admin');
      const teacher = await createUserHelper('teacher');
      const student = await createUserHelper('student');
      const session = await createSessionRecord(teacher.id);
      await setFeeConfig(60, admin.id);

      const dummyFile = { filename: 'test.jpg' } as Express.Multer.File;
      const payment = await uploadPayment(student.id, session.id, dummyFile);

      expect(Number(payment!.amount)).toBe(60);
      expect(payment!.receiptUrl).toBe(`/api/payments/${payment!.id}/receipt`);
      expect(payment!.student!.id).toBe(student.id);
      expect(payment!.session!.id).toBe(session.id);
      expect(payment!.reviewedBy).toBeNull();
    });

    it('prior payment amount unchanged after fee change', async () => {
      const admin = await createUserHelper('admin');
      const teacher = await createUserHelper('teacher');
      const student = await createUserHelper('student');
      const session = await createSessionRecord(teacher.id);
      await setFeeConfig(60, admin.id);

      const dummyFile = { filename: 'test.jpg' } as Express.Multer.File;
      const p1 = await uploadPayment(student.id, session.id, dummyFile);

      // Change fee
      await setFeeConfig(100, admin.id);

      // Second upload uses new fee
      const p2 = await uploadPayment(student.id, session.id, { filename: 'test2.jpg' } as Express.Multer.File);

      // p1 still has old amount
      const row1 = await prisma.payment.findUnique({ where: { id: p1!.id } });
      expect(Number(row1!.amount)).toBe(60);
      expect(Number(p2!.amount)).toBe(100);
    });

    it('defaults to fee=0 when no fee configured', async () => {
      const teacher = await createUserHelper('teacher');
      const student = await createUserHelper('student');
      const session = await createSessionRecord(teacher.id);

      const payment = await uploadPayment(
        student.id,
        session.id,
        { filename: 'test.jpg' } as Express.Multer.File,
      );

      expect(Number(payment!.amount)).toBe(0);
    });

    it('throws 404 for unknown session', async () => {
      const student = await createUserHelper('student');
      await expect(
        uploadPayment(
          student.id,
          '00000000-0000-0000-0000-000000000000',
          { filename: 'test.jpg' } as Express.Multer.File,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 for cancelled session', async () => {
      const admin = await createUserHelper('admin');
      const student = await createUserHelper('student');
      const session = await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });
      await expect(
        uploadPayment(
          student.id,
          session.id,
          { filename: 'test.jpg' } as Express.Multer.File,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('reviewPayment() — state machine', () => {
    it('approve transitions pending → approved and sets reviewedById', async () => {
      const admin = await createUserHelper('admin');
      const teacher = await createUserHelper('teacher');
      const student = await createUserHelper('student');
      const session = await createSessionRecord(teacher.id);
      const payment = await createPaymentRecord(student.id, session.id);

      const result = await reviewPayment(payment.id, { decision: 'approve' }, admin.id);

      expect(result.status).toBe('approved');
      expect(result.reviewedById).toBe(admin.id);
      expect(result.reviewedBy!.id).toBe(admin.id);
      expect(result.reviewedBy!.name).toBeDefined();
    });

    it('reject transitions pending → rejected', async () => {
      const teacher = await createUserHelper('teacher');
      const student = await createUserHelper('student');
      const session = await createSessionRecord(teacher.id);
      const payment = await createPaymentRecord(student.id, session.id);

      const result = await reviewPayment(payment.id, { decision: 'reject' }, teacher.id);

      expect(result.status).toBe('rejected');
    });

    it('throws 409 when reviewing an already-approved payment', async () => {
      const admin = await createUserHelper('admin');
      const teacher = await createUserHelper('teacher');
      const student = await createUserHelper('student');
      const session = await createSessionRecord(teacher.id);
      const payment = await createPaymentRecord(student.id, session.id, {
        status: 'approved',
        reviewedById: admin.id,
      });

      await expect(
        reviewPayment(payment.id, { decision: 'approve' }, admin.id),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 409 when reviewing an already-rejected payment', async () => {
      const admin = await createUserHelper('admin');
      const teacher = await createUserHelper('teacher');
      const student = await createUserHelper('student');
      const session = await createSessionRecord(teacher.id);
      const payment = await createPaymentRecord(student.id, session.id, {
        status: 'rejected',
        reviewedById: admin.id,
      });

      await expect(
        reviewPayment(payment.id, { decision: 'reject' }, admin.id),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 404 for unknown payment id', async () => {
      const admin = await createUserHelper('admin');
      await expect(
        reviewPayment('00000000-0000-0000-0000-000000000000', { decision: 'approve' }, admin.id),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('listPayments() — student isolation', () => {
    it('student role returns only own payments', async () => {
      const teacher = await createUserHelper('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUserHelper('student');
      const s2 = await createUserHelper('student');
      const p1 = await createPaymentRecord(s1.id, session.id);
      await createPaymentRecord(s2.id, session.id);

      const results = await listPayments({}, s1.id, 'student');
      const ids = results.map((p) => p.id);
      expect(ids).toContain(p1.id);
      expect(ids.every((id) => results.find((p) => p.id === id)?.studentId === s1.id)).toBe(true);
    });

    it('admin role returns all payments', async () => {
      const teacher = await createUserHelper('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUserHelper('student');
      const s2 = await createUserHelper('student');
      const admin = await createUserHelper('admin');
      await createPaymentRecord(s1.id, session.id);
      await createPaymentRecord(s2.id, session.id);

      const results = await listPayments({}, admin.id, 'admin');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getPayment() — access control', () => {
    it('student can access own payment', async () => {
      const teacher = await createUserHelper('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUserHelper('student');
      const payment = await createPaymentRecord(student.id, session.id);

      const result = await getPayment(payment.id, student.id, 'student');
      expect(result.id).toBe(payment.id);
    });

    it('student cannot access another student\'s payment (throws 403)', async () => {
      const teacher = await createUserHelper('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUserHelper('student');
      const s2 = await createUserHelper('student');
      const payment = await createPaymentRecord(s1.id, session.id);

      await expect(
        getPayment(payment.id, s2.id, 'student'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 404 for unknown payment', async () => {
      const admin = await createUserHelper('admin');
      await expect(
        getPayment('00000000-0000-0000-0000-000000000000', admin.id, 'admin'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
