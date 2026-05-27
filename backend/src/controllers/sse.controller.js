/**
 * Server-Sent Events (SSE) controller.
 * Streams real-time 'update' events to all connected dashboard clients
 * whenever a new alarm or keep-alive arrives.
 *
 * GET /api/events   (authenticated)
 */
import { eventBus } from '../lib/eventBus.js';

// Active SSE response objects — keyed by a simple incrementing ID
const clients = new Map();
let nextId = 1;

/**
 * Send a message to all connected SSE clients.
 */
function broadcast(event, data = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients.values()) {
    try { res.write(payload); } catch { /* ignore write errors */ }
  }
}

// Listen to the shared event bus
eventBus.on('new-alarm', (payload) => broadcast('alarm', payload));
eventBus.on('new-keepalive', (payload) => broadcast('keepalive', payload));

/**
 * Express route handler for SSE connections.
 */
export function sseHandler(req, res) {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const clientId = nextId++;
  clients.set(clientId, res);

  // Send initial "connected" ping so the client knows the stream is alive
  res.write(`event: ping\ndata: {"clientId":${clientId}}\n\n`);

  // Keep-alive heartbeat every 25 s (browsers close idle SSE connections)
  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch { clearInterval(heartbeat); }
  }, 25_000);

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
}

/** Number of currently connected SSE clients (for monitoring). */
export function sseClientCount() {
  return clients.size;
}
