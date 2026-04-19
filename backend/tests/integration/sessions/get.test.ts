import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createSessionRecord } from '../../helpers/sessions';
import { createPreAttendance } from '../../helpers/attendance';

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

  describe('404 — not found', () => {
    it('404 for unknown UUID', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });
});
