/**
 * Customers Controller
 * Handles all customer CRUD and status operations.
 * Ported from CustomerController.php
 */
import prisma from '../lib/prisma.js';
import { enrichCustomers } from '../services/customerStatusService.js';

/**
 * Load all common reference data needed to enrich customers.
 */
async function loadReferenceData() {
  const [subscriptions, abboAttivi, keepAlives] = await Promise.all([
    prisma.subscription.findMany(),
    prisma.abboAttivi.findMany(),
    prisma.keepAlive.findMany(),
  ]);
  return { subscriptions, abboAttivi, keepAlives };
}

/**
 * GET /api/customers
 * List all customers (including frozen).
 */
export async function index(req, res) {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const ref = await loadReferenceData();
    const enriched = enrichCustomers(customers, ref.subscriptions, ref.abboAttivi, ref.keepAlives);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/customers/active
 * List unfrozen customers.
 */
export async function indexActive(req, res) {
  try {
    const customers = await prisma.customer.findMany({
      where: { freezedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const ref = await loadReferenceData();
    const enriched = enrichCustomers(customers, ref.subscriptions, ref.abboAttivi, ref.keepAlives);
    res.json(await resolveUserNames(enriched));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/customers/snoozed-events
 */
export async function indexSnoozedEvents(req, res) {
  try {
    const customers = await prisma.customer.findMany({
      where: { isAlarmsSnoozed: true },
      orderBy: { createdAt: 'desc' },
    });
    const ref = await loadReferenceData();
    res.json(enrichCustomers(customers, ref.subscriptions, ref.abboAttivi, ref.keepAlives));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/customers/snoozed-keepalive
 */
export async function indexSnoozedKeepalive(req, res) {
  try {
    const customers = await prisma.customer.findMany({
      where: { isAliveSnoozed: true },
      orderBy: { createdAt: 'desc' },
    });
    const ref = await loadReferenceData();
    res.json(enrichCustomers(customers, ref.subscriptions, ref.abboAttivi, ref.keepAlives));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/customers/freezed
 */
export async function indexFreezed(req, res) {
  try {
    const customers = await prisma.customer.findMany({
      where: { freezedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    const ref = await loadReferenceData();
    res.json(enrichCustomers(customers, ref.subscriptions, ref.abboAttivi, ref.keepAlives));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/customers/:id
 */
export async function show(req, res) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!customer) return res.status(404).json({ error: 'Cliente non trovato' });
    const ref = await loadReferenceData();
    const [enriched] = enrichCustomers([customer], ref.subscriptions, ref.abboAttivi, ref.keepAlives);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers
 * Create a new customer. Generates a unique 7-digit account number.
 * [manager only]
 */
export async function store(req, res) {
  try {
    const { customer, address, surveyeCode, subscription, subscriptionDate } = req.body;

    if (!customer || !surveyeCode) {
      return res.status(422).json({ error: 'Nome cliente e codice Surveye sono obbligatori' });
    }

    // Generate unique 7-digit account number (matching legacy logic)
    let account;
    let attempts = 0;
    do {
      const num = Math.floor(Math.random() * 9000000) + 1000000; // 1000000-9999999
      account = String(num).padStart(7, '0');
      const existing = await prisma.customer.findUnique({ where: { account } });
      if (!existing) break;
      attempts++;
    } while (attempts < 100);

    const newCustomer = await prisma.customer.create({
      data: {
        account,
        customer,
        address: address || '',
        surveyeCode,
        createdBy: req.user.id,
        subscription: parseInt(subscription) || 1,
        subscriptionDate: subscriptionDate ? new Date(subscriptionDate) : null,
      },
    });

    res.status(201).json(newCustomer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/customers/:id
 * [manager only]
 */
export async function destroy(req, res) {
  try {
    const id = parseInt(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ error: 'Cliente non trovato' });

    // Delete related records first
    await prisma.alarm.deleteMany({ where: { customerId: customer.account } });
    await prisma.siaMessage.deleteMany({ where: { customerId: customer.account } });
    await prisma.keepAlive.deleteMany({ where: { customerId: customer.account } });
    await prisma.customer.delete({ where: { id } });

    res.json({ message: 'Cliente eliminato' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers/:id/mute-events
 */
export async function muteEvents(req, res) {
  try {
    await prisma.customer.update({
      where: { id: parseInt(req.params.id) },
      data: { isAlarmsSnoozed: true, alarmsSnoozedBy: req.user.id },
    });
    res.json({ message: 'Allarmi silenziati' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers/:id/unmute-events
 */
export async function unmuteEvents(req, res) {
  try {
    await prisma.customer.update({
      where: { id: parseInt(req.params.id) },
      data: { isAlarmsSnoozed: false, alarmsSnoozedBy: null },
    });
    res.json({ message: 'Allarmi riattivati' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers/:id/mute-keepalive
 */
export async function muteKeepalive(req, res) {
  try {
    await prisma.customer.update({
      where: { id: parseInt(req.params.id) },
      data: { isAliveSnoozed: true, aliveSnoozedBy: req.user.id },
    });
    res.json({ message: 'Keep-alive silenziato' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers/:id/unmute-keepalive
 */
export async function unmuteKeepalive(req, res) {
  try {
    await prisma.customer.update({
      where: { id: parseInt(req.params.id) },
      data: { isAliveSnoozed: false, aliveSnoozedBy: null },
    });
    res.json({ message: 'Keep-alive riattivato' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers/:id/tested
 * Marks the customer as tested (collaudato) and upserts AbboAttivi
 * with scadenza = testedAt + 1 year (subscription ID 1 = default).
 */
export async function tested(req, res) {
  try {
    const id = parseInt(req.params.id);
    const testedAt = new Date();

    const customer = await prisma.customer.update({
      where: { id },
      data: { testedBy: req.user.id, testedByName: req.user.name, testedAt },
    });

    // Create / update the subscription expiry in AbboAttivi
    if (customer.surveyeCode) {
      const scadenza = new Date(testedAt.getTime() + 365 * 24 * 60 * 60 * 1000);
      await prisma.abboAttivi.upsert({
        where:  { destinazione: customer.surveyeCode },
        update: { scadenza },
        create: { destinazione: customer.surveyeCode, scadenza },
      });
    }

    res.json({ message: 'Collaudato' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers/:id/freeze
 */
export async function freeze(req, res) {
  try {
    await prisma.customer.update({
      where: { id: parseInt(req.params.id) },
      data: {
        freezedBy: req.user.id,
        freezedAt: new Date(),
        isAlarmsSnoozed: true,
        isAliveSnoozed: true,
      },
    });
    res.json({ message: 'Cliente congelato' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers/:id/unfreeze
 */
export async function unfreeze(req, res) {
  try {
    await prisma.customer.update({
      where: { id: parseInt(req.params.id) },
      data: {
        freezedBy: null,
        freezedAt: null,
        isAlarmsSnoozed: false,
        isAliveSnoozed: false,
      },
    });
    res.json({ message: 'Cliente scongelato' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
