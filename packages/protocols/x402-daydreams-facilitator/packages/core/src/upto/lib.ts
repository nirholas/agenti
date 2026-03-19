/**
 * @daydreamsai/facilitator/upto - Upto (batched payment) scheme components
 *
 * This module exports components for implementing the "upto" payment scheme,
 * which allows batched payments with a pre-authorized spending cap.
 *
 * @example
 * ```typescript
 * import {
 *   createUptoModule,
 *   trackUptoPayment,
 *   generateSessionId,
 * } from "@daydreamsai/facilitator/upto";
 *
 * // Create module with default in-memory store
 * const upto = createUptoModule({
 *   facilitatorClient,
 *   sweeperConfig: { intervalMs: 30_000 },
 * });
 * app.use(upto.createSweeper());
 *
 * // Track payments
 * const result = await trackUptoPayment(
 *   upto.store,
 *   paymentPayload,
 *   requirements
 * );
 * if (result.success) {
 *   console.log(`Tracked payment in session ${result.sessionId}`);
 * }
 * ```
 */

// Module factory (preferred API)
export {
  createUptoModule,
  type UptoModule,
  type UptoModuleConfig,
} from "./module.js";

// Session store
export {
  InMemoryUptoSessionStore,
  type UptoSessionStore,
  type UptoSession,
  type UptoSessionStatus,
} from "./store.js";

// Redis session store + sweeper lock
export {
  RedisUptoSessionStore,
  createRedisSweeperLock,
  type RedisClientLike,
  type RedisUptoSessionStoreOptions,
  type RedisSweeperLockOptions,
} from "./redis-store.js";

// Session ID generation
export {
  generateSessionId,
  extractUptoAuthorization,
  type UptoAuthorization,
} from "./sessionId.js";

// Session tracking helpers
export {
  trackUptoPayment,
  formatSession,
  TRACKING_ERROR_MESSAGES,
  TRACKING_ERROR_STATUS,
  type TrackingResult,
  type TrackingError,
} from "./tracking.js";

// Settlement
export { settleUptoSession, type UptoFacilitatorClient } from "./settlement.js";

// Sweeper (Elysia plugin for auto-settlement)
export {
  createUptoSweeper,
  type UptoSweeperConfig,
  type UptoSweeperLock,
} from "./sweeper.js";
