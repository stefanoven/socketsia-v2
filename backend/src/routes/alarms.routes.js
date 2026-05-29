import { Router } from 'express';
import { index, indexUnmanaged, indexByCustomer, manage, manageAll, manageAllGlobal, manageMany } from '../controllers/alarms.controller.js';

const router = Router();

router.get('/', index);
router.get('/unmanaged', indexUnmanaged);
router.get('/customer/:customerId', indexByCustomer);
router.post('/manage-all', manageAllGlobal);
router.post('/manage-many', manageMany);
router.post('/customer/:customerId/manage-all', manageAll);
router.post('/:id/manage', manage);

export default router;
