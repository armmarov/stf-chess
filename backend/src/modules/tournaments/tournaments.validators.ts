import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format');

export const createTournamentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  registrationLink: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url('Invalid URL').optional(),
  ),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  place: z.string().min(1).max(200).optional(),
});

export const updateTournamentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  registrationLink: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().url('Invalid URL').nullable().optional(),
  ),
  startDate: z.preprocess(
    (v) => (v === '' ? null : v),
    dateString.nullable().optional(),
  ),
  endDate: z.preprocess(
    (v) => (v === '' ? null : v),
    dateString.nullable().optional(),
  ),
  removeImage: z.string().optional(),
  place: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().min(1).max(200).nullable().optional(),
  ),
});

export const interestSchema = z.object({
  interested: z.boolean(),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type InterestInput = z.infer<typeof interestSchema>;
