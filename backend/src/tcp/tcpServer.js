/**
 * SIA IP DC09 TCP Server
 * Listens on port 23683 (default) for incoming connections from alarm panels.
 * Ported from ServerTCP.php (php artisan serversia:serve) using ReactPHP.
 *
 * Message flow:
 *  1. Panel connects and sends SIA message
 *  2. Parse and validate CRC
 *  3. Send ACK response immediately
 *  4. Store message in DB via siaService
 */

import net from 'net';
import { parseSiaMessage, buildAck } from './siaParser.js';
import { storeAlarm, storeKeepAlive, storeSiaMessage } from '../services/siaService.js';
import { eventBus } from '../lib/eventBus.js';

let logger;

/**
 * Start the TCP server on the given port.
 * @param {number} port - TCP port (default 23683)
 * @param {object} log - pino logger instance
 */
export function startTcpServer(port = 23683, log) {
  logger = log;

  const server = net.createServer((socket) => {
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    logger.info({ addr: remoteAddr }, '[TCP] New connection');

    // Buffer to accumulate incoming data (messages may arrive in chunks)
    let buffer = Buffer.alloc(0);

    socket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Process complete messages (start=0x0A, end=0x0D)
      let startIdx = buffer.indexOf(0x0a);
      while (startIdx !== -1) {
        const endIdx = buffer.indexOf(0x0d, startIdx + 1);
        if (endIdx === -1) break; // Incomplete message, wait for more data

        const rawMessage = buffer.slice(startIdx, endIdx + 1);
        buffer = buffer.slice(endIdx + 1); // Remove processed message from buffer
        startIdx = buffer.indexOf(0x0a);

        await handleMessage(socket, rawMessage, remoteAddr);
      }
    });

    socket.on('error', (err) => {
      logger.error({ addr: remoteAddr, err: err.message }, '[TCP] Socket error');
    });

    socket.on('close', () => {
      logger.info({ addr: remoteAddr }, '[TCP] Connection closed');
    });

    // Set a generous timeout (some panels hold connections open for a long time)
    socket.setTimeout(300_000); // 5 minutes
    socket.on('timeout', () => {
      logger.info({ addr: remoteAddr }, '[TCP] Connection timeout, closing');
      socket.destroy();
    });
  });

  server.on('error', (err) => {
    logger.error({ err: err.message }, '[TCP] Server error');
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info({ port }, '[TCP] SIA server listening');
  });

  return server;
}

/**
 * Handle a single complete SIA message.
 */
async function handleMessage(socket, rawBuffer, remoteAddr) {
  logger.debug({ addr: remoteAddr, raw: rawBuffer.toString('hex') }, '[TCP] Raw message received');

  const parsed = parseSiaMessage(rawBuffer);

  if (!parsed) {
    logger.warn({ addr: remoteAddr }, '[TCP] Could not parse message (too short or bad framing)');
    return;
  }

  if (!parsed.valid) {
    logger.warn({ addr: remoteAddr, error: parsed.error }, '[TCP] Invalid SIA message');
    // Still attempt to save it for debugging
    return;
  }

  const { messageType, account, siaPayload, rawMessage } = parsed;

  logger.info(
    { addr: remoteAddr, account, messageType },
    '[TCP] SIA message received'
  );

  // 1. Send ACK immediately (before DB operations, as the device may timeout)
  try {
    const ack = buildAck(siaPayload, messageType);
    socket.write(ack);
    logger.debug({ addr: remoteAddr, account }, '[TCP] ACK sent');
  } catch (err) {
    logger.error({ err: err.message, addr: remoteAddr }, '[TCP] Failed to send ACK');
  }

  // 2. Store raw message log
  try {
    await storeSiaMessage(account, messageType, rawMessage, true);
  } catch (err) {
    logger.error({ err: err.message, account }, '[TCP] Failed to store SIA message');
  }

  // 3. Route to appropriate handler and emit real-time events
  try {
    if (messageType === 'Keep-Alive') {
      const { wasOffline } = await storeKeepAlive(account, rawMessage) ?? {};
      eventBus.emit('new-keepalive', { customerId: account, wasOffline: !!wasOffline });
    } else if (messageType === 'SIA-Alarm') {
      const stored = await storeAlarm(account, rawMessage, siaPayload);
      eventBus.emit('new-alarm', { customerId: account, code: stored?.code ?? null });
    }
  } catch (err) {
    logger.error({ err: err.message, account, messageType }, '[TCP] Failed to store event');
  }
}
