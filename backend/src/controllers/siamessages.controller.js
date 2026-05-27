import prisma from '../lib/prisma.js';

/**
 * GET /api/sia-messages
 */
export async function index(req, res) {
  try {
    const { page = 1 } = req.query;
    const PAGE_SIZE = 100;
    const skip = (parseInt(page) - 1) * PAGE_SIZE;

    const [messages, total] = await Promise.all([
      prisma.siaMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.siaMessage.count(),
    ]);

    res.json({ data: messages, total, page: parseInt(page), pageSize: PAGE_SIZE });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/sia-messages
 * Deletes ALL sia messages (manager only).
 */
export async function destroyAll(req, res) {
  try {
    const { count } = await prisma.siaMessage.deleteMany({});
    res.json({ message: `${count} messaggi eliminati` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
