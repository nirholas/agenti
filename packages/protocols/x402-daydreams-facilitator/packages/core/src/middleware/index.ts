/**
 * @daydreamsai/facilitator/middleware - Shared middleware core
 *
 * This module provides the shared utilities and processing logic used by
 * all framework-specific middleware implementations (Elysia, Hono, Express).
 *
 * Most users should import from the framework-specific modules instead:
 * - @daydreamsai/facilitator/elysia
 * - @daydreamsai/facilitator/hono
 * - @daydreamsai/facilitator/express
 */

export {
  // Types
  type PaymentState,
  type BasePaymentMiddlewareConfig,
  type BeforeHandleResult,
  type AfterHandleResult,
  type ProcessBeforeHandleOptions,
  type ProcessAfterHandleOptions,

  // Constants
  DEFAULT_PAYMENT_HEADER_ALIASES,

  // Utilities
  isUptoModule,
  normalizePathCandidate,
  resolveUrl,
  parseQueryParams,
  resolveHeaderWithAliases,
  resolveRoutes,
  resolveHttpServer,
  resolvePaywallConfig,

  // Core processing
  processBeforeHandle,
  processAfterHandle,

  // Re-exports
  x402HTTPResourceServer,
  trackUptoPayment,
  TRACKING_ERROR_MESSAGES,
  TRACKING_ERROR_STATUS,
  type TrackingResult,
  type UptoModule,
  type HTTPAdapter,
  type HTTPProcessResult,
  type PaywallConfig,
  type PaywallProvider,
  type RoutesConfig,
  type x402ResourceServer,
  type FacilitatorClient,
} from "./core.js";
