import { Elysia } from "elysia";
import type { HTTPAdapter } from "@x402/core/http";

import {
  type PaymentState,
  type BasePaymentMiddlewareConfig,
  type PaywallConfig,
  type UptoModule,
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

export interface ElysiaPaymentState extends PaymentState {
  /** Request start time for response time calculation */
  __startTimeMs?: number;
}

export type ElysiaPaymentMiddlewareConfig = BasePaymentMiddlewareConfig & {
  scope?: "local" | "scoped" | "global";
  pluginName?: string;
  pluginSeed?: unknown;
  paywallConfig?:
    | PaywallConfig
    | ((ctx: { request: Request }) => PaywallConfig | Promise<PaywallConfig>);
  syncFacilitatorOnStart?: boolean;
};

const DEFAULT_PLUGIN_NAME = "x402-elysia-payments";
type HeaderValue = string | number;
type HeaderRecord = Record<string, HeaderValue>;

// -----------------------------------------------------------------------------
// Elysia-specific Utilities
// -----------------------------------------------------------------------------

function mergeHeaders(
  current: HeaderRecord | undefined,
  next: HeaderRecord
): HeaderRecord {
  return { ...(current ?? {}), ...next };
}

type ElysiaRequestContext = {
  request: Request;
  body: unknown;
  path?: string;
  route?: string;
};

function createAdapter(
  ctx: ElysiaRequestContext,
  paymentHeaderAliases: string[]
): HTTPAdapter {
  const url = resolveUrl(ctx.request.url);
  const adapterPath =
    typeof ctx.path === "string" && ctx.path.length > 0
      ? normalizePathCandidate(ctx.path)
      : url.pathname;
  const queryParams = parseQueryParams(url);

  return {
    getHeader: (name) =>
      resolveHeaderWithAliases(
        (n) => ctx.request.headers.get(n),
        name,
        paymentHeaderAliases
      ),
    getMethod: () => ctx.request.method,
    getPath: () => adapterPath,
    getUrl: () => ctx.request.url,
    getAcceptHeader: () => ctx.request.headers.get("accept") ?? "",
    getUserAgent: () => ctx.request.headers.get("user-agent") ?? "",
    getQueryParams: () => queryParams,
    getQueryParam: (name) => queryParams[name],
    getBody: () => ctx.body,
  };
}

// -----------------------------------------------------------------------------
// Middleware Factory
// -----------------------------------------------------------------------------

export function createElysiaPaymentMiddleware(
  config: ElysiaPaymentMiddlewareConfig
) {
  let httpServer: x402HTTPResourceServer | undefined;

  const getHttpServer = (): x402HTTPResourceServer => {
    if (!httpServer) {
      httpServer = resolveHttpServer(config, "Elysia");
      if (config.paywallProvider) {
        httpServer.registerPaywallProvider(config.paywallProvider);
      }
    }
    return httpServer;
  };

  const paymentHeaderAliases =
    config.paymentHeaderAliases ?? DEFAULT_PAYMENT_HEADER_ALIASES;
  const autoSettle = config.autoSettle ?? true;
  const scope = config.scope ?? "scoped";
  const pluginName = config.pluginName ?? DEFAULT_PLUGIN_NAME;
  const uptoModule = config.upto;
  const resourceTracking = config.resourceTracking;

  if (config.upto !== undefined && !isUptoModule(config.upto)) {
    throw new Error("Upto middleware requires an upto module.");
  }

  const sweeperEnabled = Boolean(uptoModule?.autoSweeper);
  const autoTrack = Boolean(uptoModule?.autoTrack);

  const app = new Elysia({
    name: pluginName,
    ...(config.pluginSeed !== undefined ? { seed: config.pluginSeed } : {}),
  }).decorate("x402", null as ElysiaPaymentState | null);

  if (sweeperEnabled) {
    if (uptoModule?.sweeper) {
      app.use(uptoModule.sweeper);
    } else if (uptoModule?.createSweeper) {
      app.use(uptoModule.createSweeper());
    }
  }

  if (config.syncFacilitatorOnStart ?? true) {
    app.onStart(async () => {
      await getHttpServer().initialize();
    });
  }

  app.onBeforeHandle({ as: scope }, async (ctx) => {
    const startTimeMs = Date.now();
    const server = getHttpServer();
    const adapter = createAdapter(ctx, paymentHeaderAliases);
    const paywallConfig = await resolvePaywallConfig(config.paywallConfig, ctx);

    const result = await processBeforeHandle({
      httpServer: server,
      adapter,
      paywallConfig,
      uptoModule,
      autoTrack,
      resourceTracking,
    });

    ctx.x402 = { ...result.state, __startTimeMs: startTimeMs };

    if (result.action === "error") {
      const afterResult = await processAfterHandle({
        httpServer: server,
        state: ctx.x402,
        autoSettle,
        resourceTracking,
        responseStatus: result.status,
        startTimeMs: ctx.x402?.__startTimeMs,
        handlerExecuted: false,
      });
      if (result.isHtml) {
        return new Response(result.body as string, {
          status: result.status,
          headers: {
            ...result.headers,
            ...afterResult.headers,
            "content-type": "text/html; charset=utf-8",
          },
        });
      }
      ctx.set.status = result.status;
      ctx.set.headers = mergeHeaders(
        ctx.set.headers,
        mergeHeaders(result.headers, afterResult.headers)
      );
      return result.body;
    }

    if (result.action === "tracking-error") {
      const afterResult = await processAfterHandle({
        httpServer: server,
        state: ctx.x402,
        autoSettle,
        resourceTracking,
        responseStatus: result.status,
        startTimeMs: ctx.x402?.__startTimeMs,
        handlerExecuted: false,
      });
      ctx.set.status = result.status;
      ctx.set.headers = mergeHeaders(
        ctx.set.headers,
        mergeHeaders(
          {
            "content-type": "application/json",
          },
          afterResult.headers
        )
      );
      return result.body;
    }
  });

  app.onAfterHandle({ as: scope }, async (ctx) => {
    const server = getHttpServer();
    const afterResult = await processAfterHandle({
      httpServer: server,
      state: ctx.x402,
      autoSettle,
      resourceTracking,
      responseStatus: typeof ctx.set.status === "number" ? ctx.set.status : 200,
      startTimeMs: ctx.x402?.__startTimeMs,
    });

    if (Object.keys(afterResult.headers).length > 0) {
      ctx.set.headers = mergeHeaders(ctx.set.headers, afterResult.headers);
    }
  });

  return app;
}
