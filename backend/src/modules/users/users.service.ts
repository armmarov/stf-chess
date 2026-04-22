import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateUserInput, UpdateUserInput, ListUsersQuery } from './users.validators';
import { Role } from '../../types';
import { fetchFideRatings } from './fide-rating';

const BCRYPT_ROUNDS = 10;

const USER_SELECT = {
  id: true,
  name: true,
  username: true,
  role: true,
  phone: true,
  isActive: true,
  className: true,
  createdAt: true,
  lastLoginAt: true,
  lastLoginIp: true,
  fideId: true,
  mcfId: true,
  fideStandardRating: true,
  fideRapidRating: true,
  fideBlitzRating: true,
  fideRatingFetchedAt: true,
} as const;

function handleUniqueViolation(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new AppError(409, 'Username already taken');
  }
  throw err;
}

export async function listUsers(query: ListUsersQuery, requesterRole: Role) {
  let roleFilter = query.role;

  if (requesterRole === 'teacher') {
    if (roleFilter && roleFilter !== 'student') {
      throw new AppError(403, 'Teachers can only list students');
    }
    roleFilter = 'student';
  }

  const where: Prisma.UserWhereInput = {};
  if (roleFilter) where.role = roleFilter;
  if (query.active !== undefined) where.isActive = query.active;

  return prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: { name: 'asc' },
  });
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

export async function createUser(data: CreateUserInput) {
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  try {
    return await prisma.user.create({
      data: {
        name: data.name,
        username: data.username,
        passwordHash,
        role: data.role,
        phone: data.phone ?? null,
        className: data.className ?? null,
      },
      select: USER_SELECT,
    });
  } catch (err) {
    handleUniqueViolation(err);
  }
}

export async function updateUser(id: string, data: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'User not found');

  // If the FIDE id is being changed (set or cleared) we invalidate the cached
  // rating numbers — they refer to the old id.
  const patch: Record<string, unknown> = { ...data };
  const fideIdChanged = data.fideId !== undefined && data.fideId !== existing.fideId;
  if (fideIdChanged) {
    patch.fideStandardRating = null;
    patch.fideRapidRating = null;
    patch.fideBlitzRating = null;
    patch.fideRatingFetchedAt = null;
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id },
      data: patch,
      select: USER_SELECT,
    });
  } catch (err) {
    handleUniqueViolation(err);
  }

  // Fire-and-forget: if a FIDE id is now set (changed or newly added), scrape
  // the rating and persist. Don't block the response on it.
  if (fideIdChanged && updated?.fideId) {
    void refreshFideRating(id).catch((err) => {
      console.error(`[fide] auto-refresh failed for user ${id}:`, err);
    });
  }

  return updated;
}

export async function refreshFideRating(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { fideId: true },
  });
  if (!u) throw new AppError(404, 'User not found');
  if (!u.fideId) throw new AppError(400, 'User has no FIDE ID set');

  const ratings = await fetchFideRatings(u.fideId);
  return prisma.user.update({
    where: { id: userId },
    data: {
      fideStandardRating: ratings.standard,
      fideRapidRating: ratings.rapid,
      fideBlitzRating: ratings.blitz,
      fideRatingFetchedAt: new Date(),
    },
    select: USER_SELECT,
  });
}

export async function setPassword(id: string, newPassword: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'User not found');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}
