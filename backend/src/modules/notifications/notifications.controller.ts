import { Request, Response, NextFunction } from 'express';
import { listNotificationsQuerySchema } from './notifications.validators';
import { listForUser, unreadCount, markRead, markAllRead } from './notifications.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listNotificationsQuerySchema.safeParse(req.query);
    if (!parsed.success) { next(parsed.error); return; }
    const { limit, unread } = parsed.data;
    const notifications = await listForUser(req.user!.id, { limit, unreadOnly: unread ?? false });
    res.json({ notifications });
  } catch (err) { next(err); }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = await unreadCount(req.user!.id);
    res.json({ count });
  } catch (err) { next(err); }
}

export async function markOneRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await markRead(req.user!.id, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function markAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await markAllRead(req.user!.id);
    res.status(204).end();
  } catch (err) { next(err); }
}
