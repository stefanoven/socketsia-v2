import { Router } from 'express';
import { requireManager } from '../middleware/authorize.js';
import { index, store, destroy } from '../controllers/users.controller.js';

const router = Router();
router.get('/', requireManager, index);
router.post('/', requireManager, store);
router.delete('/:id', requireManager, destroy);
export default router;
