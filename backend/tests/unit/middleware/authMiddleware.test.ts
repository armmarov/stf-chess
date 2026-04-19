import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { authMiddleware } from '../../../src/middleware/authMiddleware';
import { createUser } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { signToken, signExpiredToken } from '../../helpers/jwt';
import type { AuthUser } from '../../../src/types';

// Minimal test app — just the middleware under test + a probe route
function buildTestApp() {
  const app = express();
  app.use(cookieParser());
  app.get('/probe', authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });
  return app;
}

const testApp = buildTestApp();

describe('authMiddleware', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('sets req.user and calls next() with a valid token', async () => {
    const user = await createUser('admin');
    const token = signToken({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role as AuthUser['role'],
    });

    const res = await request(testApp)
      .get('/probe')
      .set('Cookie', `stf_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.role).toBe('admin');
  });

  it('401 when no cookie is present', async () => {
    const res = await request(testApp).get('/probe');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('401 with a tampered token string', async () => {
    const res = await request(testApp)
      .get('/probe')
      .set('Cookie', 'stf_token=bad.jwt.here');

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

    const res = await request(testApp)
      .get('/probe')
      .set('Cookie', `stf_token=${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('401 when user is deactivated after token was issued', async () => {
    const user = await createUser('student');
    const token = signToken({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role as AuthUser['role'],
    });

    // Deactivate user after token issued
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await request(testApp)
      .get('/probe')
      .set('Cookie', `stf_token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('401 for a valid JWT with a non-existent user id', async () => {
    const token = signToken({
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Ghost',
      username: 'ghost',
      role: 'student',
    });

    const res = await request(testApp)
      .get('/probe')
      .set('Cookie', `stf_token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
