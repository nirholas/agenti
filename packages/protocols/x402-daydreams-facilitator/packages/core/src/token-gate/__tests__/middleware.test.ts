import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTokenGateMiddleware } from "../middleware.js";
import type { TokenGateResult } from "../types.js";

describe("TokenGateMiddleware", () => {
  // Mock checker
  const mockCheck = vi.fn<[string], Promise<TokenGateResult>>();
  const mockChecker = {
    check: mockCheck,
    getRequirement: () => ({
      network: "eip155:8453",
      tokenAddress: "0xToken",
      minimumBalance: 100n,
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTokenGateMiddleware", () => {
    it("allows request when wallet has sufficient balance", async () => {
      mockCheck.mockResolvedValue({
        allowed: true,
        balance: 200n,
        fromCache: false,
      });

      const middleware = createTokenGateMiddleware({ checker: mockChecker });
      const result = await middleware({}, "0xWallet123");

      expect(result.allowed).toBe(true);
      expect(mockCheck).toHaveBeenCalledWith("0xWallet123");
    });

    it("denies request when wallet has insufficient balance", async () => {
      const retryAfter = new Date(Date.now() + 300_000);
      mockCheck.mockResolvedValue({
        allowed: false,
        reason: "insufficient_balance",
        retryAfter,
      });

      const middleware = createTokenGateMiddleware({ checker: mockChecker });
      const result = await middleware({}, "0xWallet123");

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.response).toBeDefined();
        expect(result.response.status).toBe(403);
      }
    });

    it("allows request when no wallet provided", async () => {
      const middleware = createTokenGateMiddleware({ checker: mockChecker });
      const result = await middleware({}, undefined);

      expect(result.allowed).toBe(true);
      expect(mockCheck).not.toHaveBeenCalled();
    });

    it("uses custom wallet extractor", async () => {
      mockCheck.mockResolvedValue({
        allowed: true,
        balance: 200n,
        fromCache: false,
      });

      const extractWallet = vi.fn().mockReturnValue("0xCustomWallet");

      const middleware = createTokenGateMiddleware({
        checker: mockChecker,
        extractWallet,
      });

      const ctx = { headers: { "x-wallet": "0xCustomWallet" } };
      await middleware(ctx, undefined);

      expect(extractWallet).toHaveBeenCalledWith(ctx);
      expect(mockCheck).toHaveBeenCalledWith("0xCustomWallet");
    });

    it("uses x402Wallet when extractWallet returns null", async () => {
      mockCheck.mockResolvedValue({
        allowed: true,
        balance: 200n,
        fromCache: false,
      });

      const extractWallet = vi.fn().mockReturnValue(null);

      const middleware = createTokenGateMiddleware({
        checker: mockChecker,
        extractWallet,
      });

      await middleware({}, "0xFallbackWallet");

      expect(mockCheck).toHaveBeenCalledWith("0xFallbackWallet");
    });

    it("includes Retry-After header in deny response", async () => {
      const retryAfter = new Date(Date.now() + 300_000);
      mockCheck.mockResolvedValue({
        allowed: false,
        reason: "blocked",
        retryAfter,
      });

      const middleware = createTokenGateMiddleware({ checker: mockChecker });
      const result = await middleware({}, "0xWallet123");

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        const retryHeader = result.response.headers.get("Retry-After");
        expect(retryHeader).toBeDefined();
        expect(parseInt(retryHeader!)).toBeGreaterThan(0);
      }
    });

    it("uses custom onDeny handler", async () => {
      mockCheck.mockResolvedValue({
        allowed: false,
        reason: "rpc_error",
      });

      const customResponse = new Response("Custom error", { status: 500 });
      const onDeny = vi.fn().mockReturnValue(customResponse);

      const middleware = createTokenGateMiddleware({
        checker: mockChecker,
        onDeny,
      });

      const result = await middleware({}, "0xWallet123");

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.response).toBe(customResponse);
        expect(onDeny).toHaveBeenCalled();
      }
    });
  });
});
