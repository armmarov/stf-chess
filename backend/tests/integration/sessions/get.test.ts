import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import { createPreAttendance, createAttendance } from '../../helpers/attendance';
import { createPaymentRecord } from '../../helpers/payments';

const URL = (id: string) => `/api/sessions/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/sessions/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('200 — valid session', () => {
    it('returns full session including createdBy details', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.id).toBe(session.id);
      expect(res.body.session.place).toBe(session.place);
      expect(res.body.session.createdBy).toBeDefined();
      expect(res.body.session.createdBy.id).toBe(teacher.id);
      expect(res.body.session.createdBy.name).toBe(teacher.name);
    });

    it('includes cancelledBy details when session is cancelled', async () => {
      const admin = await createUser('admin');
      const session = await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.isCancelled).toBe(true);
      expect(res.body.session.cancelledAt).toBeDefined();
      expect(res.body.session.cancelledBy).toBeDefined();
      expect(res.body.session.cancelledBy.id).toBe(admin.id);
    });

    it('cancelledBy is null for non-cancelled session', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.isCancelled).toBe(false);
      expect(res.body.session.cancelledBy).toBeNull();
    });
  });

  describe('200 — myPreAttended field', () => {
    it('student who pre-attended gets myPreAttended: true', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      await createPreAttendance(session.id, user.id);

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myPreAttended).toBe(true);
    });

    it('student who has NOT pre-attended gets myPreAttended: false', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myPreAttended).toBe(false);
    });

    it('teacher gets myPreAttended: undefined (field absent)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myPreAttended).toBeUndefined();
    });

    it('admin gets myPreAttended: undefined (field absent)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myPreAttended).toBeUndefined();
    });
  });

  describe('200 — myAttended field', () => {
    it('student with present:true Attendance row gets myAttended: true', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      await createAttendance(session.id, user.id, teacher.id, { present: true, paidCash: false });

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myAttended).toBe(true);
    });

    it('student with no Attendance row gets myAttended: false', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myAttended).toBe(false);
    });

    it('student with present:false Attendance row gets myAttended: false', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      await createAttendance(session.id, user.id, teacher.id, { present: false, paidCash: false });

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myAttended).toBe(false);
    });

    it('teacher gets myAttended: undefined (field absent)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myAttended).toBeUndefined();
    });

    it('myPreAttended and myAttended both present for student', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      await createPreAttendance(session.id, user.id);
      await createAttendance(session.id, user.id, teacher.id, { present: true, paidCash: false });

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myPreAttended).toBe(true);
      expect(res.body.session.myAttended).toBe(true);
    });
  });

  describe('200 — myPaidCash field', () => {
    it('student with paidCash:true Attendance row gets myPaidCash: true', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      await createAttendance(session.id, user.id, teacher.id, { present: true, paidCash: true });

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myPaidCash).toBe(true);
    });

    it('student with paidCash:false Attendance row gets myPaidCash: false', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent, user } = await loginAs('student');
      await createAttendance(session.id, user.id, teacher.id, { present: true, paidCash: false });

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myPaidCash).toBe(false);
    });

    it('student with no Attendance row gets myPaidCash: false', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myPaidCash).toBe(false);
    });

    it('teacher gets myPaidCash: undefined (field absent)', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.myPaidCash).toBeUndefined();
    });
  });

  describe('200 — presentCount', () => {
    it('presentCount equals number of present:true attendance rows', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      await createAttendance(session.id, s1.id, teacher.id, { present: true, paidCash: false });
      await createAttendance(session.id, s2.id, teacher.id, { present: false, paidCash: false });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.presentCount).toBe(1);
    });

    it('presentCount is 0 when no attendance rows exist', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.presentCount).toBe(0);
    });
  });

  describe('200 — payment breakdown (paidCashCount / paidOnlineCount / unpaidCount)', () => {
    it('all-cash: 2 present+paidCash rows → paidCashCount=2, paidOnlineCount=0, unpaidCount=0', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      await createAttendance(session.id, s1.id, teacher.id, { present: true, paidCash: true });
      await createAttendance(session.id, s2.id, teacher.id, { present: true, paidCash: true });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.paidCashCount).toBe(2);
      expect(res.body.session.paidOnlineCount).toBe(0);
      expect(res.body.session.unpaidCount).toBe(0);
    });

    it('all-online: 2 present rows + 2 approved payments → paidCashCount=0, paidOnlineCount=2, unpaidCount=0', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      await createAttendance(session.id, s1.id, teacher.id, { present: true, paidCash: false });
      await createAttendance(session.id, s2.id, teacher.id, { present: true, paidCash: false });
      const admin = await createUser('admin');
      await createPaymentRecord(s1.id, session.id, { status: 'approved', reviewedById: admin.id });
      await createPaymentRecord(s2.id, session.id, { status: 'approved', reviewedById: admin.id });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.paidCashCount).toBe(0);
      expect(res.body.session.paidOnlineCount).toBe(2);
      expect(res.body.session.unpaidCount).toBe(0);
    });

    it('mixed: 1 paidCash + 1 approved payment (different students) → paidCashCount=1, paidOnlineCount=1, unpaidCount=0', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      await createAttendance(session.id, s1.id, teacher.id, { present: true, paidCash: true });
      await createAttendance(session.id, s2.id, teacher.id, { present: true, paidCash: false });
      const admin = await createUser('admin');
      await createPaymentRecord(s2.id, session.id, { status: 'approved', reviewedById: admin.id });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.paidCashCount).toBe(1);
      expect(res.body.session.paidOnlineCount).toBe(1);
      expect(res.body.session.unpaidCount).toBe(0);
    });

    it('overlap: 1 student has paidCash=true AND approved payment → union dedup, unpaidCount=0', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const student = await createUser('student');
      await createAttendance(session.id, student.id, teacher.id, { present: true, paidCash: true });
      const admin = await createUser('admin');
      await createPaymentRecord(student.id, session.id, { status: 'approved', reviewedById: admin.id });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.paidCashCount).toBe(1);
      expect(res.body.session.paidOnlineCount).toBe(1);
      expect(res.body.session.unpaidCount).toBe(0);
    });

    it('unpaid: 2 present rows, 1 approved payment → unpaidCount=1', async () => {
      const teacher = await createUser('teacher');
      const session = await createSessionRecord(teacher.id);
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      await createAttendance(session.id, s1.id, teacher.id, { present: true, paidCash: false });
      await createAttendance(session.id, s2.id, teacher.id, { present: true, paidCash: false });
      const admin = await createUser('admin');
      await createPaymentRecord(s1.id, session.id, { status: 'approved', reviewedById: admin.id });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(session.id));

      expect(res.status).toBe(200);
      expect(res.body.session.paidCashCount).toBe(0);
      expect(res.body.session.paidOnlineCount).toBe(1);
      expect(res.body.session.unpaidCount).toBe(1);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown UUID', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });
});
