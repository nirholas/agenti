/**
 * Upto Module Factory
 *
 * Creates an injectable upto module with configurable session store.
 * This allows users to provide custom store implementations (Redis, PostgreSQL, etc.)
 * instead of being locked into the in-memory default.
 *
 * @example
 * ```typescript
 * import { createUptoModule, InMemoryUptoSessionStore } from "@daydreamsai/facilitator/upto";
 *
 * // Default in-memory store
 * const upto = createUptoModule({ facilitatorClient });
 *
 * // Custom Redis store
 * const redisStore = new RedisUptoSessionStore(redisClient);
 * const upto = createUptoModule({
 *   store: redisStore,
 *   facilitatorClient,
 *   sweeperConfig: { intervalMs: 15_000, idleSettleMs: 60_000 },
 * });
 *
 * // Use in Elysia app
 * app.use(upto.createSweeper());
 *
 * // Access store for session management
 * const session = upto.store.get(sessionId);
 * ```
 */

import { InMemoryUptoSessionStore, type UptoSessionStore } from "./store.js";
import { createUptoSweeper, type UptoSweeperConfig } from "./sweeper.js";
import { settleUptoSession, type UptoFacilitatorClient } from "./settlement.js";

type UptoSweeperOverrides = Omit<
  UptoSweeperConfig,
  "store" | "facilitatorClient"
>;

export interface UptoModuleConfig {
  /**
   * Session store implementation.
   * Defaults to InMemoryUptoSessionStore if not provided.
   *
   * Implement UptoSessionStore interface for custom persistence:
   * - RedisUptoSessionStore for distributed deployments
   * - PostgresUptoSessionStore for durable persistence
   */
  store?: UptoSessionStore;

  /**
   * Facilitator client for settling payments.
   * Required for settlement and optional sweeping.
   */
  facilitatorClient: UptoFacilitatorClient;

  /**
   * Default sweeper configuration (optional).
   * Use this to control sweep cadence and thresholds.
   * Also supports settling timeout and optional distributed lock.
   */
  sweeperConfig?: UptoSweeperOverrides;

  /**
   * Enable automatic sweeper usage in middleware.
   * Defaults to false; set to true to auto-attach in middleware.
   */
  autoSweeper?: boolean;

  /**
   * Enable automatic upto session tracking in middleware.
   * Defaults to true.
   */
  autoTrack?: boolean;
}

export interface UptoModule {
  /**
   * The session store instance.
   * Use this to manage sessions (get, set, delete).
   */
  store: UptoSessionStore;

  /**
   * Optional sweeper instance if created.
   */
  sweeper?: ReturnType<typeof createUptoSweeper>;

  /**
   * Whether middleware should auto-attach the sweeper.
   */
  autoSweeper: boolean;

  /**
   * Whether middleware should auto-track upto sessions.
   */
  autoTrack: boolean;

  /**
   * Create (or reuse) an Elysia sweeper plugin for automatic settlement.
   */
  createSweeper: (
    overrides?: UptoSweeperOverrides
  ) => ReturnType<typeof createUptoSweeper>;

  /**
   * Manually settle a session.
   * Useful for immediate settlement outside of the sweeper cycle.
   */
  settleSession: (
    sessionId: string,
    reason: string,
    closeAfter?: boolean
  ) => Promise<void>;
}

/**
 * Creates an upto module with injectable dependencies.
 *
 * This factory enables:
 * - Custom session store implementations for production scaling
 * - Explicit sweeper creation when needed
 * - Testable components with mock dependencies
 */
export function createUptoModule(config: UptoModuleConfig): UptoModule {
  const store = config.store ?? new InMemoryUptoSessionStore();
  let sweeper: ReturnType<typeof createUptoSweeper> | undefined;
  const autoSweeper = config.autoSweeper ?? false;
  const autoTrack = config.autoTrack ?? true;

  const settleSession = async (
    sessionId: string,
    reason: string,
    closeAfter = false
  ) => {
    await settleUptoSession(
      store,
      config.facilitatorClient,
      sessionId,
      reason,
      closeAfter
    );
  };

  const createSweeper = (overrides?: UptoSweeperOverrides) => {
    if (!sweeper) {
      const sweeperConfig = {
        ...(config.sweeperConfig ?? {}),
        ...(overrides ?? {}),
      };
      sweeper = createUptoSweeper({
        store,
        facilitatorClient: config.facilitatorClient,
        ...sweeperConfig,
      });
    }

    return sweeper;
  };

  return {
    store,
    autoTrack,
    autoSweeper,
    createSweeper,
    get sweeper() {
      return sweeper;
    },
    settleSession,
  };
}
