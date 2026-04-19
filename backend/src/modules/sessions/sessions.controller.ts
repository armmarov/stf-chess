import { Request, Response, NextFunction } from 'express';
import {
  createSessionSchema,
  updateSessionSchema,
  listSessionsQuerySchema,
} from './sessions.validators';
import {
  listSessions,
  getSession,
  createSession,
  updateSession,
} from './sessions.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listSessionsQuerySchema.safeParse(req.query);
    if (!parsed.success) { next(parsed.error); return; }
    const studentId = req.user?.role === 'student' ? req.user.id : undefined;
    const sessions = await listSessions(parsed.data, studentId);
    res.json({ sessions });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.role === 'student' ? req.user.id : undefined;
    const session = await getSession(req.params.id, studentId);
    res.json({ session });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const session = await createSession(parsed.data, req.user!.id);
    res.status(201).json({ session });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateSessionSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const session = await updateSession(
      req.params.id,
      parsed.data,
      req.user!.id,
      req.user!.role,
    );
    res.json({ session });
  } catch (err) { next(err); }
}
