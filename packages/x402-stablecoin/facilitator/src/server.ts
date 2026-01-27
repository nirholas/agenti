/**
 * X402 Payment Facilitator Server
 * 
 * Production-ready Express.js server for:
 * - Payment verification on Arbitrum
 * - Gasless EIP-3009 settlements for USDs
 * - Quote generation with HTTP 402 responses
 * 
 * @see https://github.com/nirholas/x402
 */

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Address } from 'viem';

import { createArbitrumClient } from './services/arbitrum.js';
import { createUSdsService } from './services/usds.js';
import { createPaymentCache } from './services/cache.js';
import { logger, requestLogger, errorLogger } from './middleware/logger.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { createVerifyRouter } from './routes/verify.js';
import { createSettleRouter } from './routes/settle.js';
import { createQuoteRouter } from './routes/quote.js';
import { createPaymentsRouter } from './routes/payments.js';
import type { Network, ServerConfig, HealthResponse, ErrorResponse } from './types.js';

/**
 * Load configuration from environment
 */
function loadConfig(): ServerConfig {
  const network = (process.env.NETWORK || 'arbitrum-sepolia') as Network;
  
  const defaultRpcUrls: Record<Network, string> = {
    'arbitrum': 'https://arb1.arbitrum.io/rpc',
    'arbitrum-sepolia': 'https://sepolia-rollup.arbitrum.io/rpc',
  };

  return {
    port: parseInt(process.env.PORT || '3002', 10),
    host: process.env.HOST || '0.0.0.0',
    network,
    rpcUrl: process.env.RPC_URL || defaultRpcUrls[network],
    privateKey: process.env.PRIVATE_KEY as `0x${string}` | undefined,
    recipientAddress: (process.env.RECIPIENT_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0') as Address,
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    paymentCacheTtlMs: parseInt(process.env.PAYMENT_CACHE_TTL_MS || '86400000', 10), // 24 hours
  };
}

/**
 * Create and configure Express application
 */
function createApp(config: ServerConfig) {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Allow JSON responses
  }));

  // CORS configuration
  app.use(cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Payment', 'X-Request-ID'],
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));

  // Request logging
  app.use(requestLogger);

  // Global rate limiting
  app.use(createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests,
  }));

  // Initialize services
  const arbitrumClient = createArbitrumClient(
    config.network,
    config.rpcUrl,
    config.privateKey
  );

  const usdsService = createUSdsService(
    config.network,
    config.rpcUrl,
    config.privateKey
  );

  const paymentCache = createPaymentCache({
    ttlMs: config.paymentCacheTtlMs,
  });

  // Health check endpoint
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const blockNumber = await arbitrumClient.getBlockNumber();
      const cacheStats = paymentCache.getStats();

      const health: HealthResponse = {
        status: 'healthy',
        uptime: process.uptime(),
        version: '1.0.0',
        network: config.network,
        paymentsProcessed: cacheStats.size,
        cacheSize: cacheStats.size,
        blockNumber: Number(blockNumber),
        timestamp: Date.now(),
      };

      res.json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        uptime: process.uptime(),
        version: '1.0.0',
        network: config.network,
        paymentsProcessed: 0,
        cacheSize: 0,
        timestamp: Date.now(),
        error: String(error),
      } satisfies HealthResponse & { error: string });
    }
  });

  // Mount routes
  app.use('/verify', createVerifyRouter(arbitrumClient, paymentCache));
  app.use('/settle', createSettleRouter(usdsService, paymentCache));
  app.use('/quote', createQuoteRouter({
    recipientAddress: config.recipientAddress,
    network: config.network,
    defaultToken: 'USDs',
    facilitatorUrl: `http://${config.host}:${config.port}`,
    quoteValiditySeconds: 300, // 5 minutes
  }));
  app.use('/payments', createPaymentsRouter(arbitrumClient, paymentCache));

  // Legacy endpoint aliases
  app.get('/payment/:txHash', (req: Request, res: Response) => {
    res.redirect(301, `/payments/${req.params.txHash}`);
  });

  // Error logging middleware
  app.use(errorLogger);

  // Error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    } satisfies ErrorResponse);
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not found',
      code: 'NOT_FOUND',
      path: req.path,
    } satisfies ErrorResponse);
  });

  return app;
}

/**
 * Start the server
 */
async function main() {
  const config = loadConfig();
  const app = createApp(config);

  const server = app.listen(config.port, config.host, () => {
    console.log('');
    console.log('🚀 X402 Payment Facilitator Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 URL: http://${config.host}:${config.port}`);
    console.log(`🔗 Network: ${config.network}`);
    console.log(`💰 Recipient: ${config.recipientAddress}`);
    console.log('');
    console.log('📌 Endpoints:');
    console.log(`   POST   /verify          - Verify payment transaction`);
    console.log(`   POST   /settle          - Settle gasless payment`);
    console.log(`   POST   /quote           - Generate payment quote (402)`);
    console.log(`   GET    /payments/:tx    - Query payment status`);
    console.log(`   GET    /payments        - List cached payments`);
    console.log(`   GET    /health          - Health check`);
    console.log('');
    console.log('💡 Environment Variables:');
    console.log(`   NETWORK=${config.network}`);
    console.log(`   RPC_URL=${config.rpcUrl.slice(0, 40)}...`);
    console.log(`   PRIVATE_KEY=${config.privateKey ? '****' : 'Not set (read-only mode)'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Run server
main().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});

export { createApp, loadConfig };
