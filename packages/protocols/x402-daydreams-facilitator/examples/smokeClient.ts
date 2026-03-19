/**
 * Smoke Test Client - Tests exact and upto payment schemes
 *
 * Usage:
 *   1. Start the facilitator: bun run dev
 *   2. Start the paid API: bun run examples/paidApi.ts
 *   3. Run this client: CLIENT_EVM_PRIVATE_KEY=0x... bun run examples/smokeClient.ts
 *
 * Environment variables:
 *   - CLIENT_EVM_PRIVATE_KEY: Private key for the payer wallet (required)
 *   - BASE_URL: Paid API URL (default: http://localhost:4022)
 *   - FACILITATOR_URL: Facilitator URL (default: http://localhost:8090)
 *   - RPC_URL: EVM RPC URL (default: EVM_RPC_URL_BASE env var)
 */

import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { createUnifiedClient } from "@daydreamsai/facilitator/client";

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4022";
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:8090";
const CLIENT_EVM_PRIVATE_KEY = process.env.CLIENT_EVM_PRIVATE_KEY;

if (!CLIENT_EVM_PRIVATE_KEY) {
  console.error("Set CLIENT_EVM_PRIVATE_KEY to run smoke client");
  process.exit(1);
}

// ============================================================================
// Setup
// ============================================================================

const account = privateKeyToAccount(CLIENT_EVM_PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL ?? process.env.EVM_RPC_URL_BASE),
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
  return fetchWithPayment(`${BASE_URL}${path}`);
}

// ============================================================================
// Exact Scheme Test
// ============================================================================

async function testExactScheme(): Promise<boolean> {
  console.log("\n=== Testing Exact Scheme ===");
  const path = "/api/premium";

  const res = await paidFetch(path);
  if (res.status === 402) {
    console.error("Exact payment failed: still 402 after payment attempt");
    return false;
  }
  if (!res.ok) {
    console.error("Exact payment failed:", res.status, await res.text());
    return false;
  }

  const data = await res.json();
  console.log("Exact scheme response:", data);

  const txHeader =
    res.headers.get("X-PAYMENT-RESPONSE") ||
    res.headers.get("PAYMENT-RESPONSE");
  if (txHeader) {
    console.log("Settlement header:", txHeader);
  } else {
    console.log(
      "No settlement response header (payment verified, settlement async)"
    );
  }

  return true;
}

// ============================================================================
// Upto Scheme Test
// ============================================================================

async function testUptoScheme(): Promise<boolean> {
  console.log("\n=== Testing Upto Scheme ===");
  const path = "/api/upto-premium";
  let sessionId: string | null = null;

  for (let i = 0; i < 3; i++) {
    const res = await paidFetch(path);

    if (res.status === 402) {
      console.error("Upto payment failed: still 402 after payment attempt");
      return false;
    }
    if (!res.ok) {
      console.error("Request failed:", res.status, await res.text());
      return false;
    }

    sessionId = res.headers.get("x-upto-session-id") ?? sessionId;
    console.log(`Upto response ${i + 1}:`, await res.json());
  }

  if (!sessionId) {
    console.error("No session id returned; did payment succeed?");
    return false;
  }

  console.log("Session ID:", sessionId);

  const status1 = await fetch(`${BASE_URL}/api/upto-session/${sessionId}`).then(
    (r) => r.json()
  );
  console.log("Session status (before settle):", status1);

  const closeResult = await fetch(`${BASE_URL}/api/upto-close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  }).then((r) => r.json());
  console.log("Close result:", closeResult);

  const status2 = await fetch(`${BASE_URL}/api/upto-session/${sessionId}`).then(
    (r) => r.json()
  );
  console.log("Session status (after settle):", status2);

  return true;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log("=== Smoke Test Client ===");
  console.log("Base URL:", BASE_URL);
  console.log("Facilitator URL:", FACILITATOR_URL);
  console.log("Payer:", account.address);

  const exactOk = await testExactScheme();
  if (!exactOk) {
    console.error("\nExact scheme test failed");
    process.exit(1);
  }

  const uptoOk = await testUptoScheme();
  if (!uptoOk) {
    console.error("\nUpto scheme test failed");
    process.exit(1);
  }

  console.log("\n=== All tests passed ===");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
