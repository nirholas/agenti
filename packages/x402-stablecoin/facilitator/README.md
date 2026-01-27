# X402 Payment Facilitator Server

Production-ready payment facilitator for the X402 protocol on Arbitrum. Handles payment verification, gasless EIP-3009 settlements for Sperax USD ($USDs), and quote generation.

## Features

- ✅ **Payment Verification** - Verify on-chain token transfers
- 💸 **Gasless Settlements** - Execute EIP-3009 `transferWithAuthorization` for USDs
- 💰 **Quote Generation** - Return HTTP 402 Payment Required with pricing
- ⚡ **Rate Limiting** - Configurable per-endpoint rate limits
- 🔒 **Security** - Helmet, CORS, and production hardening
- 📊 **Logging** - Structured JSON logging with Winston
- 💾 **Caching** - LRU cache with TTL for payment status

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- (Optional) Private key for settlement execution

### Installation

```bash
cd facilitator

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Development

```bash
# Run in development mode with hot reload
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build image
docker build -t x402-facilitator .

# Run container
docker run -d \
  --name x402-facilitator \
  -p 3002:3002 \
  -e NETWORK=arbitrum-sepolia \
  -e PRIVATE_KEY=0x... \
  x402-facilitator
```

## API Endpoints

### POST /verify

Verify an on-chain payment transaction.

**Request:**
```json
{
  "txHash": "0x...",
  "paymentRequest": {
    "price": "0.001",
    "token": "USDs",
    "chain": "arbitrum",
    "recipient": "0x..."
  }
}
```

**Response:**
```json
{
  "verified": true,
  "txHash": "0x...",
  "timestamp": 1705000000000,
  "blockNumber": 12345678,
  "confirmations": 5
}
```

### POST /settle

Execute a gasless EIP-3009 settlement for USDs.

**Request:**
```json
{
  "authorization": {
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000000000000",
    "validAfter": 1705000000,
    "validBefore": 1705000300,
    "nonce": "0x...",
    "v": 27,
    "r": "0x...",
    "s": "0x..."
  },
  "paymentRequest": {
    "price": "1.0",
    "token": "USDs",
    "chain": "arbitrum",
    "recipient": "0x..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "timestamp": 1705000000000,
  "gasUsed": "50000",
  "effectiveGasPrice": "1000000000"
}
```

### POST /quote

Generate a payment quote (returns HTTP 402).

**Request:**
```json
{
  "service": "gpt-4",
  "params": {
    "maxTokens": 2000
  }
}
```

**Response (HTTP 402):**
```json
{
  "price": "0.002",
  "token": "USDs",
  "chain": "arbitrum",
  "recipient": "0x...",
  "deadline": 1705000300,
  "description": "gpt-4 API call",
  "facilitatorUrl": "http://localhost:3002",
  "x402Version": 1
}
```

### GET /payments/:txHash

Get payment status by transaction hash.

**Response:**
```json
{
  "txHash": "0x...",
  "verified": true,
  "settled": true,
  "amount": "1.0",
  "token": "USDs",
  "timestamp": 1705000000000,
  "blockNumber": 12345678,
  "age": 60000,
  "cached": true
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.0.0",
  "network": "arbitrum-sepolia",
  "paymentsProcessed": 100,
  "cacheSize": 50,
  "blockNumber": 12345678,
  "timestamp": 1705000000000
}
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3002` |
| `HOST` | Server host | `0.0.0.0` |
| `NETWORK` | `arbitrum` or `arbitrum-sepolia` | `arbitrum-sepolia` |
| `RPC_URL` | RPC endpoint URL | Public RPC |
| `PRIVATE_KEY` | Wallet private key for settlements | - |
| `RECIPIENT_ADDRESS` | Default payment recipient | - |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `PAYMENT_CACHE_TTL_MS` | Cache TTL | `86400000` |
| `LOG_LEVEL` | Winston log level | `info` |

## USDs Token Details

**Sperax USD ($USDs)** is an auto-yield stablecoin on Arbitrum.

- **Address:** `0xD74f5255D557944cf7Dd0E45FF521520002D5748`
- **Decimals:** 18
- **Features:**
  - Auto-rebasing yield
  - EIP-3009 `transferWithAuthorization` for gasless transfers
  - EIP-2612 `permit` for gasless approvals

## Architecture

```
facilitator/
├── src/
│   ├── server.ts           # Main Express server
│   ├── types.ts            # TypeScript types
│   ├── routes/
│   │   ├── verify.ts       # Payment verification
│   │   ├── settle.ts       # Gasless settlement
│   │   ├── quote.ts        # Quote generation
│   │   └── payments.ts     # Payment status
│   ├── services/
│   │   ├── arbitrum.ts     # Blockchain client
│   │   ├── usds.ts         # USDs contract interactions
│   │   └── cache.ts        # Payment caching
│   └── middleware/
│       ├── logger.ts       # Request logging
│       └── rateLimit.ts    # Rate limiting
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

## Security Considerations

1. **Private Key**: Never commit your private key. Use environment variables or secrets management.

2. **Rate Limiting**: Adjust rate limits based on your expected traffic.

3. **CORS**: In production, restrict `CORS_ORIGINS` to your frontend domains.

4. **RPC URL**: Use a private RPC endpoint for production (Alchemy, Infura, etc.).

5. **Read-Only Mode**: If `PRIVATE_KEY` is not set, settlements will fail but verification works.

## License

MIT
