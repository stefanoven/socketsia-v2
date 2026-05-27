/**
 * Shared EventEmitter for internal real-time events.
 * Events emitted by the TCP server / jobs and consumed by SSE / push service.
 *
 * Events:
 *   'new-alarm'     { customerId, code }          — new SIA alarm received
 *   'new-keepalive' { customerId, wasOffline }     — keepalive received
 *   'panel-offline' { customerId }                 — panel exceeded offline threshold (5 min)
 */
import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();
// Allow many listeners (SSE connections + push + future consumers)
eventBus.setMaxListeners(200);
