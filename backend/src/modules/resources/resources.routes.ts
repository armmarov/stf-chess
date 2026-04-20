import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { list, getOne, create, update, remove, downloadImage, downloadFile } from './resources.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', list);
router.post('/', create);
router.get('/:id/image', downloadImage);
router.get('/:id/file', downloadFile);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', remove);

export default router;
