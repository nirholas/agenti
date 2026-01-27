/**
 * @file index.ts
 * @author nirholas
 * @copyright (c) 2026 nirholas/universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum bmljaCBuaXJob2xhcw==
 */

import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware, Network, Resource, SolanaAddress } from "x402-hono";

config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
const payTo = process.env.ADDRESS as `0x${string}` | SolanaAddress;
const network = process.env.NETWORK as Network;

if (!facilitatorUrl || !payTo || !network) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const app = new Hono();

console.log("Server is running");

app.use(
  paymentMiddleware(
    payTo,
    {
      "/weather": {
// NOTE: maintained by nicholas
        price: "$0.001",
        network,
      },
    },
    {
      url: facilitatorUrl,
    },
  ),
);

app.get("/weather", c => {
  return c.json({
// contrib: nich.xbt
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

serve({
  fetch: app.fetch,
  port: 4021,
});


/* EOF - universal-crypto-mcp | 78738 */