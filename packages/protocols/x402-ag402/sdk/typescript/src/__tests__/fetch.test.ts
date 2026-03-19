import { describe, it, expect, vi } from "vitest";
import { createX402Fetch, MockPaymentProvider } from "../fetch.ts";
import { InMemoryWallet } from "../wallet.ts";
import { parseAuthorization } from "../protocol.ts";
import type { X402PaymentChallenge } from "../protocol.ts";

/** Build a mock 402 response with x402 challenge. */
function make402(overrides?: Partial<X402PaymentChallenge>): Response {
  const ch: X402PaymentChallenge = {
    chain: "solana",
    token: "USDC",
    amount: "0.05",
    address: "SellerAddr1111111111111111111",
    ...overrides,
  };
  const header = `x402 chain="${ch.chain}" token="${ch.token}" amount="${ch.amount}" address="${ch.address}"`;
  return new Response("payment required", {
    status: 402,
    headers: { "www-authenticate": header },
  });
}

function make200(body = "ok"): Response {
  return new Response(body, { status: 200 });
}

function makeFetchMock(responses: Response[]) {
  let i = 0;
  return vi.fn(async () => {
    const res = responses[i++];
    if (!res) throw new Error("No more mock responses");
    return res;
  });
}

describe("createX402Fetch — happy path", () => {
  it("passes through 200 without payment", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make200()]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.status).toBe(200);
    expect(res.x402.paymentMade).toBe(false);
    expect(wallet.getBalance()).toBe(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("auto-pays x402 challenge and retries", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402(), make200("data")]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.status).toBe(200);
    expect(res.x402.paymentMade).toBe(true);
    expect(res.x402.amountPaid).toBe(0.05);
    expect(res.x402.txHash).toMatch(/^mock_tx_/);
    expect(wallet.getBalance()).toBe(99.95);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("x402 metadata is always present on response object", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make200()]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    // Must never be undefined — callers depend on this always being set
    expect(res.x402).toBeDefined();
    expect(typeof res.x402.paymentMade).toBe("boolean");
    expect(typeof res.x402.txHash).toBe("string");
    expect(typeof res.x402.amountPaid).toBe("number");
    expect(typeof res.x402.blocked).toBe("boolean");
  });

  it("getTotalSpent tracks total spend accurately", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(make402({ amount: "0.10" }))
      .mockResolvedValueOnce(make200())
      .mockResolvedValueOnce(make402({ amount: "0.25" }))
      .mockResolvedValueOnce(make200());
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    expect(x402fetch.getTotalSpent()).toBe(0);
    await x402fetch("https://api.example.com/1");
    expect(x402fetch.getTotalSpent()).toBe(0.10);
    await x402fetch("https://api.example.com/2");
    expect(x402fetch.getTotalSpent()).toBe(0.35);
  });
});

describe("createX402Fetch — Authorization header injection", () => {
  it("injects valid x402 Authorization header in retry request", async () => {
    const wallet = new InMemoryWallet(100);
    const capturedInits: RequestInit[] = [];

    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInits.push(init ?? {});
      return capturedInits.length === 1 ? make402() : make200();
    });
    const x402fetch = createX402Fetch({ wallet, fetchImpl });
    await x402fetch("https://api.example.com/data");

    expect(capturedInits).toHaveLength(2);
    const retryHeaders = new Headers(capturedInits[1].headers);
    const authHeader = retryHeaders.get("authorization");
    expect(authHeader).not.toBeNull();
    expect(authHeader).toMatch(/^x402 /);

    // Validate the header is parseable and contains a tx_hash
    const proof = parseAuthorization(authHeader!);
    expect(proof).not.toBeNull();
    expect(proof!.txHash).toMatch(/^mock_tx_/);
    expect(proof!.chain).toBe("solana");
    expect(proof!.payerAddress).toBe("MockPayerAddress1111111111111111111111");
    expect(proof!.requestId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("preserves original custom headers in retry request", async () => {
    const wallet = new InMemoryWallet(100);
    const capturedInits: RequestInit[] = [];

    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInits.push(init ?? {});
      return capturedInits.length === 1 ? make402() : make200();
    });
    const x402fetch = createX402Fetch({ wallet, fetchImpl });

    await x402fetch("https://api.example.com/data", {
      headers: { "X-Custom-Header": "myvalue", "X-Session": "sess123" },
    });

    const retryHeaders = new Headers(capturedInits[1].headers);
    expect(retryHeaders.get("x-custom-header")).toBe("myvalue");
    expect(retryHeaders.get("x-session")).toBe("sess123");
  });

  it("preserves POST body in retry request", async () => {
    const wallet = new InMemoryWallet(100);
    const capturedInits: RequestInit[] = [];

    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInits.push(init ?? {});
      return capturedInits.length === 1 ? make402() : make200();
    });
    const x402fetch = createX402Fetch({ wallet, fetchImpl });

    const body = JSON.stringify({ query: "hello" });
    await x402fetch("https://api.example.com/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    expect(capturedInits[1].body).toBe(body);
    expect(capturedInits[1].method).toBe("POST");
    const retryHeaders = new Headers(capturedInits[1].headers);
    expect(retryHeaders.get("content-type")).toBe("application/json");
  });
});

describe("createX402Fetch — budget controls", () => {
  it("non-x402 402 has blocked=false (not a local decision)", async () => {
    const wallet = new InMemoryWallet(100);
    const plain402 = new Response("pay", { status: 402 });
    const fetchMock = makeFetchMock([plain402]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.status).toBe(402);
    expect(res.x402.paymentMade).toBe(false);
    expect(res.x402.blocked).toBe(false); // server returned 402, not blocked by us
    expect(res.x402.error).toContain("Non-x402");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks when amount exceeds maxAmountPerCall", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402({ amount: "5.00" })]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock, config: { maxAmountPerCall: 1.0 } });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.error).toContain("per-call limit");
    expect(res.x402.blocked).toBe(true);
    expect(res.x402.paymentMade).toBe(false);
    expect(wallet.getBalance()).toBe(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows payment when amount exactly equals maxAmountPerCall", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402({ amount: "1.00" }), make200()]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock, config: { maxAmountPerCall: 1.0 } });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.paymentMade).toBe(true);
    expect(res.x402.amountPaid).toBe(1.0);
  });

  it("blocks unsupported chain", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402({ chain: "ethereum" })]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.error).toContain("Chain not accepted");
    expect(wallet.getBalance()).toBe(100);
  });

  it("blocks unsupported token", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402({ token: "ETH" })]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.error).toContain("Token not accepted");
    expect(wallet.getBalance()).toBe(100);
  });

  it("blocks when wallet is empty", async () => {
    const wallet = new InMemoryWallet(0);
    const fetchMock = makeFetchMock([make402()]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.error).toContain("Insufficient");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enforces maxTotalSpend across multiple calls", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(make402({ amount: "0.30" }))
      .mockResolvedValueOnce(make200())
      .mockResolvedValueOnce(make402({ amount: "0.80" })) // would push total to 1.10 > 0.50
      .mockResolvedValueOnce(make200());
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock, config: { maxTotalSpend: 0.50 } });

    const res1 = await x402fetch("https://api.example.com/1");
    expect(res1.x402.paymentMade).toBe(true);
    expect(wallet.getBalance()).toBeCloseTo(99.70);

    const res2 = await x402fetch("https://api.example.com/2");
    expect(res2.x402.paymentMade).toBe(false);
    expect(res2.x402.error).toContain("Total spend limit");
    expect(wallet.getBalance()).toBeCloseTo(99.70);
  });

  it("mutating config arrays after creation does not affect accepted chains", async () => {
    const wallet = new InMemoryWallet(100);
    const acceptedChains = ["solana"];
    const fetchMock = makeFetchMock([make402({ chain: "ethereum" })]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock, config: { acceptedChains } });

    // Mutate the original array after creating the fetch instance
    acceptedChains.push("ethereum");

    const res = await x402fetch("https://api.example.com/data");
    // ethereum must still be rejected — internal copy was made at construction time
    expect(res.x402.error).toContain("Chain not accepted");
  });

  it("blocks challenge with invalid amount (0)", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402({ amount: "0" })]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.paymentMade).toBe(false);
    expect(res.x402.error).toMatch(/amount/i);
    expect(wallet.getBalance()).toBe(100);
  });

  it("blocks challenge with non-numeric amount", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402({ amount: "abc" })]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.paymentMade).toBe(false);
    expect(wallet.getBalance()).toBe(100);
  });
});

describe("createX402Fetch — error handling and rollback", () => {
  it("rolls back wallet if provider.pay() throws", async () => {
    const wallet = new InMemoryWallet(100);
    const failingProvider = {
      pay: vi.fn().mockRejectedValue(new Error("network error")),
      getAddress: () => "PayerAddr",
    };
    const fetchMock = makeFetchMock([make402()]);
    const x402fetch = createX402Fetch({ wallet, provider: failingProvider, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.paymentMade).toBe(false);
    expect(res.x402.error).toContain("network error");
    expect(wallet.getBalance()).toBe(100); // rolled back
  });

  it("does NOT rollback wallet after chain payment when retry fails (5xx)", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402(), new Response("server err", { status: 500 })]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.paymentMade).toBe(true);
    expect(res.x402.amountPaid).toBe(0.05);
    expect(res.x402.error).toContain("Retry failed");
    expect(wallet.getBalance()).toBe(99.95); // NOT rolled back — chain payment was real
  });

  it("does NOT rollback when retry returns 402 (server rejects proof)", async () => {
    // Server accepts the payment but the retry itself gets a 402 again (e.g., proof rejected)
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402(), make402()]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    // Should NOT recurse — must stop after one payment attempt
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.x402.paymentMade).toBe(true); // payment was made
    expect(res.x402.error).toContain("Retry failed with status 402");
    expect(wallet.getBalance()).toBe(99.95); // no rollback, no second deduction
  });

  it("propagates network error from initial fetch", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const x402fetch = createX402Fetch({ wallet, fetchImpl });

    await expect(x402fetch("https://api.example.com/data")).rejects.toThrow("Failed to fetch");
    expect(wallet.getBalance()).toBe(100); // no wallet mutation occurred
  });

  it("propagates network error from retry fetch (no rollback — payment was made)", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(make402())
      .mockRejectedValueOnce(new TypeError("connection reset"));
    const x402fetch = createX402Fetch({ wallet, fetchImpl });

    await expect(x402fetch("https://api.example.com/data")).rejects.toThrow("connection reset");
    // Payment was sent on-chain before the retry threw — wallet must NOT be rolled back
    expect(wallet.getBalance()).toBe(99.95);
  });
});

describe("createX402Fetch — config validation", () => {
  it("throws at construction when maxAmountPerCall is negative", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, config: { maxAmountPerCall: -1 } }))
      .toThrow("maxAmountPerCall");
  });

  it("throws at construction when maxAmountPerCall is zero", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, config: { maxAmountPerCall: 0 } }))
      .toThrow("maxAmountPerCall");
  });

  it("throws at construction when maxAmountPerCall is NaN", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, config: { maxAmountPerCall: NaN } }))
      .toThrow("maxAmountPerCall");
  });

  it("throws at construction when maxTotalSpend is NaN", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, config: { maxTotalSpend: NaN } }))
      .toThrow("maxTotalSpend");
  });

  it("throws at construction when maxTotalSpend is zero", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, config: { maxTotalSpend: 0 } }))
      .toThrow("maxTotalSpend");
  });

  it("throws at construction when acceptedChains is empty", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, config: { acceptedChains: [] } }))
      .toThrow("acceptedChains");
  });

  it("throws at construction when acceptedTokens is empty", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, config: { acceptedTokens: [] } }))
      .toThrow("acceptedTokens");
  });

  it("accepts valid config without throwing", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({
      wallet,
      config: { maxAmountPerCall: 0.01, maxTotalSpend: Infinity, acceptedChains: ["solana"], acceptedTokens: ["USDC"] }
    })).not.toThrow();
  });

  it("accepts Infinity as maxTotalSpend (no spend limit)", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, config: { maxTotalSpend: Infinity } })).not.toThrow();
  });
});

describe("createX402Fetch — amountPaid consistency", () => {
  it("amountPaid matches wallet balance reduction exactly", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402({ amount: "0.05" }), make200()]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const before = wallet.getBalance();
    const res = await x402fetch("https://api.example.com/data");
    const after = wallet.getBalance();

    // amountPaid is derived from the same micro-unit round-trip as the wallet deduction.
    // Use toBeCloseTo here because `before - after` itself involves float subtraction
    // (100 - 99.95 = 0.04999...). Both values originate from the same micro-unit source.
    expect(res.x402.amountPaid).toBeCloseTo(before - after, 6);
    // Independently verify the canonical value
    expect(res.x402.amountPaid).toBe(0.05);
  });

  it("amountPaid is zero when payment was not made", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make200()]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.amountPaid).toBe(0);
    expect(res.x402.paymentMade).toBe(false);
  });
});

describe("createX402Fetch — custom provider and URL types", () => {
  it("uses custom payment provider", async () => {
    const wallet = new InMemoryWallet(100);
    const customProvider = {
      pay: vi.fn().mockResolvedValue("custom_tx_hash_123"),
      getAddress: () => "CustomPayerAddr",
    };
    const fetchMock = makeFetchMock([make402(), make200()]);
    const x402fetch = createX402Fetch({ wallet, provider: customProvider, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.txHash).toBe("custom_tx_hash_123");
    const proof = parseAuthorization(
      new Headers((vi.mocked(fetchMock).mock.calls[1][1] as RequestInit)?.headers).get("authorization")!
    );
    expect(proof!.payerAddress).toBe("CustomPayerAddr");
  });

  it("accepts URL object as input", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make200()]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch(new URL("https://api.example.com/data"));
    expect(res.status).toBe(200);
  });

  it("accepts Request object as input", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make200()]);
    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });

    const res = await x402fetch(new Request("https://api.example.com/data"));
    expect(res.status).toBe(200);
  });

  it("preserves Request object headers in retry (not just init.headers)", async () => {
    const wallet = new InMemoryWallet(100);
    const capturedInits: Array<RequestInit | undefined> = [];

    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInits.push(init);
      return capturedInits.length === 1 ? make402() : make200();
    });
    const x402fetch = createX402Fetch({ wallet, fetchImpl });

    // Headers on the Request object itself (not in init)
    const req = new Request("https://api.example.com/data", {
      headers: { "X-Api-Key": "secret123" },
    });
    await x402fetch(req);

    const retryHeaders = new Headers(capturedInits[1]?.headers);
    expect(retryHeaders.get("x-api-key")).toBe("secret123");
    expect(retryHeaders.get("authorization")).toMatch(/^x402 /);
  });

  it("works with custom Wallet implementation", async () => {
    // Verify the function accepts any Wallet-interface-compatible object
    let balance = 50;
    const customWallet = {
      getBalance: () => balance,
      deduct: (amount: number, _addr: string) => {
        balance -= amount;
        return "custom_tx_1";
      },
      rollback: (_txId: string) => { balance += 5; return true; },
    };
    const fetchMock = makeFetchMock([make402({ amount: "0.05" }), make200()]);
    const x402fetch = createX402Fetch({ wallet: customWallet, fetchImpl: fetchMock });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.paymentMade).toBe(true);
    expect(balance).toBeCloseTo(49.95);
  });
});

describe("createX402Fetch — debug logging", () => {
  it("logs to console when debug is true", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402(), make200()]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock, config: { debug: true } });
    await x402fetch("https://api.example.com/data");

    expect(logSpy).toHaveBeenCalled();
    // Confirm the [ag402] prefix appears in at least one call
    expect(logSpy.mock.calls.some((args) => String(args[0]).includes("[ag402]"))).toBe(true);
    logSpy.mockRestore();
  });

  it("does not log when debug is false (default)", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402(), make200()]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const x402fetch = createX402Fetch({ wallet, fetchImpl: fetchMock });
    await x402fetch("https://api.example.com/data");

    expect(logSpy.mock.calls.every((args) => !String(args[0]).includes("[ag402]"))).toBe(true);
    logSpy.mockRestore();
  });
});

describe("createX402Fetch — attachMeta Proxy fallback", () => {
  it("x402 metadata is accessible even when Object.defineProperty throws (frozen response)", async () => {
    const wallet = new InMemoryWallet(100);
    // Simulate a frozen/sealed response — defineProperty will throw TypeError
    const frozenResponse = Object.freeze(new Response("ok", { status: 200 }));
    const fetchImpl = vi.fn().mockResolvedValue(frozenResponse);

    const x402fetch = createX402Fetch({ wallet, fetchImpl });
    const res = await x402fetch("https://api.example.com/data");

    // Despite defineProperty throwing, the Proxy fallback must surface x402 metadata
    expect(res.x402).toBeDefined();
    expect(res.x402.paymentMade).toBe(false);
    expect(res.x402.amountPaid).toBe(0);
    // Response properties must still work through the Proxy
    expect(res.status).toBe(200);
  });
});

describe("createX402Fetch — payment timeout", () => {
  it("rolls back wallet and returns error when provider.pay() times out", async () => {
    const wallet = new InMemoryWallet(100);
    // Provider that never resolves
    const hangingProvider = {
      pay: () => new Promise<string>(() => {}),
      getAddress: () => "HangingAddr",
    };
    const fetchMock = makeFetchMock([make402()]);
    const x402fetch = createX402Fetch({
      wallet,
      provider: hangingProvider,
      fetchImpl: fetchMock,
      paymentTimeoutMs: 50, // short timeout for the test
    });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.paymentMade).toBe(false);
    expect(res.x402.error).toContain("timed out");
    // Wallet must be rolled back — no money lost
    expect(wallet.getBalance()).toBe(100);
  });

  it("succeeds normally when provider resolves within timeout", async () => {
    const wallet = new InMemoryWallet(100);
    const fetchMock = makeFetchMock([make402(), make200()]);
    const x402fetch = createX402Fetch({
      wallet,
      fetchImpl: fetchMock,
      paymentTimeoutMs: 5000,
    });

    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.paymentMade).toBe(true);
    expect(wallet.getBalance()).toBe(99.95);
  });
});

describe("createX402Fetch — paymentTimeoutMs validation", () => {
  it("throws at construction when paymentTimeoutMs is zero", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, paymentTimeoutMs: 0 })).toThrow("paymentTimeoutMs");
  });

  it("throws at construction when paymentTimeoutMs is negative", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, paymentTimeoutMs: -100 })).toThrow("paymentTimeoutMs");
  });

  it("throws at construction when paymentTimeoutMs is NaN", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, paymentTimeoutMs: NaN })).toThrow("paymentTimeoutMs");
  });

  it("does not throw for a valid positive paymentTimeoutMs", () => {
    const wallet = new InMemoryWallet(100);
    expect(() => createX402Fetch({ wallet, paymentTimeoutMs: 5000 })).not.toThrow();
  });
});

describe("createX402Fetch — unsafe provider.getAddress() does not crash after payment", () => {
  it("falls back to proof without payerAddress when getAddress returns unsafe string", async () => {
    const wallet = new InMemoryWallet(100);
    // getAddress returns a value with a quote — buildAuthorization would throw without the guard
    const unsafeProvider = {
      pay: vi.fn().mockResolvedValue("tx_safe_hash"),
      getAddress: () => 'addr"with"quotes',
    };
    const fetchMock = makeFetchMock([make402(), make200()]);
    const x402fetch = createX402Fetch({ wallet, provider: unsafeProvider, fetchImpl: fetchMock });

    // Must NOT throw — must resolve to an X402Response
    const res = await x402fetch("https://api.example.com/data");
    expect(res.x402.paymentMade).toBe(true);
    expect(res.x402.txHash).toBe("tx_safe_hash");
    // The retry was still sent — money was deducted
    expect(wallet.getBalance()).toBe(99.95);
  });
});

describe("createX402Fetch — MockPaymentProvider production warning", () => {
  it("emits console.warn when no provider is supplied outside test environment", () => {
    const wallet = new InMemoryWallet(100);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Temporarily clear all test-detection env vars to simulate production
    const origVitest = process.env["VITEST"];
    const origNodeEnv = process.env["NODE_ENV"];
    const origJest = process.env["JEST_WORKER_ID"];
    delete process.env["VITEST"];
    delete process.env["NODE_ENV"];
    delete process.env["JEST_WORKER_ID"];

    createX402Fetch({ wallet });

    process.env["VITEST"] = origVitest;
    if (origNodeEnv !== undefined) process.env["NODE_ENV"] = origNodeEnv;
    if (origJest !== undefined) process.env["JEST_WORKER_ID"] = origJest;

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("MockPaymentProvider"));
    warnSpy.mockRestore();
  });

  it("does NOT warn when an explicit provider is supplied", () => {
    const wallet = new InMemoryWallet(100);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    createX402Fetch({ wallet, provider: new MockPaymentProvider() });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
