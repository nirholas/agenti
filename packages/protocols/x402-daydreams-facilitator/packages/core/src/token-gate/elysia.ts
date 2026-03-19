import { Elysia } from "elysia";
import {
  createTokenGateMiddleware,
  type TokenGateMiddlewareConfig,
} from "./middleware.js";

interface ElysiaContext {
  request: Request;
  x402?: { paymentPayload?: { accepted?: { account?: string } } };
  tokenGate?: { balance: bigint; fromCache: boolean };
}

/**
 * Elysia plugin for token gating
 *
 * Extracts wallet from:
 * 1. x402 payment state (if x402 middleware runs before)
 * 2. x-wallet-address header
 *
 * Must be used AFTER x402 payment middleware for payment-based wallet extraction.
 */
export function elysiaTokenGate(config: TokenGateMiddlewareConfig) {
  const hook = createTokenGateMiddleware({
    ...config,
    extractWallet:
      config.extractWallet ??
      ((ctx: unknown) => {
        const elysiaCtx = ctx as ElysiaContext;

        // Try x402 payment state first
        const x402Wallet = elysiaCtx.x402?.paymentPayload?.accepted?.account;
        if (x402Wallet) return x402Wallet;

        // Fall back to header (Elysia uses request.headers.get)
        return elysiaCtx.request?.headers?.get("x-wallet-address") ?? null;
      }),
  });

  return new Elysia({ name: "token-gate" })
    .derive({ as: "scoped" }, () => ({
      tokenGate: undefined as { balance: bigint; fromCache: boolean } | undefined,
    }))
    .onBeforeHandle({ as: "scoped" }, async (ctx: ElysiaContext) => {
      const result = await hook(ctx, undefined);

      if (!result.allowed) {
        return result.response;
      }

      // Attach result to context for downstream use
      ctx.tokenGate = {
        balance: result.balance,
        fromCache: result.fromCache,
      };
    });
}
