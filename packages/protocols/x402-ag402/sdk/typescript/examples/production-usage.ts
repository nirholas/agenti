/**
 * Production usage example: real on-chain USDC payments via @ag402/solana.
 *
 * This is the reference example for production deployments. It uses
 * SolanaPaymentProvider (from @ag402/solana) to broadcast real USDC
 * transfers on Solana when a 402 challenge is received.
 *
 * Prerequisites:
 *   npm install @ag402/fetch @ag402/solana
 *
 * NOTE: @ag402/solana is not yet published to npm. Until it is, build
 * from source:
 *   cd sdk/solana && npm install && npm run build
 *
 * Required environment variable:
 *   SOLANA_PRIVATE_KEY  — your wallet's base58-encoded private key
 *                         (the same key used by Python ag402-core)
 *
 * Optional environment variables (shown in the mainnet section below):
 *   SOLANA_RPC_URL      — your RPC endpoint (Helius, QuickNode, etc.)
 *
 * Run with: npx tsx examples/production-usage.ts
 */

import { createX402Fetch, InMemoryWallet } from "../src/index.js";

// fromEnv() reads SOLANA_PRIVATE_KEY from the environment.
// SolanaPaymentProvider is the real on-chain payment provider.
import { fromEnv, MAINNET_USDC_MINT } from "@ag402/solana";

// ─── Devnet example (default) ─────────────────────────────────────────────────
//
// fromEnv() with no arguments connects to Solana devnet using the official
// devnet USDC mint. Safe for development — uses test funds only.

async function devnetExample() {
  // fromEnv() throws immediately if SOLANA_PRIVATE_KEY is not set,
  // so configuration errors surface at startup rather than mid-request.
  const provider = fromEnv();

  console.log("Payer address:", provider.getAddress());

  const wallet = new InMemoryWallet(10); // $10 local budget cap

  const apiFetch = createX402Fetch({
    wallet,
    provider,                  // real on-chain payments — no mock
    config: {
      maxAmountPerCall: 1.00,  // reject challenges > $1 per call
      maxTotalSpend: 5.00,     // stop after $5 total spend this session
      debug: false,            // set to true for payment event logging
    },
    // If provider.pay() doesn't resolve in 30 s, wallet deduction is
    // rolled back automatically. Increase for slow RPC endpoints.
    paymentTimeoutMs: 30_000,
  });

  try {
    const res = await apiFetch("https://api.example.com/paid-data");

    if (res.x402.blocked) {
      // Local budget rule rejected the challenge before any payment was attempted.
      console.error("Blocked by budget rule:", res.x402.error);
      return;
    }

    if (!res.ok) {
      if (res.x402.paymentMade) {
        // Payment was broadcast on-chain but the service returned an error.
        // Do NOT retry automatically — the tx hash is real and the server
        // should accept it on a subsequent request (server-side dedup via memo).
        console.error("Payment sent but service failed:");
        console.error("  tx hash :", res.x402.txHash);
        console.error("  status  :", res.status);
        console.error("  error   :", res.x402.error);
      } else {
        console.error("Request failed:", res.status, res.x402.error);
      }
      return;
    }

    const data = await res.text();
    console.log("Response:", data);
    console.log("Payment made   :", res.x402.paymentMade);
    console.log("Tx hash        :", res.x402.txHash);   // real Solana signature
    console.log("Amount paid    :", `$${res.x402.amountPaid}`);
    console.log("Remaining local budget:", `$${wallet.getBalance()}`);
    console.log("Session total spent   :", `$${apiFetch.getTotalSpent()}`);
  } catch (err) {
    // Thrown only on network-level errors (DNS failure, connection reset).
    // No payment was made at this point.
    console.error("Network error:", err);
  }
}

// ─── Mainnet example ──────────────────────────────────────────────────────────
//
// For mainnet you MUST:
//   1. Pass your mainnet RPC URL (public endpoints are rate-limited and
//      unsuitable for production — use Helius, QuickNode, Triton, etc.)
//   2. Pass usdcMint: MAINNET_USDC_MINT (the official mainnet USDC mint).
//      Omitting this with a mainnet RPC throws an error at construction time
//      so the misconfiguration is caught before any funds are at risk.
//   3. Consider confirmationLevel: "finalized" for large payments (>$100).
//      "confirmed" (~12-16 s) is fine for micropayments.

async function mainnetExample() {
  // SOLANA_RPC_URL is REQUIRED for mainnet. Public RPC endpoints are
  // rate-limited and unsuitable for production — use Helius, QuickNode,
  // Triton, etc. The check below prevents accidental use of a public endpoint.
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      "SOLANA_RPC_URL is required for mainnet. " +
      "Public endpoints are rate-limited and unsuitable for production. " +
      "Sign up for a dedicated RPC at https://helius.dev or https://quicknode.com"
    );
  }

  const provider = fromEnv({
    rpcUrl,
    usdcMint: MAINNET_USDC_MINT,
    // confirmationLevel: "finalized", // uncomment for >$100 payments
  });

  const wallet = new InMemoryWallet(50); // $50 local budget cap

  const apiFetch = createX402Fetch({
    wallet,
    provider,
    config: {
      maxAmountPerCall: 5.00,
      maxTotalSpend: 50.00,
    },
    paymentTimeoutMs: 60_000, // mainnet can be slower than devnet
  });

  const res = await apiFetch("https://api.example.com/premium-data");

  if (res.ok && res.x402.paymentMade) {
    console.log("Paid:", res.x402.txHash);
    // Verify on Solscan: https://solscan.io/tx/<txHash>
  }
}

// ─── Concurrent requests warning ─────────────────────────────────────────────
//
// createX402Fetch instances are NOT safe for concurrent calls on the same
// instance. Two parallel calls may both pass the budget check before either
// deducts, causing over-spend.
//
//   BAD:  await Promise.all([apiFetch(urlA), apiFetch(urlB)]);
//   GOOD: await apiFetch(urlA); await apiFetch(urlB);
//
// If you need concurrency, create one instance per call chain, or wrap
// concurrent invocations with an external mutex.

// Run devnet example by default
devnetExample();
