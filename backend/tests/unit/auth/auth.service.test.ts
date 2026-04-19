import jwt from 'jsonwebtoken';
import { loginUser, getUserById, verifyToken, JwtPayload } from '../../../src/modules/auth/auth.service';
import { createUser } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';

describe('auth.service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('loginUser()', () => {
    it('returns AuthUser and token on valid credentials', async () => {
      const user = await createUser('admin');
      const result = await loginUser(user.username, 'Test1234!');

      expect(result.user.id).toBe(user.id);
      expect(result.user.username).toBe(user.username);
      expect(result.user.name).toBe(user.name);
      expect(result.user.role).toBe('admin');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');

      // password must not be in the returned user
      expect((result.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('JWT payload contains sub=userId and role', async () => {
      const user = await createUser('teacher');
      const { token } = await loginUser(user.username, 'Test1234!');

      const decoded = jwt.decode(token) as JwtPayload;
      expect(decoded.sub).toBe(user.id);
      expect(decoded.role).toBe('teacher');
    });

    it('rejects wrong password with 401 status', async () => {
      const user = await createUser('student');

      await expect(loginUser(user.username, 'WrongPassword!')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('rejects unknown username with same 401 error as wrong password', async () => {
      // Both should throw the same statusCode and message (timing-safe)
      let unknownErr: unknown;
      let wrongPassErr: unknown;

      try {
        await loginUser('no-such-user', 'Test1234!');
      } catch (e) {
        unknownErr = e;
      }

      const user = await createUser('student');
      try {
        await loginUser(user.username, 'WrongPassword!');
      } catch (e) {
        wrongPassErr = e;
      }

      expect((unknownErr as { statusCode: number }).statusCode).toBe(401);
      expect((wrongPassErr as { statusCode: number }).statusCode).toBe(401);
      expect((unknownErr as Error).message).toBe((wrongPassErr as Error).message);
    });

    it('rejects deactivated user with 403 status', async () => {
      const user = await createUser('student', { isActive: false });

      await expect(loginUser(user.username, 'Test1234!')).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe('getUserById()', () => {
    it('returns AuthUser for an active user', async () => {
      const user = await createUser('coach');
      const result = await getUserById(user.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(user.id);
      expect(result!.role).toBe('coach');
    });

    it('returns null for a non-existent id', async () => {
      const result = await getUserById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    it('returns null for a deactivated user', async () => {
      const user = await createUser('student', { isActive: false });
      const result = await getUserById(user.id);
      expect(result).toBeNull();
    });
  });

  describe('verifyToken()', () => {
    it('decodes a valid token', async () => {
      const user = await createUser('admin');
      const { token } = await loginUser(user.username, 'Test1234!');

      const payload = verifyToken(token);
      expect(payload.sub).toBe(user.id);
      expect(payload.role).toBe('admin');
    });

    it('throws on a tampered token', () => {
      expect(() => verifyToken('invalid.token.value')).toThrow();
    });

    it('throws on an expired token', async () => {
      const user = await createUser('student');
      // Sign a token already expired
      const expiredToken = jwt.sign(
        { sub: user.id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' },
      );
      expect(() => verifyToken(expiredToken)).toThrow();
    });
  });
});
