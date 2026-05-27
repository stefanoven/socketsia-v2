import { Router } from 'express';
import { redirect, callback, me, logout } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/authentik/redirect', redirect);
router.get('/authentik/callback', callback);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);

export default router;
