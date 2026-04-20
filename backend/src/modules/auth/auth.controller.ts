import { Request, Response, NextFunction } from 'express';
import { loginSchema, changePasswordSchema } from './auth.validators';
import { loginUser, changePassword } from './auth.service';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';

const COOKIE_NAME = 'stf_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const { username, password } = parsed.data;
    const { user, token } = await loginUser(username, password);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE_MS,
    });

    res.json({ user });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode === 401) {
      next(new AppError(401, 'Invalid credentials'));
    } else if (e.statusCode === 403) {
      next(new AppError(403, 'Account is deactivated'));
    } else {
      next(err);
    }
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.status(204).end();
}

export function me(req: Request, res: Response): void {
  res.json({ user: req.user });
}

export async function changePasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }

    await changePassword(req.user!.id, parsed.data.currentPassword, parsed.data.newPassword);
    res.status(204).end();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode === 401) {
      next(new AppError(401, 'Current password is incorrect'));
    } else if (e.statusCode === 400) {
      next(new AppError(400, 'New password must be different from current'));
    } else {
      next(err);
    }
  }
}
