import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { roleGuard } from '../../middleware/roleGuard';
import { list, getOne, create, update } from './sessions.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', list);
router.get('/:id', getOne);
router.post('/', roleGuard(['admin', 'teacher']), create);
router.patch('/:id', roleGuard(['admin', 'teacher']), update);

export default router;
