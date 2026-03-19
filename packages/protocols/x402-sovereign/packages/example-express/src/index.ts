import express from "express";
import { paymentMiddleware } from "x402-express";
import { Facilitator, createExpressAdapter } from "@x402-sovereign/core";
import { baseSepolia } from "viem/chains";

const app = express();

// Parse JSON bodies
app.use(express.json());

// Initialize your sovereign facilitator
const facilitator = new Facilitator({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  networks: [baseSepolia],
});

// Add facilitator endpoints using the Express adapter
// This mounts GET /facilitator/supported, POST /facilitator/verify, POST /facilitator/settle
createExpressAdapter(facilitator, app, "/facilitator");

// Configure the payment middleware
app.use(
  paymentMiddleware(
    "0x0ED6Cec17F860fb54E21D154b49DAEFd9Ca04106",
    {
      "/protected-route": {
        price: "$0.10",
        network: "base-sepolia",
        config: {
          description: "Access to premium content",
        },
      },
    },
    {
      url: "http://localhost:3000/facilitator",
    }
  )
);

// Example: A simple route
app.get("/", (req, res) => {
  res.json({
    message: "X402 Sovereign Facilitator - Express Example",
    endpoints: {
      supported: "GET /facilitator/supported",
      verify: "POST /facilitator/verify",
      settle: "POST /facilitator/settle",
    },
  });
});

// Implement your protected route
app.get("/protected-route", (req, res) => {
  res.json({ message: "This content is behind a paywall" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Facilitator endpoints available at http://localhost:${PORT}/facilitator`);
});

