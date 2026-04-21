import { prisma } from './db';

const VALID_PGN =
  '[Event "Test"]\n[Site "?"]\n[Date "2024.01.01"]\n[Round "1"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0';

export { VALID_PGN };

interface GameOverrides {
  tournamentName?: string;
  whitePlayer?: string;
  blackPlayer?: string;
  result?: 'white_win' | 'black_win' | 'draw';
  pgn?: string;
  eventDate?: Date | null;
  whiteElo?: number | null;
  blackElo?: number | null;
  opening?: string | null;
  notes?: string | null;
}

export async function createGameRecord(createdById: string, overrides: GameOverrides = {}) {
  return prisma.game.create({
    data: {
      tournamentName: overrides.tournamentName ?? 'Test Tournament',
      whitePlayer: overrides.whitePlayer ?? 'Alice',
      blackPlayer: overrides.blackPlayer ?? 'Bob',
      result: overrides.result ?? 'white_win',
      pgn: overrides.pgn ?? VALID_PGN,
      eventDate: overrides.eventDate !== undefined ? overrides.eventDate : null,
      whiteElo: overrides.whiteElo !== undefined ? overrides.whiteElo : null,
      blackElo: overrides.blackElo !== undefined ? overrides.blackElo : null,
      opening: overrides.opening !== undefined ? overrides.opening : null,
      notes: overrides.notes !== undefined ? overrides.notes : null,
      createdById,
    },
  });
}
