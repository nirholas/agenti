/**
 * Paid API Example - Resource Server with x402 Payment Middleware
 *
 * Demonstrates a resource server that accepts both exact and upto payments.
 *
 * Usage:
 *   1. Start the facilitator: bun run dev
 *   2. Start this server: bun run examples/paidApi.ts
 *
 * Endpoints:
 *   GET  /api/premium        - Exact payment ($0.01 EVM)
 *   GET  /api/premium-solana - Exact payment ($0.01 Solana)
 *   GET  /api/upto-premium   - Batched payment (upto scheme)
 *   GET  /api/upto-session/:id - Check session status
 *   POST /api/upto-close     - Close and settle session
 */

import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { createPaywall, evmPaywall, svmPaywall } from "@x402/paywall";
import Redis from "ioredis";
import pg from "pg";

import { createElysiaPaidRoutes } from "@daydreamsai/facilitator/elysia";
import {
  createPrivateKeyEvmSigner,
  createPrivateKeySvmSigner,
} from "@daydreamsai/facilitator/signers";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import {
  createUptoModule,
  createRedisSweeperLock,
  RedisUptoSessionStore,
  formatSession,
} from "@daydreamsai/facilitator/upto";
import {
  createResourceTrackingModule,
  InMemoryResourceTrackingStore,
  PostgresResourceTrackingStore,
  type PostgresClientAdapter,
} from "@daydreamsai/facilitator/tracking";
import { getRpcUrl } from "@daydreamsai/facilitator/config";

// ============================================================================
// Configuration
// ============================================================================

const { Pool } = pg;

const PORT = Number(4022);
const FACILITATOR_URL =
  process.env.FACILITATOR_URL ??
  `http://localhost:${process.env.FACILITATOR_PORT ?? 8090}`;
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX ?? "facilitator:upto";
const REDIS_SWEEPER_LOCK_KEY =
  process.env.REDIS_SWEEPER_LOCK_KEY ?? `${REDIS_PREFIX}:sweeper:lock`;
const RESOURCE_TRACKING_AUTO_PRUNE_DAYS = Number(
  process.env.RESOURCE_TRACKING_AUTO_PRUNE_DAYS ?? "0"
);
const RESOURCE_TRACKING_DATABASE_URL =
  process.env.RESOURCE_TRACKING_DATABASE_URL;
const RESOURCE_TRACKING_SCHEMA =
  process.env.RESOURCE_TRACKING_SCHEMA ?? "public";
const RESOURCE_TRACKING_TABLE =
  process.env.RESOURCE_TRACKING_TABLE ?? "resource_call_records";

const evmRpcUrl = getRpcUrl("base") ?? "https://mainnet.base.org";
const evmSigner = createPrivateKeyEvmSigner({
  network: "base",
  rpcUrl: evmRpcUrl,
});
const [evmAddress] = evmSigner.getAddresses();
const svmSigner = await createPrivateKeySvmSigner();
const [svmAddress] = svmSigner.getAddresses();

// ============================================================================
// Setup
// ============================================================================

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

const redis = REDIS_URL ? new Redis(REDIS_URL) : undefined;
const sessionStore = redis
  ? new RedisUptoSessionStore(redis, { keyPrefix: REDIS_PREFIX })
  : undefined;
const sweeperLock = redis
  ? createRedisSweeperLock(redis, {
      key: REDIS_SWEEPER_LOCK_KEY,
      useOptionsStyle: false,
    })
  : undefined;

const pgPool = RESOURCE_TRACKING_DATABASE_URL
  ? new Pool({ connectionString: RESOURCE_TRACKING_DATABASE_URL })
  : undefined;

// Drizzle users can reuse the same Pool instance:
// import { drizzle } from "drizzle-orm/node-postgres";
// const db = drizzle(pgPool);

const pgClient: PostgresClientAdapter | undefined = pgPool
  ? {
      query: async (sql, params) => {
        const result = await pgPool.query(sql, params);
        return result.rows;
      },
      queryOne: async (sql, params) => {
        const result = await pgPool.query(sql, params);
        return result.rows[0];
      },
      queryScalar: async (sql, params) => {
        const result = await pgPool.query(sql, params);
        const row = result.rows[0];
        return row ? (Object.values(row)[0] as unknown) : undefined;
      },
    }
  : undefined;

const trackingStore = pgClient
  ? new PostgresResourceTrackingStore(pgClient, {
      schema: RESOURCE_TRACKING_SCHEMA,
      tableName: RESOURCE_TRACKING_TABLE,
    })
  : new InMemoryResourceTrackingStore();

if (trackingStore instanceof PostgresResourceTrackingStore) {
  await trackingStore.initialize();
}

const resourceTracking = createResourceTrackingModule({
  store: trackingStore,
  ...(RESOURCE_TRACKING_AUTO_PRUNE_DAYS > 0
    ? { autoPruneDays: RESOURCE_TRACKING_AUTO_PRUNE_DAYS }
    : {}),
  onTrackingError: (err, id) => {
    // eslint-disable-next-line no-console
    console.warn(`[resource-tracking:${id}]`, err);
  },
});

// Create upto module for session store + manual settlement
const upto = createUptoModule({
  ...(sessionStore ? { store: sessionStore } : {}),
  facilitatorClient,
  sweeperConfig: {
    intervalMs: 30_000,
    idleSettleMs: 2 * 60_000,
    ...(sweeperLock ? { lock: sweeperLock } : {}),
  },
  autoSweeper: true,
});

// Resource server with all payment schemes
const resourceServer = createResourceServer(facilitatorClient);

// Paywall provider for browser-based payment UI
const paywallProvider = createPaywall()
  .withNetwork(evmPaywall)
  .withNetwork(svmPaywall)
  .build();

// ============================================================================
// Route Configuration
// ============================================================================

export const app = new Elysia({
  prefix: "/api",
  name: "paidApi",
  adapter: node(),
});

createElysiaPaidRoutes(app, {
  basePath: "/api",
  middleware: {
    resourceServer,
    upto,
    paywallProvider,
    resourceTracking,
    paywallConfig: {
      appName: "Paid API Example",
      testnet: true,
    },
  },
})
  .get("/premium", () => ({ message: "premium content (evm)" }), {
    payment: {
      accepts: {
        scheme: "exact",
        network: "eip155:8453",
        payTo: evmAddress,
        price: "$0.01",
      },
      description: "Premium content (EVM)",
      mimeType: "application/json",
    },
  })
  .get("/premium-solana", () => ({ message: "premium content (solana)" }), {
    payment: {
      accepts: {
        scheme: "exact",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        payTo: svmAddress,
        price: "$0.01",
      },
      description: "Premium content (Solana)",
      mimeType: "application/json",
    },
  })
  .get("/upto-premium", () => ({ message: "premium content (upto evm)" }), {
    payment: {
      accepts: {
        scheme: "upto",
        network: "eip155:8453",
        payTo: evmAddress,
        price: {
          amount: "10000", // $0.01 per request (USDC 6 decimals)
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          extra: {
            name: "USD Coin",
            version: "2",
            maxAmountRequired: "50000", // $0.05 cap
          },
        },
      },
      description: "Premium content (batched payments)",
      mimeType: "application/json",
    },
  });

app
  .get("/upto-session/:id", async ({ params }) => {
    const session = await upto.store.get(params.id);
    if (!session) return { error: "unknown_session" };
    return { id: params.id, ...formatSession(session) };
  })
  .post("/upto-close", async ({ body, set }) => {
    const { sessionId } = body as { sessionId?: string };
    if (!sessionId) {
      set.status = 400;
      return { error: "missing_session_id" };
    }

    const session = await upto.store.get(sessionId);
    if (!session) {
      set.status = 404;
      return { error: "unknown_session" };
    }

    await upto.settleSession(sessionId, "manual_close", true);

    const updated = await upto.store.get(sessionId);
    return {
      success: updated?.lastSettlement?.receipt.success ?? true,
      ...formatSession(updated ?? session),
    };
  });

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT);
console.log(`
Paid API listening on http://localhost:${PORT}
Facilitator: ${FACILITATOR_URL}

Endpoints:
  GET  /api/premium          - Exact payment ($0.01 EVM)
  GET  /api/premium-solana   - Exact payment ($0.01 Solana)
  GET  /api/upto-premium     - Batched payment (upto scheme)
  GET  /api/upto-session/:id - Check session status
  POST /api/upto-close       - Close and settle session
`);

const shutdown = async (): Promise<void> => {
  resourceTracking.stopAutoPrune();
  if (pgPool) {
    await pgPool.end();
  }
  process.exit(0);
};

const handleSignal = (): void => {
  void shutdown();
};

process.on("SIGINT", handleSignal);
process.on("SIGTERM", handleSignal);
