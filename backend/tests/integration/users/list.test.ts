import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';

const URL = '/api/users';

describe('GET /api/users', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('403 — forbidden roles', () => {
    it('403 for student', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent.get(URL);
      expect(res.status).toBe(403);
    });

    it('403 for teacher with role=teacher', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(`${URL}?role=teacher`);
      expect(res.status).toBe(403);
    });

    it('403 for teacher with role=admin', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(`${URL}?role=admin`);
      expect(res.status).toBe(403);
    });

    it('403 for teacher with role=coach', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(`${URL}?role=coach`);
      expect(res.status).toBe(403);
    });
  });

  describe('200 — teacher', () => {
    it('teacher without role filter returns only students', async () => {
      const student = await createUser('student');
      const teacher2 = await createUser('teacher');
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const ids = res.body.users.map((u: { id: string }) => u.id);
      expect(ids).toContain(student.id);
      expect(ids).not.toContain(teacher2.id);
    });

    it('teacher with role=student returns students', async () => {
      const student = await createUser('student');
      const { agent } = await loginAs('teacher');

      const res = await agent.get(`${URL}?role=student`);

      expect(res.status).toBe(200);
      const ids = res.body.users.map((u: { id: string }) => u.id);
      expect(ids).toContain(student.id);
    });
  });

  describe('200 — admin', () => {
    it('admin lists users across all roles', async () => {
      await createUser('student');
      await createUser('teacher');
      await createUser('coach');
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThanOrEqual(3);
    });

    it('admin filters by role=teacher', async () => {
      const teacher = await createUser('teacher');
      await createUser('student');
      const { agent } = await loginAs('admin');

      const res = await agent.get(`${URL}?role=teacher`);

      expect(res.status).toBe(200);
      const ids = res.body.users.map((u: { id: string }) => u.id);
      expect(ids).toContain(teacher.id);
    });

    it('admin filters active=false returns only inactive users', async () => {
      await createUser('student', { isActive: true });
      const inactive = await createUser('student', { isActive: false });
      const { agent } = await loginAs('admin');

      const res = await agent.get(`${URL}?active=false`);

      expect(res.status).toBe(200);
      const ids = res.body.users.map((u: { id: string }) => u.id);
      expect(ids).toContain(inactive.id);
      for (const u of res.body.users) {
        expect(u.isActive).toBe(false);
      }
    });
  });

  describe('passwordHash never in response', () => {
    it('passwordHash is absent from every user object', async () => {
      await createUser('student');
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      for (const u of res.body.users) {
        expect(u.passwordHash).toBeUndefined();
      }
    });
  });
});
