/**
 * Express Application Factory
 * Assembles all middleware and routes.
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import { authenticate } from './middleware/authenticate.js';

import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customers.routes.js';
import alarmRoutes from './routes/alarms.routes.js';
import siaMessageRoutes from './routes/siamessages.routes.js';
import statsRoutes from './routes/stats.routes.js';
import userRoutes from './routes/users.routes.js';
import referenceRoutes from './routes/reference.routes.js';
import pushRoutes from './routes/push.routes.js';
import { sseHandler } from './controllers/sse.controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // --- Middleware ---
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  // Note: express-session removed — OIDC PKCE state is stored in a short-lived
  // httpOnly cookie by auth.controller.js, which survives backend restarts.

  // Health check (no auth required — must be BEFORE the /api catch-all)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // SSE real-time event stream (authenticated)
  app.get('/api/events', authenticate, sseHandler);

  // --- API Routes ---
  app.use('/api/auth', authRoutes);
  app.use('/api/stats', authenticate, statsRoutes);
  app.use('/api/customers', authenticate, customerRoutes);
  app.use('/api/alarms', authenticate, alarmRoutes);
  app.use('/api/sia-messages', authenticate, siaMessageRoutes);
  app.use('/api/users', authenticate, userRoutes);
  app.use('/api/push', authenticate, pushRoutes);
  app.use('/api', authenticate, referenceRoutes);

  // --- Serve Frontend SPA ---
  // Serve the built frontend whenever dist/ exists (both dev and production).
  // In pure development the Vite dev server (port 5173) is preferred;
  // this fallback lets you run the full app from a single `npm start`.
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  return app;
}
