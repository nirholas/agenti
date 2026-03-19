/**
 * Token-Metered API Client
 *
 * Simple client demonstrating x402 upto payments for token-metered AI.
 *
 * Usage:
 *   1. Start facilitator: bun run dev
 *   2. Start API: bun run examples/tokenMeteredApi.ts
 *   3. Run client: CLIENT_EVM_PRIVATE_KEY=0x... bun run examples/tokenMeteredClient.ts
 *
 * Environment:
 *   - CLIENT_EVM_PRIVATE_KEY: Payer wallet private key (required)
 *   - API_URL: Token-metered API URL (default: http://localhost:4024)
 *   - FACILITATOR_URL: Facilitator URL (default: http://localhost:8090)
 */

import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { createUnifiedClient } from "@daydreamsai/facilitator/client";

// ============================================================================
// Configuration
// ============================================================================

const API_URL = process.env.API_URL ?? "http://localhost:4024";
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:8090";
const CLIENT_EVM_PRIVATE_KEY = process.env.CLIENT_EVM_PRIVATE_KEY;

if (!CLIENT_EVM_PRIVATE_KEY) {
  console.error("Set CLIENT_EVM_PRIVATE_KEY to run the client");
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
  evmUpto: {
    signer: account,
    publicClient,
    facilitatorUrl: FACILITATOR_URL,
  },
});

// ============================================================================
// Chat Function
// ============================================================================

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  id: string;
  choices: Array<{ message: ChatMessage }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  x402?: {
    sessionId: string;
    cost: { units: string; usd: string };
    session: { cap: string; spent: string; remaining: string };
  };
}

async function chat(messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await fetchWithPayment(`${API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Chat failed (${res.status}): ${error}`);
  }

  return res.json();
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("Token-Metered AI Client");
  console.log("───────────────────────");
  console.log("API:", API_URL);
  console.log("Payer:", account.address);
  console.log();

  // Check pricing
  const pricing = await fetch(`${API_URL}/pricing`).then((r) => r.json());
  console.log("Pricing:", pricing.rates);
  console.log();

  // Send a few chat messages
  const prompts = [
    "Hello! What is 2+2?",
    "Explain quantum computing in one sentence.",
    "Write a haiku about payments.",
  ];

  let sessionId: string | undefined;

  for (const prompt of prompts) {
    console.log(`User: ${prompt}`);

    const response = await chat([
      { role: "system", content: "Be concise." },
      { role: "user", content: prompt },
    ]);

    const reply = response.choices[0]?.message.content ?? "(no response)";
    console.log(`Assistant: ${reply}`);
    console.log(`Tokens: ${response.usage.total_tokens} | Cost: ${response.x402?.cost.usd}`);
    console.log(`Session remaining: ${response.x402?.session.remaining}`);
    console.log();

    sessionId = response.x402?.sessionId;
  }

  // Check session status
  if (sessionId) {
    console.log("───────────────────────");
    const status = await fetch(`${API_URL}/session/${sessionId}`).then((r) => r.json());
    console.log("Final session status:", status);

    // Close and settle
    console.log("\nClosing session...");
    const closeResult = await fetch(`${API_URL}/session/${sessionId}/close`, {
      method: "POST",
    }).then((r) => r.json());
    if (closeResult.success && closeResult.transaction) {
      console.log("Settlement:", {
        settled: closeResult.settled,
        tx: closeResult.transaction,
        network: closeResult.network,
      });
    } else {
      console.log("Settlement:", closeResult);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
