import { Request, Response, NextFunction } from 'express';
import { setFeeSchema } from './config.validators';
import { getFee, setFee } from './config.service';
import { AppError } from '../../middleware/errorHandler';

export async function getFeeCfg(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const fee = await getFee();
    res.json({ fee });
  } catch (err) { next(err); }
}

export async function setFeeCfg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }
    const parsed = setFeeSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const fee = await setFee(parsed.data.fee, req.user!.id);
    res.json({ fee });
  } catch (err) { next(err); }
}
