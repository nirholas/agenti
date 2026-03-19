/**
 * Starknet Client Example - Calls the Starknet paid API using fetchWithPayment
 *
 * Usage:
 *   1. Start the facilitator (Starknet enabled):
 *      STARKNET_NETWORKS=starknet-mainnet,starknet-sepolia \
 *      STARKNET_SPONSOR_ADDRESS=0x... \
 *      STARKNET_PAYMASTER_ENDPOINT_STARKNET_MAINNET=https://starknet.paymaster.avnu.fi \
 *      STARKNET_PAYMASTER_ENDPOINT_STARKNET_SEPOLIA=https://starknet.paymaster.avnu.fi \
 *      STARKNET_PAYMASTER_API_KEY=your-avnu-api-key \
 *      bun run dev
 *   2. Start the Starknet API:
 *      STARKNET_PAY_TO=0x... bun run examples/starknetApi.ts
 *   3. Run this client:
 *      STARKNET_ACCOUNT_ADDRESS=0x... \
 *      STARKNET_ACCOUNT_PRIVATE_KEY=0x... \
 *      bun run examples/starknetClient.ts
 *
 * Environment variables:
 *   - BASE_URL: Paid API base URL (default: http://localhost:4024)
 *   - STARKNET_ACCOUNT_ADDRESS: Payer account address (required)
 *   - STARKNET_ACCOUNT_PRIVATE_KEY: Payer private key (required)
 *   - STARKNET_RPC_URL: Optional Starknet RPC URL override
 *   - STARKNET_NETWORK: starknet:SN_MAIN | starknet:SN_SEPOLIA (default: starknet:SN_SEPOLIA)
 *   - STARKNET_PAYMASTER_ENDPOINT: Optional paymaster endpoint override (default: AVNU)
 *   - STARKNET_PAYMASTER_API_KEY: Optional paymaster API key for build calls
 *
 * Notes:
 *   - Starknet payments require typedData. The unified client enforces this.
 */

import { Account } from "starknet";
import {
  createProvider,
  decodePaymentResponse,
  HTTP_HEADERS,
} from "x402-starknet";

import { createUnifiedClient } from "@daydreamsai/facilitator/client";
import {
  STARKNET_CAIP_IDS,
  toStarknetCanonicalCaip,
  toStarknetLegacyCaip,
  type StarknetCaipId,
  type StarknetLegacyCaipId,
} from "@daydreamsai/facilitator/networks";

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4024";
const STARKNET_ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS;
const STARKNET_ACCOUNT_PRIVATE_KEY = process.env.STARKNET_ACCOUNT_PRIVATE_KEY;
const STARKNET_RPC_URL = process.env.STARKNET_RPC_URL;
const STARKNET_PAYMASTER_API_KEY = process.env.STARKNET_PAYMASTER_API_KEY;
const STARKNET_PAYMASTER_ENDPOINT =
  process.env.STARKNET_PAYMASTER_ENDPOINT ??
  "https://starknet.paymaster.avnu.fi";
const PREFERRED_NETWORK = toStarknetCanonicalCaip(
  process.env.STARKNET_NETWORK ?? STARKNET_CAIP_IDS.SEPOLIA
) as StarknetCaipId | undefined;
const LEGACY_NETWORK = PREFERRED_NETWORK
  ? (toStarknetLegacyCaip(PREFERRED_NETWORK) as
      | StarknetLegacyCaipId
      | undefined)
  : undefined;

if (
  !STARKNET_ACCOUNT_ADDRESS ||
  !STARKNET_ACCOUNT_PRIVATE_KEY ||
  !PREFERRED_NETWORK ||
  !LEGACY_NETWORK
) {
  // eslint-disable-next-line no-console
  console.error(
    "Set STARKNET_ACCOUNT_ADDRESS, STARKNET_ACCOUNT_PRIVATE_KEY, and STARKNET_NETWORK to run."
  );
  process.exit(1);
}

const PATH = "/api/starknet-premium";

// ============================================================================
// Setup
// ============================================================================

const provider = createProvider({
  network: LEGACY_NETWORK,
  ...(STARKNET_RPC_URL ? { rpcUrl: STARKNET_RPC_URL } : {}),
});

const account = new Account({
  provider,
  address: STARKNET_ACCOUNT_ADDRESS,
  signer: STARKNET_ACCOUNT_PRIVATE_KEY,
});

const { fetchWithPayment } = createUnifiedClient({
  starknetExact: {
    account,
    paymasterEndpoint: STARKNET_PAYMASTER_ENDPOINT,
    ...(STARKNET_PAYMASTER_API_KEY
      ? { paymasterApiKey: STARKNET_PAYMASTER_API_KEY }
      : {}),
    networks: [PREFERRED_NETWORK],
  },
  paymentRequirementsSelector: (_x402Version, accepts) => {
    const preferred = accepts.find(
      (requirement) => requirement.network === PREFERRED_NETWORK
    );
    const fallback = accepts[0];
    if (preferred) return preferred;
    if (fallback) return fallback;
    throw new Error("No payment options available.");
  },
});

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("Requesting paid endpoint...");

  const response = await fetchWithPayment(`${BASE_URL}${PATH}`);

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error("Paid request failed:", response.status);
    // eslint-disable-next-line no-console
    console.error(await response.text());
    return;
  }

  const result = await response.json();
  // eslint-disable-next-line no-console
  console.log("Paid response:", result);

  const paymentResponse = response.headers.get(HTTP_HEADERS.PAYMENT_RESPONSE);
  if (paymentResponse) {
    const settlement = decodePaymentResponse(paymentResponse);
    // eslint-disable-next-line no-console
    console.log("Settlement:", settlement);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Client failed:", error);
  process.exit(1);
});
