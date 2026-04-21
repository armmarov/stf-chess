import { Chess } from 'chess.js';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateGameInput, UpdateGameInput } from './games.validators';

function validatePgn(pgn: string): { ok: true; moveCount: number } | { ok: false; reason: string } {
  try {
    const c = new Chess();
    c.loadPgn(pgn, { strict: false });
    if (c.history().length === 0) return { ok: false, reason: 'PGN contains no moves' };
    return { ok: true, moveCount: c.history().length };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Invalid PGN' };
  }
}

const GAME_LIST_SELECT = {
  id: true,
  tournamentName: true,
  whitePlayer: true,
  blackPlayer: true,
  result: true,
  eventDate: true,
  whiteElo: true,
  blackElo: true,
  opening: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

const GAME_DETAIL_SELECT = {
  ...GAME_LIST_SELECT,
  pgn: true,
  notes: true,
  updatedAt: true,
} as const;

export async function listGames(tournamentName?: string, player?: string) {
  const where: Record<string, unknown> = {};

  if (tournamentName) {
    where.tournamentName = { contains: tournamentName, mode: 'insensitive' };
  }

  if (player) {
    where.OR = [
      { whitePlayer: { contains: player, mode: 'insensitive' } },
      { blackPlayer: { contains: player, mode: 'insensitive' } },
    ];
  }

  return prisma.game.findMany({
    where,
    select: GAME_LIST_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getGame(id: string) {
  const game = await prisma.game.findUnique({ where: { id }, select: GAME_DETAIL_SELECT });
  if (!game) throw new AppError(404, 'Game not found');
  return game;
}

export async function createGame(data: CreateGameInput, createdById: string) {
  const validation = validatePgn(data.pgn);
  if (!validation.ok) throw new AppError(400, `Invalid PGN: ${validation.reason}`);

  return prisma.game.create({
    data: {
      tournamentName: data.tournamentName,
      whitePlayer: data.whitePlayer,
      blackPlayer: data.blackPlayer,
      result: data.result,
      pgn: data.pgn,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      whiteElo: data.whiteElo ?? null,
      blackElo: data.blackElo ?? null,
      opening: data.opening ?? null,
      notes: data.notes ?? null,
      createdById,
    },
    select: GAME_DETAIL_SELECT,
  });
}

export async function updateGame(id: string, data: UpdateGameInput) {
  const existing = await prisma.game.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Game not found');

  if (data.pgn !== undefined) {
    const validation = validatePgn(data.pgn);
    if (!validation.ok) throw new AppError(400, `Invalid PGN: ${validation.reason}`);
  }

  const updateData: Record<string, unknown> = {};
  if (data.tournamentName !== undefined) updateData.tournamentName = data.tournamentName;
  if (data.whitePlayer !== undefined) updateData.whitePlayer = data.whitePlayer;
  if (data.blackPlayer !== undefined) updateData.blackPlayer = data.blackPlayer;
  if (data.result !== undefined) updateData.result = data.result;
  if (data.pgn !== undefined) updateData.pgn = data.pgn;
  if (data.eventDate !== undefined) updateData.eventDate = data.eventDate ? new Date(data.eventDate) : null;
  if (data.whiteElo !== undefined) updateData.whiteElo = data.whiteElo;
  if (data.blackElo !== undefined) updateData.blackElo = data.blackElo;
  if (data.opening !== undefined) updateData.opening = data.opening;
  if (data.notes !== undefined) updateData.notes = data.notes;

  return prisma.game.update({ where: { id }, data: updateData, select: GAME_DETAIL_SELECT });
}

export async function deleteGame(id: string) {
  const existing = await prisma.game.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Game not found');
  await prisma.game.delete({ where: { id } });
}
