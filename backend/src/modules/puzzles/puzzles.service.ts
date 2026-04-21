import { Chess } from 'chess.js';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { AttemptInput } from './puzzles.validators';

// Lichess puzzle convention:
//   - FEN is the position BEFORE the opponent's setup move
//   - Moves[0] is that setup move (computer plays it)
//   - Moves[1..] is the player's actual solution
// We present a "playable" FEN (after setup applied) and the trimmed solution.
function toPlayable(rawFen: string, rawSolution: string): { fen: string; moves: string[] } {
  const all = rawSolution.split(' ').filter(Boolean);
  if (all.length < 2) return { fen: rawFen, moves: all };
  const setup = all[0];
  try {
    const chess = new Chess(rawFen);
    chess.move({
      from: setup.slice(0, 2),
      to: setup.slice(2, 4),
      promotion: (setup[4] as 'q' | 'r' | 'b' | 'n' | undefined) ?? undefined,
    });
    return { fen: chess.fen(), moves: all.slice(1) };
  } catch {
    return { fen: rawFen, moves: all };
  }
}

// In-memory cache: date string → puzzle IDs (5 per day)
const dailyCache = new Map<string, string[]>();

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getTodayPuzzleIds(): Promise<string[]> {
  const today = todayUtc();

  if (dailyCache.has(today)) return dailyCache.get(today)!;

  // Clear stale cache entries
  dailyCache.clear();

  const totalPuzzles = await prisma.puzzle.count();
  if (totalPuzzles === 0) throw new AppError(404, 'No puzzles available');

  const hash = [...today].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
  const startIndex = hash % totalPuzzles;

  const first = await prisma.puzzle.findMany({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    skip: startIndex,
    take: 5,
  });

  let ids = first.map((p) => p.id);

  if (ids.length < 5) {
    const wrap = await prisma.puzzle.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 5 - ids.length,
    });
    ids = [...ids, ...wrap.map((p) => p.id)];
  }

  dailyCache.set(today, ids);
  return ids;
}

const PUZZLE_PUBLIC_SELECT = {
  id: true,
  externalId: true,
  fen: true,
  solutionUci: true, // used internally to compute playable FEN + solution length; stripped before response
  rating: true,
  themes: true,
  gameUrl: true,
} as const;

type PuzzlePublicRow = {
  id: string;
  externalId: string;
  fen: string;
  solutionUci: string;
  rating: number;
  themes: string | null;
  gameUrl: string | null;
};

export async function getTodayPuzzles(userId: string) {
  const today = todayUtc();
  const ids = await getTodayPuzzleIds();

  const rows = await prisma.puzzle.findMany({
    where: { id: { in: ids } },
    select: PUZZLE_PUBLIC_SELECT,
    orderBy: { rating: 'asc' },
  });

  const todayDate = new Date(today + 'T00:00:00Z');
  const attempts = await prisma.puzzleAttempt.findMany({
    where: { userId, puzzleId: { in: ids }, attemptedOn: todayDate },
    select: { puzzleId: true, status: true, timeMs: true },
  });

  const attemptsMap = new Map<string, { solved: boolean; count: number; bestTimeMs: number | null }>();
  for (const a of attempts) {
    const cur = attemptsMap.get(a.puzzleId) ?? { solved: false, count: 0, bestTimeMs: null };
    cur.count++;
    if (a.status === 'solved') {
      cur.solved = true;
      cur.bestTimeMs = cur.bestTimeMs === null ? a.timeMs : Math.min(cur.bestTimeMs, a.timeMs);
    }
    attemptsMap.set(a.puzzleId, cur);
  }

  const puzzles = (rows as PuzzlePublicRow[]).map(({ solutionUci, themes, fen, ...rest }) => {
    const myAttempts = attemptsMap.get(rest.id) ?? { solved: false, count: 0, bestTimeMs: null };
    const { fen: playableFen, moves } = toPlayable(fen, solutionUci);
    return {
      ...rest,
      fen: playableFen,
      themes: themes ? themes.split(/\s+/).filter(Boolean) : [],
      solutionLength: moves.length,
      myAttempts: { solved: myAttempts.solved, attempts: myAttempts.count, bestTimeMs: myAttempts.bestTimeMs },
    };
  });

  return { date: today, puzzles };
}

export async function checkMove(puzzleId: string, ply: number, uci: string) {
  const puzzle = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    select: { fen: true, solutionUci: true },
  });
  if (!puzzle) throw new AppError(404, 'Puzzle not found');

  const { moves } = toPlayable(puzzle.fen, puzzle.solutionUci);
  if (ply >= moves.length) throw new AppError(400, 'Ply out of range');

  if (uci !== moves[ply]) {
    return { correct: false as const, expected: moves[ply] };
  }

  if (ply + 1 >= moves.length) {
    return { correct: true as const, solved: true as const };
  }

  return { correct: true as const, replyUci: moves[ply + 1] };
}

export async function recordAttempt(puzzleId: string, userId: string, data: AttemptInput) {
  const puzzle = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    select: { id: true, fen: true, solutionUci: true },
  });
  if (!puzzle) throw new AppError(404, 'Puzzle not found');

  const today = todayUtc();
  const todayDate = new Date(today + 'T00:00:00Z');

  const priorCount = await prisma.puzzleAttempt.count({
    where: { userId, puzzleId, attemptedOn: todayDate },
  });

  const attempt = await prisma.puzzleAttempt.create({
    data: {
      puzzleId,
      userId,
      status: data.status,
      movesTaken: data.movesTaken,
      timeMs: data.timeMs,
      isFirstTry: priorCount === 0,
      attemptedOn: todayDate,
    },
    select: { id: true, status: true, isFirstTry: true, movesTaken: true, timeMs: true, attemptedOn: true },
  });

  if (data.status === 'gave_up') {
    const { moves } = toPlayable(puzzle.fen, puzzle.solutionUci);
    return { ...attempt, solutionUci: moves.join(' ') };
  }

  return attempt;
}

export async function getMyStats(userId: string) {
  const today = todayUtc();
  const todayDate = new Date(today + 'T00:00:00Z');

  const [totalSolved, solvedDayRows, todayIds] = await Promise.all([
    prisma.puzzleAttempt.count({ where: { userId, status: 'solved' } }),
    prisma.puzzleAttempt.findMany({
      where: { userId, status: 'solved' },
      select: { attemptedOn: true },
      distinct: ['attemptedOn'],
      orderBy: { attemptedOn: 'asc' },
    }),
    getTodayPuzzleIds().catch(() => [] as string[]),
  ]);

  const solvedDateSet = new Set(solvedDayRows.map((r) => r.attemptedOn.toISOString().slice(0, 10)));

  // Current streak: consecutive days going back from today
  let currentStreak = 0;
  let checkDate = today;
  while (solvedDateSet.has(checkDate)) {
    currentStreak++;
    checkDate = addDays(checkDate, -1);
  }

  // Longest streak: scan sorted dates
  let longestStreak = 0;
  let streak = 0;
  let prevDate: string | null = null;
  for (const row of solvedDayRows) {
    const dateStr = row.attemptedOn.toISOString().slice(0, 10);
    if (prevDate && addDays(prevDate, 1) === dateStr) {
      streak++;
    } else {
      streak = 1;
    }
    if (streak > longestStreak) longestStreak = streak;
    prevDate = dateStr;
  }

  // todayProgress
  let todaySolved = 0;
  if (todayIds.length > 0) {
    todaySolved = await prisma.puzzleAttempt.count({
      where: { userId, status: 'solved', puzzleId: { in: todayIds }, attemptedOn: todayDate },
    });
  }

  // last7Days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, -(6 - i));
    return { date, solved: solvedDateSet.has(date) };
  });

  return {
    totalSolved,
    currentStreak,
    longestStreak,
    todayProgress: { solved: todaySolved, total: 5 },
    last7Days,
  };
}
