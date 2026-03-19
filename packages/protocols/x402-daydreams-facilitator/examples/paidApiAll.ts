/**
 * Paid API Example - Single endpoint with EVM + Solana + Starknet payments
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
 *      EVM_PRIVATE_KEY=... \
 *      SVM_PRIVATE_KEY=... \
 *      STARKNET_PAY_TO=0x... \
 *      bun run examples/paidApiAll.ts
 *
 * Environment variables:
 *   - PORT: Server port (default: 4025)
 *   - FACILITATOR_URL: Facilitator URL (default: http://localhost:8090)
 *   - EVM_PRIVATE_KEY: EVM signer private key (required)
 *   - SVM_PRIVATE_KEY: Solana signer private key (required)
 *   - STARKNET_PAY_TO: Recipient address for Starknet payments (required)
 *   - STARKNET_NETWORK: starknet:SN_MAIN | starknet:SN_SEPOLIA (default: starknet:SN_SEPOLIA)
 *   - STARKNET_PRICE: ETH amount for Starknet payment (default: 0.0001)
 *
 * Endpoints:
 *   GET /api/premium-all - Exact payment (EVM + Solana + Starknet)
 */

import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { buildETHPayment } from "x402-starknet";
import { createPaywall, evmPaywall, svmPaywall } from "@x402/paywall";

import { createElysiaPaidRoutes } from "@daydreamsai/facilitator/elysia";
import {
  STARKNET_CAIP_IDS,
  toStarknetCanonicalCaip,
  toStarknetLegacyCaip,
  type StarknetCaipId,
  type StarknetLegacyCaipId,
} from "@daydreamsai/facilitator/networks";
import {
  createPrivateKeyEvmSigner,
  createPrivateKeySvmSigner,
} from "@daydreamsai/facilitator/signers";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import { getRpcUrl } from "@daydreamsai/facilitator/config";

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number(process.env.PORT ?? 4025);
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:8090";
const STARKNET_NETWORK = toStarknetCanonicalCaip(
  process.env.STARKNET_NETWORK ?? STARKNET_CAIP_IDS.SEPOLIA
) as StarknetCaipId | undefined;
const STARKNET_LEGACY_NETWORK = STARKNET_NETWORK
  ? (toStarknetLegacyCaip(STARKNET_NETWORK) as
      | StarknetLegacyCaipId
      | undefined)
  : undefined;
const STARKNET_PAY_TO = process.env.STARKNET_PAY_TO;
const STARKNET_PRICE = Number(process.env.STARKNET_PRICE ?? "0.0001");

if (!STARKNET_PAY_TO || !STARKNET_NETWORK || !STARKNET_LEGACY_NETWORK) {
  // eslint-disable-next-line no-console
  console.error("Set STARKNET_PAY_TO and STARKNET_NETWORK to run this example.");
  process.exit(1);
}

const evmRpcUrl = getRpcUrl("base-sepolia") ?? "https://sepolia.base.org";
const evmSigner = createPrivateKeyEvmSigner({
  network: "base-sepolia",
  rpcUrl: evmRpcUrl,
});
const [evmAddress] = evmSigner.getAddresses();
const svmSigner = await createPrivateKeySvmSigner();
const [svmAddress] = svmSigner.getAddresses();

// ============================================================================
// Setup
// ============================================================================

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = createResourceServer(facilitatorClient);

const paywallProvider = createPaywall()
  .withNetwork(evmPaywall)
  .withNetwork(svmPaywall)
  .build();

const starknetRequirements = buildETHPayment({
  network: STARKNET_LEGACY_NETWORK,
  amount: STARKNET_PRICE,
  payTo: STARKNET_PAY_TO,
  maxTimeoutSeconds: 120,
});

// ============================================================================
// Route Configuration
// ============================================================================

export const app = new Elysia({
  prefix: "/api",
  name: "paidApiAll",
  adapter: node(),
});

createElysiaPaidRoutes(app, {
  basePath: "/api",
  middleware: {
    resourceServer,
    paywallProvider,
    paywallConfig: {
      appName: "Paid API (Multi-Chain)",
      testnet: true,
    },
  },
}).get("/premium-all", () => ({ message: "premium content (multi-chain)" }), {
  payment: {
    accepts: [
      {
        scheme: "exact",
        network: "eip155:84532",
        payTo: evmAddress,
        price: "$0.01",
      },
      {
        scheme: "exact",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        payTo: svmAddress,
        price: "$0.01",
      },
      {
        scheme: "exact" as const,
        network: STARKNET_NETWORK,
        payTo: STARKNET_PAY_TO,
        price: {
          amount: starknetRequirements.amount,
          asset: starknetRequirements.asset,
        },
      },
    ],
    description: "Premium content (EVM + Solana + Starknet)",
    mimeType: "application/json",
  },
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT);
// eslint-disable-next-line no-console
console.log(`
Paid API (Multi-Chain) listening on http://localhost:${PORT}
Facilitator: ${FACILITATOR_URL}
Starknet: ${STARKNET_NETWORK}

Endpoints:
  GET /api/premium-all - Exact payment (EVM + Solana + Starknet)
`);
