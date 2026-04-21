import { prisma } from './db';

let _seq = 0;

interface PuzzleOverrides {
  externalId?: string;
  fen?: string;
  solutionUci?: string;
  rating?: number;
  themes?: string | null;
  gameUrl?: string | null;
  createdAt?: Date;
}

export async function createPuzzle(overrides: PuzzleOverrides = {}) {
  _seq++;
  return prisma.puzzle.create({
    data: {
      externalId: overrides.externalId ?? `ext-${_seq}-${Date.now()}`,
      fen: overrides.fen ?? 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      // Default: 3-ply solution (e5, Nf3, Nc6)
      solutionUci: overrides.solutionUci ?? 'e7e5 g1f3 b8c6',
      rating: overrides.rating ?? 1200,
      themes: overrides.themes !== undefined ? overrides.themes : 'opening tactics',
      gameUrl: overrides.gameUrl !== undefined ? overrides.gameUrl : null,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

/** Creates exactly 5 puzzles (minimum needed for daily pick). */
export async function createFivePuzzles() {
  const puzzles = [];
  for (let i = 0; i < 5; i++) {
    puzzles.push(await createPuzzle({ rating: 1000 + i * 100 }));
  }
  return puzzles;
}

export async function recordAttemptRow(
  puzzleId: string,
  userId: string,
  opts: {
    status?: 'solved' | 'failed' | 'gave_up';
    movesTaken?: number;
    timeMs?: number;
    isFirstTry?: boolean;
    attemptedOn?: Date;
  } = {},
) {
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  return prisma.puzzleAttempt.create({
    data: {
      puzzleId,
      userId,
      status: opts.status ?? 'solved',
      movesTaken: opts.movesTaken ?? 3,
      timeMs: opts.timeMs ?? 5000,
      isFirstTry: opts.isFirstTry ?? true,
      attemptedOn: opts.attemptedOn ?? today,
    },
  });
}
