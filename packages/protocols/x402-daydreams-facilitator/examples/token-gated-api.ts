/**
 * Token-Gated API Example
 *
 * This example shows how to use the token-gate module to restrict access
 * to API endpoints based on ERC20 token holdings.
 *
 * Users must hold at least 100 USDC on Base to access the protected endpoints.
 *
 * Run with:
 *   cd examples
 *   bun run token-gated:api
 */

import { Elysia } from "elysia";
import {
  createTokenGateChecker,
  elysiaTokenGate,
  InMemoryTokenGateCache,
} from "@daydreamsai/facilitator/token-gate";

// For production, use Redis:
// import { RedisTokenGateCache } from "@daydreamsai/facilitator/token-gate/cache/redis";
// import Redis from "ioredis";

const PORT = parseInt(process.env.PORT || "3000", 10);

// Configure token requirement
const tokenChecker = createTokenGateChecker({
  requirement: {
    // Base mainnet - require 100 USDC to use service
    network: "eip155:8453",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    minimumBalance: 100_000_000n, // 100 USDC (6 decimals)
    tokenName: "USDC",
    decimals: 6,
  },
  validCacheTtlMs: 5 * 60 * 1000, // 5 min cache for valid wallets
  blockedCacheTtlMs: 5 * 60 * 1000, // 5 min block for empty wallets
  cache: new InMemoryTokenGateCache(),
  // For production with Redis:
  // cache: new RedisTokenGateCache({ redis: new Redis(process.env.REDIS_URL!) }),
  allowOnRpcFailure: false, // Fail closed (deny if RPC unavailable)
  rpcUrl: process.env.BASE_RPC_URL, // Optional: custom RPC URL
});

const app = new Elysia()
  // Public routes (no token gate)
  .get("/", () => ({
    message: "Token-Gated API",
    docs: {
      "/health": "Health check (public)",
      "/api/premium": "Premium endpoint (requires 100 USDC on Base)",
    },
  }))
  .get("/health", () => ({ status: "ok" }))

  // Protected routes (require token holdings)
  .group("/api", (api) =>
    api
      // Apply token gate to all /api/* routes
      .use(elysiaTokenGate({ checker: tokenChecker }))

      // This route requires holding 100 USDC
      .get("/premium", ({ tokenGate }: { tokenGate?: { balance: bigint; fromCache: boolean } }) => ({
        message: "Welcome, token holder!",
        yourBalance: tokenGate?.balance.toString(),
        fromCache: tokenGate?.fromCache,
      }))

      // Another protected route
      .get("/exclusive-data", () => ({
        data: "This is exclusive content for token holders",
        timestamp: new Date().toISOString(),
      }))
  );

app.listen(PORT);

console.log(`
🚀 Token-Gated API running on http://localhost:${PORT}

Endpoints:
  GET /           - API info (public)
  GET /health     - Health check (public)
  GET /api/premium - Premium content (requires 100 USDC on Base)
  GET /api/exclusive-data - Exclusive data (requires 100 USDC on Base)

To access protected endpoints, include your wallet address in the request:
  curl -H "x-wallet-address: 0xYourWalletAddress" http://localhost:${PORT}/api/premium

Token requirement:
  - Network: Base (eip155:8453)
  - Token: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
  - Minimum: 100 USDC

Cache behavior:
  - Valid wallets cached for 5 minutes
  - Insufficient balance wallets blocked for 5 minutes
`);
