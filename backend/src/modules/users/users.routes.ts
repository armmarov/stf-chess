import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { list, getOne, create, patch, changePassword } from './users.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.patch('/:id', patch);
router.post('/:id/password', changePassword);

export default router;
