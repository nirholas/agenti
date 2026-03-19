import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { facilitatorRouter } from './routes/facilitator.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { toNodeHandler } from 'better-auth/node';
import { getAuth } from './auth/index.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { notificationsRouter } from './routes/notifications.js';
import { statsRouter } from './routes/stats.js';
import { discoveryRouter } from './routes/discovery.js';
import { internalWebhooksRouter } from './routes/internal-webhooks.js';
import { rewardsRouter } from './routes/rewards.js';
import { resolveFacilitator } from './middleware/tenant.js';

/**
 * Get allowed CORS origins from environment or defaults
 */
function getCorsOrigins(): string[] {
  const dashboardUrl = process.env.DASHBOARD_URL;
  
  // Default origins for development
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:5001',
  ];

  // Production origins
  const productionOrigins = [
    'https://openfacilitator.io',
    'https://www.openfacilitator.io',
    'https://dashboard.openfacilitator.io',
    'https://openfacilitator-dashboard.vercel.app',
    'https://api.openfacilitator.io',
  ];

  // Add custom dashboard URL if set
  if (dashboardUrl) {
    return [...defaultOrigins, ...productionOrigins, dashboardUrl];
  }

  return [...defaultOrigins, ...productionOrigins];
}

/**
 * Create the Express server with all middleware and routes
 */
export function createServer(): Express {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    })
  );
  app.use(
    cors({
      origin: getCorsOrigins(),
      credentials: true,
    })
  );
  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth routes (handled by Better Auth)
  // Mount directly to preserve full URL path for Better Auth
  app.all('/api/auth/*', (req, res) => {
    const auth = getAuth();
    return toNodeHandler(auth)(req, res);
  });

  // Admin API routes (for dashboard)
  app.use('/api/admin', adminRouter);

  // Rewards API routes (for rewards program)
  app.use('/api/rewards', rewardsRouter);

  // Subscription routes (for Memeputer agent integration)
  app.use('/api/subscriptions', subscriptionsRouter);

  // Notifications routes (user notifications for payment events, warnings, etc.)
  app.use('/api/notifications', notificationsRouter);

  // Internal webhooks (for dogfooding - subscription activation, etc.)
  app.use('/api/internal/webhooks', internalWebhooksRouter);

  // Stats API (x402 protected)
  app.use('/', statsRouter);

  // Discovery API (service discovery for x402 resources - Bazaar)
  app.use('/', discoveryRouter);

  // Public free facilitator routes (no auth required)
  app.use('/', publicRouter);

  // Multi-tenant facilitator routes
  // These are resolved by subdomain or custom domain
  app.use('/', resolveFacilitator, facilitatorRouter);

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}

