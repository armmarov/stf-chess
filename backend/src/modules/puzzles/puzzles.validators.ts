import { z } from 'zod';

export const attemptSchema = z.object({
  status: z.enum(['solved', 'failed', 'gave_up']),
  movesTaken: z.number().int().min(0),
  timeMs: z.number().int().min(0),
});

export const checkMoveSchema = z.object({
  ply: z.number().int().min(0),
  uci: z.string().min(4).max(5),
});

export type AttemptInput = z.infer<typeof attemptSchema>;
export type CheckMoveInput = z.infer<typeof checkMoveSchema>;
