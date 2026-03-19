/**
 * Client for testing the Hono server example (examples/hono.ts)
 *
 * Tests both exact and upto payment schemes using fetchWithPayment.
 *
 * Usage:
 *   1. Start the facilitator: bun run dev
 *   2. Start the Hono server: bun run examples/hono.ts
 *   3. Run this client: CLIENT_EVM_PRIVATE_KEY=0x... bun run examples/honoClient.ts
 *
 * Environment variables:
 *   - HONO_URL: Hono server URL (default: http://localhost:3000)
 *   - FACILITATOR_URL: Facilitator URL (default: http://localhost:8090)
 *   - CLIENT_EVM_PRIVATE_KEY: Private key for signing payments (required)
 *   - RPC_URL: Optional EVM RPC URL (default: https://mainnet.base.org)
 */

import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { createUnifiedClient } from "@daydreamsai/facilitator/client";

const HONO_URL = process.env.HONO_URL ?? "http://localhost:3000";
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:8090";
const CLIENT_EVM_PRIVATE_KEY = process.env.CLIENT_EVM_PRIVATE_KEY;

if (!CLIENT_EVM_PRIVATE_KEY) {
  console.error("Set CLIENT_EVM_PRIVATE_KEY to run client");
  process.exit(1);
}

const account = privateKeyToAccount(CLIENT_EVM_PRIVATE_KEY as `0x${string}`);
console.log("Payer:", account.address);

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL ?? "https://mainnet.base.org"),
});

const { fetchWithPayment } = createUnifiedClient({
  evmExact: { signer: account },
  evmUpto: {
    signer: account,
    publicClient,
    facilitatorUrl: FACILITATOR_URL,
  },
});

async function paidFetch(path: string): Promise<Response> {
  return fetchWithPayment(`${HONO_URL}${path}`);
}

// ============================================================================
// Exact Scheme Test - /weather endpoint
// ============================================================================

async function testExactScheme(): Promise<boolean> {
  console.log("\n=== Testing Exact Scheme (/weather) ===");
  const res = await paidFetch("/weather");

  if (res.status === 402) {
    console.error("Exact payment failed: still 402 after payment attempt");
    return false;
  }

  if (!res.ok) {
    console.error("Exact payment failed:", res.status, await res.text());
    return false;
  }

  const data = await res.json();
  console.log("Weather data:", data);

  const txHeader =
    res.headers.get("X-PAYMENT-RESPONSE") ||
    res.headers.get("PAYMENT-RESPONSE");
  if (txHeader) {
    console.log("Settlement header present");
  } else {
    console.log("No settlement header (payment verified, settlement async)");
  }

  return true;
}

// ============================================================================
// Upto Scheme Test - /premium/data endpoint
// ============================================================================

async function testUptoScheme(): Promise<string | null> {
  console.log("\n=== Testing Upto Scheme (/premium/data) ===");
  let sessionId: string | null = null;

  for (let i = 0; i < 3; i++) {
    const res = await paidFetch("/premium/data");

    if (res.status === 402) {
      console.error("Upto payment failed: still 402 after payment attempt");
      return null;
    }

    if (!res.ok) {
      console.error("Request failed", res.status, await res.text());
      return null;
    }

    sessionId = res.headers.get("x-upto-session-id") ?? sessionId;
    console.log(`Request ${i + 1}:`, await res.json());
  }

  return sessionId;
}

// ============================================================================
// Session Management Test
// ============================================================================

async function testSessionManagement(sessionId: string | null): Promise<boolean> {
  console.log("\n=== Testing Session Management ===");

  if (!sessionId) {
    console.error("No session id returned; did payment succeed?");
    return false;
  }

  console.log("Session ID:", sessionId);

  const status1 = await fetch(`${HONO_URL}/upto/session/${sessionId}`).then(
    (res) => res.json()
  );
  console.log("Session status (before settle):", status1);

  const closeResult = await fetch(`${HONO_URL}/upto/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  }).then((res) => res.json());
  console.log("Close result:", closeResult);

  const status2 = await fetch(`${HONO_URL}/upto/session/${sessionId}`).then(
    (res) => res.json()
  );
  console.log("Session status (after settle):", status2);

  return true;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("=== Hono Server x402 Client Test ===");
  console.log("Hono URL:", HONO_URL);
  console.log("Facilitator URL:", FACILITATOR_URL);
  console.log("Payer:", account.address);

  const exactOk = await testExactScheme();
  if (!exactOk) {
    console.error("\nExact scheme test failed");
    process.exit(1);
  }
  console.log("Exact scheme test passed");

  const sessionId = await testUptoScheme();
  if (!sessionId) {
    console.error("\nUpto scheme test failed");
    process.exit(1);
  }
  console.log("Upto scheme test passed");

  const sessionOk = await testSessionManagement(sessionId);
  if (!sessionOk) {
    console.error("\nSession management test failed");
    process.exit(1);
  }
  console.log("Session management test passed");

  console.log("\n=== All tests passed ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
