import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';

const URL = (id: string) => `/api/users/${id}/password`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('POST /api/users/:id/password', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).post(URL(UNKNOWN_ID)).send({ newPassword: 'SomePass1!' });
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin roles', () => {
    it('403 for teacher', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL(target.id)).send({ newPassword: 'NewPass123!' });
      expect(res.status).toBe(403);
    });

    it('403 for student', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(target.id)).send({ newPassword: 'NewPass123!' });
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('coach');
      const res = await agent.post(URL(target.id)).send({ newPassword: 'NewPass123!' });
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown user id', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL(UNKNOWN_ID)).send({ newPassword: 'NewPass123!' });
      expect(res.status).toBe(404);
    });
  });

  describe('400 — validation', () => {
    it('400 for missing newPassword field', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL(target.id)).send({});
      expect(res.status).toBe(400);
    });

    it('400 for newPassword shorter than 8 chars', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL(target.id)).send({ newPassword: 'short' });
      expect(res.status).toBe(400);
    });
  });

  describe('204 — admin resets password end-to-end', () => {
    it('admin sets new password — returns 204', async () => {
      const target = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL(target.id)).send({ newPassword: 'BrandNew123!' });
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });

    it('user can log in with new password after reset', async () => {
      const OLD_PASSWORD = 'OldPass123!';
      const NEW_PASSWORD = 'NewPass456!';
      const target = await createUser('student', { password: OLD_PASSWORD });
      const { agent: adminAgent } = await loginAs('admin');

      await adminAgent.post(URL(target.id)).send({ newPassword: NEW_PASSWORD });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: target.username, password: NEW_PASSWORD });
      expect(loginRes.status).toBe(200);
    });

    it('old password fails after reset', async () => {
      const OLD_PASSWORD = 'OldPass123!';
      const NEW_PASSWORD = 'NewPass456!';
      const target = await createUser('student', { password: OLD_PASSWORD });
      const { agent: adminAgent } = await loginAs('admin');

      await adminAgent.post(URL(target.id)).send({ newPassword: NEW_PASSWORD });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: target.username, password: OLD_PASSWORD });
      expect(loginRes.status).toBe(401);
    });
  });
});
