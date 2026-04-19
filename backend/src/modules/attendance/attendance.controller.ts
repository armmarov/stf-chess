import { Request, Response, NextFunction } from 'express';
import { preAttendanceSchema, markAttendanceSchema } from './attendance.validators';
import { togglePreAttendance, getAttendanceRoster, markAttendance } from './attendance.service';

export async function togglePreAttend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = preAttendanceSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const result = await togglePreAttendance(req.params.id, req.user!.id, parsed.data.confirmed);
    res.json({ preAttendance: result });
  } catch (err) { next(err); }
}

export async function getRoster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getAttendanceRoster(req.params.id);
    res.json(data);
  } catch (err) { next(err); }
}

export async function markAttend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = markAttendanceSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const result = await markAttendance(req.params.id, parsed.data, req.user!.id);
    res.json(result);
  } catch (err) { next(err); }
}
