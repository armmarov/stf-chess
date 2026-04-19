import jwt from 'jsonwebtoken';
import type { AuthUser } from '../../src/types';

export function signToken(user: AuthUser, options: jwt.SignOptions = {}): string {
  return jwt.sign(
    { id: user.id, name: user.name, username: user.username, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h', ...options },
  );
}

export function signExpiredToken(user: AuthUser): string {
  return signToken(user, { expiresIn: '-1s' });
}
