import { z } from 'zod';

const roleEnum = z.enum(['admin', 'teacher', 'coach', 'student']);

export const CLASS_VALUES = [
  '1S', '1T', '1F', '1J', '1B',
  '2S', '2T', '2F', '2J', '2B',
  '3S', '3T', '3F', '3J', '3B',
  '4S', '4T', '4F', '4J', '4B',
  '5S', '5T', '5F', '5J', '5B',
] as const;
export type ClassName = typeof CLASS_VALUES[number];

const phoneSchema = z
  .string()
  .min(7)
  .max(20)
  .regex(/^[\d\s+\-()]+$/, 'Phone must contain only digits, spaces, +, -, ()')
  .optional();

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/, 'Username must be lowercase letters, digits, or underscores only'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: roleEnum,
  phone: phoneSchema,
  className: z.enum(CLASS_VALUES).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/, 'username must be 3-32 chars of lowercase letters, digits, or underscore')
    .optional(),
  phone: z.string().min(7).max(20).regex(/^[\d\s+\-()]+$/).nullable().optional(),
  isActive: z.boolean().optional(),
  role: roleEnum.optional(),
  className: z.enum(CLASS_VALUES).optional(),
});

export const listUsersQuerySchema = z.object({
  role: roleEnum.optional(),
  active: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      return undefined;
    }),
});

export const setPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
