# X402 Sovereign Facilitator - Express Example

This example demonstrates how to set up a sovereign X402 payment facilitator using Express.

## What is a Facilitator?

A facilitator is a service that handles payment verification and settlement for X402 payments. Instead of relying on Coinbase's hosted facilitator, this example shows how to run your own.

## Features

- ✅ Self-hosted payment facilitator
- ✅ EVM network support (Base, Optimism, etc.)
- ✅ Express integration with `createExpressAdapter`
- ✅ Payment middleware for protecting routes

## Setup

1. Install dependencies:

```bash
bun install
```

2. Set your environment variables:

```bash
export EVM_PRIVATE_KEY="0x..."
```

3. Run the server:

```bash
bun run dev
```

## How it Works

### 1. Initialize the Facilitator

```typescript
import { Facilitator, createExpressAdapter } from "@x402-sovereign/core";
import { baseSepolia } from "viem/chains";

const facilitator = new Facilitator({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  networks: [baseSepolia],
});
```

### 2. Mount Facilitator Endpoints

The Express adapter automatically sets up three endpoints:

```typescript
createExpressAdapter(facilitator, app, "/facilitator");
```

This creates:
- `GET /facilitator/supported` - Lists supported payment types
- `POST /facilitator/verify` - Verifies a payment authorization
- `POST /facilitator/settle` - Settles a payment on-chain

### 3. Add Payment Middleware

```typescript
import { paymentMiddleware } from "x402-express";

app.use(
  paymentMiddleware(
    "0x0ED6Cec17F860fb54E21D154b49DAEFd9Ca04106", // Your wallet address
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
```

### 4. Create Protected Routes

```typescript
app.get("/protected-route", (req, res) => {
  res.json({ message: "This content is behind a paywall" });
});
```

## Testing

Test the facilitator endpoints:

```bash
# Check supported payment types
curl http://localhost:3000/facilitator/supported

# Access a protected route (requires payment)
curl http://localhost:3000/protected-route
```

## Multi-Network Support

You can support multiple networks by passing them to the Facilitator:

```typescript
import { base, baseSepolia, optimism } from "viem/chains";

const facilitator = new Facilitator({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY!,
  networks: [base, baseSepolia, optimism],
});
```

## Security Notes

- Never commit your `EVM_PRIVATE_KEY` to version control
- Use environment variables for all sensitive data
- Consider using a dedicated wallet for your facilitator
- Monitor your facilitator for suspicious activity

## Learn More

- [X402 Protocol Documentation](https://docs.x402.org)
- [Coinbase Facilitator Guide](https://docs.cdp.coinbase.com/x402-protocol/docs/facilitator)

