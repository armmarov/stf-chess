import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { getFeeCfg, setFeeCfg } from './config.controller';

const router = Router();

router.use(authMiddleware);
router.get('/fee', getFeeCfg);
router.put('/fee', setFeeCfg);

export default router;
