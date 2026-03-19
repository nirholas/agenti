/**
 * @daydreamsai/facilitator/express - Express middleware for x402 payments
 *
 * Provides a plug-and-play Express middleware that handles payment verification,
 * optional upto tracking, and settlement headers for x402-protected routes.
 *
 * @example
 * ```typescript
 * import express from "express";
 * import { createExpressPaymentMiddleware } from "@daydreamsai/facilitator/express";
 * import { createUptoModule } from "@daydreamsai/facilitator/upto";
 *
 * const app = express();
 * const upto = createUptoModule({ facilitatorClient });
 *
 * app.use(
 *   "/api",
 *   createExpressPaymentMiddleware({
 *     resourceServer,
 *     routes,
 *     upto,
 *   })
 * );
 *
 * app.get("/api/premium", (req, res) => {
 *   const x402 = req.x402;
 *   res.json({ status: x402?.result.type });
 * });
 * ```
 */

export {
  createExpressPaymentMiddleware,
  getHttpServer,
  initializeHttpServer,
  type ExpressPaymentState,
  type ExpressPaymentMiddlewareConfig,
} from "./middleware.js";

export {
  createPaidRoutes,
  createExpressPaidRoutes,
  type PaidRoutes,
  type PaidRoutesOptions,
  type PaidRouteOptions,
  type ExpressPaidRoutes,
  type ExpressPaidRoutesOptions,
} from "./paidRoutes.js";
