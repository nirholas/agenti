/**
 * Server-side example: using the x402 protocol utilities to build
 * a WWW-Authenticate challenge on the selling/gateway side.
 *
 * This shows how a Node.js HTTP server (or Express route handler)
 * can emit the 402 challenge that @ag402/fetch understands.
 *
 * Run with: npx tsx examples/server-side-challenge.ts
 */

import { buildWwwAuthenticate, parseAuthorization, descriptorToChallenge } from "../src/index.js";
import { createServer } from "node:http";

// Service descriptor — define once, reuse for all 402 responses on this route
const serviceDescriptor = {
  endpoint: "http://localhost:3402/data",
  price: "0.05",
  chain: "solana",
  token: "USDC",
  address: "YourSolanaRecipientAddress",
  serviceHash: "sha256_of_service_terms",
};

const challenge = descriptorToChallenge(serviceDescriptor);
const wwwAuth = buildWwwAuthenticate(challenge);

const server = createServer((req, res) => {
  if (req.url === "/data") {
    const authHeader = req.headers["authorization"] ?? "";
    const proof = parseAuthorization(authHeader);

    if (!proof || !proof.txHash) {
      // No valid x402 proof — emit 402 challenge
      res.writeHead(402, {
        "WWW-Authenticate": wwwAuth,
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ error: "Payment required", challenge: wwwAuth }));
      return;
    }

    // Proof present — verify it on-chain (not shown), then serve content
    console.log("[server] proof received:", proof.txHash, "from:", proof.payerAddress);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: "paid content", txHash: proof.txHash }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3402, () => {
  console.log("x402 demo server listening on http://localhost:3402");
  console.log("WWW-Authenticate challenge:", wwwAuth);
  console.log("\nTest with: curl -i http://localhost:3402/data");
});
