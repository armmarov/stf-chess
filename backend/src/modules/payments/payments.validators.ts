import { z } from 'zod';

export const uploadPaymentSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
});

export const reviewPaymentSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
});

export const listPaymentsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  studentId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});

export type UploadPaymentInput = z.infer<typeof uploadPaymentSchema>;
export type ReviewPaymentInput = z.infer<typeof reviewPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
