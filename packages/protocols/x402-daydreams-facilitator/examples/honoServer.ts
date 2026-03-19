/**
 * Hono server runner for the x402 payment example
 *
 * Usage:
 *   1. Start the facilitator: bun run dev
 *   2. Start this server: bun run example:hono
 *   3. Run the client: bun run example:hono:client
 *
 * Environment variables:
 *   - PORT: Server port (default: 3000)
 *   - FACILITATOR_URL: Facilitator URL (default: http://localhost:8090)
 *   - EVM_ADDRESS: Payment recipient address (required)
 */

import { serve } from "@hono/node-server";
import app from "./hono.js";

const port = Number(3000);

console.log("Starting Hono x402 example server...");
console.log(
  `Facilitator URL: ${process.env.FACILITATOR_URL ?? "http://localhost:8090"}`
);
console.log(`Payment address: ${process.env.EVM_ADDRESS ?? "(not set)"}`);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
    console.log("\nEndpoints:");
    console.log("  GET  /weather       - Exact scheme ($0.001 per request)");
    console.log("  GET  /premium/data  - Upto scheme (batched payments)");
    console.log("  GET  /upto/session/:id - Check session status");
    console.log("  POST /upto/close    - Close and settle session");
  }
);
