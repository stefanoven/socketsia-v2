import { Router } from 'express';
import { requireManager } from '../middleware/authorize.js';
import { index, destroyAll } from '../controllers/siamessages.controller.js';

const router = Router();
router.get('/', index);
router.delete('/', requireManager, destroyAll);
export default router;
