import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional();

export const createGameSchema = z.object({
  tournamentName: z.string().min(1).max(200),
  whitePlayer: z.string().min(1).max(120),
  blackPlayer: z.string().min(1).max(120),
  result: z.enum(['white_win', 'black_win', 'draw']),
  pgn: z.string().min(1),
  eventDate: isoDate,
  whiteElo: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(4000).optional(),
  ),
  blackElo: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(4000).optional(),
  ),
  opening: z.string().max(120).optional(),
  notes: z.string().max(10_000).optional(),
});

export const updateGameSchema = createGameSchema.partial();

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
