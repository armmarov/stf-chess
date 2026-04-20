import { Request, Response, NextFunction } from 'express';
import { preAttendanceSchema, markAttendanceSchema } from './attendance.validators';
import { togglePreAttendance, getAttendanceRoster, markAttendance } from './attendance.service';
import { AppError } from '../../middleware/errorHandler';

export async function togglePreAttend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = preAttendanceSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }

    const actor = req.user!;
    const { confirmed, studentId } = parsed.data;

    let targetStudentId: string;
    if (studentId !== undefined) {
      if (actor.role !== 'admin' && actor.role !== 'teacher') {
        next(new AppError(403, 'Only staff can set pre-attendance on behalf of others')); return;
      }
      targetStudentId = studentId;
    } else {
      if (actor.role !== 'student') {
        next(new AppError(400, 'studentId is required when acting on behalf')); return;
      }
      targetStudentId = actor.id;
    }

    const result = await togglePreAttendance(
      req.params.id,
      targetStudentId,
      confirmed,
      { id: actor.id, role: actor.role, name: actor.name },
    );
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
