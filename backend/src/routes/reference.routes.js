/**
 * Reference data routes (subscriptions, sia codes, keepalives)
 */
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    res.json(await prisma.subscription.findMany({ orderBy: { id: 'asc' } }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sia-codes
router.get('/sia-codes', async (req, res) => {
  try {
    res.json(await prisma.siaCode.findMany({ orderBy: { code: 'asc' } }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/keepalives
router.get('/keepalives', async (req, res) => {
  try {
    res.json(await prisma.keepAlive.findMany({ orderBy: { updatedAt: 'desc' } }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
