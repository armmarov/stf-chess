import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';

const URL = (id: string) => `/api/users/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/users/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown id', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — self access (any role)', () => {
    it('student can view their own record', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.get(URL(user.id));
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
    });

    it('teacher can view their own record', async () => {
      const { agent, user } = await loginAs('teacher');
      const res = await agent.get(URL(user.id));
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
    });

    it('coach can view their own record', async () => {
      const { agent, user } = await loginAs('coach');
      const res = await agent.get(URL(user.id));
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
    });

    it('admin can view their own record', async () => {
      const { agent, user } = await loginAs('admin');
      const res = await agent.get(URL(user.id));
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
    });
  });

  describe('403 — cross-role restrictions', () => {
    it('student cannot view another user', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(target.id));
      expect(res.status).toBe(403);
    });

    it('coach cannot view another user', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('coach');
      const res = await agent.get(URL(target.id));
      expect(res.status).toBe(403);
    });

    it('teacher cannot view another teacher', async () => {
      const target = await createUser('teacher');
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(target.id));
      expect(res.status).toBe(403);
    });

    it('teacher cannot view an admin', async () => {
      const target = await createUser('admin');
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(target.id));
      expect(res.status).toBe(403);
    });

    it('teacher cannot view a coach', async () => {
      const target = await createUser('coach');
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(target.id));
      expect(res.status).toBe(403);
    });
  });

  describe('200 — teacher/admin cross-user access', () => {
    it('teacher can view a student', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(student.id));
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(student.id);
    });

    it('admin can view any user', async () => {
      const target = await createUser('teacher');
      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(target.id));
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(target.id);
    });
  });

  describe('passwordHash never in response', () => {
    it('passwordHash absent from response', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(student.id));
      expect(res.status).toBe(200);
      expect(res.body.user.passwordHash).toBeUndefined();
    });
  });

  describe('lastLoginAt field', () => {
    it('lastLoginAt is null for user who has never logged in', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(student.id));
      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('lastLoginAt');
      expect(res.body.user.lastLoginAt).toBeNull();
    });

    it('lastLoginAt is an ISO datetime string after user logs in', async () => {
      const before = new Date();
      const { agent: adminAgent } = await loginAs('admin');
      const { user: student } = await loginAs('student');

      const res = await adminAgent.get(URL(student.id));

      expect(res.status).toBe(200);
      expect(res.body.user.lastLoginAt).not.toBeNull();
      const parsed = new Date(res.body.user.lastLoginAt);
      expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
