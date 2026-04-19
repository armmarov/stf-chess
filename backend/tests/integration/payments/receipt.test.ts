import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import {
  createPaymentRecord,
  writeFixtureFile,
  deleteFixtureFile,
  cleanUploads,
  JPEG_BUFFER,
  PNG_BUFFER,
  PDF_BUFFER,
} from '../../helpers/payments';

const URL = (id: string) => `/api/payments/${id}/receipt`;

describe('GET /api/payments/:id/receipt', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    cleanUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL('00000000-0000-0000-0000-000000000000'));
      expect(res.status).toBe(401);
    });
  });

  describe('403 — coach', () => {
    it('403 for coach', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const filename = writeFixtureFile('test-coach.jpg', JPEG_BUFFER);
      const payment = await createPaymentRecord(student.id, session.id, { receiptFilePath: filename });

      const { agent } = await loginAs('coach');
      const res = await agent.get(URL(payment.id));
      expect(res.status).toBe(403);
    });
  });

  describe('403 — student accessing another\'s receipt', () => {
    it('403 when student tries to download another student\'s receipt', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const other = await createUser('student');
      const filename = writeFixtureFile('test-other.jpg', JPEG_BUFFER);
      const payment = await createPaymentRecord(other.id, session.id, { receiptFilePath: filename });

      const { agent } = await loginAs('student');
      const res = await agent.get(URL(payment.id));
      expect(res.status).toBe(403);
    });
  });

  describe('200 — correct Content-Type', () => {
    it('student downloads own JPEG receipt — Content-Type: image/jpeg', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      const filename = writeFixtureFile('receipt-test.jpg', JPEG_BUFFER);
      const payment = await createPaymentRecord(user.id, session.id, { receiptFilePath: filename });

      const res = await agent.get(URL(payment.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    });

    it('student downloads own PNG receipt — Content-Type: image/png', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      const filename = writeFixtureFile('receipt-test.png', PNG_BUFFER);
      const payment = await createPaymentRecord(user.id, session.id, { receiptFilePath: filename });

      const res = await agent.get(URL(payment.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/png/);
    });

    it('student downloads own PDF receipt — Content-Type: application/pdf', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      const filename = writeFixtureFile('receipt-test.pdf', PDF_BUFFER);
      const payment = await createPaymentRecord(user.id, session.id, { receiptFilePath: filename });

      const res = await agent.get(URL(payment.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });
  });

  describe('200 — admin/teacher can download any receipt', () => {
    it('admin can download any receipt', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const filename = writeFixtureFile('receipt-admin.jpg', JPEG_BUFFER);
      const payment = await createPaymentRecord(student.id, session.id, { receiptFilePath: filename });

      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(payment.id));
      expect(res.status).toBe(200);
    });

    it('teacher can download any receipt', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      const filename = writeFixtureFile('receipt-teacher.png', PNG_BUFFER);
      const payment = await createPaymentRecord(student.id, session.id, { receiptFilePath: filename });

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(payment.id));
      expect(res.status).toBe(200);
    });
  });

  describe('404 — file missing from disk', () => {
    it('404 when file record exists but file is gone from disk', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');

      // Write then immediately delete to simulate missing file
      const filename = writeFixtureFile('receipt-missing.jpg', JPEG_BUFFER);
      const payment = await createPaymentRecord(user.id, session.id, { receiptFilePath: filename });
      deleteFixtureFile(filename);

      const res = await agent.get(URL(payment.id));
      expect(res.status).toBe(404);
    });
  });
});
