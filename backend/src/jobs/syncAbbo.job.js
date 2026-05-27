/**
 * Sync Abbonamenti Job — runs daily at 14:45 Europe/Rome.
 * Syncs active subscriptions from external GO! API.
 */
import { syncAbbonamenti } from '../services/abboService.js';

let logger;

export function initSyncAbboJob(log) {
  logger = log;
}

export async function syncAbboJob() {
  logger?.info('[SyncAbbo] Starting scheduled sync');
  await syncAbbonamenti(logger);
}
