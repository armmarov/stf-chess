import request from 'supertest';
import bcrypt from 'bcrypt';
import { prisma } from './db';
import { app } from './app';

export type Role = 'admin' | 'teacher' | 'coach' | 'student';

interface UserOverrides {
  name?: string;
  username?: string;
  password?: string;
  phone?: string;
  isActive?: boolean;
}

const DEFAULT_PASSWORD = 'Test1234!';

export async function createUser(role: Role, overrides: UserOverrides = {}) {
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);
  const timestamp = Date.now();

  return prisma.user.create({
    data: {
      name: overrides.name ?? `Test ${role} ${timestamp}`,
      username: overrides.username ?? `${role}-${timestamp}`,
      passwordHash,
      role,
      phone: overrides.phone ?? null,
      isActive: overrides.isActive ?? true,
    },
  });
}

/**
 * Returns a Supertest agent already authenticated as the given role.
 * The agent preserves cookies across requests (session simulation).
 */
export async function loginAs(role: Role, overrides: UserOverrides = {}) {
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const user = await createUser(role, overrides);

  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: user.username, password });

  return { agent, user };
}
