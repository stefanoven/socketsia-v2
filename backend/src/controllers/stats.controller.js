/**
 * Stats Controller
 * Returns dashboard statistics — replicates the home.blade.php data.
 */
import prisma from '../lib/prisma.js';

/**
 * GET /api/stats
 * Returns all dashboard statistics in one request.
 */
export async function getStats(req, res) {
  try {
    const now = new Date();

    // Parallel queries for all stats
    const [
      totalCustomers,
      testedCustomers,
      snoozedEvents,
      snoozedKeepalive,
      freezedCount,
      totalAlarms,
      totalKeepalives,
      unmanagedAlarms,
      onlineCount,
      neverSeenCount,
      lastAlarms,
      lastKeepalives,
      statistic,
      managedByStats,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { testedAt: { not: null } } }),
      prisma.customer.count({ where: { isAlarmsSnoozed: true } }),
      prisma.customer.count({ where: { isAliveSnoozed: true } }),
      prisma.customer.count({ where: { freezedAt: { not: null } } }),
      prisma.alarm.count(),
      prisma.keepAlive.count(),
      prisma.alarm.count({ where: { managedBy: null } }),
      prisma.customer.count({ where: { isAlive: true } }),
      // Never seen = no keepalive record at all
      prisma.customer.count({
        where: {
          keepAlive: null,
          freezedAt: null,
        },
      }),
      // Last 10 alarms (real-time list) — exclude snoozed/frozen customers
      prisma.alarm.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: {
          customer: {
            isAlarmsSnoozed: false,
            freezedAt: null,
          },
        },
        include: { customer: true },
      }),
      // Last 10 keepalives (real-time list)
      prisma.keepAlive.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: { customer: true },
      }),
      prisma.statistic.findFirst(),
      // Count alarms managed per user
      prisma.alarm.groupBy({
        by: ['managedBy'],
        where: { managedBy: { not: null } },
        _count: { id: true },
      }),
    ]);

    const offlineCount = totalCustomers - onlineCount - freezedCount;

    // Calculate average alarm management time (in minutes)
    const avgResult = await prisma.$queryRaw`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60)::float as avg_minutes
      FROM alarms
      WHERE managed_by IS NOT NULL
    `;
    const avgManageMinutes = avgResult?.[0]?.avg_minutes ?? null;

    // Bulk fetch SIA code descriptions for the last 10 alarms
    const uniqueCodes = [...new Set(
      lastAlarms.map((a) => a.code?.substring(0, 2)).filter(Boolean)
    )];
    const siaCodes = uniqueCodes.length
      ? await prisma.siaCode.findMany({ where: { code: { in: uniqueCodes } } })
      : [];
    const siaCodeMap = Object.fromEntries(siaCodes.map((s) => [s.code, s]));

    // Get user names for managed-by stats
    const userIds = managedByStats.map((m) => m.managedBy).filter(Boolean);
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } } })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const managedByList = managedByStats.map((m) => ({
      userId: m.managedBy,
      userName: userMap[m.managedBy] ?? 'Unknown',
      count: m._count.id,
    }));

    res.json({
      customers: {
        total: totalCustomers,
        tested: testedCustomers,
        snoozedEvents,
        snoozedKeepalive,
        freezed: freezedCount,
      },
      connectivity: {
        online: onlineCount,
        offline: Math.max(0, offlineCount),
        neverSeen: neverSeenCount,
        onlinePercent: totalCustomers > 0 ? Math.round((onlineCount / totalCustomers) * 100) : 0,
      },
      alarms: {
        total: totalAlarms,
        unmanaged: unmanagedAlarms,
        totalKeepalives,
        avgManageMinutes: avgManageMinutes ? Math.round(avgManageMinutes) : null,
        managedByUser: managedByList,
      },
      lastEvents: {
        lastAlarms: lastAlarms.map((a) => ({
          id: a.id,
          customerId: a.customerId,
          code: a.code,
          detail: a.detail,
          createdAt: a.createdAt,
          managedBy: a.managedBy,
          siaCode: a.code ? (siaCodeMap[a.code.substring(0, 2)] ?? null) : null,
          customer: a.customer
            ? { customer: a.customer.customer, surveyeCode: a.customer.surveyeCode }
            : null,
        })),
        lastKeepalives: lastKeepalives.map((k) => ({
          customerId: k.customerId,
          updatedAt: k.updatedAt,
          customer: k.customer
            ? { customer: k.customer.customer, surveyeCode: k.customer.surveyeCode }
            : null,
        })),
      },
      statistics: {
        keepAlives: statistic?.keepAlives ? Number(statistic.keepAlives) : 0,
        alarms: statistic?.alarms ? Number(statistic.alarms) : 0,
      },
      serverTime: now.toISOString(),
    });
  } catch (err) {
    console.error('[Stats] Error:', err);
    res.status(500).json({ error: err.message });
  }
}
