/**
 * Push Notification Controller
 * Manages browser push subscriptions (Web Push / VAPID).
 */
import prisma from '../lib/prisma.js';
import { getVapidPublicKey, isPushReady } from '../services/pushService.js';

/**
 * GET /api/push/vapid-key
 * Returns the VAPID public key needed by the browser to subscribe.
 */
export async function getVapidKey(req, res) {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: key });
}

/**
 * POST /api/push/subscribe
 * Saves a new push subscription (or updates if endpoint already exists).
 * Body: { endpoint, keys: { p256dh, auth } }
 */
export async function subscribe(req, res) {
  if (!isPushReady()) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }

  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(422).json({ error: 'Invalid subscription object' });
  }

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { keys, userId: req.user?.id ?? null },
      create: { endpoint, keys, userId: req.user?.id ?? null },
    });
    res.status(201).json({ message: 'Subscribed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/push/subscribe
 * Removes a push subscription.
 * Body: { endpoint }
 */
export async function unsubscribe(req, res) {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(422).json({ error: 'endpoint required' });

  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
