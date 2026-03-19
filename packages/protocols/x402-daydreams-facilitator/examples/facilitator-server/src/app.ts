import { Elysia, file } from "elysia";
import { node } from "@elysiajs/node";
import { staticPlugin } from "@elysiajs/static";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";

import { logger } from "@bogeychan/elysia-logger";
import {
  extractPaymentDetails,
  extractX402AuditFields,
  type ResourceTrackingModule,
  type TrackingContext,
} from "@daydreamsai/facilitator/tracking";

function normalizeSupportedVersions(supported: {
  kinds: Array<{ x402Version: number; network: string }>;
  extensions: unknown[];
  signers: Record<string, string[]>;
}) {
  for (const kind of supported.kinds) {
    if (!kind.network.includes(":")) {
      kind.x402Version = 1;
    }
  }
  return supported;
}

function toQueryParams(url: URL): Record<string, string | string[]> {
  const queryParams: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const existing = queryParams[key];
    if (existing === undefined) {
      queryParams[key] = value;
      continue;
    }
    queryParams[key] = Array.isArray(existing)
      ? [...existing, value]
      : [existing, value];
  }
  return queryParams;
}

function buildTrackingContext(
  request: Request,
  fallbackPath: string,
  paymentRequired = false
): TrackingContext {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(request.url);
  } catch {
    parsedUrl = new URL(`http://localhost${fallbackPath}`);
  }
  const headers = Object.fromEntries(request.headers.entries());
  const contentLengthRaw = request.headers.get("content-length");
  const contentLength = contentLengthRaw
    ? parseInt(contentLengthRaw, 10)
    : undefined;
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;

  return {
    method: request.method || "POST",
    path: parsedUrl.pathname || fallbackPath,
    url: request.url || parsedUrl.toString(),
    paymentRequired,
    request: {
      clientIp,
      userAgent: request.headers.get("user-agent") ?? undefined,
      headers,
      queryParams: toQueryParams(parsedUrl),
      contentType: request.headers.get("content-type") ?? undefined,
      contentLength: Number.isNaN(contentLength) ? undefined : contentLength,
      acceptHeader: request.headers.get("accept") ?? undefined,
    },
  };
}

interface Facilitator {
  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>;
  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>;
  getSupported(): {
    kinds: Array<{ x402Version: number; network: string }>;
    extensions: unknown[];
    signers: Record<string, string[]>;
  };
}

export type AppModule = unknown;

export interface AppConfig {
  facilitator: Facilitator;
  tracking?: ResourceTrackingModule;
  modules?: AppModule[];
}

export function createApp(config: AppConfig) {
  const { facilitator, tracking, modules = [] } = config;
  const safeTrack = async (
    fn: (module: ResourceTrackingModule) => Promise<void>,
    label = "tracking"
  ): Promise<void> => {
    if (!tracking) return;
    try {
      await fn(tracking);
    } catch (err) {
      console.warn(`[${label}]`, err);
    }
  };

  const safeStartTracking = async (
    context: TrackingContext
  ): Promise<string | undefined> => {
    if (!tracking) return undefined;
    try {
      return await tracking.startTracking(context);
    } catch (err) {
      console.warn("[tracking:start]", err);
      return undefined;
    }
  };

  const baseApp = new Elysia({ adapter: node() })
    .use(
      logger({
        autoLogging: true,
        level: "info",
      })
    )
    .use(
      opentelemetry({
        serviceName: process.env.OTEL_SERVICE_NAME ?? "x402-facilitator",
        spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
      })
    );

  for (const module of modules) {
    baseApp.use(module as any);
  }

  const app = baseApp
    .get("/", () => file("./public/index.html"))
    .use(staticPlugin())
    .post("/verify", async ({ body, request, status }) => {
      const startMs = Date.now();
      const trackingId = await safeStartTracking(
        buildTrackingContext(request, "/verify")
      );

      try {
        const { paymentPayload, paymentRequirements } = body as {
          paymentPayload?: PaymentPayload;
          paymentRequirements?: PaymentRequirements;
        };

        if (!paymentPayload || !paymentRequirements) {
          if (trackingId) {
            await safeTrack(
              (module) =>
                module.finalizeTracking(
                  trackingId,
                  400,
                  Date.now() - startMs,
                  false
                ),
              `tracking:${trackingId}`
            );
          }
          return status(400, {
            error: "Missing paymentPayload or paymentRequirements",
          });
        }

        const response: VerifyResponse = await facilitator.verify(
          paymentPayload,
          paymentRequirements
        );

        if (trackingId) {
          await safeTrack(
            (module) =>
              module.recordVerification(
                trackingId,
                true,
                extractPaymentDetails(paymentPayload, paymentRequirements),
                undefined,
                extractX402AuditFields(paymentPayload, paymentRequirements)
              ),
            `tracking:${trackingId}`
          );
          await safeTrack(
            (module) =>
              module.finalizeTracking(
                trackingId,
                200,
                Date.now() - startMs,
                true
              ),
            `tracking:${trackingId}`
          );
        }

        return response;
      } catch (error) {
        console.error("Verify error:", error);
        const parsedBody = (body ?? {}) as {
          paymentPayload?: PaymentPayload;
          paymentRequirements?: PaymentRequirements;
        };
        const { paymentPayload, paymentRequirements } = parsedBody;
        if (trackingId) {
          await safeTrack(
            (module) =>
              module.recordVerification(
                trackingId,
                false,
                paymentPayload && paymentRequirements
                  ? extractPaymentDetails(paymentPayload, paymentRequirements)
                  : undefined,
                error instanceof Error ? error.message : "Unknown error",
                paymentPayload && paymentRequirements
                  ? extractX402AuditFields(paymentPayload, paymentRequirements)
                  : undefined
              ),
            `tracking:${trackingId}`
          );
          await safeTrack(
            (module) =>
              module.finalizeTracking(
                trackingId,
                500,
                Date.now() - startMs,
                false
              ),
            `tracking:${trackingId}`
          );
        }
        return status(500, {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    })
    .post("/settle", async ({ body, request, status }) => {
      const startMs = Date.now();
      const trackingId = await safeStartTracking(
        buildTrackingContext(request, "/settle")
      );

      try {
        const { paymentPayload, paymentRequirements } = body as {
          paymentPayload?: PaymentPayload;
          paymentRequirements?: PaymentRequirements;
        };

        if (!paymentPayload || !paymentRequirements) {
          if (trackingId) {
            await safeTrack(
              (module) =>
                module.finalizeTracking(
                  trackingId,
                  400,
                  Date.now() - startMs,
                  false
                ),
              `tracking:${trackingId}`
            );
          }
          return status(400, {
            error: "Missing paymentPayload or paymentRequirements",
          });
        }

        if (trackingId) {
          await safeTrack(
            (module) =>
              module.recordVerification(
                trackingId,
                true,
                extractPaymentDetails(paymentPayload, paymentRequirements),
                undefined,
                extractX402AuditFields(paymentPayload, paymentRequirements)
              ),
            `tracking:${trackingId}`
          );
        }

        const response: SettleResponse = await facilitator.settle(
          paymentPayload,
          paymentRequirements
        );

        if (trackingId) {
          await safeTrack(
            (module) =>
              module.recordSettlement(trackingId, {
                attempted: true,
                success: response.success,
                transactionHash: response.transaction,
                errorMessage: response.errorReason,
                settledAtMs: Date.now(),
              }),
            `tracking:${trackingId}`
          );
          await safeTrack(
            (module) =>
              module.finalizeTracking(
                trackingId,
                200,
                Date.now() - startMs,
                true
              ),
            `tracking:${trackingId}`
          );
        }

        return response;
      } catch (error) {
        console.error("Settle error:", error);

        if (
          error instanceof Error &&
          error.message.includes("Settlement aborted:")
        ) {
          const parsedBody = (body ?? {}) as {
            paymentPayload?: PaymentPayload;
            paymentRequirements?: PaymentRequirements;
          };
          const { paymentPayload, paymentRequirements } = parsedBody;

          if (trackingId) {
            if (paymentPayload && paymentRequirements) {
              await safeTrack(
                (module) =>
                  module.recordVerification(
                    trackingId,
                    false,
                    extractPaymentDetails(paymentPayload, paymentRequirements),
                    error.message,
                    extractX402AuditFields(paymentPayload, paymentRequirements)
                  ),
                `tracking:${trackingId}`
              );
            }
            await safeTrack(
              (module) =>
                module.recordSettlement(trackingId, {
                  attempted: true,
                  success: false,
                  errorMessage: error.message,
                  settledAtMs: Date.now(),
                }),
              `tracking:${trackingId}`
            );
            await safeTrack(
              (module) =>
                module.finalizeTracking(
                  trackingId,
                  200,
                  Date.now() - startMs,
                  false
                ),
              `tracking:${trackingId}`
            );
          }

          return {
            success: false,
            errorReason: error.message.replace("Settlement aborted: ", ""),
            network: paymentPayload?.accepted?.network || "unknown",
          } as SettleResponse;
        }

        if (trackingId) {
          await safeTrack(
            (module) =>
              module.recordSettlement(trackingId, {
                attempted: true,
                success: false,
                errorMessage:
                  error instanceof Error ? error.message : "Unknown error",
                settledAtMs: Date.now(),
              }),
            `tracking:${trackingId}`
          );
          await safeTrack(
            (module) =>
              module.finalizeTracking(
                trackingId,
                500,
                Date.now() - startMs,
                false
              ),
            `tracking:${trackingId}`
          );
        }
        return status(500, {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    })
    .get("/supported", ({ status }) => {
      try {
        return normalizeSupportedVersions(facilitator.getSupported());
      } catch (error) {
        console.error("Supported error:", error);
        return status(500, {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

  return app;
}
