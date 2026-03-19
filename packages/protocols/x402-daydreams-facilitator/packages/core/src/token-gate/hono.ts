import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";
import {
  createTokenGateMiddleware,
  type TokenGateMiddlewareConfig,
} from "./middleware.js";

/**
 * Hono middleware for token gating
 *
 * Extracts wallet from:
 * 1. x402 payment state (if x402 middleware runs before)
 * 2. x-wallet-address header
 *
 * Must be used AFTER x402 payment middleware for payment-based wallet extraction.
 */
export function honoTokenGate(config: TokenGateMiddlewareConfig) {
  const hook = createTokenGateMiddleware({
    ...config,
    extractWallet:
      config.extractWallet ??
      ((ctx: unknown) => {
        const honoCtx = ctx as Context;

        // Try x402 payment state first
        const x402State = honoCtx.get("x402") as
          | { paymentPayload?: { accepted?: { account?: string } } }
          | undefined;
        const x402Wallet = x402State?.paymentPayload?.accepted?.account;
        if (x402Wallet) return x402Wallet;

        // Fall back to header
        return honoCtx.req.header("x-wallet-address") ?? null;
      }),
  });

  return createMiddleware(async (c: Context, next: Next) => {
    const result = await hook(c, undefined);

    if (!result.allowed) {
      return result.response;
    }

    // Set token gate result for downstream handlers
    c.set("tokenGate", {
      balance: result.balance,
      fromCache: result.fromCache,
    });

    await next();
  });
}
