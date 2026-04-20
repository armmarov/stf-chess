import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { list, getUnreadCount, markOneRead, markAll } from './notifications.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', list);
router.get('/unread-count', getUnreadCount);
router.post('/read-all', markAll);
router.post('/:id/read', markOneRead);

export default router;
