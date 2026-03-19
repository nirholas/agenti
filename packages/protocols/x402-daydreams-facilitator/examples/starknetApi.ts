/**
 * Starknet Paid API Example - Resource Server using the Facilitator
 *
 * Usage:
 *   1. Start the facilitator (Starknet enabled):
 *      STARKNET_NETWORKS=starknet-mainnet,starknet-sepolia \
 *      STARKNET_SPONSOR_ADDRESS=0x... \
 *      STARKNET_PAYMASTER_ENDPOINT_STARKNET_MAINNET=https://starknet.paymaster.avnu.fi \
 *      STARKNET_PAYMASTER_ENDPOINT_STARKNET_SEPOLIA=https://starknet.paymaster.avnu.fi \
 *      STARKNET_PAYMASTER_API_KEY=your-avnu-api-key \
 *      bun run dev
 *   2. Start this server:
 *      STARKNET_PAY_TO=0x... bun run examples/starknetApi.ts
 *
 * Environment variables:
 *   - PORT: Server port (default: 4024)
 *   - FACILITATOR_URL: Facilitator URL (default: http://localhost:8090)
 *   - STARKNET_NETWORK: starknet:SN_MAIN | starknet:SN_SEPOLIA (default: starknet:SN_SEPOLIA)
 *   - STARKNET_PAY_TO: Recipient address for payments (required)
 *   - STARKNET_PRICE: ETH amount for this endpoint (default: 0.0001)
 *
 * Endpoints:
 *   GET /api/starknet-premium - Exact payment (ETH on Starknet)
 */

import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { buildETHPayment } from "x402-starknet";
import { createPaywall, evmPaywall } from "@x402/paywall";

import { createElysiaPaidRoutes } from "@daydreamsai/facilitator/elysia";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import {
  toStarknetCanonicalCaip,
  toStarknetLegacyCaip,
} from "@daydreamsai/facilitator/networks";

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number(process.env.PORT ?? 4024);
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:8090";
const NETWORK = toStarknetCanonicalCaip(
  process.env.STARKNET_NETWORK ?? "starknet:SN_SEPOLIA"
);
const LEGACY_NETWORK = NETWORK ? toStarknetLegacyCaip(NETWORK) : undefined;
const PAY_TO = process.env.STARKNET_PAY_TO;
const PRICE = Number(process.env.STARKNET_PRICE ?? "0.0001");

if (!PAY_TO || !NETWORK || !LEGACY_NETWORK) {
  console.error("Set STARKNET_PAY_TO to run Starknet API example.");
  process.exit(1);
}

// ============================================================================
// Setup
// ============================================================================

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = createResourceServer(facilitatorClient);

// Paywall provider for browser-based payment UI
const paywallProvider = createPaywall().withNetwork(evmPaywall).build();

const paymentRequirements = buildETHPayment({
  network: LEGACY_NETWORK,
  amount: PRICE,
  payTo: PAY_TO,
  maxTimeoutSeconds: 120,
});

// ============================================================================
// Route Configuration
// ============================================================================

export const app = new Elysia({
  prefix: "/api",
  name: "starknetPaidApi",
  adapter: node(),
});

createElysiaPaidRoutes(app, {
  basePath: "/api",
  middleware: {
    resourceServer,
    paywallProvider,
    paywallConfig: {
      appName: "Starknet Paid API",
      testnet: NETWORK === "starknet:SN_SEPOLIA",
    },
  },
}).get("/starknet-premium", () => ({ message: "premium starknet content" }), {
  payment: {
    accepts: {
      scheme: "exact" as const,
      network: NETWORK,
      payTo: PAY_TO,
      price: {
        amount: paymentRequirements.amount,
        asset: paymentRequirements.asset,
      },
    },
    description: "Starknet premium endpoint",
    mimeType: "application/json",
  },
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT);
console.log(`
Starknet API listening on http://localhost:${PORT}
Facilitator: ${FACILITATOR_URL}
Network: ${NETWORK}

Endpoints:
  GET /api/starknet-premium - Exact payment (${PRICE} ETH on Starknet)
`);
