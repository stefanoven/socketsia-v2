import { Router } from 'express';
import { index, indexUnmanaged, indexByCustomer, manage, manageAll } from '../controllers/alarms.controller.js';

const router = Router();

router.get('/', index);
router.get('/unmanaged', indexUnmanaged);
router.get('/customer/:customerId', indexByCustomer);
router.post('/:id/manage', manage);
router.post('/customer/:customerId/manage-all', manageAll);

export default router;
