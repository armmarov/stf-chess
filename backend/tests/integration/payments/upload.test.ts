import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import {
  setFeeConfig,
  cleanUploads,
  JPEG_BUFFER,
  PNG_BUFFER,
  PDF_BUFFER,
  TEXT_BUFFER,
  OVERSIZED_BUFFER,
} from '../../helpers/payments';

const URL = '/api/payments';
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('POST /api/payments', () => {
  beforeEach(async () => {
    await resetDb();
    cleanUploads();
  });

  afterEach(() => {
    cleanUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app)
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r.jpg', contentType: 'image/jpeg' })
        .field('sessionId', UNKNOWN_ID);
      expect(res.status).toBe(401);
    });
  });

  describe('403 — wrong role', () => {
    it('403 for teacher', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');
      const res = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r.jpg', contentType: 'image/jpeg' })
        .field('sessionId', session.id);
      expect(res.status).toBe(403);
    });

    it('403 for admin', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r.jpg', contentType: 'image/jpeg' })
        .field('sessionId', session.id);
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('coach');
      const res = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r.jpg', contentType: 'image/jpeg' })
        .field('sessionId', session.id);
      expect(res.status).toBe(403);
    });
  });

  describe('400 — file validation', () => {
    it('400 when no file attached', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');
      const res = await agent.post(URL).field('sessionId', session.id);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/receipt file is required/i);
    });

    it('400 for invalid MIME type (text/plain)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .attach('receipt', TEXT_BUFFER, { filename: 'r.txt', contentType: 'text/plain' })
        .field('sessionId', session.id);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid file type/i);
    });

    it('400 for file exceeding 5 MB', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .attach('receipt', OVERSIZED_BUFFER, { filename: 'big.jpg', contentType: 'image/jpeg' })
        .field('sessionId', session.id);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/5 mb/i);
    });

    it('400 for missing sessionId', async () => {
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(400);
    });

    it('400 for invalid sessionId (not a UUID)', async () => {
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r.jpg', contentType: 'image/jpeg' })
        .field('sessionId', 'not-a-uuid');
      expect(res.status).toBe(400);
    });
  });

  describe('404 — session not found', () => {
    it('404 for unknown sessionId', async () => {
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r.jpg', contentType: 'image/jpeg' })
        .field('sessionId', UNKNOWN_ID);
      expect(res.status).toBe(404);
    });
  });

  describe('409 — cancelled session', () => {
    it('409 for cancelled session', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: teacher.id,
      });
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r.jpg', contentType: 'image/jpeg' })
        .field('sessionId', session.id);
      expect(res.status).toBe(409);
    });
  });

  describe('201 — valid upload', () => {
    it('201 with JPEG — creates pending payment with snapshotted fee', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      const admin = await createUser('admin');
      await setFeeConfig(50, admin.id);

      const res = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'receipt.jpg', contentType: 'image/jpeg' })
        .field('sessionId', session.id);

      expect(res.status).toBe(201);
      expect(res.body.payment).toBeDefined();
      expect(res.body.payment.studentId).toBe(user.id);
      expect(res.body.payment.sessionId).toBe(session.id);
      expect(res.body.payment.status).toBe('pending');
      expect(Number(res.body.payment.amount)).toBe(50);

      // receiptUrl replaces receiptFilePath in responses
      expect(res.body.payment.receiptUrl).toBe(`/api/payments/${res.body.payment.id}/receipt`);
      expect(res.body.payment.receiptFilePath).toBeUndefined();

      // embedded relations
      expect(res.body.payment.student.id).toBe(user.id);
      expect(res.body.payment.student.name).toBeDefined();
      expect(res.body.payment.student.username).toBeDefined();
      expect(res.body.payment.session.id).toBe(session.id);
      expect(res.body.payment.session.place).toBeDefined();
      expect(res.body.payment.reviewedBy).toBeNull();

      // DB readback
      const row = await prisma.payment.findUnique({ where: { id: res.body.payment.id } });
      expect(row).not.toBeNull();
      expect(Number(row!.amount)).toBe(50);
    });

    it('201 with PNG — accepted', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent
        .post(URL)
        .attach('receipt', PNG_BUFFER, { filename: 'receipt.png', contentType: 'image/png' })
        .field('sessionId', session.id);

      expect(res.status).toBe(201);
    });

    it('201 with PDF — accepted', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent
        .post(URL)
        .attach('receipt', PDF_BUFFER, { filename: 'receipt.pdf', contentType: 'application/pdf' })
        .field('sessionId', session.id);

      expect(res.status).toBe(201);
    });

    it('amount defaults to 0 when no fee configured', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r.jpg', contentType: 'image/jpeg' })
        .field('sessionId', session.id);

      expect(res.status).toBe(201);
      expect(Number(res.body.payment.amount)).toBe(0);
    });
  });

  describe('FR-28 — fee snapshot', () => {
    it('second upload after fee change uses new fee; first payment amount unchanged', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user: student } = await loginAs('student');
      const { agent: adminAgent, user: admin } = await loginAs('admin');

      // Set initial fee and upload
      await adminAgent.put('/api/config/fee').send({ fee: 40 });
      const res1 = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r1.jpg', contentType: 'image/jpeg' })
        .field('sessionId', session.id);
      expect(res1.status).toBe(201);
      expect(Number(res1.body.payment.amount)).toBe(40);

      // Change fee
      await adminAgent.put('/api/config/fee').send({ fee: 80 });

      // Upload again — new fee applies
      const res2 = await agent
        .post(URL)
        .attach('receipt', JPEG_BUFFER, { filename: 'r2.jpg', contentType: 'image/jpeg' })
        .field('sessionId', session.id);
      expect(res2.status).toBe(201);
      expect(Number(res2.body.payment.amount)).toBe(80);

      // First payment's amount is still 40 (snapshot, not recalculated)
      const p1 = await prisma.payment.findUnique({ where: { id: res1.body.payment.id } });
      expect(Number(p1!.amount)).toBe(40);
    });
  });
});
