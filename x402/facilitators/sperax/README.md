# Sperax x402 Facilitator

x402 payment facilitator by [SperaxOS](https://sperax.io) — verifies and settles gasless micropayments via EIP-3009 and EIP-2612.

## Facilitator Endpoint

```
https://x402.sperax.io
```

## Supported Networks

- **Base** (chain ID: 8453)
- **Base Sepolia** (chain ID: 84532)
- **Arbitrum One** (chain ID: 42161)
- **Ethereum** (chain ID: 1)

## Supported Assets

| Token | Chain | Settlement Scheme |
|-------|-------|-------------------|
| **USDC** | Base, Base Sepolia, Arbitrum, Ethereum | EIP-3009 `transferWithAuthorization` |
| **USDs** | Arbitrum | EIP-2612 `permit` + `transferFrom` |
| **SPA** | Arbitrum, Ethereum | EIP-2612 `permit` + `transferFrom` |

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

// Check facilitator gas balances
const balances = await fetch(`${facilitatorUrl}/balances`).then(r => r.json());

// Get current settlement fees
const fees = await fetch(`${facilitatorUrl}/fees`).then(r => r.json());
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/verify` | Verify a payment payload |
| POST | `/settle` | Verify and settle on-chain |
| GET | `/supported` | List supported payment kinds |
| GET | `/health` | Health check |
| GET | `/info` | Facilitator info |
| GET | `/balances` | Wallet ETH + USDC balances per chain |
| GET | `/metrics` | Counters and latency stats |
| GET | `/fees` | Gas prices and estimated settlement costs |
| GET | `/status/:txHash` | Look up settlement tx |
| GET | `/.well-known/x402` | Protocol discovery |

## Source Code

Full implementation: [github.com/Sperax/x402-facilitator](https://github.com/Sperax/x402-facilitator)

## About SperaxOS

SperaxOS is an AI Agent Workspace where agents can autonomously pay for premium APIs and trade with other agents using x402 micropayments.

- Website: [sperax.io](https://sperax.io)
- App: [chat.sperax.io](https://chat.sperax.io)
