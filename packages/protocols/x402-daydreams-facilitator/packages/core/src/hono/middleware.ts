import type { Context, MiddlewareHandler } from "hono";
import type { HTTPAdapter } from "@x402/core/http";

import {
  type PaymentState,
  type BasePaymentMiddlewareConfig,
  type PaywallConfig,
  type ResourceTrackingModule,
  DEFAULT_PAYMENT_HEADER_ALIASES,
  isUptoModule,
  normalizePathCandidate,
  resolveUrl,
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

export interface HonoPaymentState extends PaymentState {
  /** Request start time for response time calculation */
  __startTimeMs?: number;
}

export interface HonoPaymentMiddlewareConfig extends BasePaymentMiddlewareConfig {
  paywallConfig?:
    | PaywallConfig
    | ((ctx: { request: Request }) => PaywallConfig | Promise<PaywallConfig>);
}

declare module "hono" {
  interface ContextVariableMap {
    x402: HonoPaymentState | null;
  }
}

// -----------------------------------------------------------------------------
// Hono-specific Utilities
// -----------------------------------------------------------------------------

function createAdapter(
  c: Context,
  paymentHeaderAliases: string[],
  cachedBody: unknown
): HTTPAdapter {
  const request = c.req.raw;
  const url = resolveUrl(request.url);
  const adapterPath = c.req.path || url.pathname;
  const queryParams = parseQueryParams(url);

  return {
    getHeader: (name) =>
      resolveHeaderWithAliases(
        (n) => request.headers.get(n),
        name,
        paymentHeaderAliases
      ),
    getMethod: () => request.method,
    getPath: () => normalizePathCandidate(adapterPath),
    getUrl: () => request.url,
    getAcceptHeader: () => request.headers.get("accept") ?? "",
    getUserAgent: () => request.headers.get("user-agent") ?? "",
    getQueryParams: () => queryParams,
    getQueryParam: (name) => queryParams[name],
    getBody: () => cachedBody,
  };
}

// -----------------------------------------------------------------------------
// Middleware Factory
// -----------------------------------------------------------------------------

export function createHonoPaymentMiddleware(
  config: HonoPaymentMiddlewareConfig
): MiddlewareHandler {
  const httpServer = resolveHttpServer(config, "Hono");
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

  return async (c, next) => {
    const startTimeMs = Date.now();

    if (!initialized) {
      await httpServer.initialize();
      initialized = true;
    }

    c.set("x402", null);

    let cachedBody: unknown = undefined;
    try {
      cachedBody = await c.req.parseBody();
    } catch {
      cachedBody = undefined;
    }

    const adapter = createAdapter(c, paymentHeaderAliases, cachedBody);
    const paywallConfig = await resolvePaywallConfig(config.paywallConfig, {
      request: c.req.raw,
    });

    const result = await processBeforeHandle({
      httpServer,
      adapter,
      paywallConfig,
      uptoModule,
      autoTrack,
      resourceTracking,
    });

    c.set("x402", { ...result.state, __startTimeMs: startTimeMs });

    if (result.action === "error") {
      const afterResult = await processAfterHandle({
        httpServer,
        state: c.get("x402"),
        autoSettle,
        resourceTracking,
        responseStatus: result.status,
        startTimeMs: c.get("x402")?.__startTimeMs,
        handlerExecuted: false,
      });

      const headers = new Headers();
      for (const [key, value] of Object.entries(result.headers)) {
        headers.set(key, value);
      }
      for (const [key, value] of Object.entries(afterResult.headers)) {
        headers.set(key, value);
      }
      if (result.isHtml) {
        return c.html(result.body as string, {
          status: result.status as 402,
          headers,
        });
      }
      return c.json(result.body, {
        status: result.status as 402,
        headers,
      });
    }

    if (result.action === "tracking-error") {
      const afterResult = await processAfterHandle({
        httpServer,
        state: c.get("x402"),
        autoSettle,
        resourceTracking,
        responseStatus: result.status,
        startTimeMs: c.get("x402")?.__startTimeMs,
        handlerExecuted: false,
      });
      for (const [key, value] of Object.entries(afterResult.headers)) {
        c.header(key, value);
      }
      return c.json(result.body, {
        status: result.status as 400,
      });
    }

    await next();

    const state = c.get("x402");
    const afterResult = await processAfterHandle({
      httpServer,
      state,
      autoSettle,
      resourceTracking,
      responseStatus: c.res.status,
      startTimeMs: state?.__startTimeMs,
    });

    for (const [key, value] of Object.entries(afterResult.headers)) {
      c.header(key, value);
    }
  };
}

// -----------------------------------------------------------------------------
// Utility Exports
// -----------------------------------------------------------------------------

export function getHttpServer(
  config: HonoPaymentMiddlewareConfig
): x402HTTPResourceServer {
  return resolveHttpServer(config, "Hono");
}

export async function initializeHttpServer(
  config: HonoPaymentMiddlewareConfig
): Promise<x402HTTPResourceServer> {
  const httpServer = resolveHttpServer(config, "Hono");
  await httpServer.initialize();
  return httpServer;
}
