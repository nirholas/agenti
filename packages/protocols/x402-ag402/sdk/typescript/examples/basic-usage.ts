/**
 * Basic usage example: auto-pay a single x402-protected API endpoint.
 *
 * Run with: npx tsx examples/basic-usage.ts
 * (requires @ag402/fetch to be installed or path alias set up)
 *
 * NOTE: This example uses MockPaymentProvider — no real money is spent.
 * For production, replace with a real PaymentProvider (e.g. @ag402/solana).
 */

import { createX402Fetch, InMemoryWallet, MockPaymentProvider } from "../src/index.js";

async function main() {
  const wallet = new InMemoryWallet(10); // $10 test budget
  console.log("Initial balance:", wallet.getBalance());

  // Explicitly pass MockPaymentProvider to suppress the production warning.
  // In real usage, swap this for a real Solana payment provider.
  const apiFetch = createX402Fetch({
    wallet,
    provider: new MockPaymentProvider(),
    config: {
      maxAmountPerCall: 1.00,   // reject anything over $1/call
      maxTotalSpend: 5.00,      // stop after $5 total
      debug: false,             // set to true for payment event logging
    },
  });

  // This request will automatically handle a 402 if the server sends one.
  // If the server returns 200 directly, no payment is made.
  try {
    const res = await apiFetch("https://api.example.com/paid-data");

    if (res.x402.blocked) {
      console.error("Payment blocked by local budget rule:", res.x402.error);
      return;
    }

    if (!res.ok) {
      if (res.x402.paymentMade) {
        console.error("Payment sent but service failed:", res.x402.txHash, res.x402.error);
      } else {
        console.error("Request failed:", res.status, res.x402.error);
      }
      return;
    }

    const data = await res.text();
    console.log("Response:", data);
    console.log("Payment made:", res.x402.paymentMade);
    console.log("Amount paid:", res.x402.amountPaid);
    console.log("Tx hash:", res.x402.txHash);
    console.log("Remaining balance:", wallet.getBalance());
    console.log("Total spent this session:", apiFetch.getTotalSpent());
  } catch (err) {
    // Network-level error (DNS failure, connection reset, etc.)
    // No payment was made at this point.
    console.error("Network error:", err);
  }
}

main();
