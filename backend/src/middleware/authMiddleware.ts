import { Request, Response, NextFunction } from 'express';
import { verifyToken, getUserById } from '../modules/auth/auth.service';

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token: string | undefined = req.cookies?.stf_token;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyToken(token);
    const user = await getUserById(payload.sub);

    if (!user) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
