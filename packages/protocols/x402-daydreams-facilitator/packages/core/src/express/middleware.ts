import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { HTTPAdapter } from "@x402/core/http";

import {
  type PaymentState,
  type BasePaymentMiddlewareConfig,
  type PaywallConfig,
  type ResourceTrackingModule,
  DEFAULT_PAYMENT_HEADER_ALIASES,
  isUptoModule,
  normalizePathCandidate,
  parseQueryParams,
  resolveHeaderWithAliases,
  resolveHttpServer,
  resolvePaywallConfig,
  processBeforeHandle,
  processAfterHandle,
  x402HTTPResourceServer,
} from "../middleware/core.js";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ExpressPaymentState extends PaymentState {
  /** Request start time for response time calculation */
  __startTimeMs?: number;
}

export interface ExpressPaymentMiddlewareConfig extends BasePaymentMiddlewareConfig {
  paywallConfig?:
    | PaywallConfig
    | ((req: Request) => PaywallConfig | Promise<PaywallConfig>);
}

declare global {
  namespace Express {
    interface Request {
      x402?: ExpressPaymentState | null;
    }
  }
}

// -----------------------------------------------------------------------------
// Express-specific Utilities
// -----------------------------------------------------------------------------

function createAdapter(
  req: Request,
  paymentHeaderAliases: string[]
): HTTPAdapter {
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost";
  const url = new URL(req.originalUrl || req.url, `${protocol}://${host}`);
  const adapterPath = req.path || url.pathname;
  const queryParams = parseQueryParams(url);

  return {
    getHeader: (name) =>
      resolveHeaderWithAliases(
        (n) => req.get(n),
        name,
        paymentHeaderAliases
      ),
    getMethod: () => req.method,
    getPath: () => normalizePathCandidate(adapterPath),
    getUrl: () => url.toString(),
    getAcceptHeader: () => req.get("accept") ?? "",
    getUserAgent: () => req.get("user-agent") ?? "",
    getQueryParams: () => queryParams,
    getQueryParam: (name) => queryParams[name],
    getBody: () => req.body,
  };
}

// -----------------------------------------------------------------------------
// Middleware Factory
// -----------------------------------------------------------------------------

export function createExpressPaymentMiddleware(
  config: ExpressPaymentMiddlewareConfig
): RequestHandler {
  const httpServer = resolveHttpServer(config, "Express");
  const paymentHeaderAliases =
    config.paymentHeaderAliases ?? DEFAULT_PAYMENT_HEADER_ALIASES;
  const autoSettle = config.autoSettle ?? true;
  const uptoModule = config.upto;
  const resourceTracking = config.resourceTracking;

  if (config.upto !== undefined && !isUptoModule(config.upto)) {
    throw new Error("Upto middleware requires an upto module.");
  }

  const autoTrack = Boolean(uptoModule?.autoTrack);

  if (config.paywallProvider) {
    httpServer.registerPaywallProvider(config.paywallProvider);
  }

  let initialized = false;

  return async (req: Request, res: Response, next: NextFunction) => {
    const startTimeMs = Date.now();

    try {
      if (!initialized) {
        await httpServer.initialize();
        initialized = true;
      }

      req.x402 = null;

      const adapter = createAdapter(req, paymentHeaderAliases);
      const paywallConfig = await resolvePaywallConfig(config.paywallConfig, req);

      const result = await processBeforeHandle({
        httpServer,
        adapter,
        paywallConfig,
        uptoModule,
        autoTrack,
        resourceTracking,
      });

      req.x402 = { ...result.state, __startTimeMs: startTimeMs };

      const finalizeEarly = async (status: number) => {
        const afterResult = await processAfterHandle({
          httpServer,
          state: req.x402,
          autoSettle,
          resourceTracking,
          responseStatus: status,
          startTimeMs: req.x402?.__startTimeMs,
          handlerExecuted: false,
        });

        for (const [key, value] of Object.entries(afterResult.headers)) {
          res.setHeader(key, value);
        }
      };

      if (result.action === "error") {
        await finalizeEarly(result.status);
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, value);
        }
        if (result.isHtml) {
          res.setHeader("content-type", "text/html");
          res.status(result.status).send(result.body);
        } else {
          res.status(result.status).json(result.body);
        }
        return;
      }

      if (result.action === "tracking-error") {
        await finalizeEarly(result.status);
        res.status(result.status).json(result.body);
        return;
      }

      // Intercept response to add settlement headers after handler completes
      const originalSend = res.send.bind(res);
      let settlementHandled = false;

      const handleAfterResponse = async () => {
        if (settlementHandled) return;
        settlementHandled = true;

        const afterResult = await processAfterHandle({
          httpServer,
          state: req.x402,
          autoSettle,
          resourceTracking,
          responseStatus: res.statusCode,
          startTimeMs: req.x402?.__startTimeMs,
        });

        for (const [key, value] of Object.entries(afterResult.headers)) {
          res.setHeader(key, value);
        }
      };

      // Override res.send to inject settlement before sending
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.send = function (body?: any) {
        handleAfterResponse()
          .then(() => originalSend(body))
          .catch(() => originalSend(body));
        return res;
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

// -----------------------------------------------------------------------------
// Utility Exports
// -----------------------------------------------------------------------------

export function getHttpServer(
  config: ExpressPaymentMiddlewareConfig
): x402HTTPResourceServer {
  return resolveHttpServer(config, "Express");
}

export async function initializeHttpServer(
  config: ExpressPaymentMiddlewareConfig
): Promise<x402HTTPResourceServer> {
  const httpServer = resolveHttpServer(config, "Express");
  await httpServer.initialize();
  return httpServer;
}
