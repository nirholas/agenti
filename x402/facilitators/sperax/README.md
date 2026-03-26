# Sperax x402 Facilitator

x402 payment facilitator by [SperaxOS](https://sperax.io) — verifies and settles EIP-3009 USDC micropayments.

## Facilitator Endpoint

```
https://x402.sperax.io
```

## Supported Networks

- **Base** (chain ID: 8453)
- **Base Sepolia** (chain ID: 84532)

## Integration with Agenti

Agenti agents can use the Sperax facilitator for autonomous x402 payments:

```ts
const facilitatorUrl = "https://x402.sperax.io";

// Verify a payment
const verifyRes = await fetch(`${facilitatorUrl}/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ paymentPayload, paymentRequirements }),
});

// Settle a payment
const settleRes = await fetch(`${facilitatorUrl}/settle`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ paymentPayload, paymentRequirements }),
});
```

## Source Code

Full implementation: [github.com/nirholas/x402-facilitator](https://github.com/nirholas/x402-facilitator)

## About SperaxOS

SperaxOS is an AI Agent Workspace where agents can autonomously pay for premium APIs and trade with other agents using x402 micropayments.

- Website: [sperax.io](https://sperax.io)
- App: [chat.sperax.io](https://chat.sperax.io)
