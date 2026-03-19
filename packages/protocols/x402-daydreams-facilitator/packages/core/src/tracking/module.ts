/**
 * Resource Tracking Module Factory
 *
 * Creates a configured ResourceTrackingModule for tracking payment settlements.
 * Follows the same pattern as createUptoModule for consistency.
 */

import type {
  ResourceCallRecord,
  TrackedPayment,
  TrackedSettlement,
  TrackedUptoSession,
  TrackedRequest,
  TrackedRouteConfig,
  ListOptions,
  ListResult,
  TrackingStats,
} from "./types.js";
import type { ResourceTrackingStore } from "./store.js";
import { InMemoryResourceTrackingStore } from "./store.js";
import { generateTrackingId } from "./helpers.js";

/**
 * Configuration for createResourceTrackingModule
 */
export interface ResourceTrackingModuleConfig {
  /**
   * Store implementation. Defaults to InMemoryResourceTrackingStore.
   * Use PostgresResourceTrackingStore for production.
   */
  store?: ResourceTrackingStore;

  /**
   * Enable async fire-and-forget tracking (default: true).
   * When true, tracking errors don't block responses.
   */
  asyncTracking?: boolean;

  /**
   * Additional headers to capture (beyond defaults).
   * Header names are case-insensitive.
   */
  captureHeaders?: string[];

  /**
   * Callback for tracking errors (for logging/alerting).
   */
  onTrackingError?: (error: Error, recordId: string) => void;

  /**
   * Auto-prune records older than N days (0 = disabled).
   * Only works with stores that support prune().
   */
  autoPruneDays?: number;
}

/**
 * Context for starting a new tracking record
 */
export interface TrackingContext {
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Full URL */
  url: string;
  /** Request metadata */
  request: TrackedRequest;
  /** Route configuration */
  routeConfig?: TrackedRouteConfig;
  /** Was payment required for this route? */
  paymentRequired: boolean;
  /** Custom metadata to attach */
  metadata?: Record<string, unknown>;
}

/**
 * Resource tracking module interface
 */
export interface ResourceTrackingModule {
  /**
   * The underlying store instance
   */
  readonly store: ResourceTrackingStore;

  /**
   * Headers to capture from requests
   */
  readonly captureHeaders: string[];

  /**
   * Track a new resource call (called at request start)
   * @returns Tracking ID for subsequent updates
   */
  startTracking(context: TrackingContext): Promise<string>;

  /**
   * Update tracking with request-level details
   */
  recordRequest(
    id: string,
    updates: Partial<Pick<ResourceCallRecord, "paymentRequired" | "routeConfig">>
  ): Promise<void>;

  /**
   * Update tracking with payment verification result
   */
  recordVerification(
    id: string,
    verified: boolean,
    payment?: TrackedPayment,
    error?: string,
    x402Audit?: Partial<
      Pick<
        ResourceCallRecord,
        | "x402Version"
        | "paymentNonce"
        | "paymentValidBefore"
        | "payloadHash"
        | "requirementsHash"
        | "paymentSignatureHash"
      >
    >
  ): Promise<void>;

  /**
   * Update tracking with settlement result
   */
  recordSettlement(id: string, settlement: TrackedSettlement): Promise<void>;

  /**
   * Update tracking with upto session info
   */
  recordUptoSession(id: string, session: TrackedUptoSession): Promise<void>;

  /**
   * Finalize tracking with response info (called at response end)
   */
  finalizeTracking(
    id: string,
    responseStatus: number,
    responseTimeMs: number,
    handlerExecuted: boolean
  ): Promise<void>;

  /**
   * Query records with pagination
   */
  list(options?: ListOptions): Promise<ListResult>;

  /**
   * Get aggregated statistics for a time period
   */
  getStats(startTime: Date, endTime: Date): Promise<TrackingStats>;

  /**
   * Get a specific record by ID
   */
  get(id: string): Promise<ResourceCallRecord | undefined>;

  /**
   * Manually prune old records
   */
  prune(olderThan: Date): Promise<number>;

  /**
   * Stop any configured auto-prune background timer
   */
  stopAutoPrune(): void;
}

/**
 * Creates a configured ResourceTrackingModule.
 *
 * @example
 * ```typescript
 * // Development: in-memory store
 * const tracking = createResourceTrackingModule();
 *
 * // Production: Postgres store
 * const tracking = createResourceTrackingModule({
 *   store: new PostgresResourceTrackingStore(pgClient),
 *   asyncTracking: true,
 *   onTrackingError: (err, id) => console.error(`Tracking error ${id}:`, err),
 * });
 * ```
 */
export function createResourceTrackingModule(
  config: ResourceTrackingModuleConfig = {}
): ResourceTrackingModule {
  const store = config.store ?? new InMemoryResourceTrackingStore();
  const asyncTracking = config.asyncTracking ?? true;
  const captureHeaders = config.captureHeaders ?? [];
  const onTrackingError = config.onTrackingError;
  const operationQueues = new Map<string, Promise<void>>();

  const enqueueTrackingOperation = (
    recordId: string,
    fn: () => Promise<void>
  ): Promise<void> => {
    const previous = operationQueues.get(recordId) ?? Promise.resolve();
    const run = previous.then(fn);
    const queue = run.catch(() => {
      // Keep queue alive after individual operation failures.
    });

    operationQueues.set(recordId, queue);
    queue.finally(() => {
      if (operationQueues.get(recordId) === queue) {
        operationQueues.delete(recordId);
      }
    });

    return run;
  };

  /**
   * Execute tracking operation with error handling
   */
  const safeTrack = async (
    fn: () => Promise<void>,
    recordId: string
  ): Promise<void> => {
    const operation = enqueueTrackingOperation(recordId, fn);

    if (asyncTracking) {
      // Fire-and-forget: don't await request path, but keep per-record ordering.
      operation.catch((err) => {
        onTrackingError?.(err as Error, recordId);
      });
    } else {
      // Synchronous: await and propagate errors
      try {
        await operation;
      } catch (err) {
        onTrackingError?.(err as Error, recordId);
        throw err;
      }
    }
  };

  let pruneTimer: ReturnType<typeof setInterval> | undefined;

  // Set up auto-pruning if configured
  if (config.autoPruneDays && config.autoPruneDays > 0) {
    const pruneIntervalMs = 24 * 60 * 60 * 1000; // Daily
    const pruneAgeDays = config.autoPruneDays;

    pruneTimer = setInterval(() => {
      const olderThan = new Date(Date.now() - pruneAgeDays * 24 * 60 * 60 * 1000);
      Promise.resolve(store.prune(olderThan)).catch((err) => {
        onTrackingError?.(err as Error, "auto-prune");
      });
    }, pruneIntervalMs);

    const timer = pruneTimer as { unref?: () => void };
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }

  return {
    store,
    captureHeaders,
    stopAutoPrune() {
      if (pruneTimer) {
        clearInterval(pruneTimer);
        pruneTimer = undefined;
      }
    },

    async startTracking(context: TrackingContext): Promise<string> {
      const id = generateTrackingId();

      const record: ResourceCallRecord = {
        id,
        method: context.method,
        path: context.path,
        routeKey: `${context.method} ${context.path}`,
        url: context.url,
        timestamp: new Date(),
        paymentRequired: context.paymentRequired,
        paymentVerified: false,
        responseStatus: 0,
        responseTimeMs: 0,
        handlerExecuted: false,
        request: context.request,
        routeConfig: context.routeConfig,
        metadata: context.metadata,
      };

      await safeTrack(async () => {
        await Promise.resolve(store.create(record));
      }, id);

      return id;
    },

    async recordRequest(
      id: string,
      updates: Partial<Pick<ResourceCallRecord, "paymentRequired" | "routeConfig">>
    ): Promise<void> {
      await safeTrack(async () => {
        await Promise.resolve(store.update(id, updates));
      }, id);
    },

    async recordVerification(
      id: string,
      verified: boolean,
      payment?: TrackedPayment,
      error?: string,
      x402Audit?: Partial<
        Pick<
          ResourceCallRecord,
          | "x402Version"
          | "paymentNonce"
          | "paymentValidBefore"
          | "payloadHash"
          | "requirementsHash"
          | "paymentSignatureHash"
        >
      >
    ): Promise<void> {
      await safeTrack(async () => {
        await Promise.resolve(
          store.update(id, {
            paymentVerified: verified,
            payment,
            verificationError: error,
            ...x402Audit,
          })
        );
      }, id);
    },

    async recordSettlement(
      id: string,
      settlement: TrackedSettlement
    ): Promise<void> {
      await safeTrack(async () => {
        await Promise.resolve(store.update(id, { settlement }));
      }, id);
    },

    async recordUptoSession(
      id: string,
      session: TrackedUptoSession
    ): Promise<void> {
      await safeTrack(async () => {
        await Promise.resolve(store.update(id, { uptoSession: session }));
      }, id);
    },

    async finalizeTracking(
      id: string,
      responseStatus: number,
      responseTimeMs: number,
      handlerExecuted: boolean
    ): Promise<void> {
      await safeTrack(async () => {
        await Promise.resolve(
          store.update(id, {
            responseStatus,
            responseTimeMs,
            handlerExecuted,
          })
        );
      }, id);
    },

    async list(options?: ListOptions): Promise<ListResult> {
      return Promise.resolve(store.list(options ?? {}));
    },

    async getStats(startTime: Date, endTime: Date): Promise<TrackingStats> {
      return Promise.resolve(store.getStats(startTime, endTime));
    },

    async get(id: string): Promise<ResourceCallRecord | undefined> {
      return Promise.resolve(store.get(id));
    },

    async prune(olderThan: Date): Promise<number> {
      return Promise.resolve(store.prune(olderThan));
    },
  };
}
