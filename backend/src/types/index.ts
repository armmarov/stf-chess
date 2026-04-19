export type Role = 'admin' | 'teacher' | 'coach' | 'student';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
