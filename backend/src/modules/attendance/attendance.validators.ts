import { z } from 'zod';

export const preAttendanceSchema = z.object({
  confirmed: z.boolean(),
});

export const markAttendanceSchema = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        present: z.boolean(),
        paidCash: z.boolean(),
      }),
    )
    .min(1, 'entries must not be empty'),
});

export type PreAttendanceInput = z.infer<typeof preAttendanceSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
