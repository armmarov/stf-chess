import { z } from 'zod';

const competitionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime());
  }, 'Invalid date');

export const createRecordSchema = z.object({
  studentId: z.string().min(1),
  competitionName: z.string().min(1).max(200),
  competitionDate: competitionDateSchema,
  level: z.enum(['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa']),
  category: z.enum(['u13', 'u14', 'u15', 'u16', 'u17', 'u18', 'u21', 'open']),
  pajsk: z.boolean(),
  fideRated: z.boolean(),
  mcfRated: z.boolean(),
  placement: z.number().int().min(1).max(30).nullable(),
});

export const updateRecordSchema = z
  .object({
    competitionName: z.string().min(1).max(200),
    competitionDate: competitionDateSchema,
    level: z.enum(['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa']),
    category: z.enum(['u13', 'u14', 'u15', 'u16', 'u17', 'u18', 'u21', 'open']),
    pajsk: z.boolean(),
    fideRated: z.boolean(),
    mcfRated: z.boolean(),
    placement: z.number().int().min(1).max(30).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
