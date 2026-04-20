import { Router } from 'express';
import { login, logout, me, changePasswordHandler } from './auth.controller';
import { authMiddleware } from '../../middleware/authMiddleware';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);
router.post('/change-password', authMiddleware, changePasswordHandler);

export default router;
