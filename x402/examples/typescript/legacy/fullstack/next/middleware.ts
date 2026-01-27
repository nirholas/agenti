/**
 * @file middleware.ts
 * @author nich
 * @copyright (c) 2026 nich
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 0.14.9.3
 */

import { Address } from "viem";
import { paymentMiddleware, Network, Resource } from "x402-next";

const facilitatorUrl = process.env.NEXT_PUBLIC_FACILITATOR_URL as Resource;
const payTo = process.env.RESOURCE_WALLET_ADDRESS as Address;
const network = process.env.NETWORK as Network;

export const middleware = paymentMiddleware(
  payTo,
  {
    "/protected": {
      price: "$0.01",
      network,
      config: {
        description: "Access to protected content",
      },
    },
  },
  {
    url: facilitatorUrl,
  },
  {
    appName: "Next x402 Demo",
    appLogo: "/x402-icon-blue.png",
  },
);

// Configure which paths the middleware should run on
export const config = {
  matcher: ["/protected/:path*"],
  runtime: "nodejs",
};


/* universal-crypto-mcp © nicholas */