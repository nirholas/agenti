import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { honoTokenGate } from "../hono.js";
import type { TokenGateResult } from "../types.js";

describe("honoTokenGate", () => {
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

  it("allows request when wallet has sufficient balance", async () => {
    mockCheck.mockResolvedValue({
      allowed: true,
      balance: 200n,
      fromCache: false,
    });

    const app = new Hono();
    app.use("*", honoTokenGate({ checker: mockChecker }));
    app.get("/test", (c) => c.text("success"));

    const response = await app.request("/test", {
      headers: { "x-wallet-address": "0xWallet123" },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("success");
  });

  it("denies request when wallet has insufficient balance", async () => {
    mockCheck.mockResolvedValue({
      allowed: false,
      reason: "insufficient_balance",
      retryAfter: new Date(Date.now() + 300_000),
    });

    const app = new Hono();
    app.use("*", honoTokenGate({ checker: mockChecker }));
    app.get("/test", (c) => c.text("success"));

    const response = await app.request("/test", {
      headers: { "x-wallet-address": "0xWallet123" },
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("token_gate_denied");
  });

  it("allows request when no wallet header present", async () => {
    const app = new Hono();
    app.use("*", honoTokenGate({ checker: mockChecker }));
    app.get("/test", (c) => c.text("success"));

    const response = await app.request("/test");

    expect(response.status).toBe(200);
    expect(mockCheck).not.toHaveBeenCalled();
  });
});
