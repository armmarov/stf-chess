import { z } from 'zod';

export const setFeeSchema = z.object({
  fee: z
    .number({ invalid_type_error: 'fee must be a number' })
    .positive('fee must be positive')
    .max(10000, 'fee must be ≤ 10000')
    .refine(
      (v) => Number((v * 100).toFixed(0)) === Math.round(v * 100),
      'fee must have at most 2 decimal places',
    ),
});

export type SetFeeInput = z.infer<typeof setFeeSchema>;
