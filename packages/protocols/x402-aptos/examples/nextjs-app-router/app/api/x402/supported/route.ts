import { createSupportedHandler } from "x402a-next/middleware";

/**
 * GET /api/x402/supported
 *
 * Returns supported payment types for this service
 */

const config = {
  payTo: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  routes: {
    "/api/stream": {
      price: "1000000",
      network: "aptos-testnet" as const,
    },
    "/api/premium/*": {
      price: "500000",
      network: "aptos-testnet" as const,
    },
  },
};

export const GET = createSupportedHandler(config);
