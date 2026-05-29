/**
 * Check Alive Job — runs every 5 minutes.
 * Monitors customer connectivity: marks is_alive=false if no keep-alive
 * has been received in the last 1 hour, then emits 'panel-offline'
 * so the push service can notify subscribers.
 */
import prisma from '../lib/prisma.js';
import { sendKeepAliveEmail } from '../services/emailService.js';
import { eventBus } from '../lib/eventBus.js';

/** Threshold: panel is considered offline after this many ms without a keepalive */
const OFFLINE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

let logger;
let isRunning = false;

export function initCheckAliveJob(log) {
  logger = log;
}

export async function checkAliveJob() {
  if (isRunning) {
    logger?.debug('[CheckAlive] Already running, skipping');
    return;
  }
  isRunning = true;

  try {
    // Find customers currently marked alive and NOT snoozed / frozen
    const customers = await prisma.customer.findMany({
      where: {
        isAlive: true,
        isAliveSnoozed: false,
        freezedAt: null,
      },
    });

    const now = Date.now();

    for (const customer of customers) {
      try {
        const keepAlive = await prisma.keepAlive.findUnique({
          where: { customerId: customer.account },
        });

        const lastSeen = keepAlive?.updatedAt ?? null;
        const elapsed  = lastSeen ? now - lastSeen.getTime() : Infinity;

        if (elapsed > OFFLINE_THRESHOLD_MS) {
          logger?.info(
            { account: customer.account, lastSeen, elapsed: Math.round(elapsed / 60000) + 'min' },
            '[CheckAlive] Customer went offline',
          );

          // Mark as offline
          await prisma.customer.update({
            where: { account: customer.account },
            data: { isAlive: false },
          });

          // Emit push event (consumed by pushService)
          eventBus.emit('panel-offline', { customerId: customer.account });

          // Send notification email (existing behavior)
          await sendKeepAliveEmail(customer, lastSeen);
        }
      } catch (err) {
        logger?.error(
          { err: err.message, account: customer.account },
          '[CheckAlive] Failed to process customer',
        );
      }
    }
  } catch (err) {
    logger?.error({ err: err.message }, '[CheckAlive] Job failed');
  } finally {
    isRunning = false;
  }
}
