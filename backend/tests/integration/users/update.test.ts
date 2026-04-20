import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';

const URL = (id: string) => `/api/users/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('PATCH /api/users/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).patch(URL(UNKNOWN_ID)).send({ name: 'X' });
      expect(res.status).toBe(401);
    });
  });

  describe('400 — username change rejected', () => {
    it('400 when username is present in body', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(target.id)).send({ username: 'newname' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/username cannot be changed/i);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown id', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(UNKNOWN_ID)).send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('200 — admin updates', () => {
    it('admin can update name', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(target.id)).send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Updated Name');
    });

    it('admin can update phone', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(target.id)).send({ phone: '+60123456789' });
      expect(res.status).toBe(200);
      expect(res.body.user.phone).toBe('+60123456789');
    });

    it('admin can set isActive: false — user\'s subsequent requests return 401', async () => {
      const { agent: userAgent, user } = await loginAs('student');

      // Confirm user can make authenticated requests before deactivation
      const before = await userAgent.get(URL(user.id));
      expect(before.status).toBe(200);

      // Admin deactivates
      const { agent: adminAgent } = await loginAs('admin');
      const deactivate = await adminAgent.patch(URL(user.id)).send({ isActive: false });
      expect(deactivate.status).toBe(200);
      expect(deactivate.body.user.isActive).toBe(false);

      // Existing session cookie must now be rejected
      const after = await userAgent.get(URL(user.id));
      expect(after.status).toBe(401);
    });
  });

  describe('200 — teacher updates student (name/phone/isActive)', () => {
    it('teacher can update a student\'s name', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(student.id)).send({ name: 'Teacher Updated' });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Teacher Updated');
    });

    it('teacher can update a student\'s phone', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(student.id)).send({ phone: '+60111234567' });
      expect(res.status).toBe(200);
      expect(res.body.user.phone).toBe('+60111234567');
    });

    it('teacher can set isActive: false on a student', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(student.id)).send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.user.isActive).toBe(false);
    });

    it('teacher can set isActive: true on a student', async () => {
      const student = await createUser('student', { isActive: false });
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(student.id)).send({ isActive: true });
      expect(res.status).toBe(200);
      expect(res.body.user.isActive).toBe(true);
    });

    it('teacher can update name, phone, and isActive together', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('teacher');
      const res = await agent
        .patch(URL(student.id))
        .send({ name: 'Combo Update', phone: '+60129999999', isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Combo Update');
      expect(res.body.user.phone).toBe('+60129999999');
      expect(res.body.user.isActive).toBe(false);
    });
  });

  describe('403 — teacher restrictions', () => {
    it('teacher cannot set a student\'s role', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(student.id)).send({ role: 'admin' });
      expect(res.status).toBe(403);
    });

    it('teacher cannot deactivate another teacher', async () => {
      const target = await createUser('teacher');
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(target.id)).send({ isActive: false });
      expect(res.status).toBe(403);
    });

    it('teacher cannot deactivate an admin', async () => {
      const target = await createUser('admin');
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(target.id)).send({ isActive: false });
      expect(res.status).toBe(403);
    });

    it('teacher cannot deactivate a coach', async () => {
      const target = await createUser('coach');
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(target.id)).send({ isActive: false });
      expect(res.status).toBe(403);
    });
  });

  describe('200 — self update (name/phone)', () => {
    it('student can update own name', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.patch(URL(user.id)).send({ name: 'My New Name' });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('My New Name');
    });

    it('student can update own phone', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.patch(URL(user.id)).send({ phone: '+60199999999' });
      expect(res.status).toBe(200);
      expect(res.body.user.phone).toBe('+60199999999');
    });

    it('coach can update own name', async () => {
      const { agent, user } = await loginAs('coach');
      const res = await agent.patch(URL(user.id)).send({ name: 'Coach Updated' });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Coach Updated');
    });
  });

  describe('403 — self update restricted fields', () => {
    it('student cannot change own isActive', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.patch(URL(user.id)).send({ isActive: false });
      expect(res.status).toBe(403);
    });

    it('student cannot change own role', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.patch(URL(user.id)).send({ role: 'teacher' });
      expect(res.status).toBe(403);
    });

    it('coach cannot change own isActive', async () => {
      const { agent, user } = await loginAs('coach');
      const res = await agent.patch(URL(user.id)).send({ isActive: false });
      expect(res.status).toBe(403);
    });
  });

  describe('passwordHash never in response', () => {
    it('passwordHash absent from update response', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(target.id)).send({ name: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.user.passwordHash).toBeUndefined();
    });
  });
});
