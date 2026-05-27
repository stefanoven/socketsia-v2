/**
 * SocketSia v2 — Main Entry Point
 *
 * Starts:
 *   1. PostgreSQL connection via Prisma
 *   2. SIA TCP server on port 23683
 *   3. Express HTTP server on port 3000
 *   4. Scheduled cron jobs
 *
 * All subsystems share the same Node.js process and Prisma client.
 */
import 'dotenv/config';
import pino from 'pino';
import cron from 'node-cron';

import prisma from './lib/prisma.js';
import { initOidcClient } from './lib/oidcClient.js';
import { createApp } from './server.js';
import { startTcpServer } from './tcp/tcpServer.js';
import { validateCrcTestVector } from './tcp/siaParser.js';

import { initPushService } from './services/pushService.js';
import { initCheckAlarmsJob, checkAlarmsJob } from './jobs/checkAlarms.job.js';
import { initCheckAliveJob, checkAliveJob } from './jobs/checkAlive.job.js';
import { initSyncAbboJob, syncAbboJob } from './jobs/syncAbbo.job.js';

// Logger
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

async function main() {
  logger.info('🚀 SocketSia v2 starting...');

  // 1. Validate SIA CRC test vector (critical — must pass before accepting connections)
  if (!validateCrcTestVector()) {
    logger.error('SIA CRC validation failed! Check siaParser.js. Exiting.');
    process.exit(1);
  }

  // 2. Connect to PostgreSQL
  try {
    await prisma.$connect();
    logger.info('[DB] PostgreSQL connected (socketsia_v2)');
  } catch (err) {
    logger.error({ err: err.message }, '[DB] Failed to connect to PostgreSQL');
    process.exit(1);
  }

  // 3. Initialize OIDC client (non-fatal — auth works in fallback mode)
  await initOidcClient();

  // 4. Initialise push notification service (non-fatal if VAPID keys missing)
  initPushService(logger);

  // 5. Start TCP server for SIA protocol
  const tcpPort = parseInt(process.env.TCP_PORT || '23683');
  startTcpServer(tcpPort, logger);

  // 5. Initialize and register cron jobs
  initCheckAlarmsJob(logger);
  initCheckAliveJob(logger);
  initSyncAbboJob(logger);

  // Check alarms every minute
  cron.schedule('* * * * *', checkAlarmsJob);

  // Check alive every 5 minutes
  cron.schedule('*/5 * * * *', checkAliveJob);

  // Sync abbonamenti every 30 minutes
  cron.schedule('*/30 * * * *', syncAbboJob);

  logger.info('[Cron] Scheduled: checkAlarms(1min), checkAlive(5min), syncAbbo(ogni 30min)');

  // Sync immediately at startup (non-blocking — don't delay HTTP server startup)
  syncAbboJob().catch((err) => logger.warn({ err: err.message }, '[SyncAbbo] Startup sync failed'));

  // 6. Start Express HTTP server
  const app = createApp();
  const httpPort = parseInt(process.env.PORT || '3000');

  app.listen(httpPort, () => {
    logger.info({ port: httpPort }, `[HTTP] Express server listening`);
    logger.info('✅ SocketSia v2 ready!');
    logger.info(`   API:  http://localhost:${httpPort}/api`);
    logger.info(`   TCP:  0.0.0.0:${tcpPort} (SIA DC09)`);
    logger.info(`   Health: http://localhost:${httpPort}/api/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
