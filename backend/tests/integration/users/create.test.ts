import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';

const URL = '/api/users';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'New User',
    username: `newuser_${Date.now()}`,
    password: 'Password1!',
    role: 'student',
    ...overrides,
  };
}

describe('POST /api/users', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).post(URL).send(validBody());
      expect(res.status).toBe(401);
    });
  });

  describe('403 — forbidden roles', () => {
    it('403 for student', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL).send(validBody());
      expect(res.status).toBe(403);
    });

    it('403 for coach', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent.post(URL).send(validBody());
      expect(res.status).toBe(403);
    });

    it('403 for teacher creating a teacher', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL).send(validBody({ role: 'teacher' }));
      expect(res.status).toBe(403);
    });

    it('403 for teacher creating a coach', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL).send(validBody({ role: 'coach' }));
      expect(res.status).toBe(403);
    });

    it('403 for teacher creating an admin', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL).send(validBody({ role: 'admin' }));
      expect(res.status).toBe(403);
    });
  });

  describe('201 — successful creation', () => {
    it('teacher creates a student — 201 with user object', async () => {
      const { agent } = await loginAs('teacher');
      const body = validBody({ role: 'student' });
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.username).toBe(body.username);
    });

    it('admin creates a student — 201', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ role: 'student' }));
      expect(res.status).toBe(201);
    });

    it('admin creates a teacher — 201', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ role: 'teacher' }));
      expect(res.status).toBe(201);
    });

    it('admin creates a coach — 201', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ role: 'coach' }));
      expect(res.status).toBe(201);
    });

    it('admin creates another admin — 201', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ role: 'admin' }));
      expect(res.status).toBe(201);
    });
  });

  describe('400 — validation errors', () => {
    it('400 for missing name', async () => {
      const { agent } = await loginAs('admin');
      const { name: _name, ...body } = validBody();
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(400);
    });

    it('400 for missing username', async () => {
      const { agent } = await loginAs('admin');
      const { username: _u, ...body } = validBody();
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(400);
    });

    it('400 for uppercase username', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ username: 'UpperCase' }));
      expect(res.status).toBe(400);
    });

    it('400 for username with special chars', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ username: 'user@name' }));
      expect(res.status).toBe(400);
    });

    it('400 for username with hyphen', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ username: 'user-name' }));
      expect(res.status).toBe(400);
    });

    it('400 for password shorter than 8 chars', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ password: 'short' }));
      expect(res.status).toBe(400);
    });

    it('400 for invalid role', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ role: 'superuser' }));
      expect(res.status).toBe(400);
    });

    it('400 for missing password', async () => {
      const { agent } = await loginAs('admin');
      const { password: _p, ...body } = validBody();
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(400);
    });

    it('400 for missing role', async () => {
      const { agent } = await loginAs('admin');
      const { role: _r, ...body } = validBody();
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(400);
    });
  });

  describe('409 — duplicate username', () => {
    it('409 on duplicate username with error message', async () => {
      const existing = await createUser('student');
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ username: existing.username }));
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/username already taken/i);
    });
  });

  describe('className — create', () => {
    it('201 with valid className stored and returned', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ className: '1S' }));
      expect(res.status).toBe(201);
      expect(res.body.user.className).toBe('1S');
    });

    it('201 without className → className is null', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody());
      expect(res.status).toBe(201);
      expect(res.body.user.className).toBeNull();
    });

    it('400 for invalid className value', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody({ className: '6X' }));
      expect(res.status).toBe(400);
    });
  });

  describe('passwordHash never in response', () => {
    it('passwordHash absent from created user response', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(validBody());
      expect(res.status).toBe(201);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('password is stored as bcrypt hash in DB (not plain text)', async () => {
      const { agent } = await loginAs('admin');
      const body = validBody({ password: 'MyPlainPass1!' });
      const res = await agent.post(URL).send(body);
      expect(res.status).toBe(201);

      const row = await prisma.user.findUnique({ where: { id: res.body.user.id } });
      expect(row!.passwordHash).not.toBe('MyPlainPass1!');
      expect(row!.passwordHash).toMatch(/^\$2/);
    });
  });
});
