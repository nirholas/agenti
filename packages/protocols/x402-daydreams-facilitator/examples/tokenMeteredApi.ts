/**
 * Token-Metered AI API with x402 Upto Payments
 *
 * Demonstrates pay-per-token pricing using the upto payment scheme.
 * Charges based on actual token usage determined AFTER the LLM response.
 *
 * Usage:
 *   1. Start the facilitator: bun run dev
 *   2. Start this server: bun run examples/tokenMeteredApi.ts
 *
 * Environment:
 *   - PORT: Server port (default: 4024)
 *   - FACILITATOR_URL: Facilitator URL (default: http://localhost:8090)
 *   - REDIS_URL: Redis connection URL (optional)
 *   - REDIS_PREFIX: Redis key prefix (optional)
 *   - REDIS_SWEEPER_LOCK_KEY: Redis lock key (optional)
 *   - OPENAI_API_KEY: OpenAI API key (optional, uses mock if not set)
 */

import { Elysia, t } from "elysia";
import { node } from "@elysiajs/node";
import { HTTPFacilitatorClient } from "@x402/core/http";
import Redis from "ioredis";

import { createElysiaPaymentMiddleware } from "@daydreamsai/facilitator/elysia";
import {
  createUptoModule,
  createRedisSweeperLock,
  RedisUptoSessionStore,
  formatSession,
} from "@daydreamsai/facilitator/upto";
import { createPrivateKeyEvmSigner } from "@daydreamsai/facilitator/signers";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import { getRpcUrl } from "@daydreamsai/facilitator/config";
import {
  generateSessionId,
  extractUptoAuthorization,
} from "@daydreamsai/facilitator/upto/session";

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number(4024);
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:8090";
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX ?? "facilitator:upto";
const REDIS_SWEEPER_LOCK_KEY =
  process.env.REDIS_SWEEPER_LOCK_KEY ?? `${REDIS_PREFIX}:sweeper:lock`;

// Pricing in USDC units (6 decimals) per 1K tokens
const PRICE_PER_1K_INPUT = BigInt(process.env.PRICE_PER_1K_INPUT ?? "150"); // $0.00015
const PRICE_PER_1K_OUTPUT = BigInt(process.env.PRICE_PER_1K_OUTPUT ?? "600"); // $0.0006
const MIN_PRICE = BigInt(process.env.MIN_PRICE ?? "100"); // $0.0001 minimum

// USDC on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NETWORK = "eip155:8453" as const;

// ============================================================================
// Setup
// ============================================================================

const evmRpcUrl = getRpcUrl("base") ?? "https://mainnet.base.org";
const evmSigner = createPrivateKeyEvmSigner({
  network: "base",
  rpcUrl: evmRpcUrl,
});
const [payTo] = evmSigner.getAddresses();

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = createResourceServer(facilitatorClient);

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

// Upto module - autoTrack: false since we track manually after knowing token usage
const upto = createUptoModule({
  ...(sessionStore ? { store: sessionStore } : {}),
  facilitatorClient,
  sweeperConfig: {
    intervalMs: 30_000,
    idleSettleMs: 2 * 60_000,
    ...(sweeperLock ? { lock: sweeperLock } : {}),
  },
  autoSweeper: true,
  autoTrack: false,
});

// Route configuration for x402 middleware
const routes = {
  "POST /v1/chat/completions": {
    accepts: {
      scheme: "upto" as const,
      network: NETWORK,
      payTo,
      price: {
        amount: MIN_PRICE.toString(),
        asset: USDC_ADDRESS,
        extra: { name: "USD Coin", version: "2", maxAmountRequired: "1000000" },
      },
    },
    description: "Token-metered AI chat",
    mimeType: "application/json",
  },
};

// ============================================================================
// Token Pricing
// ============================================================================

function calculatePrice(
  promptTokens: number,
  completionTokens: number
): bigint {
  const inputCost = (BigInt(promptTokens) * PRICE_PER_1K_INPUT) / 1000n;
  const outputCost = (BigInt(completionTokens) * PRICE_PER_1K_OUTPUT) / 1000n;
  const total = inputCost + outputCost;
  return total < MIN_PRICE ? MIN_PRICE : total;
}

function formatUsd(units: bigint): string {
  return `$${(Number(units) / 1_000_000).toFixed(6)}`;
}

async function trackTokenCost(sessionId: string, cost: bigint): Promise<boolean> {
  const session = await upto.store.get(sessionId);
  if (!session || session.status !== "open") return false;

  const nextTotal = session.settledTotal + session.pendingSpent + cost;
  if (nextTotal > session.cap) return false;

  session.pendingSpent += cost;
  session.lastActivityMs = Date.now();
  await upto.store.set(sessionId, session);
  return true;
}

// ============================================================================
// Mock LLM
// ============================================================================

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callLLM(messages: ChatMessage[]): Promise<{
  content: string;
  promptTokens: number;
  completionTokens: number;
}> {
  const promptText = messages.map((m) => m.content).join(" ");
  const promptTokens = Math.ceil(promptText.length / 4);

  // Mock response - replace with AI SDK for real usage
  const content = `Mock response for: "${messages[messages.length - 1]?.content.slice(0, 30)}..."`;
  const completionTokens = Math.ceil(content.length / 4);

  await new Promise((r) => setTimeout(r, 100));
  return { content, promptTokens, completionTokens };
}

// ============================================================================
// Application
// ============================================================================

const app = new Elysia({ adapter: node() })
  // Attach sweeper for automatic settlement
  .use(upto.createSweeper())

  // Public endpoints (no payment)
  .get("/pricing", () => ({
    network: NETWORK,
    asset: USDC_ADDRESS,
    rates: {
      inputPer1K: formatUsd(PRICE_PER_1K_INPUT),
      outputPer1K: formatUsd(PRICE_PER_1K_OUTPUT),
      minimum: formatUsd(MIN_PRICE),
    },
    payTo,
  }))
  .get("/health", () => ({ status: "ok", facilitator: FACILITATOR_URL }))
  .get("/session/:id", async ({ params }) => {
    const session = await upto.store.get(params.id);
    if (!session) return { error: "not_found" };
    return { id: params.id, ...formatSession(session) };
  })
  .post("/session/:id/close", async ({ params }) => {
    const session = await upto.store.get(params.id);
    if (!session) return { error: "not_found" };
    await upto.settleSession(params.id, "manual_close", true);
    const updated = await upto.store.get(params.id);
    const receipt = updated?.lastSettlement?.receipt;
    return {
      success: receipt?.success ?? false,
      settled: formatUsd(updated?.settledTotal ?? 0n),
      transaction: receipt?.transaction || null,
      network: receipt?.network || null,
      error: receipt?.errorReason || null,
    };
  })
  .get("/sessions", async () => {
    const list: Array<{ id: string; status: string; spent: string }> = [];
    for await (const [id, s] of upto.store.entries()) {
      list.push({
        id: id.slice(0, 16) + "...",
        status: s.status,
        spent: formatUsd(s.pendingSpent + s.settledTotal),
      });
    }
    return { count: list.length, sessions: list };
  })

  // x402 payment middleware for protected routes
  .use(
    createElysiaPaymentMiddleware({
      resourceServer,
      routes,
      upto,
      autoSettle: false, // We handle this manually
    })
  )

  // Protected chat endpoint
  .post(
    "/v1/chat/completions",
    async (ctx) => {
      const { body, x402, set } = ctx;

      // Middleware verified payment - extract session info
      if (!x402 || x402.result.type !== "payment-verified") {
        set.status = 500;
        return { error: "payment_state_missing" };
      }

      const { paymentPayload, paymentRequirements } = x402.result;
      const sessionId = generateSessionId(paymentPayload);
      const auth = extractUptoAuthorization(paymentPayload);

      if (!auth) {
        set.status = 400;
        return { error: "invalid_upto_payload" };
      }

      // Initialize session if new
      let session = await upto.store.get(sessionId);
      if (!session) {
        session = {
          cap: BigInt(auth.value),
          deadline: BigInt(auth.deadline),
          pendingSpent: 0n,
          settledTotal: 0n,
          lastActivityMs: Date.now(),
          status: "open" as const,
          paymentPayload,
          paymentRequirements,
        };
        await upto.store.set(sessionId, session);
      }

      if (session.status !== "open") {
        set.status = session.status === "settling" ? 409 : 402;
        return { error: `session_${session.status}` };
      }

      // Call LLM
      const llm = await callLLM(body.messages as ChatMessage[]);

      // Calculate and track cost
      const cost = calculatePrice(llm.promptTokens, llm.completionTokens);

      if (!(await trackTokenCost(sessionId, cost))) {
        set.status = 402;
        return { error: "cap_exhausted", cost: formatUsd(cost) };
      }

      const updated = (await upto.store.get(sessionId))!;
      set.headers["x-upto-session-id"] = sessionId;
      set.headers["x-token-cost"] = cost.toString();

      return {
        id: `chat-${Date.now()}`,
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: llm.content },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: llm.promptTokens,
          completion_tokens: llm.completionTokens,
          total_tokens: llm.promptTokens + llm.completionTokens,
        },
        x402: {
          sessionId,
          cost: { units: cost.toString(), usd: formatUsd(cost) },
          session: {
            cap: formatUsd(updated.cap),
            spent: formatUsd(updated.pendingSpent + updated.settledTotal),
            remaining: formatUsd(
              updated.cap - updated.pendingSpent - updated.settledTotal
            ),
          },
        },
      };
    },
    {
      body: t.Object({
        messages: t.Array(t.Object({ role: t.String(), content: t.String() })),
        model: t.Optional(t.String()),
      }),
    }
  );

// ============================================================================
// Start
// ============================================================================

app.listen(PORT);

console.log(`
Token-Metered AI API
────────────────────────────────────────
Port:        ${PORT}
Facilitator: ${FACILITATOR_URL}
Pay To:      ${payTo}

Pricing (USDC/1K tokens):
  Input:  ${formatUsd(PRICE_PER_1K_INPUT)}
  Output: ${formatUsd(PRICE_PER_1K_OUTPUT)}

Endpoints:
  GET  /pricing              - Token rates
  POST /v1/chat/completions  - Chat (x402 upto)
  GET  /session/:id          - Session status
  POST /session/:id/close    - Settle & close
────────────────────────────────────────
`);
