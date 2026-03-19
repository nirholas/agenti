/**
 * Upto Module Example - Injectable Session Store
 *
 * This example demonstrates the new `createUptoModule` factory that allows
 * injecting custom session stores for production deployments.
 *
 * Features demonstrated:
 * - Creating an upto module with custom store
 * - Implementing a custom session store (Redis-like mock)
 * - Using the sweeper for automatic batch settlement
 * - Session management endpoints
 *
 * Usage:
 *   1. Start the facilitator: bun run dev
 *   2. Start this server: bun run examples/uptoModule.ts
 *
 * Environment variables:
 *   - PORT: Server port (default: 4023)
 *   - FACILITATOR_URL: Facilitator URL (default: http://localhost:8090)
 *   - REDIS_URL: Redis connection URL (optional)
 *   - REDIS_PREFIX: Redis key prefix (optional)
 *   - REDIS_SWEEPER_LOCK_KEY: Redis lock key (optional)
 */

import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { HTTPFacilitatorClient } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import Redis from "ioredis";

import {
  createUptoModule,
  createRedisSweeperLock,
  RedisUptoSessionStore,
  trackUptoPayment,
  formatSession,
  TRACKING_ERROR_STATUS,
  type UptoSessionStore,
  type UptoSession,
} from "@daydreamsai/facilitator/upto";

// ============================================================================
// Custom Session Store Implementation
// ============================================================================

/**
 * Example: A custom session store with TTL and event hooks.
 *
 * In production, you would implement this interface with:
 * - Redis for distributed deployments
 * - PostgreSQL for durable persistence
 * - DynamoDB for serverless deployments
 *
 * This mock demonstrates the pattern with in-memory storage + extras.
 */
class CustomSessionStore implements UptoSessionStore {
  private readonly map = new Map<string, UptoSession>();
  private readonly ttlMs: number;
  private readonly onSessionChange?: (
    id: string,
    session: UptoSession | undefined
  ) => void;

  constructor(options?: {
    ttlMs?: number;
    onSessionChange?: (id: string, session: UptoSession | undefined) => void;
  }) {
    this.ttlMs = options?.ttlMs ?? 60 * 60 * 1000; // 1 hour default
    this.onSessionChange = options?.onSessionChange;
  }

  get(id: string): UptoSession | undefined {
    const session = this.map.get(id);
    if (!session) return undefined;

    // Check TTL based on last activity
    const age = Date.now() - session.lastActivityMs;
    if (age > this.ttlMs && session.status === "closed") {
      this.map.delete(id);
      return undefined;
    }

    return session;
  }

  set(id: string, session: UptoSession): void {
    this.map.set(id, session);
    this.onSessionChange?.(id, session);
  }

  delete(id: string): void {
    this.map.delete(id);
    this.onSessionChange?.(id, undefined);
  }

  entries(): IterableIterator<[string, UptoSession]> {
    return this.map.entries();
  }

  // Custom methods for monitoring
  size(): number {
    return this.map.size;
  }

  getStats(): {
    total: number;
    open: number;
    settling: number;
    closed: number;
  } {
    let open = 0,
      settling = 0,
      closed = 0;
    for (const [, session] of this.map) {
      switch (session.status) {
        case "open":
          open++;
          break;
        case "settling":
          settling++;
          break;
        case "closed":
          closed++;
          break;
      }
    }
    return { total: this.map.size, open, settling, closed };
  }
}

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number(process.env.PORT ?? 4023);
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:8090";
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX ?? "facilitator:upto";
const REDIS_SWEEPER_LOCK_KEY =
  process.env.REDIS_SWEEPER_LOCK_KEY ?? `${REDIS_PREFIX}:sweeper:lock`;

// Create facilitator client
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

const redis = REDIS_URL ? new Redis(REDIS_URL) : undefined;
const redisStore = redis
  ? new RedisUptoSessionStore(redis, { keyPrefix: REDIS_PREFIX })
  : undefined;
const sweeperLock = redis
  ? createRedisSweeperLock(redis, {
      key: REDIS_SWEEPER_LOCK_KEY,
      useOptionsStyle: false,
    })
  : undefined;

// Create custom store with event hooks for logging
const customStore = new CustomSessionStore({
  ttlMs: 30 * 60 * 1000, // 30 minutes TTL for closed sessions
  onSessionChange: (id, session) => {
    if (session) {
      console.log(
        `[Store] Session ${id.slice(0, 8)}... status: ${session.status}, pending: ${session.pendingSpent}, settled: ${session.settledTotal}`
      );
    } else {
      console.log(`[Store] Session ${id.slice(0, 8)}... deleted`);
    }
  },
});

const activeStore = redisStore ?? customStore;
const storeLabel = redisStore ? "RedisUptoSessionStore" : "CustomSessionStore";

const getStoreStats = async () => {
  if (!redisStore) return customStore.getStats();
  let open = 0;
  let settling = 0;
  let closed = 0;
  let total = 0;
  for await (const [, session] of activeStore.entries()) {
    total++;
    switch (session.status) {
      case "open":
        open++;
        break;
      case "settling":
        settling++;
        break;
      case "closed":
        closed++;
        break;
    }
  }
  return { total, open, settling, closed };
};

// Create upto module with the active store
const upto = createUptoModule({
  store: activeStore,
  facilitatorClient,
  sweeperConfig: {
    intervalMs: 15_000, // Sweep every 15 seconds (faster for demo)
    idleSettleMs: 60_000, // Settle after 1 minute idle
    capThresholdNum: 8n, // Settle at 80% cap (8/10)
    capThresholdDen: 10n,
    ...(sweeperLock ? { lock: sweeperLock } : {}),
  },
});

const sweeper = upto.createSweeper();

// ============================================================================
// Elysia Application
// ============================================================================

const app = new Elysia({ adapter: node() })
  // Use the sweeper plugin from our upto module
  .use(sweeper)

  // ---- API Routes ----

  /**
   * POST /payment/track
   * Track an upto payment after verification.
   * In a real app, this would be called after x402 middleware verifies the payment.
   */
  .post("/payment/track", async ({ body, set }) => {
    const { paymentPayload, paymentRequirements } = body as {
      paymentPayload?: PaymentPayload;
      paymentRequirements?: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      set.status = 400;
      return { error: "missing_payload_or_requirements" };
    }

    if (paymentRequirements.scheme !== "upto") {
      set.status = 400;
      return { error: "not_upto_scheme" };
    }

    const result = await trackUptoPayment(
      upto.store,
      paymentPayload,
      paymentRequirements
    );

    if (!result.success) {
      set.status = TRACKING_ERROR_STATUS[result.error];
      return {
        error: result.error,
        sessionId: result.sessionId,
        session: result.session ? formatSession(result.session) : undefined,
      };
    }

    set.headers["x-upto-session-id"] = result.sessionId;
    return {
      success: true,
      sessionId: result.sessionId,
      session: formatSession(result.session),
    };
  })

  /**
   * GET /session/:id
   * Get session details.
   */
  .get("/session/:id", async ({ params, set }) => {
    const session = await upto.store.get(params.id);

    if (!session) {
      set.status = 404;
      return { error: "session_not_found" };
    }

    return {
      id: params.id,
      ...formatSession(session),
      deadlineDate: new Date(Number(session.deadline) * 1000).toISOString(),
    };
  })

  /**
   * POST /session/:id/settle
   * Manually trigger settlement for a session.
   */
  .post("/session/:id/settle", async ({ params, body, set }) => {
    const { close } = (body as { close?: boolean }) ?? {};
    const session = await upto.store.get(params.id);

    if (!session) {
      set.status = 404;
      return { error: "session_not_found" };
    }

    if (session.status === "settling") {
      set.status = 409;
      return { error: "already_settling" };
    }

    if (session.pendingSpent === 0n) {
      if (close) {
        session.status = "closed";
        await upto.store.set(params.id, session);
        return { success: true, message: "session_closed_no_pending" };
      }
      return { success: true, message: "nothing_to_settle" };
    }

    await upto.settleSession(params.id, "manual_settlement", close ?? false);

    const updated = await upto.store.get(params.id);
    return {
      success: updated?.lastSettlement?.receipt.success ?? false,
      settlement: updated?.lastSettlement,
    };
  })

  /**
   * POST /session/:id/close
   * Close a session and settle any remaining balance.
   */
  .post("/session/:id/close", async ({ params, set }) => {
    const session = await upto.store.get(params.id);

    if (!session) {
      set.status = 404;
      return { error: "session_not_found" };
    }

    await upto.settleSession(params.id, "manual_close", true);

    const updated = await upto.store.get(params.id);
    return {
      success: true,
      finalStatus: updated?.status,
      settlement: updated?.lastSettlement,
    };
  })

  /**
   * GET /sessions
   * List all active sessions (for debugging/monitoring).
   */
  .get("/sessions", async () => {
    const sessions: Array<{
      id: string;
      status: string;
      cap: string;
      pendingSpent: string;
      settledTotal: string;
    }> = [];

    for await (const [id, session] of upto.store.entries()) {
      sessions.push({
        id,
        status: session.status,
        cap: session.cap.toString(),
        pendingSpent: session.pendingSpent.toString(),
        settledTotal: session.settledTotal.toString(),
      });
    }

    return {
      count: sessions.length,
      stats: await getStoreStats(),
      sessions,
    };
  })

  /**
   * GET /health
   * Health check with store stats.
   */
  .get("/health", async () => ({
    status: "ok",
    facilitator: FACILITATOR_URL,
    store: {
      type: storeLabel,
      stats: await getStoreStats(),
    },
    sweeper: {
      intervalMs: 15_000,
      idleSettleMs: 60_000,
      capThreshold: "80%",
    },
  }));

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT);

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    Upto Module Example Server                      ║
╠════════════════════════════════════════════════════════════════════╣
║  Port:        ${String(PORT).padEnd(50)}║
║  Facilitator: ${FACILITATOR_URL.padEnd(50)}║
╠════════════════════════════════════════════════════════════════════╣
║  Endpoints:                                                        ║
║    POST /payment/track     - Track upto payment                    ║
║    GET  /session/:id       - Get session details                   ║
║    POST /session/:id/settle - Manually settle session              ║
║    POST /session/:id/close  - Close and settle session             ║
║    GET  /sessions          - List all sessions                     ║
║    GET  /health            - Health check with stats               ║
╠════════════════════════════════════════════════════════════════════╣
║  Features:                                                         ║
║    - Custom session store with TTL and event hooks                 ║
║    - Automatic sweeper (15s interval, 80% cap threshold)           ║
║    - Session monitoring and manual settlement                      ║
╚════════════════════════════════════════════════════════════════════╝
`);
