import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../utils/prisma';
import { env } from '../../config/env';
import { AuthUser } from '../../types';

const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

export interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

export async function loginUser(
  username: string,
  password: string,
  ip?: string | null,
): Promise<{ user: AuthUser; token: string }> {
  const record = await prisma.user.findUnique({ where: { username } });

  // Always run bcrypt compare to prevent timing attacks revealing valid usernames
  const hashToCheck = record?.passwordHash ?? DUMMY_HASH;
  const valid = await bcrypt.compare(password, hashToCheck);

  if (!record || !valid) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  if (!record.isActive) {
    throw Object.assign(new Error('Account is deactivated'), { statusCode: 403 });
  }

  await prisma.user.update({
    where: { id: record.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip ?? null },
  });

  const token = jwt.sign(
    { sub: record.id, role: record.role } satisfies JwtPayload,
    env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY_SECONDS },
  );

  return {
    user: {
      id: record.id,
      name: record.name,
      username: record.username,
      role: record.role as AuthUser['role'],
    },
    token,
  };
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const record = await prisma.user.findUnique({ where: { id: userId } });
  if (!record) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const valid = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 401 });

  const same = await bcrypt.compare(newPassword, record.passwordHash);
  if (same) throw Object.assign(new Error('New password must be different from current'), { statusCode: 400 });

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const record = await prisma.user.findUnique({ where: { id } });
  if (!record || !record.isActive) return null;
  return {
    id: record.id,
    name: record.name,
    username: record.username,
    role: record.role as AuthUser['role'],
  };
}
