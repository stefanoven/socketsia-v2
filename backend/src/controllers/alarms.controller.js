/**
 * Alarms Controller
 * Handles alarm listing, filtering, and management.
 * Ported from AlarmController.php
 */
import prisma from '../lib/prisma.js';

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

  const [customers, siaCodes, managers] = await Promise.all([
    prisma.customer.findMany({ where: { account: { in: accountIds } } }),
    codes.length ? prisma.siaCode.findMany({ where: { code: { in: codes } } }) : [],
    managerIds.length ? prisma.user.findMany({ where: { id: { in: managerIds } } }) : [],
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.account, c]));
  const siaCodeMap = Object.fromEntries(siaCodes.map((s) => [s.code, s]));
  const managerMap = Object.fromEntries(managers.map((u) => [u.id, u]));

  return alarms.map((alarm) => ({
    ...alarm,
    customer: customerMap[alarm.customerId] ?? null,
    siaCode: alarm.code ? siaCodeMap[alarm.code.substring(0, 2)] ?? null : null,
    managedByUser: alarm.managedBy ? managerMap[alarm.managedBy] ?? null : null,
  }));
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
