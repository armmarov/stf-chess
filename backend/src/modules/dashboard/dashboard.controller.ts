import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { getStats } from './dashboard.service';

export async function stats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getStats(req.user!);
    if (result === null) { next(new AppError(403, 'Forbidden')); return; }
    res.json({ stats: result });
  } catch (err) { next(err); }
}
