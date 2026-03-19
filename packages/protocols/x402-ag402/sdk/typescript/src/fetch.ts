/**
 * createX402Fetch — wraps the native fetch() to auto-handle HTTP 402 Payment Required.
 *
 * Usage:
 *   import { createX402Fetch, InMemoryWallet } from "@ag402/fetch";
 *   const fetch = createX402Fetch({ wallet, config });
 *   const res = await fetch("https://api.example.com/data");
 *
 * Flow:
 *   1. Send request as-is
 *   2. If 402 + x402 WWW-Authenticate → validate challenge → deduct wallet → build proof → retry
 *   3. Non-402, non-x402 402, or blocked → pass through
 *
 * Concurrency:
 *   createX402Fetch is NOT safe for concurrent calls on the same instance. Parallel
 *   invocations (e.g. Promise.all) may both pass the budget check before either
 *   deducts, causing over-spend. Use one instance per sequential call chain, or
 *   wrap concurrent calls with an external mutex.
 *
 * TODO: Real Solana on-chain payment (deferred from TypeScript SDK, 2026-03-11).
 *       Currently uses MockPaymentProvider. Replace with SolanaPaymentProvider
 *       that broadcasts a real USDC transfer and returns the tx_hash.
 *
 * NOTE: Compared to ag402-core (Python), this implementation omits Idempotency-Key
 *       header injection on retry — that requires a persistent PaymentOrderStore
 *       which is out of scope for v0.1. The requestId is embedded in the proof
 *       for server-side deduplication via the tx memo.
 */

import { buildAuthorization, parseAmount, parseWwwAuthenticate, type X402PaymentChallenge, type X402PaymentProof } from "./protocol.js";
import { type Wallet } from "./wallet.js";
import { DEFAULT_CONFIG, type X402Config } from "./config.js";

/** Result metadata attached to the fetch Response. */
export interface X402FetchMeta {
  /** True if a payment was successfully submitted on-chain (even if retry failed). */
  paymentMade: boolean;
  /** On-chain transaction hash, or "mock_tx_..." in test mode. Empty string if no payment. */
  txHash: string;
  /** Amount paid in USD. 0 if no payment. */
  amountPaid: number;
  /**
   * True if the request was blocked by a local budget rule (chain/token/amount/spend limit)
   * without attempting payment. Distinct from paymentMade=false which covers both blocking
   * and non-payment scenarios (e.g. non-x402 402).
   */
  blocked: boolean;
  /** Human-readable error description. May be set even when paymentMade=true (retry failed). */
  error?: string;
}

/** Extended Response that carries x402 payment metadata. */
export type X402Response = Response & { x402: X402FetchMeta };

export interface PaymentProvider {
  /** Pay the challenge. Returns tx_hash on success, throws on failure. */
  pay(challenge: X402PaymentChallenge, requestId: string): Promise<string>;
  /** Return payer address for the proof. */
  getAddress(): string;
}

/** Test/mock payment provider — approves all payments, returns a fake tx hash.
 *
 * **WARNING:** This provider does NOT broadcast real on-chain transactions.
 * It is intended for local development and testing only.
 * In production, replace it with a real PaymentProvider (e.g. @ag402/solana).
 */
export class MockPaymentProvider implements PaymentProvider {
  private address: string;

  constructor(address = "MockPayerAddress1111111111111111111111") {
    this.address = address;
  }

  async pay(_challenge: X402PaymentChallenge, requestId: string): Promise<string> {
    return `mock_tx_${requestId.slice(0, 12)}`;
  }

  getAddress(): string {
    return this.address;
  }
}

export interface CreateX402FetchOptions {
  /** Wallet instance. Accepts any object implementing the Wallet interface. */
  wallet: Wallet;
  provider?: PaymentProvider;
  config?: X402Config;
  /**
   * Timeout in milliseconds for provider.pay() calls.
   * If the payment provider does not resolve within this time, the wallet
   * deduction is rolled back. Default: 30000 (30 seconds).
   */
  paymentTimeoutMs?: number;
  /** Override fetch implementation (useful for testing). Default: global fetch. */
  fetchImpl?: typeof fetch;
}

/** Return type of createX402Fetch — a fetch-compatible function with spend tracking. */
export interface X402FetchFunction {
  (input: RequestInfo | URL, init?: RequestInit): Promise<X402Response>;
  /** Total amount spent (USD) by this instance since creation. */
  getTotalSpent(): number;
}

/**
 * Safely attach x402 metadata to a Response.
 *
 * Some environments (Bun, Deno, CloudFlare Workers) return frozen native
 * Response objects. Attaching a property to a frozen object silently fails
 * in non-strict mode and throws in strict mode. We use Object.defineProperty
 * with a Proxy fallback to guarantee the metadata is always readable.
 */
function attachMeta(res: Response, meta: X402FetchMeta): X402Response {
  try {
    Object.defineProperty(res, "x402", {
      value: meta,
      writable: false,
      configurable: true,
      enumerable: false,
    });
    return res as X402Response;
  } catch {
    // Frozen or sealed object — return a lightweight proxy.
    return new Proxy(res, {
      get(target, prop) {
        if (prop === "x402") return meta;
        const val = Reflect.get(target, prop);
        return typeof val === "function" ? val.bind(target) : val;
      },
    }) as X402Response;
  }
}

/**
 * Race a promise against a timeout. Rejects with a timeout error if the
 * promise does not settle within `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Create a fetch() wrapper that automatically handles HTTP 402 Payment Required.
 *
 * @param options - wallet, optional payment provider, optional config
 * @returns A fetch-compatible function with a getTotalSpent() method
 */
export function createX402Fetch(options: CreateX402FetchOptions): X402FetchFunction {
  const cfg: Required<X402Config> = {
    ...DEFAULT_CONFIG,
    ...options.config,
    // Defensively copy arrays to prevent external mutation after construction
    acceptedChains: [...(options.config?.acceptedChains ?? DEFAULT_CONFIG.acceptedChains)],
    acceptedTokens: [...(options.config?.acceptedTokens ?? DEFAULT_CONFIG.acceptedTokens)],
  };

  // Validate config at construction time — fail fast before any request
  if (!isFinite(cfg.maxAmountPerCall) || cfg.maxAmountPerCall <= 0) {
    throw new Error(`maxAmountPerCall must be a positive finite number, got: ${cfg.maxAmountPerCall}`);
  }
  if (isNaN(cfg.maxTotalSpend) || cfg.maxTotalSpend <= 0) {
    throw new Error(`maxTotalSpend must be a positive number, got: ${cfg.maxTotalSpend}`);
  }
  if (cfg.acceptedChains.length === 0) {
    throw new Error("acceptedChains must not be empty");
  }
  if (cfg.acceptedTokens.length === 0) {
    throw new Error("acceptedTokens must not be empty");
  }
  const paymentTimeoutMs = options.paymentTimeoutMs ?? 30_000;
  if (!isFinite(paymentTimeoutMs) || paymentTimeoutMs <= 0) {
    throw new Error(`paymentTimeoutMs must be a positive finite number, got: ${paymentTimeoutMs}`);
  }

  // Warn loudly when MockPaymentProvider is used outside of test environments.
  // This prevents silent "success" scenarios where money is never actually sent.
  const provider = options.provider ?? (() => {
    const isTest =
      typeof process !== "undefined" &&
      (process.env["NODE_ENV"] === "test" ||
       process.env["VITEST"] === "true" ||
       process.env["JEST_WORKER_ID"] !== undefined);
    if (!isTest) {
      console.warn(
        "[ag402] WARNING: No PaymentProvider supplied — using MockPaymentProvider.\n" +
        "         Payments will NOT be broadcast on-chain. tx hashes are fake.\n" +
        "         Set `provider` to a real PaymentProvider for production use."
      );
    }
    return new MockPaymentProvider();
  })();
  const wallet = options.wallet;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  // Track total spend in micro-units (1 unit = $0.000001) to avoid float drift
  const MICRO = 1_000_000;
  let totalSpentMicro = 0;

  function log(...args: unknown[]): void {
    if (cfg.debug) console.log("[ag402]", ...args);
  }

  async function x402Fetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<X402Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    const method =
      init?.method ??
      (input instanceof Request ? input.method : "GET");
    log("→", method, url);

    // 1. Send initial request
    const res = await fetchImpl(input, init);

    // 2. Pass through non-402
    if (res.status !== 402) {
      return attachMeta(res, { paymentMade: false, txHash: "", amountPaid: 0, blocked: false });
    }

    // 3. Parse x402 challenge
    const wwwAuth = res.headers.get("www-authenticate") ?? "";
    const challenge = parseWwwAuthenticate(wwwAuth);

    if (!challenge) {
      log("  402 without x402 challenge — passing through");
      return attachMeta(res, { paymentMade: false, txHash: "", amountPaid: 0, blocked: false, error: "Non-x402 402" });
    }

    // 4. Validate challenge
    let amount: number;
    try {
      amount = parseAmount(challenge);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("  Invalid amount:", msg);
      return attachMeta(res, { paymentMade: false, txHash: "", amountPaid: 0, blocked: true, error: msg });
    }

    if (!cfg.acceptedChains.includes(challenge.chain)) {
      const msg = `Chain not accepted: ${challenge.chain}`;
      log(" ", msg);
      return attachMeta(res, { paymentMade: false, txHash: "", amountPaid: 0, blocked: true, error: msg });
    }
    if (!cfg.acceptedTokens.includes(challenge.token)) {
      const msg = `Token not accepted: ${challenge.token}`;
      log(" ", msg);
      return attachMeta(res, { paymentMade: false, txHash: "", amountPaid: 0, blocked: true, error: msg });
    }
    if (amount > cfg.maxAmountPerCall) {
      const msg = `Amount $${amount} exceeds per-call limit $${cfg.maxAmountPerCall}`;
      log(" ", msg);
      return attachMeta(res, { paymentMade: false, txHash: "", amountPaid: 0, blocked: true, error: msg });
    }

    // Budget check in micro-units to avoid float drift
    const amountMicro = Math.round(amount * MICRO);
    // amountPaid is what the wallet actually deducted — consistent with wallet's micro arithmetic
    const amountPaid = amountMicro / MICRO;
    const maxSpendMicro = isFinite(cfg.maxTotalSpend)
      ? Math.round(cfg.maxTotalSpend * MICRO)
      : Number.MAX_SAFE_INTEGER;
    if (totalSpentMicro + amountMicro > maxSpendMicro) {
      const msg = `Total spend limit reached ($${cfg.maxTotalSpend})`;
      log(" ", msg);
      return attachMeta(res, { paymentMade: false, txHash: "", amountPaid: 0, blocked: true, error: msg });
    }

    log(`  💳 Price: $${amount} ${challenge.token} → ${challenge.address} (chain: ${challenge.chain})`);

    // 5. Deduct from wallet
    let txId: string;
    try {
      txId = wallet.deduct(amount, challenge.address);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("  Wallet deduction failed:", msg);
      return attachMeta(res, { paymentMade: false, txHash: "", amountPaid: 0, blocked: true, error: msg });
    }

    // 6. Pay via provider (with timeout — rollback if timed out or throws)
    const requestId = crypto.randomUUID().replace(/-/g, "");
    let txHash: string;
    try {
      txHash = await withTimeout(
        provider.pay(challenge, requestId),
        paymentTimeoutMs,
        "provider.pay()"
      );
    } catch (err) {
      wallet.rollback(txId);
      const msg = err instanceof Error ? err.message : String(err);
      log("  Payment failed (rolled back):", msg);
      return attachMeta(res, { paymentMade: false, txHash: "", amountPaid: 0, blocked: false, error: msg });
    }

    log(`  ✓ tx: ${txHash}`);

    // Update total spend AFTER successful payment, BEFORE retry
    totalSpentMicro += amountMicro;

    // 7. Retry with payment proof
    //
    // buildAuthorization validates field values (rejects CR/LF/quotes).
    // If the provider returns a malformed address, we must NOT throw here —
    // the payment already left the wallet. Fall back to a minimal proof
    // so the retry still succeeds and amountPaid is recorded correctly.
    let authHeader: string;
    try {
      const proof: X402PaymentProof = {
        txHash,
        chain: challenge.chain,
        payerAddress: provider.getAddress(),
        requestId,
      };
      authHeader = buildAuthorization(proof);
    } catch {
      // provider.getAddress() returned unsafe characters — omit payerAddress
      log("  WARNING: provider.getAddress() returned unsafe value — omitting from proof");
      authHeader = buildAuthorization({ txHash, chain: challenge.chain, requestId });
    }

    // Merge original headers with Authorization, preserving all original headers.
    // When input is a Request object its headers live on input.headers, not init.headers.
    // We must seed retryHeaders from the Request's own headers first, then overlay
    // init.headers (if any), then set Authorization — matching fetch spec merge order.
    const baseHeaders =
      input instanceof Request ? input.headers : init?.headers;
    const retryHeaders = new Headers(baseHeaders);
    if (input instanceof Request && init?.headers) {
      new Headers(init.headers).forEach((value, key) => retryHeaders.set(key, value));
    }
    retryHeaders.set("Authorization", authHeader);

    log("  ↺ retrying with proof...");
    const retryRes = await fetchImpl(input, { ...init, headers: retryHeaders });

    if (!retryRes.ok) {
      // Do NOT rollback — chain payment already made.
      log(`  Retry failed (${retryRes.status}) — payment was made, no rollback`);
      return attachMeta(retryRes, {
        paymentMade: true,
        txHash,
        amountPaid,
        blocked: false,
        error: `Retry failed with status ${retryRes.status}`,
      });
    }

    log(`  ✓ success ($${amountPaid.toFixed(6)} paid)`);
    return attachMeta(retryRes, { paymentMade: true, txHash, amountPaid, blocked: false });
  }

  x402Fetch.getTotalSpent = (): number => totalSpentMicro / MICRO;

  return x402Fetch as X402FetchFunction;
}
