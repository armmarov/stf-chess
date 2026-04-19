import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  setPasswordSchema,
} from '../../../src/modules/users/users.validators';
import { createUser, getUser, listUsers } from '../../../src/modules/users/users.service';
import { prisma, resetDb } from '../../helpers/db';
import { createUser as createUserHelper } from '../../helpers/auth';

// ---------------------------------------------------------------------------
// Schema validator tests — no DB required
// ---------------------------------------------------------------------------

describe('createUserSchema', () => {
  const validBase = {
    name: 'Alice Smith',
    username: 'alice_123',
    password: 'Password1!',
    role: 'student',
  };

  it('accepts valid input', () => {
    expect(createUserSchema.safeParse(validBase).success).toBe(true);
  });

  it('rejects uppercase username', () => {
    expect(createUserSchema.safeParse({ ...validBase, username: 'Alice' }).success).toBe(false);
  });

  it('rejects username with @ character', () => {
    expect(createUserSchema.safeParse({ ...validBase, username: 'user@name' }).success).toBe(false);
  });

  it('rejects username with hyphen', () => {
    expect(createUserSchema.safeParse({ ...validBase, username: 'user-name' }).success).toBe(false);
  });

  it('accepts username with underscore and digits', () => {
    expect(createUserSchema.safeParse({ ...validBase, username: 'user_99' }).success).toBe(true);
  });

  it('rejects username shorter than 3 chars', () => {
    expect(createUserSchema.safeParse({ ...validBase, username: 'ab' }).success).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    expect(createUserSchema.safeParse({ ...validBase, password: 'short' }).success).toBe(false);
  });

  it('rejects invalid role', () => {
    expect(createUserSchema.safeParse({ ...validBase, role: 'superuser' }).success).toBe(false);
  });

  it('accepts all valid roles', () => {
    for (const role of ['admin', 'teacher', 'coach', 'student']) {
      expect(createUserSchema.safeParse({ ...validBase, role }).success).toBe(true);
    }
  });

  it('rejects empty object (missing required fields)', () => {
    expect(createUserSchema.safeParse({}).success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('accepts partial update with name only', () => {
    expect(updateUserSchema.safeParse({ name: 'Bob' }).success).toBe(true);
  });

  it('accepts isActive: false', () => {
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('rejects non-boolean isActive', () => {
    expect(updateUserSchema.safeParse({ isActive: 'yes' }).success).toBe(false);
  });

  it('accepts empty object (all fields optional)', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid role', () => {
    expect(updateUserSchema.safeParse({ role: 'teacher' }).success).toBe(true);
  });

  it('rejects invalid role', () => {
    expect(updateUserSchema.safeParse({ role: 'superuser' }).success).toBe(false);
  });
});

describe('listUsersQuerySchema', () => {
  it('transforms active="true" string to boolean true', () => {
    const result = listUsersQuerySchema.safeParse({ active: 'true' });
    expect(result.success).toBe(true);
    expect(result.data!.active).toBe(true);
  });

  it('transforms active="false" string to boolean false', () => {
    const result = listUsersQuerySchema.safeParse({ active: 'false' });
    expect(result.success).toBe(true);
    expect(result.data!.active).toBe(false);
  });

  it('active omitted → undefined', () => {
    const result = listUsersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data!.active).toBeUndefined();
  });

  it('accepts valid role filter', () => {
    const result = listUsersQuerySchema.safeParse({ role: 'student' });
    expect(result.success).toBe(true);
    expect(result.data!.role).toBe('student');
  });
});

describe('setPasswordSchema', () => {
  it('accepts valid newPassword (8+ chars)', () => {
    expect(setPasswordSchema.safeParse({ newPassword: 'ValidPass1!' }).success).toBe(true);
  });

  it('rejects newPassword shorter than 8 chars', () => {
    expect(setPasswordSchema.safeParse({ newPassword: 'short' }).success).toBe(false);
  });

  it('rejects missing newPassword', () => {
    expect(setPasswordSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Service tests — require DB
// ---------------------------------------------------------------------------

describe('users.service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('createUser() — password hashing', () => {
    it('stores a bcrypt hash (starts with $2), not the plain password', async () => {
      await createUser({
        name: 'Test User',
        username: 'test_user_hash',
        password: 'PlainPassword1!',
        role: 'student',
      });

      const row = await prisma.user.findUnique({ where: { username: 'test_user_hash' } });
      expect(row!.passwordHash).not.toBe('PlainPassword1!');
      expect(row!.passwordHash).toMatch(/^\$2/);
    });

    it('does not return passwordHash in the result', async () => {
      const result = await createUser({
        name: 'Test User',
        username: 'test_no_hash',
        password: 'PlainPassword1!',
        role: 'student',
      });
      expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('throws 409 on duplicate username', async () => {
      await createUser({ name: 'First', username: 'dupuser', password: 'Password1!', role: 'student' });
      await expect(
        createUser({ name: 'Second', username: 'dupuser', password: 'Password1!', role: 'student' }),
      ).rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/username already taken/i) });
    });
  });

  describe('getUser() — lookup and 404', () => {
    it('returns the user by id', async () => {
      const u = await createUserHelper('student');
      const result = await getUser(u.id);
      expect(result.id).toBe(u.id);
      expect(result.username).toBe(u.username);
    });

    it('throws 404 for unknown id', async () => {
      await expect(
        getUser('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('listUsers() — teacher authorization matrix', () => {
    it('teacher role without filter returns only students', async () => {
      const student = await createUserHelper('student');
      const teacher = await createUserHelper('teacher');

      const results = await listUsers({}, 'teacher');
      const ids = results.map((u) => u.id);
      expect(ids).toContain(student.id);
      expect(ids).not.toContain(teacher.id);
    });

    it('teacher with role=student is allowed', async () => {
      const student = await createUserHelper('student');
      const results = await listUsers({ role: 'student' }, 'teacher');
      const ids = results.map((u) => u.id);
      expect(ids).toContain(student.id);
    });

    it('teacher with role=teacher throws 403', async () => {
      await expect(
        listUsers({ role: 'teacher' }, 'teacher'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('teacher with role=admin throws 403', async () => {
      await expect(
        listUsers({ role: 'admin' }, 'teacher'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('admin can list all roles', async () => {
      const student = await createUserHelper('student');
      const teacher = await createUserHelper('teacher');
      const coach = await createUserHelper('coach');

      const results = await listUsers({}, 'admin');
      const ids = results.map((u) => u.id);
      expect(ids).toContain(student.id);
      expect(ids).toContain(teacher.id);
      expect(ids).toContain(coach.id);
    });

    it('admin can filter by role=teacher', async () => {
      await createUserHelper('student');
      const teacher = await createUserHelper('teacher');

      const results = await listUsers({ role: 'teacher' }, 'admin');
      const ids = results.map((u) => u.id);
      expect(ids).toContain(teacher.id);
    });
  });
});
