import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { signExpiredToken, signToken } from '../../helpers/jwt';
import type { AuthUser } from '../../../src/types';

const URL = '/api/auth/me';

describe('GET /api/auth/me', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('200 — authenticated', () => {
    it('returns current user when cookie is valid', async () => {
      const { agent, user } = await loginAs('teacher');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(user.id);
      expect(res.body.user.username).toBe(user.username);
      expect(res.body.user.role).toBe('teacher');
      expect(res.body.user.passwordHash).toBeUndefined();
    });
  });

  describe('401 — unauthenticated', () => {
    it('401 without any cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('401 with a tampered token', async () => {
      const res = await request(app)
        .get(URL)
        .set('Cookie', 'stf_token=tampered.jwt.token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('401 with an expired token', async () => {
      const user = await createUser('student');
      const expiredToken = signExpiredToken({
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role as AuthUser['role'],
      });

      const res = await request(app)
        .get(URL)
        .set('Cookie', `stf_token=${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('401 when user is deactivated after token was issued', async () => {
      const { agent, user } = await loginAs('student');

      // Deactivate the user after token was issued
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      const res = await agent.get(URL);

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('401 with a valid JWT signed with a different secret', async () => {
      const user = await createUser('student');
      const fakeToken = require('jsonwebtoken').sign(
        { sub: user.id, role: user.role },
        'completely-different-secret',
        { expiresIn: '1h' },
      );

      const res = await request(app)
        .get(URL)
        .set('Cookie', `stf_token=${fakeToken}`);

      expect(res.status).toBe(401);
    });
  });
});
