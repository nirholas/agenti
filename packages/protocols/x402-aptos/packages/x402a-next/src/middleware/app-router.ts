import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { MiddlewareConfig } from "../types";
import { createLogger, generateCorrelationId } from "../utils/logger";
import { X402_HEADER } from "./protocol";
import {
  buildPaymentRequirements,
  create402Response,
  createSuccessResponse,
  debug,
  matchRoute,
  parsePaymentFromHeader,
  verifyPayment,
} from "./utils";

export function createPaymentMiddleware(config: MiddlewareConfig) {
  const logger = createLogger("PaymentMiddleware");

  return async function middleware(request: NextRequest) {
    const correlationId = generateCorrelationId();
    const pathname = request.nextUrl.pathname;

    logger.debug("Processing request", { correlationId, pathname });
    debug(config, `Processing request: ${pathname}`);

    const routeConfig = matchRoute(pathname, config.routes);

    if (!routeConfig) {
      logger.debug("No payment config for route", { correlationId, pathname });
      debug(config, `No payment config for route: ${pathname}`);
      return NextResponse.next();
    }

    logger.info("Route requires payment", { correlationId, pathname, price: routeConfig.price });
    debug(config, `Route requires payment`, routeConfig);

    const requirements = buildPaymentRequirements(routeConfig, config, pathname);

    const paymentHeader = request.headers.get(X402_HEADER);

    if (!paymentHeader) {
      logger.info("No payment header, returning 402", { correlationId, pathname });
      debug(config, `No payment header, returning 402`);

      if (config.onPaymentRequired) {
        try {
          await config.onPaymentRequired(request, requirements);
        } catch (error) {
          logger.error("onPaymentRequired callback error", {
            correlationId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return create402Response(requirements);
    }

    const parseResult = parsePaymentFromHeader(paymentHeader);
    if (!parseResult.valid) {
      logger.warn("Invalid payment header", { correlationId, pathname, error: parseResult.error });
      debug(config, `Invalid payment header: ${parseResult.error}`);

      if (config.onPaymentError) {
        try {
          await config.onPaymentError(request, new Error(parseResult.error || "Invalid payment"));
        } catch (error) {
          logger.error("onPaymentError callback error", {
            correlationId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return new Response(
        JSON.stringify({
          error: "Invalid Payment",
          code: "invalid_payment",
          message: parseResult.error,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!parseResult.payload) {
      logger.warn("Payment payload missing", { correlationId, pathname });
      return new Response(
        JSON.stringify({
          error: "Invalid Payment",
          code: "invalid_payment",
          message: "Payment payload is missing",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    logger.debug("Verifying payment", { correlationId, pathname });
    debug(config, `Verifying payment...`);
    const verificationResult = await verifyPayment(parseResult.payload, requirements, config);

    if (!verificationResult.valid) {
      logger.warn("Payment verification failed", {
        correlationId,
        pathname,
        error: verificationResult.error,
      });
      debug(config, `Payment verification failed: ${verificationResult.error}`);

      if (config.onPaymentError) {
        try {
          await config.onPaymentError(
            request,
            new Error(verificationResult.error || "Payment verification failed")
          );
        } catch (error) {
          logger.error("onPaymentError callback error", {
            correlationId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return new Response(
        JSON.stringify({
          error: "Payment Verification Failed",
          code: "payment_verification_failed",
          message: verificationResult.error,
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    logger.info("Payment verified", {
      correlationId,
      pathname,
      payer: verificationResult.payer,
      txHash: verificationResult.txHash,
    });
    debug(config, `Payment verified for payer: ${verificationResult.payer}`);

    if (config.onPaymentVerified && verificationResult.payer) {
      try {
        await config.onPaymentVerified(request, verificationResult.payer);
      } catch (error) {
        logger.error("onPaymentVerified callback error", {
          correlationId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if (config.onPaymentSettled && verificationResult.txHash) {
      try {
        await config.onPaymentSettled(request, verificationResult.txHash);
      } catch (error) {
        logger.error("onPaymentSettled callback error", {
          correlationId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const response = NextResponse.next();

    if (verificationResult.payer) {
      const paymentHeaders = createSuccessResponse(
        verificationResult.payer,
        verificationResult.txHash
      );

      for (const [key, value] of Object.entries(paymentHeaders)) {
        response.headers.set(key, value);
      }
    }

    return response;
  };
}

export function createSupportedHandler(config: MiddlewareConfig) {
  return async function GET() {
    const kinds = Object.entries(config.routes).map(([route, routeConfig]) => {
      const network = routeConfig.network || "aptos-testnet";
      return {
        x402Version: 1,
        scheme: "exact",
        network,
        resource: routeConfig.resource || route,
      };
    });

    return NextResponse.json({
      x402Version: 1,
      kinds,
    });
  };
}
