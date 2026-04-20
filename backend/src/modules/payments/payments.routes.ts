import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { upload, list, getOne, downloadReceipt, review, history, receiptPdf } from './payments.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', upload);
router.get('/', list);
router.get('/history', history);
router.get('/history/:entryId/receipt', receiptPdf);
router.get('/:id', getOne);
router.get('/:id/receipt', downloadReceipt);
router.patch('/:id/review', review);

export default router;
