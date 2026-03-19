import { createPaymentMiddleware } from "x402a-next/middleware";

/**
 * x402a Payment Middleware Configuration
 *
 * This middleware protects API routes with Aptos micropayments
 *
 * SETUP REQUIRED:
 * 1. Copy .env.example to .env.local
 * 2. Add your NEXT_PUBLIC_FACILITATOR_ADDRESS (your Aptos wallet address)
 * 3. The contract is already deployed at the address in .env.example
 */
export const middleware = createPaymentMiddleware({
  // Address to receive payments (from environment variable)
  payTo: process.env.NEXT_PUBLIC_FACILITATOR_ADDRESS || "",

  // Protected routes and their payment requirements
  routes: {
    "/api/stream": {
      price: "1000000", // 0.01 APT in octas
      network:
        (process.env.NEXT_PUBLIC_APTOS_NETWORK as "aptos-testnet" | "aptos-mainnet") ||
        "aptos-testnet",
      description: "Audio streaming access",
    },
    "/api/premium/*": {
      price: "500000", // 0.005 APT
      network:
        (process.env.NEXT_PUBLIC_APTOS_NETWORK as "aptos-testnet" | "aptos-mainnet") ||
        "aptos-testnet",
      description: "Premium content access",
    },
  },

  // REAL FACILITATOR - Submits actual blockchain transactions!
  // This uses the /api/facilitator/verify endpoint
  facilitator: {
    url: process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api/facilitator`
      : "http://localhost:3001/api/facilitator", // Must be absolute URL for Edge middleware
    timeout: 90000, // 90 seconds (increased to accommodate blockchain confirmation + network latency)
  },

  // Optional: Lifecycle hooks
  onPaymentRequired: async (_req, requirements) => {
    console.log("[x402a] Payment required:", requirements);
  },

  onPaymentVerified: async (_req, payer) => {
    console.log("[x402a] Payment verified from:", payer);
    // You can log to database, trigger analytics, etc.
  },

  onPaymentSettled: async (_req, txHash) => {
    console.log("[x402a] Payment settled, tx:", txHash);
  },

  onPaymentError: async (_req, error) => {
    console.error("[x402a] Payment error:", error);
  },

  // Enable debug logging
  debug: true,
});

// Configure which routes the middleware should run on
// IMPORTANT: Only match protected routes, exclude /api/facilitator/* and /api/x402/*
export const config = {
  matcher: ["/api/stream", "/api/premium/:path*"],
};
