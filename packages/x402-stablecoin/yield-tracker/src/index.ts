/**
 * USDs Yield Tracker Service
 * 
 * Main entry point for the yield tracking service.
 * Tracks auto-yield earnings from Sperax USDs payments.
 * 
 * Features:
 * - Track USDs balances over time
 * - Calculate yield earned from rebasing
 * - Historical yield analytics
 * - Real-time yield rate estimation
 * 
 * USDs Contract: 0xD74f5255D557944cf7Dd0E45FF521520002D5748 (Arbitrum)
 * Vault: 0x8EC1877698ACF262Fe8Ad8a295ad94D6ea258988
 * 
 * @see https://docs.sperax.io/
 */

import express from 'express';
import cors from 'cors';
import { createYieldTracker, type YieldTracker } from './tracker.js';
import { createApiRouter } from './api/routes.js';
import type { YieldTrackerConfig } from './types.js';

// Re-export types and classes
export { YieldTracker, createYieldTracker } from './tracker.js';
export { USdsContract, createUSdsContract, USDS_ADDRESS, USDS_VAULT_ADDRESS } from './contracts/usds.js';
export { PaymentStorage, createPaymentStorage } from './storage/payments.js';
export { RebaseMonitor, createRebaseMonitor } from './services/rebase-monitor.js';
export { YieldCalculator, createYieldCalculator } from './services/yield-calculator.js';
export * from './types.js';

/**
 * Default configuration
 */
const DEFAULT_PORT = 3003;
const DEFAULT_RPC_URL = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
const DEFAULT_DB_PATH = process.env.DB_PATH || './yield-tracker.db';

/**
 * Start the yield tracker server
 */
export async function startServer(config: Partial<YieldTrackerConfig> = {}): Promise<{
  tracker: YieldTracker;
  app: express.Application;
  close: () => void;
}> {
  const port = config.port || DEFAULT_PORT;
  const rpcUrl = config.rpcUrl || DEFAULT_RPC_URL;
  const dbPath = config.dbPath || DEFAULT_DB_PATH;

  console.log('===========================================');
  console.log('  USDs Yield Tracker Service');
  console.log('===========================================');
  console.log(`Network: ${config.network || 'mainnet'}`);
  console.log(`RPC URL: ${rpcUrl}`);
  console.log(`Database: ${dbPath}`);
  console.log(`Port: ${port}`);
  console.log('===========================================');

  // Create tracker
  const tracker = createYieldTracker({
    rpcUrl,
    dbPath,
    network: config.network || 'mainnet',
    port,
    pollInterval: config.pollInterval || 60000,
  });

  // Start tracker
  await tracker.start();

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', createApiRouter(tracker));

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'USDs Yield Tracker',
      version: '1.0.0',
      description: 'Track auto-yield earnings from Sperax USDs payments',
      endpoints: {
        health: 'GET /api/health',
        yieldInfo: 'GET /api/yield/:address',
        yieldHistory: 'GET /api/yield/:address/history',
        payments: 'GET /api/yield/:address/payments',
        apy: 'GET /api/apy',
        latestRebase: 'GET /api/rebase/latest',
        rebaseHistory: 'GET /api/rebase/history',
        trackPayment: 'POST /api/track',
        estimate: 'GET /api/estimate?balance=100&days=30',
        contractState: 'GET /api/contract/state',
        payment: 'GET /api/payment/:id',
      },
      usdsContract: '0xD74f5255D557944cf7Dd0E45FF521520002D5748',
      network: config.network || 'mainnet',
    });
  });

  // Start server
  const server = app.listen(port, () => {
    console.log(`\n🚀 Yield Tracker API running at http://localhost:${port}`);
    console.log(`📊 API endpoints available at http://localhost:${port}/api`);
    console.log('\nEndpoints:');
    console.log(`  GET  /api/health              - Health check`);
    console.log(`  GET  /api/yield/:address      - Get yield info for address`);
    console.log(`  GET  /api/yield/:address/history - Yield history`);
    console.log(`  GET  /api/apy                 - Current APY info`);
    console.log(`  GET  /api/rebase/latest       - Latest rebase event`);
    console.log(`  POST /api/track               - Track a payment`);
    console.log('');
  });

  const close = () => {
    console.log('\nShutting down...');
    tracker.close();
    server.close();
  };

  // Handle graceful shutdown
  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  return { tracker, app, close };
}

/**
 * Main entry point
 */
async function main() {
  const config: Partial<YieldTrackerConfig> = {
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    port: parseInt(process.env.PORT || '3003'),
    dbPath: process.env.DB_PATH,
    network: (process.env.NETWORK as 'mainnet' | 'sepolia') || 'mainnet',
    pollInterval: parseInt(process.env.POLL_INTERVAL || '60000'),
  };

  try {
    await startServer(config);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
