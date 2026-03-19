# @x402-sovereign/example-hono

Complete example showing how to build **sovereign x402 payment infrastructure** in a **single server**:

- **Facilitator endpoints** (`/facilitator/*`) - Using `@x402-sovereign/core`
- **Paywalled API** - Using `x402-hono` middleware pointing to local facilitator

## Features

- ✅ **Single server**: Facilitator + Paywalled API in one process
- ✅ **Sovereign payments**: Your own facilitator using `@x402-sovereign/core`
- ✅ **Self-contained**: API middleware points to local facilitator routes
- ✅ **Easy deployment**: One server to deploy
- ✅ **Multi-network support**: Base, Base Sepolia (easily extensible)
- ✅ **Real payment flow**: Complete end-to-end payment protocol

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│             Single Server (Port 3000)                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Facilitator Routes                                      │
│  ├─ /facilitator/supported                               │
│  ├─ /facilitator/verify                                  │
│  └─ /facilitator/settle                                  │
│       ▲                                                   │
│       │ (internal)                                        │
│       │                                                   │
│  API Routes (protected by x402-hono)                     │
│  ├─ / (free)                                             │
│  ├─ /health (free)                                       │
│  ├─ /weather ($0.001) ──────┘                            │
│  └─ /premium ($0.01) ────────┘                           │
│                                                           │
│  Uses @x402-sovereign/core                               │
│  • Verifies payments                                     │
│  • Settles on-chain                                      │
│  • Your private key                                      │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

From the monorepo root:

```bash
bun install
```

### 2. Set Up Environment Variables

Create a `.env` file in the monorepo root:

```bash
# Your EVM private key (must have ETH for gas on supported networks)
EVM_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Your wallet address where payments are sent (typically same as EVM_PRIVATE_KEY address)
PAY_TO=0x1234567890abcdef1234567890abcdef12345678

# Network to use (base-sepolia or base)
NETWORK=base-sepolia

# Server port (default: 3000)
PORT=3000
```

⚠️ **Security Warning**: Never commit your `.env` file or expose your private keys!

### 3. Run the Server

From the monorepo root:

```bash
bun run --filter @x402-sovereign/example-hono dev
```

Or from this directory:

```bash
bun run dev
```

### 4. Test It Out

Once the server is running:

**Check the server info:**
```bash
curl http://localhost:3000
```

**Check facilitator status:**
```bash
curl http://localhost:3000/facilitator/supported
# Shows supported networks
```

**Try accessing paid content (will get 402):**
```bash
curl http://localhost:3000/weather
# Returns 402 Payment Required with payment requirements
```

**Access free endpoints:**
```bash
curl http://localhost:3000/health
# Returns health status
```

## API Endpoints

All endpoints are on `http://localhost:3000` (or your configured PORT)

### Facilitator Routes

#### `GET /facilitator`
Facilitator information.

#### `GET /facilitator/supported`
Returns the list of payment kinds this facilitator supports.

**Response:**
```json
{
  "kinds": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base-sepolia"
    }
  ]
}
```

#### `POST /facilitator/verify`
Verifies a payment authorization without settling it on-chain.

#### `POST /facilitator/settle`
Settles a payment by broadcasting the transaction to the blockchain.

### API Routes

#### `GET /` (Free)
Information about the server and all endpoints.

#### `GET /health` (Free)
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-25T10:00:00.000Z"
}
```

#### `GET /weather` (Paid: $0.001)
Current weather report. Requires payment via x402 protocol.

**Response (after payment):**
```json
{
  "report": {
    "location": "San Francisco",
    "weather": "sunny",
    "temperature": 70,
    "humidity": 65,
    "wind": "10 mph NW",
    "timestamp": "2025-10-25T10:00:00.000Z"
  }
}
```

#### `GET /premium` (Paid: $0.01)
Premium content access. Requires payment via x402 protocol.

**Response (after payment):**
```json
{
  "message": "Welcome to premium content! 🎉",
  "secrets": [...],
  "exclusiveData": {
    "insight": "This data costs $0.01 to access",
    "value": "But it's worth every penny! 💎"
  }
}
```


## Making Payments

To actually pay for the protected endpoints, you'll need an x402-compatible client. You can use:

1. **x402-fetch** (programmatic):
```typescript
import { wrapFetchWithPayment, createSigner } from "x402-fetch";

const signer = await createSigner("base-sepolia", BUYER_PRIVATE_KEY);
const fetchWithPayment = wrapFetchWithPayment(fetch, signer);

// This will automatically handle the 402 response and make payment
const response = await fetchWithPayment("http://localhost:4021/weather");
const data = await response.json();
console.log(data.report);
```

2. **Browser with wallet** - The x402-hono middleware includes a built-in paywall UI that works with browser wallets like MetaMask or Coinbase Wallet.

## Configuration

### Adding More Paid Endpoints

Edit `src/api.ts` and add more routes to the middleware config:

```typescript
app.use(
  paymentMiddleware(
    PAY_TO,
    {
      "/weather": { price: "$0.001", network: NETWORK },
      "/premium": { price: "$0.01", network: NETWORK },
      "/data": { price: "$0.05", network: NETWORK },  // Add new endpoint
    },
    { url: FACILITATOR_URL as `${string}://${string}` }
  )
);

// Then add the route handler
app.get("/data", (c) => {
  return c.json({ data: "expensive data" });
});
```

### Adding More Networks

Edit `src/facilitator.ts` and add more chains to the `networks` array:

```typescript
import { baseSepolia, base, mainnet, optimism } from "viem/chains";

const facilitator = new Facilitator({
  evmPrivateKey: EVM_PRIVATE_KEY,
  networks: [baseSepolia, base, mainnet, optimism],
  minConfirmations: 1,
});
```

### Changing Confirmation Requirements

Adjust the `minConfirmations` parameter:

```typescript
const facilitator = new Facilitator({
  evmPrivateKey: EVM_PRIVATE_KEY,
  networks: [baseSepolia, base],
  minConfirmations: 3, // Wait for 3 confirmations
});
```

## Production Deployment

### Deploy Facilitator

Your facilitator should be deployed securely:

1. Use environment variables for the private key
2. Consider using a hardware wallet or key management service
3. Enable HTTPS
4. Add rate limiting and authentication if needed
5. Monitor for failed transactions

### Deploy API

Your paywalled API can be deployed anywhere. Just point `FACILITATOR_URL` to your deployed facilitator.

### Example with Render.com

```bash
# Set environment variables in Render dashboard
EVM_PRIVATE_KEY=0x...
PAY_TO=0x...
NETWORK=base
FACILITATOR_URL=https://your-facilitator.onrender.com
```

## Learn More

- [x402 Protocol Documentation](https://x402.org)
- [@x402-sovereign/core](../core/README.md)
- [Hono Documentation](https://hono.dev)

