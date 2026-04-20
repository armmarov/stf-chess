import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { list, getOne, create, update, remove, downloadOptionImage, vote } from './polls.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', list);
router.post('/', create);
router.get('/:id/options/:optionId/image', downloadOptionImage);
router.post('/:id/vote', vote);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', remove);

export default router;
