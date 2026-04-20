import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  setPasswordSchema,
} from './users.validators';
import { listUsers, getUser, createUser, updateUser, setPassword } from './users.service';
import { Role } from '../../types';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.user!.role;
    if (role !== 'admin' && role !== 'teacher') {
      next(new AppError(403, 'Forbidden')); return;
    }
    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) { next(parsed.error); return; }
    const users = await listUsers(parsed.data, role as Role);
    res.json({ users });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const requester = req.user!;
    const isSelf = requester.id === id;

    if (!isSelf) {
      if (requester.role === 'admin') {
        // allowed
      } else if (requester.role === 'teacher') {
        // must be a student
        const target = await getUser(id);
        if (target.role !== 'student') { next(new AppError(403, 'Forbidden')); return; }
        res.json({ user: target }); return;
      } else {
        next(new AppError(403, 'Forbidden')); return;
      }
    }

    const user = await getUser(id);
    res.json({ user });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requesterRole = req.user!.role;
    if (requesterRole !== 'admin' && requesterRole !== 'teacher') {
      next(new AppError(403, 'Forbidden')); return;
    }

    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }

    if (requesterRole === 'teacher' && parsed.data.role !== 'student') {
      next(new AppError(403, 'Teachers can only create student accounts')); return;
    }

    const user = await createUser(parsed.data);
    res.status(201).json({ user });
  } catch (err) { next(err); }
}

export async function patch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const requester = req.user!;

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }

    const isSelf = requester.id === id;
    const data = parsed.data;

    if (requester.role === 'admin') {
      // admin: any field including username
    } else if (requester.role === 'teacher') {
      if (data.username !== undefined) {
        next(new AppError(403, 'Only admin can change username')); return;
      }
      if (isSelf) {
        // teacher updating self — treat as self update rules
        if (data.isActive !== undefined || data.role !== undefined) {
          next(new AppError(403, 'You can only update your own name, phone, and className')); return;
        }
      } else {
        // teacher updating a student: name, phone, isActive allowed
        const target = await getUser(id);
        if (target.role !== 'student') { next(new AppError(403, 'Forbidden')); return; }
        const disallowedKeys = Object.keys(data).filter(
          (k) => !['name', 'phone', 'isActive', 'className'].includes(k),
        );
        if (disallowedKeys.length > 0) {
          next(new AppError(403, "Teachers can only update students' name, phone, or isActive")); return;
        }
      }
    } else if (isSelf) {
      // self: name, phone, className
      if (data.username !== undefined) {
        next(new AppError(403, 'Only admin can change username')); return;
      }
      if (data.isActive !== undefined || data.role !== undefined) {
        next(new AppError(403, 'You can only update your own name, phone, and className')); return;
      }
    } else {
      next(new AppError(403, 'Forbidden')); return;
    }

    const user = await updateUser(id, data);
    res.json({ user });
  } catch (err) { next(err); }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (req.user!.role !== 'admin') {
      next(new AppError(403, 'Forbidden')); return;
    }
    const parsed = setPasswordSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    await setPassword(req.params.id, parsed.data.newPassword);
    res.status(204).end();
  } catch (err) { next(err); }
}
