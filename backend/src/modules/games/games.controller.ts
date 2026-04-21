import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { createGameSchema, updateGameSchema } from './games.validators';
import { listGames, getGame, createGame, updateGame, deleteGame } from './games.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournamentName = typeof req.query.tournamentName === 'string' ? req.query.tournamentName : undefined;
    const player = typeof req.query.player === 'string' ? req.query.player : undefined;
    const games = await listGames(tournamentName, player);
    res.json({ games });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await getGame(req.params.id);
    res.json({ game });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }
    const parsed = createGameSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const game = await createGame(parsed.data, req.user!.id);
    res.status(201).json({ game });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }
    const parsed = updateGameSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const game = await updateGame(req.params.id, parsed.data);
    res.json({ game });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }
    await deleteGame(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
}
