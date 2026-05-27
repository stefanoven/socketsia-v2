/**
 * Abbonamenti Sync Service
 * Syncs active subscriptions from the external GO! API.
 * Ported from SyncAbbo.php artisan command.
 */
import axios from 'axios';
import prisma from '../lib/prisma.js';

const GO_API_URL = process.env.GO_API_URL || 'https://go.surveye.it/api/abbonamenti';
const GO_API_TOKEN = process.env.GO_API_TOKEN || '';

/**
 * Sync active subscriptions from the external GO! system.
 * Truncates and repopulates the abboattivi table.
 */
export async function syncAbbonamenti(logger) {
  logger?.info('[SyncAbbo] Starting sync...');

  try {
    const response = await axios.get(GO_API_URL, {
      headers: {
        Authorization: `Bearer ${GO_API_TOKEN}`,
        Accept: 'application/json',
      },
      timeout: 30_000,
    });

    const data = response.data;
    if (!Array.isArray(data)) {
      logger?.warn('[SyncAbbo] Unexpected response format');
      return;
    }

    // Truncate and repopulate (same as legacy SyncAbbo.php)
    await prisma.abboAttivi.deleteMany({});

    const records = data
      .filter((item) => item.dd_coddest)
      .map((item) => ({
        destinazione: String(item.dd_coddest).trim(),
        // If scadenza is null in GO!, use far future date (2099-12-31)
        scadenza: item.nnc_datascan
          ? new Date(item.nnc_datascan)
          : new Date('2099-12-31'),
      }));

    if (records.length > 0) {
      await prisma.abboAttivi.createMany({ data: records, skipDuplicates: true });
    }

    logger?.info({ count: records.length }, '[SyncAbbo] Sync completed');
  } catch (err) {
    logger?.error({ err: err.message }, '[SyncAbbo] Sync failed');
  }
}
