import { Request, Response, NextFunction } from 'express';
import { attemptSchema, checkMoveSchema } from './puzzles.validators';
import { getTodayPuzzles, checkMove, recordAttempt, getMyStats } from './puzzles.service';

export async function getToday(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getTodayPuzzles(req.user!.id);
    res.json(data);
  } catch (err) { next(err); }
}

export async function postCheckMove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = checkMoveSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const result = await checkMove(req.params.id, parsed.data.ply, parsed.data.uci);
    res.json(result);
  } catch (err) { next(err); }
}

export async function postAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = attemptSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const attempt = await recordAttempt(req.params.id, req.user!.id, parsed.data);
    res.status(201).json({ attempt });
  } catch (err) { next(err); }
}

export async function myStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getMyStats(req.user!.id);
    res.json(stats);
  } catch (err) { next(err); }
}
