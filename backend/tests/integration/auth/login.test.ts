import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';

const URL = '/api/auth/login';

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('200 — valid credentials', () => {
    it('returns user object without passwordHash and sets stf_token cookie', async () => {
      const user = await createUser('admin');

      const res = await request(app)
        .post(URL)
        .send({ username: user.username, password: 'Test1234!' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(user.id);
      expect(res.body.user.username).toBe(user.username);
      expect(res.body.user.name).toBe(user.name);
      expect(res.body.user.role).toBe('admin');

      // password must never leak
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.password_hash).toBeUndefined();

      // stf_token httpOnly cookie must be set
      const rawCookies = res.headers['set-cookie'] as string | string[];
      const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
      const token = cookies.find((c) => c.startsWith('stf_token='));
      expect(token).toBeDefined();
      expect(token).toMatch(/HttpOnly/i);
    });

    it('works for each role type', async () => {
      for (const role of ['teacher', 'student', 'coach'] as const) {
        const user = await createUser(role);
        const res = await request(app)
          .post(URL)
          .send({ username: user.username, password: 'Test1234!' });
        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe(role);
      }
    });
  });

  describe('401 — bad credentials', () => {
    it('rejects wrong password', async () => {
      const user = await createUser('student');

      const res = await request(app)
        .post(URL)
        .send({ username: user.username, password: 'WrongPassword99!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('rejects unknown username with the same error as wrong password', async () => {
      const user = await createUser('student');

      const unknownRes = await request(app)
        .post(URL)
        .send({ username: 'no-such-user', password: 'Test1234!' });

      const wrongPassRes = await request(app)
        .post(URL)
        .send({ username: user.username, password: 'WrongPassword99!' });

      expect(unknownRes.status).toBe(401);
      expect(wrongPassRes.status).toBe(401);
      // same message prevents username enumeration
      expect(unknownRes.body.error).toBe(wrongPassRes.body.error);
    });
  });

  describe('403 — deactivated user', () => {
    it('rejects login for inactive account', async () => {
      const user = await createUser('student', { isActive: false });

      const res = await request(app)
        .post(URL)
        .send({ username: user.username, password: 'Test1234!' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('400 — validation', () => {
    it('missing username', async () => {
      const res = await request(app).post(URL).send({ password: 'Test1234!' });
      expect(res.status).toBe(400);
    });

    it('missing password', async () => {
      const res = await request(app).post(URL).send({ username: 'someone' });
      expect(res.status).toBe(400);
    });

    it('empty username string', async () => {
      const res = await request(app).post(URL).send({ username: '', password: 'Test1234!' });
      expect(res.status).toBe(400);
    });

    it('empty password string', async () => {
      const res = await request(app).post(URL).send({ username: 'someone', password: '' });
      expect(res.status).toBe(400);
    });

    it('non-string username', async () => {
      const res = await request(app).post(URL).send({ username: 42, password: 'Test1234!' });
      expect(res.status).toBe(400);
    });

    it('non-string password', async () => {
      const res = await request(app).post(URL).send({ username: 'someone', password: true });
      expect(res.status).toBe(400);
    });

    it('empty body', async () => {
      const res = await request(app).post(URL).send({});
      expect(res.status).toBe(400);
    });
  });
});
