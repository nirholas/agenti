/**
 * @daydreamsai/facilitator/elysia - Elysia middleware for x402 payments
 *
 * Provides a plug-and-play Elysia plugin that handles payment verification,
 * optional upto tracking, and settlement headers for x402-protected routes.
 *
 * @example
 * ```typescript
 * import { createElysiaPaymentMiddleware } from "@daydreamsai/facilitator/elysia";
 * import { createUptoModule } from "@daydreamsai/facilitator/upto";
 *
 * const upto = createUptoModule({
 *   facilitatorClient,
 *   sweeperConfig: { intervalMs: 30_000 },
 *   autoSweeper: true,
 * });
 *
 * app.use(
 *   createElysiaPaymentMiddleware({
 *     resourceServer,
 *     routes,
 *     upto,
 *   })
 * );
 * ```
 */

export {
  createElysiaPaymentMiddleware,
  type ElysiaPaymentState,
  type ElysiaPaymentMiddlewareConfig,
} from "./middleware.js";

export {
  createPaidRoutes,
  createElysiaPaidRoutes,
  type PaidRoutes,
  type PaidRoutesOptions,
  type PaidRouteHook,
  type ElysiaPaidRoutes,
  type ElysiaPaidRoutesOptions,
} from "./paidRoutes.js";
