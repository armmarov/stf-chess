import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { roleGuard } from '../../../src/middleware/roleGuard';
import type { AuthUser } from '../../../src/types';

// Injects a synthetic req.user so we can test roleGuard in isolation
function injectUser(user: AuthUser | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.user = user;
    next();
  };
}

function buildTestApp(role: AuthUser | undefined, allowed: AuthUser['role'][]) {
  const app = express();
  app.get('/probe', injectUser(role), roleGuard(allowed), (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

const ADMIN_USER: AuthUser = { id: '1', name: 'Admin', username: 'admin', role: 'admin' };
const TEACHER_USER: AuthUser = { id: '2', name: 'Teacher', username: 'teacher', role: 'teacher' };
const STUDENT_USER: AuthUser = { id: '3', name: 'Student', username: 'student', role: 'student' };

describe('roleGuard', () => {
  it('calls next() and returns 200 when role is in allowed list', async () => {
    const app = buildTestApp(ADMIN_USER, ['admin', 'teacher']);
    const res = await request(app).get('/probe');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('403 when authenticated role is not in allowed list', async () => {
    const app = buildTestApp(STUDENT_USER, ['admin', 'teacher']);
    const res = await request(app).get('/probe');
    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('401 when req.user is undefined (not authenticated)', async () => {
    const app = buildTestApp(undefined, ['admin']);
    const res = await request(app).get('/probe');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('allows multiple roles — each passes independently', async () => {
    const allowed: AuthUser['role'][] = ['admin', 'teacher'];

    for (const user of [ADMIN_USER, TEACHER_USER]) {
      const app = buildTestApp(user, allowed);
      const res = await request(app).get('/probe');
      expect(res.status).toBe(200);
    }
  });

  it('403 for a role not in the allowed list even if other roles are', async () => {
    const app = buildTestApp(STUDENT_USER, ['admin', 'teacher', 'coach']);
    const res = await request(app).get('/probe');
    expect(res.status).toBe(403);
  });
});
