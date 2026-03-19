import { Hono } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/http";
import Redis from "ioredis";

import { createPrivateKeyEvmSigner } from "@daydreamsai/facilitator/signers";
import { getRpcUrl } from "@daydreamsai/facilitator/config";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import {
  RedisUptoSessionStore,
  InMemoryUptoSessionStore,
  settleUptoSession,
  trackUptoPayment,
} from "@daydreamsai/facilitator/upto";

const facilitatorUrl = process.env.FACILITATOR_URL ?? "http://localhost:8090";
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX ?? "facilitator:upto";
const evmRpcUrl = getRpcUrl("base") ?? "https://mainnet.base.org";
const evmSigner = createPrivateKeyEvmSigner({
  network: "base",
  rpcUrl: evmRpcUrl,
});
const [evmAddress] = evmSigner.getAddresses();

const app = new Hono();

// Facilitator client for verification and settlement
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

// Create resource server with all Daydreams schemes pre-registered
const resourceServer = createResourceServer(facilitatorClient);

resourceServer.initialize();

// Session store for upto scheme batched payments
const redis = REDIS_URL ? new Redis(REDIS_URL) : undefined;
const uptoStore = redis
  ? new RedisUptoSessionStore(redis, { keyPrefix: REDIS_PREFIX })
  : new InMemoryUptoSessionStore();

// Register hook to track upto sessions after verification
resourceServer.onAfterVerify(async (ctx) => {
  if (ctx.requirements.scheme !== "upto") return;
  if (!ctx.result.isValid) return;

  // Track the session (errors are logged but don't block the request)
  const result = await trackUptoPayment(
    uptoStore,
    ctx.paymentPayload,
    ctx.requirements
  );
  if (!result.success) {
    console.warn(`Upto session ${result.sessionId} error: ${result.error}`);
  }
});

// ============================================================================
// Routes
// ============================================================================

// Apply payment middleware globally - it will only intercept routes defined in config
app.use(
  paymentMiddleware(
    {
      // Exact scheme - immediate settlement per request
      "GET /weather": {
        accepts: {
          scheme: "exact",
          price: "$0.001",
          network: "eip155:8453", // Base mainnet
          payTo: evmAddress,
        },
        description: "Weather data",
        mimeType: "application/json",
      },
      // Upto scheme - batched settlement
      "GET /premium/data": {
        accepts: {
          scheme: "upto",
          network: "eip155:8453", // Base mainnet
          payTo: evmAddress,
          price: {
            amount: "1000", // $0.001 per request
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base mainnet
            extra: {
              name: "USD Coin",
              version: "2",
              maxAmountRequired: "10000", // $0.01 cap
            },
          },
        },
        description: "Premium data with batched payments",
        mimeType: "application/json",
      },
    },
    resourceServer,
    undefined, // paywallConfig
    undefined, // paywall
    false // syncFacilitatorOnStart - skip validation on startup
  )
);

// Route handlers
app.get("/weather", (c) => c.json({ weather: "sunny", temperature: 70 }));
app.get("/premium/data", (c) => c.json({ data: "premium content" }));

// Session status endpoint
app.get("/upto/session/:id", async (c) => {
  const session = await uptoStore.get(c.req.param("id"));
  if (!session) return c.json({ error: "unknown_session" }, 404);

  return c.json({
    id: c.req.param("id"),
    status: session.status,
    cap: session.cap.toString(),
    settledTotal: session.settledTotal.toString(),
    pendingSpent: session.pendingSpent.toString(),
    deadline: session.deadline.toString(),
  });
});

// Manual close/settle endpoint
app.post("/upto/close", async (c) => {
  const { sessionId } = await c.req.json<{ sessionId?: string }>();
  if (!sessionId) return c.json({ error: "missing_session_id" }, 400);

  const session = await uptoStore.get(sessionId);
  if (!session) return c.json({ error: "unknown_session" }, 404);

  await settleUptoSession(
    uptoStore,
    facilitatorClient,
    sessionId,
    "manual_close",
    true
  );

  return c.json(
    (await uptoStore.get(sessionId))?.lastSettlement?.receipt ?? {
      success: true,
    }
  );
});

export default app;
