import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { bodyLimit } from 'hono/body-limit';
import Database from 'better-sqlite3';
import { TonClient } from '@ton/ton';
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  TonSigner,
  SchemeNetworkFacilitator,
  TON_API_MAINNET,
  TON_API_TESTNET,
  TON_MAINNET,
  MAX_COMMISSION_CAP,
} from 'x402ton';
import type { ExactTonPayload, PaymentRequirements, GaslessConfigCache } from 'x402ton';

import { loadConfig } from './config';
import { createLogger } from './middleware/logging';
import { createRateLimiters } from './middleware/rate-limit';
import { IdempotencyStore } from './store/idempotency-store';
import { TxStateStore } from './store/tx-state';
import { BudgetStore } from './store/budget-store';
import { supportedRoute } from './routes/supported';
import { verifyRoute } from './routes/verify';
import { settleRoute } from './routes/settle';
import { healthRoute } from './health';

const logger = createLogger();

/** Fetch TONAPI gasless config (relay address + commission estimate) */
async function fetchGaslessConfig(
  endpoint: string,
  apiKey: string | undefined,
): Promise<{ relayAddress: string; maxRelayCommission: string | null } | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const configRes = await fetch(`${endpoint}/v2/gasless/config`, { headers });
    if (!configRes.ok) {
      logger.warn({ status: configRes.status }, 'failed to fetch TONAPI gasless config');
      return null;
    }
    const configData = (await configRes.json()) as { relay_address: string };
    const relayAddress = configData.relay_address;

    // Estimate commission with a sample USDT transfer
    const estimateRes = await fetch(
      `${endpoint}/v2/gasless/estimate/0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          wallet_address: '0:0000000000000000000000000000000000000000000000000000000000000000',
          wallet_public_key: '0'.repeat(64),
          messages: [{ boc: '0'.repeat(64) }],
        }),
      },
    );

    let commission: string | null = null;
    if (estimateRes.ok) {
      const estimateData = (await estimateRes.json()) as { commission?: string };
      if (estimateData.commission) {
        let commissionBig = BigInt(estimateData.commission);
        if (commissionBig > MAX_COMMISSION_CAP) {
          logger.warn(
            { estimated: estimateData.commission, cap: MAX_COMMISSION_CAP.toString() },
            'TONAPI commission exceeds cap — using cap value',
          );
          commissionBig = MAX_COMMISSION_CAP;
        }
        commission = commissionBig.toString();
      }
    } else {
      logger.warn({ status: estimateRes.status }, 'failed to fetch TONAPI commission estimate');
    }

    return { relayAddress, maxRelayCommission: commission };
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'TONAPI gasless config fetch failed');
    return null;
  }
}

async function start() {
  const config = loadConfig();

  // Ensure DB directory exists
  mkdirSync(dirname(config.dbPath), { recursive: true });

  // Init database
  const db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Init stores
  const idempotencyStore = new IdempotencyStore(db);
  const txStateStore = new TxStateStore(db);
  const budgetStore = new BudgetStore(db);

  // Init rate limiters
  const limiters = createRateLimiters(config.rateLimits);

  // Init signer
  const facSigner = new TonSigner(config.tonMnemonic);
  await facSigner.init();
  const facilitatorAddress = facSigner.getAddress('v5r1');
  logger.info({ facilitatorAddress, network: config.tonNetwork }, 'facilitator signer initialized');

  // Init TON client
  const apiKey = process.env.TONCENTER_API_KEY;
  const tonClient = new TonClient({
    endpoint: config.toncenterUrl,
    ...(apiKey ? { apiKey } : {}),
  });

  // Determine TONAPI endpoint
  const tonApiEndpoint =
    config.tonapiEndpoint ?? (config.tonNetwork === TON_MAINNET ? TON_API_MAINNET : TON_API_TESTNET);

  // Init real facilitator with TONAPI config
  const realFacilitator = new SchemeNetworkFacilitator(facSigner, config.tonNetwork, tonClient, {
    emulation: {
      tonApiKey: config.tonapiKey,
      tonApiEndpoint,
    },
    tonApiKey: config.tonapiKey,
    tonApiEndpoint,
    budgetPersistence: budgetStore,
  });

  // Adapter: routes pass {payload: ExactTonPayload}, facilitator expects ExactTonPayload directly
  const facilitator = {
    async verify(paymentPayload: { payload: ExactTonPayload }, paymentRequirements: PaymentRequirements) {
      return realFacilitator.verify(paymentPayload.payload, paymentRequirements);
    },
    async settle(paymentPayload: { payload: ExactTonPayload }, paymentRequirements: PaymentRequirements) {
      return realFacilitator.settle(paymentPayload.payload, paymentRequirements);
    },
  };

  // Fetch TONAPI gasless config at boot
  const gaslessCache: GaslessConfigCache = {
    relayAddress: null,
    maxRelayCommission: null,
    lastUpdated: 0,
  };

  // Fetch gasless config (TONAPI key is optional — public API works without it)
  const gaslessConfig = await fetchGaslessConfig(tonApiEndpoint, config.tonapiKey);
  if (gaslessConfig) {
    gaslessCache.relayAddress = gaslessConfig.relayAddress;
    gaslessCache.maxRelayCommission = gaslessConfig.maxRelayCommission;
    gaslessCache.lastUpdated = Date.now();
    logger.info(
      {
        relayAddress: gaslessConfig.relayAddress,
        maxRelayCommission: gaslessConfig.maxRelayCommission,
      },
      'TONAPI gasless config loaded',
    );
  } else {
    logger.warn('TONAPI gasless config unavailable at boot — using facilitator address as fallback');
  }

  // Build Hono app
  const app = new Hono();

  // Global middleware
  app.use('*', bodyLimit({ maxSize: 128 * 1024 }));

  app.use('*', async (c, next) => {
    if (!limiters.global.isAllowed('global')) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!limiters.perIp.isAllowed(ip)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }
    await next();
  });

  // Landing page
  const landingHtml = readFileSync(join(import.meta.dirname, '../public/index.html'), 'utf-8');
  app.get('/', (c) => c.html(landingHtml));

  // Mount routes
  app.route('/', supportedRoute(config, facilitatorAddress, gaslessCache));
  app.route(
    '/',
    verifyRoute({
      facilitator,
      logger,
      walletLimiter: limiters.perWallet,
    }),
  );
  app.route(
    '/',
    settleRoute({
      facilitator,
      logger,
      idempotencyStore,
      txStateStore,
      settleLimiter: limiters.settlePerWallet,
      walletLimiter: limiters.perWallet,
      network: config.tonNetwork,
    }),
  );
  app.route(
    '/',
    healthRoute({
      tonClient,
      network: config.tonNetwork,
      startedAt: Date.now(),
    }),
  );

  // Reconcile SETTLING transactions from previous runs
  const settlingTxs = txStateStore.getSettling();
  if (settlingTxs.length > 0) {
    logger.warn(
      { count: settlingTxs.length },
      'found SETTLING transactions from previous run — manual reconciliation needed',
    );
  }

  // Start server
  const server = serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    () => {
      logger.info(
        {
          port: config.port,
          network: config.tonNetwork,
          facilitatorAddress,
          gaslessRelay: gaslessCache.relayAddress ?? 'unavailable',
        },
        'x402ton facilitator server started',
      );
    },
  );

  // Periodic cleanup + gasless config refresh (every hour)
  const cleanupInterval = setInterval(async () => {
    try {
      idempotencyStore.cleanup(86400);
      limiters.global.cleanup();
      limiters.perIp.cleanup();
      limiters.perWallet.cleanup();
      limiters.settlePerWallet.cleanup();
      logger.debug('periodic cleanup completed');

      // Refresh TONAPI gasless config
      const refreshedConfig = await fetchGaslessConfig(tonApiEndpoint, config.tonapiKey);
      if (refreshedConfig) {
        gaslessCache.relayAddress = refreshedConfig.relayAddress;
        gaslessCache.maxRelayCommission = refreshedConfig.maxRelayCommission;
        gaslessCache.lastUpdated = Date.now();
        logger.debug(
          { relayAddress: refreshedConfig.relayAddress, commission: refreshedConfig.maxRelayCommission },
          'TONAPI gasless config refreshed',
        );
      }
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'periodic cleanup failed');
    }
  }, 3600_000);

  // Graceful shutdown
  const shutdown = () => {
    logger.info('shutting down...');
    clearInterval(cleanupInterval);
    server.close();
    try {
      db.close();
      logger.info('database closed');
    } catch {
      // Already closed
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  logger.fatal({ error: (err as Error).message }, 'failed to start server');
  process.exit(1);
});
