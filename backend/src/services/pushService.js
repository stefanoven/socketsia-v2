/**
 * Web Push notification service.
 * Initialises web-push with VAPID keys from .env and listens for events
 * on the shared eventBus to notify all subscribed browsers.
 *
 * Events handled:
 *   'new-alarm'    → always notify (🔴 + SIA description)
 *   'new-keepalive'→ notify only when panel was previously offline (✅ tornato online)
 *   'panel-offline'→ notify when checkAlive marks a panel as offline (⚠️ offline)
 */
import webpush from 'web-push';
import prisma from '../lib/prisma.js';
import { eventBus } from '../lib/eventBus.js';

let ready = false;
let _logger = null;

/** ─── Helpers ─────────────────────────────────────────── */

/**
 * Build the notification body text for a customer.
 * Format: "[SurveyeCode] Nome Cliente — Indirizzo"
 */
async function customerBody(customerId) {
  try {
    const c = await prisma.customer.findUnique({
      where: { account: customerId },
      select: { customer: true, address: true, surveyeCode: true },
    });
    if (!c) return `Account ${customerId}`;
    const parts = [c.customer || customerId];
    if (c.address) parts.push(c.address);
    const text = parts.join(' — ');
    return c.surveyeCode ? `[${c.surveyeCode}] ${text}` : text;
  } catch {
    return `Account ${customerId}`;
  }
}

/**
 * Build the alarm notification title using the SIA code description.
 * Falls back to the raw code if the description is not found.
 */
async function alarmTitle(code) {
  if (!code) return '🔴 Nuovo allarme';
  const twoLetter = code.substring(0, 2).toUpperCase();
  try {
    const sc = await prisma.siaCode.findUnique({ where: { code: twoLetter } });
    return sc ? `🔴 ${sc.description}` : `🔴 Allarme ${twoLetter}`;
  } catch {
    return `🔴 Allarme ${code}`;
  }
}

/**
 * Send a push notification to ALL subscribed browsers.
 * Removes stale (expired) subscriptions automatically.
 */
async function sendToAll({ title, body, url, icon }) {
  const subscriptions = await prisma.pushSubscription.findMany();
  if (!subscriptions.length) return 0;

  const message = JSON.stringify({ title, body, url, icon });
  const stale = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          message,
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          stale.push(sub.endpoint);
        } else {
          _logger?.error(
            { statusCode: err.statusCode, err: err.message },
            '[Push] sendNotification failed',
          );
        }
      }
    }),
  );

  if (stale.length) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
    _logger?.info({ count: stale.length }, '[Push] Removed stale subscriptions');
  }

  return subscriptions.length - stale.length;
}

/** ─── Initialise ─────────────────────────────────────── */

/**
 * Call once at startup (from main.js) to initialise VAPID and start listening.
 */
export function initPushService(logger) {
  _logger = logger;

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger?.warn('[Push] VAPID keys not configured — push notifications disabled.');
    return;
  }

  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:admin@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
  ready = true;
  logger?.info('[Push] Web Push service ready');

  // ── 1. Alarm notification ──────────────────────────────
  // Always fired when a new alarm arrives from any panel.
  eventBus.on('new-alarm', async (payload) => {
    if (!ready) return;
    try {
      const [title, body] = await Promise.all([
        alarmTitle(payload.code),
        customerBody(payload.customerId),
      ]);
      const sent = await sendToAll({
        title,
        body,
        url: '/alarms?filter=unmanaged',
        icon: '/icons/notif-alarm.svg',
      });
      logger?.info({ sent, code: payload.code, customerId: payload.customerId }, '[Push] Alarm sent');
    } catch (err) {
      logger?.error({ err: err.message }, '[Push] Error in alarm push handler');
    }
  });

  // ── 2. Panel came back online ──────────────────────────
  // Fired only when a keepalive arrives for a panel that was marked offline.
  eventBus.on('new-keepalive', async (payload) => {
    if (!ready || !payload.wasOffline) return;
    try {
      const body = await customerBody(payload.customerId);
      const sent = await sendToAll({
        title: '✅ Pannello tornato online',
        body,
        url: '/customers',
        icon: '/icons/notif-online.svg',
      });
      logger?.info({ sent, customerId: payload.customerId }, '[Push] Online notification sent');
    } catch (err) {
      logger?.error({ err: err.message }, '[Push] Error in online push handler');
    }
  });

  // ── 3. Panel went offline ──────────────────────────────
  // Fired by checkAlive.job.js when a panel exceeds the offline threshold.
  eventBus.on('panel-offline', async (payload) => {
    if (!ready) return;
    try {
      const body = await customerBody(payload.customerId);
      const sent = await sendToAll({
        title: '⚠️ Pannello offline',
        body,
        url: '/customers',
        icon: '/icons/notif-offline.svg',
      });
      logger?.info({ sent, customerId: payload.customerId }, '[Push] Offline notification sent');
    } catch (err) {
      logger?.error({ err: err.message }, '[Push] Error in offline push handler');
    }
  });
}

/** Returns whether the push service is ready. */
export function isPushReady() { return ready; }

/** Returns the public VAPID key (safe to expose to frontend). */
export function getVapidPublicKey() { return process.env.VAPID_PUBLIC_KEY || null; }
