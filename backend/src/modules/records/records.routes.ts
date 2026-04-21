import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { list, getOne, create, update, remove, downloadImage } from './records.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', remove);
router.get('/:id/image', downloadImage);

export default router;
