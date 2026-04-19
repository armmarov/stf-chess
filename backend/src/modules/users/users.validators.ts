import { z } from 'zod';

const roleEnum = z.enum(['admin', 'teacher', 'coach', 'student']);

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
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(7).max(20).regex(/^[\d\s+\-()]+$/).nullable().optional(),
  isActive: z.boolean().optional(),
  role: roleEnum.optional(),
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
