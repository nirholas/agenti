/**
 * Paid API Example (Express) - Resource Server with x402 Payment Middleware
 *
 * Demonstrates a resource server that accepts both exact and upto payments.
 *
 * Usage:
 *   1. Start the facilitator: bun run dev
 *   2. Start this server: bun run examples/paidApiExpress.ts
 *
 * Endpoints:
 *   GET  /api/premium        - Exact payment ($0.01 EVM)
 *   GET  /api/premium-solana - Exact payment ($0.01 Solana)
 *   GET  /api/upto-premium   - Batched payment (upto scheme)
 *   GET  /api/upto-session/:id - Check session status
 *   POST /api/upto-close     - Close and settle session
 */

import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { createPaywall, evmPaywall, svmPaywall } from "@x402/paywall";
import Redis from "ioredis";

import { createExpressPaidRoutes } from "@daydreamsai/facilitator/express";
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
import { getRpcUrl } from "@daydreamsai/facilitator/config";

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number(4024);
const FACILITATOR_URL =
  process.env.FACILITATOR_URL ??
  `http://localhost:${process.env.FACILITATOR_PORT ?? 8090}`;
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX ?? "facilitator:upto";
const REDIS_SWEEPER_LOCK_KEY =
  process.env.REDIS_SWEEPER_LOCK_KEY ?? `${REDIS_PREFIX}:sweeper:lock`;

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

const app = express();
app.use(express.json());

createExpressPaidRoutes(app, {
  basePath: "/api",
  middleware: {
    resourceServer,
    upto,
    paywallProvider,
    paywallConfig: {
      appName: "Paid API Example (Express)",
      testnet: true,
    },
  },
})
  .get(
    "/api/premium",
    (_req, res) => res.json({ message: "premium content (evm)" }),
    {
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
    }
  )
  .get(
    "/api/premium-solana",
    (_req, res) => res.json({ message: "premium content (solana)" }),
    {
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
    }
  )
  .get(
    "/api/upto-premium",
    (_req, res) => res.json({ message: "premium content (upto evm)" }),
    {
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
    }
  );

// Non-paid routes
app.get("/api/upto-session/:id", async (req, res) => {
  const session = await upto.store.get(req.params.id);
  if (!session) {
    res.json({ error: "unknown_session" });
    return;
  }
  res.json({ id: req.params.id, ...formatSession(session) });
});

app.post("/api/upto-close", async (req, res) => {
  const sessionId = req.body?.sessionId as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: "missing_session_id" });
    return;
  }

  const session = await upto.store.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "unknown_session" });
    return;
  }

  await upto.settleSession(sessionId, "manual_close", true);

  const updated = await upto.store.get(sessionId);
  res.json({
    success: updated?.lastSettlement?.receipt.success ?? true,
    ...formatSession(updated ?? session),
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log(`
Paid API (Express) listening on http://localhost:${PORT}
Facilitator: ${FACILITATOR_URL}

Endpoints:
  GET  /api/premium          - Exact payment ($0.01 EVM)
  GET  /api/premium-solana   - Exact payment ($0.01 Solana)
  GET  /api/upto-premium     - Batched payment (upto scheme)
  GET  /api/upto-session/:id - Check session status
  POST /api/upto-close       - Close and settle session
`);
});
