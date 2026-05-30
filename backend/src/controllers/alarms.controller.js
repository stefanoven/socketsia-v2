/**
 * Alarms Controller
 * Handles alarm listing, filtering, and management.
 * Ported from AlarmController.php
 */
import prisma from '../lib/prisma.js';
import { computeCustomerStatus, loadStatusReferenceData } from '../services/customerStatusService.js';

const PAGE_SIZE = 100;

/**
 * Build enriched alarm response with customer and SIA code info.
 */
async function enrichAlarms(alarms) {
  if (alarms.length === 0) return [];

  // Fetch all needed customers and sia codes in batch
  const accountIds = [...new Set(alarms.map((a) => a.customerId))];
  const codes = [...new Set(alarms.map((a) => a.code?.substring(0, 2)).filter(Boolean))];
  const managerIds = [...new Set(alarms.map((a) => a.managedBy).filter(Boolean))];

  const [customers, siaCodes, managers, [abboAttivi, subscriptions]] = await Promise.all([
    prisma.customer.findMany({ where: { account: { in: accountIds } } }),
    codes.length ? prisma.siaCode.findMany({ where: { code: { in: codes } } }) : [],
    managerIds.length ? prisma.user.findMany({ where: { id: { in: managerIds } } }) : [],
    loadStatusReferenceData(),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.account, c]));
  const siaCodeMap = Object.fromEntries(siaCodes.map((s) => [s.code, s]));
  const managerMap = Object.fromEntries(managers.map((u) => [u.id, u]));
  const subMap = Object.fromEntries(subscriptions.map((s) => [s.id, s]));

  function isInterrotto(customer) {
    if (!customer) return false;
    const sub = subMap[customer.subscription] ?? { daysDuration: 365 };
    const { stato } = computeCustomerStatus(customer, sub, abboAttivi);
    return stato === 'Interrotto';
  }

  return alarms.map((alarm) => {
    const customer = customerMap[alarm.customerId] ?? null;
    return {
      ...alarm,
      customer: customer ? { ...customer, isInterrotto: isInterrotto(customer) } : null,
      siaCode: alarm.code ? siaCodeMap[alarm.code.substring(0, 2)] ?? null : null,
      managedByUser: alarm.managedBy ? managerMap[alarm.managedBy] ?? null : null,
    };
  });
}

/**
 * GET /api/alarms
 * List all alarms, optionally filtered by year.
 */
export async function index(req, res) {
  try {
    const { year, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * PAGE_SIZE;

    const where = {};
    if (year) {
      const y = parseInt(year);
      where.createdAt = {
        gte: new Date(`${y}-01-01T00:00:00Z`),
        lt: new Date(`${y + 1}-01-01T00:00:00Z`),
      };
    }

    const [alarms, total] = await Promise.all([
      prisma.alarm.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.alarm.count({ where }),
    ]);

    const enriched = await enrichAlarms(alarms);
    res.json({ data: enriched, total, page: parseInt(page), pageSize: PAGE_SIZE });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/alarms/unmanaged
 * List alarms waiting to be managed (managed_by IS NULL).
 */
export async function indexUnmanaged(req, res) {
  try {
    const alarms = await prisma.alarm.findMany({
      where: { managedBy: null },
      orderBy: { createdAt: 'desc' },
    });
    const enriched = await enrichAlarms(alarms);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/alarms/customer/:customerId
 * List alarms for a specific customer (by account string).
 */
export async function indexByCustomer(req, res) {
  try {
    const { customerId } = req.params;
    const alarms = await prisma.alarm.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    const enriched = await enrichAlarms(alarms);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/alarms/:id/manage
 * Mark a single alarm as managed by the current user.
 */
export async function manage(req, res) {
  try {
    const alarm = await prisma.alarm.update({
      where: { id: parseInt(req.params.id) },
      data: { managedBy: req.user.id },
    });
    res.json(alarm);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/alarms/manage-all
 * Mark ALL unmanaged alarms (across all customers) as managed by the current user.
 */
export async function manageAllGlobal(req, res) {
  try {
    const result = await prisma.alarm.updateMany({
      where: { managedBy: null },
      data: { managedBy: req.user.id },
    });
    res.json({ managed: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/alarms/customer/:customerId/manage-all
 * Mark all unmanaged alarms for a customer as managed by the current user.
 */
export async function manageAll(req, res) {
  try {
    const { customerId } = req.params;
    const result = await prisma.alarm.updateMany({
      where: { customerId, managedBy: null },
      data: { managedBy: req.user.id },
    });
    res.json({ managed: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/alarms/manage-many
 * Mark specific alarms (by ID array) as managed by the current user.
 * Used by "Gestisci tutti" to operate only on currently visible/filtered alarms.
 */
export async function manageMany(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    const result = await prisma.alarm.updateMany({
      where: { id: { in: ids.map(Number) }, managedBy: null },
      data: { managedBy: req.user.id },
    });
    res.json({ managed: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
