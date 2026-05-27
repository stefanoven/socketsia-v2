import { Router } from 'express';
import { requireManager } from '../middleware/authorize.js';
import {
  index,
  indexActive,
  indexSnoozedEvents,
  indexSnoozedKeepalive,
  indexFreezed,
  show,
  store,
  destroy,
  muteEvents,
  unmuteEvents,
  muteKeepalive,
  unmuteKeepalive,
  tested,
  freeze,
  unfreeze,
} from '../controllers/customers.controller.js';

const router = Router();

// List views
router.get('/', index);
router.get('/active', indexActive);
router.get('/snoozed-events', indexSnoozedEvents);
router.get('/snoozed-keepalive', indexSnoozedKeepalive);
router.get('/freezed', indexFreezed);

// Single customer
router.get('/:id', show);

// Create / delete (manager only)
router.post('/', requireManager, store);
router.delete('/:id', requireManager, destroy);

// Status actions
router.post('/:id/mute-events', muteEvents);
router.post('/:id/unmute-events', unmuteEvents);
router.post('/:id/mute-keepalive', muteKeepalive);
router.post('/:id/unmute-keepalive', unmuteKeepalive);
router.post('/:id/tested', tested);
router.post('/:id/freeze', freeze);
router.post('/:id/unfreeze', unfreeze);

export default router;
