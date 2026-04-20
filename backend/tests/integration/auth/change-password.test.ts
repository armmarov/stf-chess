import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';

const URL = '/api/auth/change-password';

describe('POST /api/auth/change-password', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 with no cookie', async () => {
      const res = await request(app)
        .post(URL)
        .send({ currentPassword: 'Test1234!', newPassword: 'NewPass99!' });
      expect(res.status).toBe(401);
    });
  });

  describe('400 — validation failures', () => {
    it('400 when newPassword is too short (< 8 chars)', async () => {
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .send({ currentPassword: 'Test1234!', newPassword: 'short' });
      expect(res.status).toBe(400);
    });

    it('400 when currentPassword field is missing', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL).send({ newPassword: 'NewPass99!' });
      expect(res.status).toBe(400);
    });

    it('400 when newPassword field is missing', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL).send({ currentPassword: 'Test1234!' });
      expect(res.status).toBe(400);
    });
  });

  describe('401 — wrong current password', () => {
    it('401 when currentPassword is incorrect', async () => {
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .send({ currentPassword: 'WrongPassword1!', newPassword: 'NewPass99!' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/current password is incorrect/i);
    });
  });

  describe('400 — new password same as current', () => {
    it('400 when newPassword equals currentPassword', async () => {
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .send({ currentPassword: 'Test1234!', newPassword: 'Test1234!' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/different from current/i);
    });
  });

  describe('204 — happy path', () => {
    it('204 on valid change; subsequent login with new password succeeds', async () => {
      const { agent, user } = await loginAs('student');

      const res = await agent
        .post(URL)
        .send({ currentPassword: 'Test1234!', newPassword: 'NewPass99!' });
      expect(res.status).toBe(204);

      // Login with new password should work
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: user.username, password: 'NewPass99!' });
      expect(loginRes.status).toBe(200);
    });

    it('old password no longer works after change', async () => {
      const { agent, user } = await loginAs('student');

      await agent
        .post(URL)
        .send({ currentPassword: 'Test1234!', newPassword: 'NewPass99!' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: user.username, password: 'Test1234!' });
      expect(loginRes.status).toBe(401);
    });

    it('session cookie stays alive after password change', async () => {
      const { agent } = await loginAs('student');

      await agent
        .post(URL)
        .send({ currentPassword: 'Test1234!', newPassword: 'NewPass99!' });

      // Existing session should still be valid
      const meRes = await agent.get('/api/auth/me');
      expect(meRes.status).toBe(200);
    });

    it('any role can change own password (teacher)', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent
        .post(URL)
        .send({ currentPassword: 'Test1234!', newPassword: 'NewPass99!' });
      expect(res.status).toBe(204);
    });
  });
});
