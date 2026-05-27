import prisma from '../lib/prisma.js';

/**
 * GET /api/users [manager only]
 */
export async function index(req, res) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, type: true, createdAt: true },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/users [manager only]
 * Create a new user (who can then log in via Authentik SSO).
 */
export async function store(req, res) {
  try {
    const { name, email, type } = req.body;
    if (!name || !email) {
      return res.status(422).json({ error: 'Nome ed email sono obbligatori' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(422).json({ error: 'Email già registrata' });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        type: type === 'manager' ? 'manager' : 'viewer',
      },
      select: { id: true, name: true, email: true, type: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/users/:id [manager only]
 */
export async function destroy(req, res) {
  try {
    await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Utente eliminato' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
