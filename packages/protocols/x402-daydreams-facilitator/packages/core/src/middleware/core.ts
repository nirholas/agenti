import {
  x402HTTPResourceServer,
  type HTTPAdapter,
  type HTTPProcessResult,
  type PaywallConfig,
  type PaywallProvider,
  type RoutesConfig,
} from "@x402/core/http";
import type { x402ResourceServer, FacilitatorClient } from "@x402/core/server";

import {
  trackUptoPayment,
  TRACKING_ERROR_MESSAGES,
  TRACKING_ERROR_STATUS,
  type TrackingResult,
  type UptoModule,
} from "../upto/lib.js";
import { createResourceServer, type ResourceServerConfig } from "../server.js";
import type { ResourceTrackingModule } from "../tracking/lib.js";
import {
  extractPaymentDetails,
  extractRequestMetadata,
  extractRouteConfig,
  extractX402AuditFields,
} from "../tracking/helpers.js";

// -----------------------------------------------------------------------------
// Shared Types
// -----------------------------------------------------------------------------

export interface PaymentState {
  result: HTTPProcessResult;
  tracking?: TrackingResult;
  /** Resource tracking ID for settlement tracking */
  resourceTrackingId?: string;
}

export interface BasePaymentMiddlewareConfig {
  httpServer?: x402HTTPResourceServer;
  resourceServer?: x402ResourceServer;
  facilitatorClient?: FacilitatorClient;
  routes?: RoutesConfig;
  routesResolver?: () => RoutesConfig;
  serverConfig?: ResourceServerConfig;
  paywallProvider?: PaywallProvider;
  paymentHeaderAliases?: string[];
  autoSettle?: boolean;
  upto?: UptoModule;
  /** Resource tracking module for settlement tracking */
  resourceTracking?: ResourceTrackingModule;
}

export const DEFAULT_PAYMENT_HEADER_ALIASES = ["x-payment"];

// -----------------------------------------------------------------------------
// Shared Utilities
// -----------------------------------------------------------------------------

export function isUptoModule(value: unknown): value is UptoModule {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as UptoModule).createSweeper === "function" &&
    typeof (value as UptoModule).settleSession === "function"
  );
}

export function normalizePathCandidate(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

export function resolveUrl(url: string): URL {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return new URL(url);
  }
  return new URL(url, "http://localhost");
}

export function parseQueryParams(url: URL): Record<string, string | string[]> {
  const queryParams: Record<string, string | string[]> = {};

  for (const [key, value] of url.searchParams.entries()) {
    const existing = queryParams[key];
    if (existing === undefined) {
      queryParams[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      queryParams[key] = [existing, value];
    }
  }

  return queryParams;
}

export function resolveHeaderWithAliases(
  getHeader: (name: string) => string | null | undefined,
  name: string,
  aliases: string[]
): string | undefined {
  const direct = getHeader(name);
  if (direct !== null && direct !== undefined) return direct;

  if (name.toLowerCase() === "payment-signature") {
    for (const alias of aliases) {
      const aliasValue = getHeader(alias);
      if (aliasValue !== null && aliasValue !== undefined) return aliasValue;
    }
  }

  return undefined;
}

// -----------------------------------------------------------------------------
// HTTP Server Resolution
// -----------------------------------------------------------------------------

export interface ResolveHttpServerOptions {
  frameworkName: string;
  config: BasePaymentMiddlewareConfig;
}

export function resolveRoutes(
  config: BasePaymentMiddlewareConfig,
  frameworkName: string
): RoutesConfig {
  if (config.routes) return config.routes;
  if (config.routesResolver) {
    const resolved = config.routesResolver();
    if (!resolved) {
      throw new Error(
        `${frameworkName} payment middleware requires routes from routesResolver.`
      );
    }
    return resolved;
  }
  throw new Error(`${frameworkName} payment middleware requires routes.`);
}

export function resolveHttpServer(
  config: BasePaymentMiddlewareConfig,
  frameworkName: string
): x402HTTPResourceServer {
  if (config.httpServer) return config.httpServer;

  const routes = resolveRoutes(config, frameworkName);

  const resourceServer =
    config.resourceServer ??
    (config.facilitatorClient
      ? createResourceServer(config.facilitatorClient, config.serverConfig)
      : undefined);

  if (!resourceServer) {
    throw new Error(
      `${frameworkName} payment middleware requires a resourceServer or facilitatorClient.`
    );
  }

  return new x402HTTPResourceServer(resourceServer, routes);
}

// -----------------------------------------------------------------------------
// Paywall Config Resolution
// -----------------------------------------------------------------------------

export async function resolvePaywallConfig<TContext>(
  source:
    | PaywallConfig
    | ((ctx: TContext) => PaywallConfig | Promise<PaywallConfig>)
    | undefined,
  ctx: TContext
): Promise<PaywallConfig | undefined> {
  if (!source) return undefined;
  if (typeof source === "function") {
    return source(ctx);
  }
  return source;
}

// -----------------------------------------------------------------------------
// Core Payment Processing
// -----------------------------------------------------------------------------

export type BeforeHandleResult =
  | { action: "continue"; state: PaymentState }
  | { action: "error"; state: PaymentState; status: number; headers: Record<string, string>; body: unknown; isHtml?: boolean }
  | { action: "tracking-error"; state: PaymentState; status: number; body: { error: string; message: string; sessionId: string } };

export interface ProcessBeforeHandleOptions {
  httpServer: x402HTTPResourceServer;
  adapter: HTTPAdapter;
  paywallConfig: PaywallConfig | undefined;
  uptoModule: UptoModule | undefined;
  autoTrack: boolean;
  /** Resource tracking module for settlement tracking */
  resourceTracking?: ResourceTrackingModule;
}

export async function processBeforeHandle(
  options: ProcessBeforeHandleOptions
): Promise<BeforeHandleResult> {
  const { httpServer, adapter, paywallConfig, uptoModule, autoTrack, resourceTracking } = options;
  const path = adapter.getPath();
  const method = adapter.getMethod();

  const safeTrack = async (fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch {
      // Best-effort tracking: never block the request
    }
  };

  // Start resource tracking if module is configured
  let resourceTrackingId: string | undefined;
  if (resourceTracking) {
    const captureHeaders = resourceTracking.captureHeaders ?? [];
    try {
      resourceTrackingId = await resourceTracking.startTracking({
        method,
        path,
        url: adapter.getUrl(),
        request: extractRequestMetadata(adapter, captureHeaders),
        paymentRequired: true, // Will be updated based on result
      });
    } catch {
      resourceTrackingId = undefined;
    }
  }

  const result = await httpServer.processHTTPRequest(
    {
      adapter,
      path,
      method,
    },
    paywallConfig
  );

  let state: PaymentState = { result, resourceTrackingId };
  const paymentRequired =
    result.type === "payment-error" || result.type === "payment-verified";

  if (resourceTracking && resourceTrackingId) {
    const routeConfig =
      result.type === "payment-verified"
        ? extractRouteConfig(result.paymentRequirements)
        : undefined;
    await safeTrack(async () => {
      await resourceTracking.recordRequest(resourceTrackingId, {
        paymentRequired,
        routeConfig,
      });
    });
  }

  if (result.type === "payment-error") {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(result.response.headers)) {
      headers[key] = String(value);
    }

    // Record verification failure
    if (resourceTracking && resourceTrackingId) {
      await safeTrack(async () => {
        await resourceTracking.recordVerification(
          resourceTrackingId,
          false,
          undefined,
          "payment_error"
        );
      });
    }

    return {
      action: "error",
      state,
      status: result.response.status,
      headers,
      body: result.response.body,
      isHtml: result.response.isHtml,
    };
  }

  // Record successful verification with payment details
  if (result.type === "payment-verified" && resourceTracking && resourceTrackingId) {
    const payment = extractPaymentDetails(
      result.paymentPayload,
      result.paymentRequirements
    );
    const x402Audit = extractX402AuditFields(
      result.paymentPayload,
      result.paymentRequirements
    );
    await safeTrack(async () => {
      await resourceTracking.recordVerification(
        resourceTrackingId,
        true,
        payment,
        undefined,
        x402Audit
      );
    });
  }

  if (
    result.type === "payment-verified" &&
    result.paymentRequirements.scheme === "upto"
  ) {
    if (!uptoModule) {
      throw new Error("Upto middleware requires an upto module.");
    }

    if (autoTrack) {
      const tracking = await trackUptoPayment(
        uptoModule.store,
        result.paymentPayload,
        result.paymentRequirements
      );

      state = { result, tracking, resourceTrackingId };

      // Record upto session info
      if (resourceTracking && resourceTrackingId) {
        await safeTrack(async () => {
          await resourceTracking.recordUptoSession(resourceTrackingId, {
            sessionId: tracking.sessionId,
            trackingSuccess: tracking.success,
            trackingError: tracking.success ? undefined : tracking.error,
          });
        });
      }

      if (!tracking.success) {
        return {
          action: "tracking-error",
          state,
          status: TRACKING_ERROR_STATUS[tracking.error],
          body: {
            error: tracking.error,
            message: TRACKING_ERROR_MESSAGES[tracking.error],
            sessionId: tracking.sessionId,
          },
        };
      }
    }
  }

  return { action: "continue", state };
}

// -----------------------------------------------------------------------------
// Core Settlement Processing
// -----------------------------------------------------------------------------

export interface AfterHandleResult {
  headers: Record<string, string>;
}

export interface ProcessAfterHandleOptions {
  httpServer: x402HTTPResourceServer;
  state: PaymentState | null | undefined;
  autoSettle: boolean;
  /** Resource tracking module for settlement tracking */
  resourceTracking?: ResourceTrackingModule;
  /** HTTP response status code */
  responseStatus?: number;
  /** Request start time for calculating response time */
  startTimeMs?: number;
  /** Whether the route handler executed */
  handlerExecuted?: boolean;
}

export async function processAfterHandle(
  options: ProcessAfterHandleOptions
): Promise<AfterHandleResult> {
  const { httpServer, state, autoSettle, resourceTracking, responseStatus, startTimeMs } = options;
  const headers: Record<string, string> = {};
  const handlerExecuted = options.handlerExecuted ?? true;

  const safeTrack = async (fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch {
      // Best-effort tracking: never block the response
    }
  };

  // Calculate response time if start time was provided
  const responseTimeMs = startTimeMs ? Date.now() - startTimeMs : 0;

  // Finalize tracking with response info (even if no payment was verified)
  const finalizeTracking = async (handlerExecuted: boolean) => {
    const trackingId = state?.resourceTrackingId;
    if (resourceTracking && trackingId) {
      await safeTrack(async () => {
        await resourceTracking.finalizeTracking(
          trackingId,
          responseStatus ?? 200,
          responseTimeMs,
          handlerExecuted
        );
      });
    }
  };

  if (!state || state.result.type !== "payment-verified") {
    await finalizeTracking(handlerExecuted);
    return { headers };
  }

  if (state.result.paymentRequirements.scheme === "upto") {
    if (state.tracking?.success) {
      headers["x-upto-session-id"] = state.tracking.sessionId;
    }
    await finalizeTracking(handlerExecuted);
    return { headers };
  }

  if (!autoSettle) {
    await finalizeTracking(handlerExecuted);
    return { headers };
  }

  const settlement = await httpServer.processSettlement(
    state.result.paymentPayload,
    state.result.paymentRequirements
  );

  // Record settlement result
  if (resourceTracking && state.resourceTrackingId) {
    const trackingId = state.resourceTrackingId;
    await safeTrack(async () => {
      await resourceTracking.recordSettlement(trackingId, {
        attempted: true,
        success: settlement.success,
        transactionHash: settlement.transaction,
        errorMessage: settlement.errorReason,
        settledAtMs: Date.now(),
      });
    });
  }

  if (settlement.success) {
    for (const [key, value] of Object.entries(settlement.headers)) {
      headers[key] = String(value);
    }
  }

  await finalizeTracking(handlerExecuted);
  return { headers };
}

// -----------------------------------------------------------------------------
// Re-exports for convenience
// -----------------------------------------------------------------------------

export {
  trackUptoPayment,
  TRACKING_ERROR_MESSAGES,
  TRACKING_ERROR_STATUS,
  type TrackingResult,
  type UptoModule,
} from "../upto/lib.js";

export type {
  HTTPAdapter,
  HTTPProcessResult,
  PaywallConfig,
  PaywallProvider,
  RoutesConfig,
} from "@x402/core/http";

export { x402HTTPResourceServer } from "@x402/core/http";
export type { x402ResourceServer, FacilitatorClient } from "@x402/core/server";

export type { ResourceTrackingModule } from "../tracking/lib.js";
