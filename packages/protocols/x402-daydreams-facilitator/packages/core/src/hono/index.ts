/**
 * @daydreamsai/facilitator/hono - Hono middleware for x402 payments
 *
 * Provides a plug-and-play Hono middleware that handles payment verification,
 * optional upto tracking, and settlement headers for x402-protected routes.
 *
 * @example
 * ```typescript
 * import { Hono } from "hono";
 * import { createHonoPaymentMiddleware } from "@daydreamsai/facilitator/hono";
 * import { createUptoModule } from "@daydreamsai/facilitator/upto";
 *
 * const app = new Hono();
 * const upto = createUptoModule({ facilitatorClient });
 *
 * app.use(
 *   "/api/*",
 *   createHonoPaymentMiddleware({
 *     resourceServer,
 *     routes,
 *     upto,
 *   })
 * );
 *
 * app.get("/api/premium", (c) => {
 *   const x402 = c.get("x402");
 *   return c.json({ status: x402?.result.type });
 * });
 * ```
 */

export {
  createHonoPaymentMiddleware,
  getHttpServer,
  initializeHttpServer,
  type HonoPaymentState,
  type HonoPaymentMiddlewareConfig,
} from "./middleware.js";

export {
  createPaidRoutes,
  createHonoPaidRoutes,
  type PaidRoutes,
  type PaidRoutesOptions,
  type PaidRouteOptions,
  type HonoPaidRoutes,
  type HonoPaidRoutesOptions,
} from "./paidRoutes.js";
