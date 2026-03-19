/**
 * @daydreamsai/facilitator/tracking - Resource call tracking module
 *
 * Track 100% of payment settlements with full metadata capture,
 * persistent storage, and paginated API queries.
 *
 * @example
 * ```typescript
 * import {
 *   createResourceTrackingModule,
 *   InMemoryResourceTrackingStore,
 *   PostgresResourceTrackingStore,
 * } from "@daydreamsai/facilitator/tracking";
 *
 * // Development: in-memory store
 * const tracking = createResourceTrackingModule();
 *
 * // Production: Postgres store
 * const pgClient = {
 *   async query(sql, params) { ... },
 *   async queryOne(sql, params) { ... },
 *   async queryScalar(sql, params) { ... },
 * };
 * const tracking = createResourceTrackingModule({
 *   store: new PostgresResourceTrackingStore(pgClient),
 *   asyncTracking: true,
 *   onTrackingError: (err, id) => console.error(`Tracking error ${id}:`, err),
 * });
 *
 * // Query records
 * const result = await tracking.list({
 *   filters: { network: "eip155:8453", paymentVerified: true },
 *   limit: 50,
 * });
 *
 * // Get statistics
 * const stats = await tracking.getStats(
 *   new Date(Date.now() - 24 * 60 * 60 * 1000),
 *   new Date()
 * );
 * ```
 */

// Module factory (preferred API)
export {
  createResourceTrackingModule,
  type ResourceTrackingModule,
  type ResourceTrackingModuleConfig,
  type TrackingContext,
} from "./module.js";

// Store implementations
export {
  InMemoryResourceTrackingStore,
  type ResourceTrackingStore,
} from "./store.js";

export {
  PostgresResourceTrackingStore,
  POSTGRES_SCHEMA,
  type PostgresClientAdapter,
  type PostgresResourceTrackingStoreOptions,
  type QueryResultRow,
} from "./postgres-store.js";

// Types
export type {
  ResourceCallRecord,
  TrackedPayment,
  TrackedSettlement,
  TrackedUptoSession,
  TrackedRequest,
  TrackedRouteConfig,
  ListOptions,
  ListFilters,
  ListSort,
  ListResult,
  TrackingStats,
  MaybePromise,
} from "./types.js";

// Helper functions
export {
  extractPaymentDetails,
  extractRequestMetadata,
  extractRouteConfig,
  detectNetworkType,
  extractCurrency,
  extractPayer,
  formatAmount,
  extractX402AuditFields,
  hashCanonicalJson,
  generateTrackingId,
} from "./helpers.js";
