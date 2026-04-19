import { z } from 'zod';

const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

export const createSessionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    startTime: z.string().regex(timeRegex, 'startTime must be HH:MM or HH:MM:SS'),
    endTime: z.string().regex(timeRegex, 'endTime must be HH:MM or HH:MM:SS'),
    place: z.string().min(1).max(255),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (d) => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      return new Date(d.date) >= today;
    },
    { message: 'date must be today or in the future', path: ['date'] },
  )
  .refine((d) => d.startTime < d.endTime, {
    message: 'startTime must be before endTime',
    path: ['startTime'],
  });

export const updateSessionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
    startTime: z.string().regex(timeRegex).optional(),
    endTime: z.string().regex(timeRegex).optional(),
    place: z.string().min(1).max(255).optional(),
    notes: z.string().max(1000).nullable().optional(),
    isCancelled: z.boolean().optional(),
  })
  .refine(
    (d) => {
      if (d.date === undefined) return true;
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      return new Date(d.date) >= today;
    },
    { message: 'date must be today or in the future', path: ['date'] },
  )
  .refine(
    (d) => {
      if (d.startTime === undefined || d.endTime === undefined) return true;
      return d.startTime < d.endTime;
    },
    { message: 'startTime must be before endTime', path: ['startTime'] },
  );

export const listSessionsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeCancelled: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
