import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateUserInput, UpdateUserInput, ListUsersQuery } from './users.validators';
import { Role } from '../../types';

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

  try {
    return await prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  } catch (err) {
    handleUniqueViolation(err);
  }
}

export async function setPassword(id: string, newPassword: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'User not found');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}
