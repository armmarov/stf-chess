import { z } from 'zod';

const isoDatetime = z.string().datetime({ offset: true, message: 'Invalid ISO datetime' });

export const createPollSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    startDate: isoDatetime,
    endDate: isoDatetime,
    options: z.preprocess(
      (v) => {
        if (typeof v !== 'string') return v;
        try { return JSON.parse(v); } catch { return null; }
      },
      z
        .array(z.object({ label: z.string().min(1).max(200) }))
        .min(2, 'At least 2 options required')
        .max(10, 'At most 10 options allowed'),
    ),
  })
  .refine((d) => new Date(d.endDate) > new Date(d.startDate), {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  });

export const updatePollSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().nullable().optional(),
    ),
    startDate: isoDatetime.optional(),
    endDate: isoDatetime.optional(),
  })
  .refine(
    (d) => {
      if (d.startDate && d.endDate) return new Date(d.endDate) > new Date(d.startDate);
      return true;
    },
    { message: 'endDate must be after startDate', path: ['endDate'] },
  );

export const voteSchema = z.object({
  optionId: z.string().uuid(),
});

export type CreatePollInput = z.infer<typeof createPollSchema>;
export type UpdatePollInput = z.infer<typeof updatePollSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
