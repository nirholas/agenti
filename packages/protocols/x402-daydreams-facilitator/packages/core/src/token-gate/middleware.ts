import type { TokenGateResult, TokenRequirement } from "./types.js";

export interface TokenGateChecker {
  check(wallet: string): Promise<TokenGateResult>;
  getRequirement(): TokenRequirement;
}

export interface TokenGateMiddlewareConfig {
  /** Token gate checker instance */
  checker: TokenGateChecker;

  /**
   * Extract wallet address from request context
   * Default: uses x402Wallet parameter
   */
  extractWallet?: (ctx: unknown) => string | null;

  /**
   * Custom error response builder
   */
  onDeny?: (result: Extract<TokenGateResult, { allowed: false }>) => Response;
}

/**
 * Build default 403 response for denied requests
 */
function buildDenyResponse(
  result: Extract<TokenGateResult, { allowed: false }>
): Response {
  const messages: Record<string, string> = {
    insufficient_balance:
      "Insufficient token balance. Please acquire tokens and try again.",
    blocked:
      "Wallet temporarily blocked due to insufficient balance. Please try again later.",
    rpc_error: "Unable to verify token balance. Please try again.",
  };

  const body = {
    error: "token_gate_denied",
    reason: result.reason,
    message: messages[result.reason],
    ...(result.retryAfter && { retryAfter: result.retryAfter.toISOString() }),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (result.retryAfter) {
    const secondsUntilRetry = Math.ceil(
      (result.retryAfter.getTime() - Date.now()) / 1000
    );
    headers["Retry-After"] = String(secondsUntilRetry);
  }

  return new Response(JSON.stringify(body), {
    status: 403,
    headers,
  });
}

export type TokenGateMiddlewareResult =
  | { allowed: true; balance: bigint; fromCache: boolean }
  | { allowed: false; response: Response };

/**
 * Create framework-agnostic token gate middleware hook
 */
export function createTokenGateMiddleware(config: TokenGateMiddlewareConfig) {
  const { checker, extractWallet, onDeny } = config;

  return async function tokenGateHook(
    ctx: unknown,
    x402Wallet?: string
  ): Promise<TokenGateMiddlewareResult> {
    // Extract wallet from custom extractor or x402 payment
    const wallet = extractWallet?.(ctx) ?? x402Wallet;

    if (!wallet) {
      // No wallet to check - allow request
      // (payment verification handles authentication)
      return { allowed: true, balance: 0n, fromCache: false };
    }

    const result = await checker.check(wallet);

    if (result.allowed) {
      return result;
    }

    // Build error response
    const response = onDeny?.(result) ?? buildDenyResponse(result);
    return { allowed: false, response };
  };
}
