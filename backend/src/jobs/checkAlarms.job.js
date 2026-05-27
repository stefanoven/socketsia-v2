/**
 * Check Alarms Job — runs every 1 minute.
 * Finds alarms where mail_sent=false and sends email notifications.
 * Ported from CheckAlarms.php artisan command.
 */
import prisma from '../lib/prisma.js';
import { sendAlarmEmail } from '../services/emailService.js';

let logger;
let isRunning = false;

export function initCheckAlarmsJob(log) {
  logger = log;
}

export async function checkAlarmsJob() {
  if (isRunning) {
    logger?.debug('[CheckAlarms] Already running, skipping');
    return;
  }
  isRunning = true;

  try {
    // Find all alarms where email not yet sent
    const alarms = await prisma.alarm.findMany({
      where: { mailSent: false },
      orderBy: { createdAt: 'asc' },
    });

    if (alarms.length === 0) {
      isRunning = false;
      return;
    }

    logger?.info({ count: alarms.length }, '[CheckAlarms] Processing unnotified alarms');

    for (const alarm of alarms) {
      try {
        // Get customer
        const customer = await prisma.customer.findUnique({
          where: { account: alarm.customerId },
        });

        // Skip if customer has alarms snoozed (is_alarms_snoozed=true)
        if (customer?.isAlarmsSnoozed) {
          // Still mark as sent to avoid re-processing
          await prisma.alarm.update({
            where: { id: alarm.id },
            data: { mailSent: true },
          });
          continue;
        }

        // Get SIA code description
        const siaCode = alarm.code
          ? await prisma.siaCode.findFirst({
              where: { code: alarm.code.substring(0, 2) },
            })
          : null;

        // Send email
        await sendAlarmEmail(alarm, customer, siaCode);

        // Mark as sent
        await prisma.alarm.update({
          where: { id: alarm.id },
          data: { mailSent: true },
        });

        logger?.info({ alarmId: alarm.id, account: alarm.customerId }, '[CheckAlarms] Email sent');
      } catch (err) {
        logger?.error({ err: err.message, alarmId: alarm.id }, '[CheckAlarms] Failed to process alarm');
      }
    }
  } catch (err) {
    logger?.error({ err: err.message }, '[CheckAlarms] Job failed');
  } finally {
    isRunning = false;
  }
}
