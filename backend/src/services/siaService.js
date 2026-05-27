/**
 * SIA Service — persists SIA protocol events to the database.
 * Called by tcpServer.js after receiving and ACKing a message.
 */
import prisma from '../lib/prisma.js';
import { parseAlarmCodeAndDetail } from '../tcp/siaParser.js';

/**
 * Store a raw SIA message log entry.
 * @param {string} account - Customer account number
 * @param {string} messageType - 'SIA-Alarm' | 'Keep-Alive'
 * @param {string} rawMessage - Raw SIA message string
 * @param {boolean} acked - Whether ACK was sent
 */
export async function storeSiaMessage(account, messageType, rawMessage, acked = false) {
  // Find customer by account (don't fail if not found — log anyway)
  const customer = await prisma.customer.findUnique({ where: { account } });
  if (!customer) {
    console.warn(`[SIA] Unknown account: ${account} — storing message without customer link`);
    return;
  }

  await prisma.siaMessage.create({
    data: {
      customerId: account,
      messageType,
      siaRawMessage: rawMessage,
      acked,
    },
  });
}

/**
 * Store a Keep-Alive message.
 * Updates the customer's is_alive flag and the keep_alive record (upsert).
 *
 * @param {string} account - Customer account number
 * @param {string} rawMessage - Raw SIA message
 */
export async function storeKeepAlive(account, rawMessage) {
  const customer = await prisma.customer.findUnique({ where: { account } });
  if (!customer) {
    console.warn(`[SIA] Keep-Alive from unknown account: ${account}`);
    return { wasOffline: false };
  }

  // Capture previous online state BEFORE updating (used to trigger push notification)
  const wasOffline = !customer.isAlive;

  // Upsert the keep_alive record (one per customer — tracks last seen time)
  await prisma.keepAlive.upsert({
    where: { customerId: account },
    create: {
      customerId: account,
      siaRawMessage: rawMessage,
    },
    update: {
      siaRawMessage: rawMessage,
      updatedAt: new Date(),
    },
  });

  // Mark customer as alive
  await prisma.customer.update({
    where: { account },
    data: { isAlive: true },
  });

  // Increment statistics
  await incrementStatistic('keepAlives');

  return { wasOffline };
}

/**
 * Store a SIA-Alarm message.
 * Parses the code and detail, creates an alarm record.
 * Sets is_alive=true for the customer.
 * Fires email notification (via checkAlarms job).
 *
 * @param {string} account - Customer account number
 * @param {string} rawMessage - Full raw SIA message
 * @param {string} payload - Parsed SIA payload (after CCCC+LLLL)
 */
export async function storeAlarm(account, rawMessage, payload) {
  const customer = await prisma.customer.findUnique({ where: { account } });
  if (!customer) {
    console.warn(`[SIA] Alarm from unknown account: ${account}`);
    return;
  }

  // Parse event code and detail from payload
  const { code, detail } = parseAlarmCodeAndDetail(payload);

  // Create alarm record (mail_sent=false — checkAlarms job will send email)
  const alarm = await prisma.alarm.create({
    data: {
      customerId: account,
      code,
      detail,
      siaRawMessage: rawMessage,
      mailSent: false,
      managedBy: null,
    },
  });

  // Mark customer as alive (receiving alarms means the device is connected)
  await prisma.customer.update({
    where: { account },
    data: { isAlive: true },
  });

  // Increment statistics
  await incrementStatistic('alarms');

  return alarm;
}

/**
 * Increment a statistic counter.
 * Creates the statistics row if it doesn't exist.
 * @param {'keepAlives'|'alarms'} field
 */
async function incrementStatistic(field) {
  const existing = await prisma.statistic.findFirst();
  if (existing) {
    await prisma.statistic.update({
      where: { id: existing.id },
      data: { [field]: { increment: 1 } },
    });
  } else {
    const data = { keepAlives: BigInt(0), alarms: BigInt(0) };
    data[field] = BigInt(1);
    await prisma.statistic.create({ data });
  }
}
