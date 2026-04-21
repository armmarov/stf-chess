import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { getToday, postCheckMove, postAttempt, myStats } from './puzzles.controller';

const router = Router();
router.use(authMiddleware);

router.get('/today', getToday);
router.get('/me/stats', myStats);
router.post('/:id/check-move', postCheckMove);
router.post('/:id/attempt', postAttempt);

export default router;
