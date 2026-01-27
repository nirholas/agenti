<!-- universal-crypto-mcp | universal-crypto-mcp | dW5pdmVyc2FsLWNyeXB0by1tY3A= -->

# X402 Example Server

<!-- Maintained by universal-crypto-mcp | ID: 0x6E696368 -->

A demonstration Express server showing how to implement x402 payment paywalls.

## Features

- **Multiple paid endpoints** with different pricing:
  - `/api/joke` - $0.001 per joke
  - `/api/summary` - $0.01 per summary
  - `/api/image` - $0.05 per image
  - `/api/premium/*` - Resource-based pricing
  - `/api/ai/generate` - Dynamic per-token pricing

- **Analytics dashboard** at `/dashboard`:
  - Total revenue
  - Revenue by endpoint
  - Top payers
  - Revenue over time chart
  - Recent payments

- **Multiple pricing strategies**:
  - Fixed pricing
  - Dynamic pricing (per-token, per-KB)
  - Resource-based pricing
  - Tiered pricing (volume discounts)

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
export X402_SERVER_WALLET=0x...  # Your wallet address to receive payments
export X402_DEFAULT_CHAIN=arbitrum
export X402_DEFAULT_TOKEN=USDs

# Run the server
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_SERVER_WALLET` | Wallet address to receive payments | Required |
| `X402_DEFAULT_CHAIN` | Blockchain network | `arbitrum` |
| `X402_DEFAULT_TOKEN` | Payment token | `USDs` |
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `localhost` |

## API Endpoints

### Public Endpoints

#### GET /health
Health check endpoint.

```bash
curl http://localhost:3000/health
```

#### GET /api
API documentation and pricing.

```bash
curl http://localhost:3000/api
```

### Paid Endpoints

All paid endpoints require x402 payment. When you make a request without payment, you'll receive a `402 Payment Required` response with payment details.

#### GET /api/joke - $0.001

Get a random programming joke.

```bash
# Without payment - returns 402
curl http://localhost:3000/api/joke

# With payment proof
curl -H "X-Payment-Proof: 0x..." http://localhost:3000/api/joke
```

#### POST /api/summary - $0.01

Summarize text.

```bash
curl -X POST http://localhost:3000/api/summary \
  -H "Content-Type: application/json" \
  -H "X-Payment-Proof: 0x..." \
  -d '{"text": "Long text to summarize..."}'
```

#### POST /api/image - $0.05

Generate an image from a prompt.

```bash
curl -X POST http://localhost:3000/api/image \
  -H "Content-Type: application/json" \
  -H "X-Payment-Proof: 0x..." \
  -d '{"prompt": "A beautiful sunset"}'
```

#### GET /api/premium/data - $0.10

Access premium analytics data.

#### GET /api/premium/report - $0.25

Get a detailed report.

#### POST /api/ai/generate - Dynamic Pricing

AI text generation with per-token pricing.

Base: $0.001 + $0.00001 per token

```bash
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "X-Payment-Proof: 0x..." \
  -d '{"prompt": "Write a poem", "max_tokens": 100}'
```

### Dashboard

#### GET /dashboard

HTML dashboard showing earnings and statistics.

#### GET /dashboard/api

JSON API for dashboard data.

## How Payments Work

1. **Request without payment**: Returns 402 with `WWW-Authenticate` header containing payment details

2. **Make payment**: Use an x402-compatible client to make the payment on-chain

3. **Retry with proof**: Include the transaction hash in `X-Payment-Proof` header

4. **Access granted**: Server verifies payment and returns the requested resource

## Integration with AI Agents

AI agents using x402 can automatically:

1. Detect 402 responses
2. Parse payment requirements from headers
3. Execute payment using their wallet
4. Retry the request with payment proof

This enables autonomous AI-to-API payments without human intervention.

## Using with MCP

The x402 server tools can be registered with an MCP server:

```typescript
import { registerX402ServerTools } from '@/x402/server/tools';

// Register with your MCP server
registerX402ServerTools(mcpServer);
```

This enables AI agents to:
- `x402_create_protected_endpoint` - Define new paywalls
- `x402_list_earnings` - View revenue
- `x402_withdraw_earnings` - Withdraw funds
- `x402_set_pricing` - Configure prices


<!-- EOF: universal-crypto-mcp | ucm:dW5pdmVyc2FsLWNyeXB0by1tY3A= -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->