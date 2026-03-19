import { Hono } from "hono";
import { paymentMiddleware } from "x402-hono";
import { Facilitator, createHonoAdapter } from "@x402-sovereign/core";
import { baseSepolia } from "viem/chains";

const app = new Hono();

// Initialize your sovereign facilitator
const facilitator = new Facilitator({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  networks: [baseSepolia],
});

createHonoAdapter(facilitator, app, "/facilitator");

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
      url: `http://localhost:3000/facilitator` as `${string}://${string}`,
    }
  )
);

// Implement your route
app.get("/protected-route", (c) => {
  return c.json({ message: "This content is behind a paywall" });
});

export default app;

