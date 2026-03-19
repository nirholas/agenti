import type { RequestHandler, Request, Response, NextFunction } from "express";
import {
  createTokenGateMiddleware,
  type TokenGateMiddlewareConfig,
} from "./middleware.js";

// Type for accessing req properties we add
type TokenGateRequest = Request & {
  tokenGate?: { balance: bigint; fromCache: boolean };
};

/**
 * Express middleware for token gating
 *
 * Extracts wallet from:
 * 1. x402 payment state (if x402 middleware runs before)
 * 2. x-wallet-address header
 *
 * Must be used AFTER x402 payment middleware for payment-based wallet extraction.
 */
export function expressTokenGate(
  config: TokenGateMiddlewareConfig
): RequestHandler {
  const hook = createTokenGateMiddleware({
    ...config,
    extractWallet:
      config.extractWallet ??
      ((ctx: unknown) => {
        const req = ctx as Request & {
          x402?: { paymentPayload?: { accepted?: { account?: string } } };
        };

        // Try x402 payment state first
        const x402Wallet = req.x402?.paymentPayload?.accepted?.account;
        if (x402Wallet) return x402Wallet;

        // Fall back to header
        return (req.headers["x-wallet-address"] as string | undefined) ?? null;
      }),
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await hook(req, undefined);

    if (!result.allowed) {
      const body = await result.response.json();
      res.status(result.response.status);
      for (const [key, value] of result.response.headers.entries()) {
        res.setHeader(key, value);
      }
      res.json(body);
      return;
    }

    // Attach result to request for downstream handlers
    (req as TokenGateRequest).tokenGate = {
      balance: result.balance,
      fromCache: result.fromCache,
    };

    next();
  };
}
