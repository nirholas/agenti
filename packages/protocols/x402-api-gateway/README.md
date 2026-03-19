# x402 Payment Gateway

A reference implementation for building and serving paid APIs using x402 v2, with support for both EVM and Solana networks.

## Overview

This project demonstrates how to:

1. Receive API requests
2. Require payment (for example, $0.10 USDC) before processing
3. Verify and settle payments through a facilitator (default: `https://x402.org/facilitator` for testnets, or a custom facilitator for mainnets)
4. Process requests using a pluggable backend (examples: OpenAI, EigenAI)
5. Return responses after payment has been confirmed

## Architecture

The API is composed of four main components:

- **ExampleService**: Example request-processing logic using OpenAI or EigenAI, intended to be replaced with your own service implementation.
- **MerchantExecutor**: Handles payment requirements, verification, and settlement (supports both EVM and Solana).
- **Server**: Express HTTP server that orchestrates payment validation and request processing.
- **Facilitator** (optional): Facilitator server for mainnet or custom network support.

## Prerequisites

- Node.js 18 or higher
- A wallet address to receive USDC payments
- An OpenAI or EigenAI API key (used by the example service; can be replaced with your own API)
- For testing: a wallet funded with USDC and gas tokens on the selected network

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp env.example .env
```

Edit `.env` and fill in your values:

```env
# =============================================================================
# Server Configuration
# =============================================================================
PORT=3000

# Your wallet address to receive payments (no private key needed)
PAY_TO_ADDRESS=0xYourWalletAddress

# Network to use for payments
# Legacy names: base, base-sepolia, polygon, polygon-amoy, avalanche, avalanche-fuji,
#               iotex, sei, sei-testnet, peaq, solana, solana-devnet
# CAIP-2 format: eip155:8453, eip155:84532, solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
NETWORK=base-sepolia

# =============================================================================
# AI Provider Configuration
# =============================================================================
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key

# Alternative: EigenAI
# AI_PROVIDER=eigenai
# EIGENAI_API_KEY=your-eigenai-api-key

# =============================================================================
# Settlement Mode
# =============================================================================
# Options: "facilitator" (default) or "direct" (EVM only)
SETTLEMENT_MODE=facilitator

# For custom/local facilitator (required for mainnets):
# FACILITATOR_URL=http://localhost:4022

# For direct settlement (EVM only, no facilitator needed):
# SETTLEMENT_MODE=direct
# PRIVATE_KEY=0xYourMerchantPrivateKey

# =============================================================================
# Test Client Configuration
# =============================================================================
# EVM test client (for npm run test)
# EVM_CLIENT_PRIVATE_KEY=0xYourTestWalletPrivateKey

# Solana test client (for npm run test:solana)
# SOLANA_CLIENT_PRIVATE_KEY=YourBase58SolanaKeypair

# =============================================================================
# Local Facilitator Configuration (npm run start:facilitator)
# =============================================================================
# Required for mainnet support - the facilitator settles payments on-chain

# FACILITATOR_PORT=4022
# EVM_PRIVATE_KEY=0xFacilitatorEvmKey
# SVM_PRIVATE_KEY=FacilitatorSolanaKeypair
# FACILITATOR_EVM_NETWORK=base-sepolia
# FACILITATOR_SVM_NETWORK=solana-devnet
```

## Quickstart

### Testnets (Default Facilitator)

For testnet usage, start the server. It will use the default facilitator at `https://x402.org/facilitator`:

```bash
npm run dev
```

### Mainnets (Custom Facilitator Recommended)

The default facilitator at `https://x402.org/facilitator` supports testnets only. For mainnet usage, configure a facilitator that supports your target network. This can be a locally run facilitator or an external facilitator service.

#### Option 1: Run a Local Facilitator

**Terminal 1 – Facilitator:**

```bash
npm run start:facilitator
```

**Terminal 2 – Server:**

```bash
FACILITATOR_URL=http://localhost:4022 npm run start
```

#### Option 2: Use an External Facilitator

If you have access to a hosted facilitator that supports your network:

```bash
FACILITATOR_URL=https://your-mainnet-facilitator.example.com npm run start
```

Some public facilitators that do not require an API key:

- `https://facilitator.payai.network`
- `https://facilitator.x402.rs`
- `https://facilitator.heurist.xyz`
- `https://facilitator.corbits.dev`

#### Option 3: Direct Settlement (EVM Only)

For EVM networks, you can bypass a facilitator and settle payments directly on-chain (requires the merchant's private key):

```bash
SETTLEMENT_MODE=direct PRIVATE_KEY=0xYourMerchantKey npm run start
```

## Running Tests

```bash
# Test EVM payments
npm run test

# Test Solana payments
npm run test:solana
```

## Available Scripts

| Script                      | Description                        |
|-----------------------------|------------------------------------|
| `npm run dev`               | Build and start the server         |
| `npm run start`             | Start the server (production)      |
| `npm run start:facilitator` | Start the local facilitator        |
| `npm run build`             | Build TypeScript                   |
| `npm run test`              | Run EVM test client                |
| `npm run test:solana`       | Run Solana test client             |
| `npm run setup:solana`      | Set up Solana wallets (ATAs)       |
| `npm run clean`             | Remove build artifacts             |

## Environment Variables

### Server (Merchant)

| Variable          | Required        | Description                                   |
|-------------------|-----------------|-----------------------------------------------|
| `PORT`            | No              | Server port (default: 3000)                   |
| `PAY_TO_ADDRESS`  | Yes             | Wallet address to receive payments           |
| `NETWORK`         | No              | Payment network (default: `base-sepolia`)     |
| `SETTLEMENT_MODE` | No              | `facilitator` (default) or `direct`          |
| `FACILITATOR_URL` | No              | Custom facilitator URL                       |
| `PRIVATE_KEY`     | For direct mode | Merchant key for direct settlement (EVM only) |

### AI Provider

| Variable          | Required     | Description                      |
|-------------------|--------------|----------------------------------|
| `AI_PROVIDER`     | No           | `openai` (default) or `eigenai` |
| `OPENAI_API_KEY`  | For OpenAI   | OpenAI API key                  |
| `EIGENAI_API_KEY` | For EigenAI  | EigenAI API key                 |
| `AI_MODEL`        | No           | Model identifier to use        |
| `AI_TEMPERATURE`  | No           | Temperature setting            |
| `AI_MAX_TOKENS`   | No           | Maximum tokens per response    |

### Test Clients

| Variable                    | Description                          |
|-----------------------------|--------------------------------------|
| `EVM_CLIENT_PRIVATE_KEY`    | EVM wallet for test payments         |
| `SOLANA_CLIENT_PRIVATE_KEY` | Solana wallet for test payments     |
| `AGENT_URL`                 | Server URL (default: `http://localhost:3000`) |

### Local Facilitator

| Variable                  | Required | Description                                     |
|---------------------------|----------|-------------------------------------------------|
| `FACILITATOR_PORT`        | No       | Facilitator port (default: 4022)               |
| `EVM_PRIVATE_KEY`         | Yes      | EVM key used by facilitator to settle payments |
| `SVM_PRIVATE_KEY`         | Yes      | Solana key used by facilitator                 |
| `FACILITATOR_EVM_NETWORK` | No       | EVM network (default: `base-sepolia`)          |
| `FACILITATOR_SVM_NETWORK` | No       | Solana network (default: `solana-devnet`)      |

## Network Support

### Testnets (Default Facilitator)

| Network        | Config Value     | Supported |
|----------------|------------------|-----------|
| Base Sepolia   | `base-sepolia`   | Yes       |
| Polygon Amoy   | `polygon-amoy`   | Yes       |
| Avalanche Fuji | `avalanche-fuji` | Yes       |
| Solana Devnet  | `solana-devnet`  | Yes       |

### Mainnets (Custom Facilitator or Direct Settlement)

| Network   | Config Value | Custom Facilitator | Direct Settlement |
|-----------|--------------|--------------------|-------------------|
| Base      | `base`       | Yes                | Yes               |
| Polygon   | `polygon`    | Yes                | Yes               |
| Avalanche | `avalanche`  | Yes                | Yes               |
| Solana    | `solana`     | Yes                | No                |

## Usage

### Health Check

```bash
curl http://localhost:3000/health
```

Example response:

```json
{
  "status": "healthy",
  "service": "x402-payment-api",
  "version": "2.0.0",
  "x402Version": 2,
  "payment": {
    "address": "0xYourAddress...",
    "network": "base-sepolia",
    "price": "$0.10"
  }
}
```

### Example Request

```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "parts": [{ "kind": "text", "text": "What is 2+2?" }]
    }
  }'
```

The server returns payment requirements. To complete the flow, use the provided test clients or implement x402 payment signing in your client.

## Payment Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CLIENT        │     │     SERVER      │     │   FACILITATOR   │
│                 │     │                 │     │                 │
│ 1. Request      │────▶│ 2. Return       │     │                 │
│                 │     │    payment      │     │                 │
│                 │◀────│    requirements │     │                 │
│                 │     │                 │     │                 │
│ 3. Sign payment │     │                 │     │                 │
│                 │     │                 │     │                 │
│ 4. Submit       │────▶│ 5. Verify       │────▶│ 6. Check sig    │
│    payment      │     │                 │◀────│                 │
│                 │     │                 │     │                 │
│                 │     │ 7. Process      │     │                 │
│                 │     │    request      │     │                 │
│                 │     │                 │     │                 │
│                 │     │ 8. Settle       │────▶│ 9. Submit tx    │
│                 │◀────│                 │◀────│    on-chain     │
│ 10. Response    │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Roles

| Role              | Requirements              | Purpose                        |
|-------------------|---------------------------|--------------------------------|
| Client (Payer)    | Private key + USDC        | Signs payment authorization    |
| Server (Payee)    | Wallet address only       | Receives USDC payments         |
| Facilitator       | Private key + gas tokens  | Settles transactions on-chain |

## Project Structure

```
x402-starter/
├── src/
│   ├── server.ts               # Express server and endpoints
│   ├── ExampleService.ts       # Example AI service
│   ├── MerchantExecutor.ts     # Payment verification & settlement
│   ├── facilitator.ts          # Local facilitator server
│   ├── testClient.ts           # EVM test client
│   ├── testClientSolana.ts     # Solana test client
│   ├── setupSolanaWallets.ts   # Solana wallet setup tool
│   └── x402Types.ts            # Shared types
├── env.example                 # Example environment configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### "PAY_TO_ADDRESS is required"

Set `PAY_TO_ADDRESS` in `.env` to your wallet address.

### "OPENAI_API_KEY is required"

Set `OPENAI_API_KEY` in `.env`, or use `AI_PROVIDER=eigenai` with `EIGENAI_API_KEY`.

### Payment Verification Fails

- Confirm the configured network matches the client's network.
- Verify the client wallet has sufficient USDC.
- For facilitator mode, ensure the facilitator is running and reachable.
- For direct mode, ensure the `PRIVATE_KEY` has enough gas tokens.

### "Default facilitator only supports TESTNETS"

For mainnet networks, either:

1. Run a local facilitator: `npm run start:facilitator`, or
2. Use an external facilitator that supports mainnet, or
3. Use direct settlement (EVM only): `SETTLEMENT_MODE=direct`.

### Solana Payments

- Ensure `NETWORK` is set to `solana-devnet` or `solana`.
- For mainnet, use a facilitator configured with `SVM_PRIVATE_KEY`.
- The client must have `SOLANA_CLIENT_PRIVATE_KEY` funded with USDC and SOL for fees.

### Solana Wallet Setup

Solana uses Associated Token Accounts (ATAs) for token holdings. Each wallet must have an ATA for USDC before receiving tokens.

Run:

```bash
npm run setup:solana
```

The tool will:

1. Check SOL balance for configured wallets
2. Check for existing USDC ATAs
3. Create missing ATAs where possible (if a funded wallet is available)
4. Provide guidance for any remaining issues

Required wallets for Solana payments:

| Wallet      | Needs ATA? | Needs USDC? | Needs SOL? |
|------------|------------|-------------|------------|
| Client     | Yes        | Yes         | Yes        |
| Merchant   | Yes        | No          | Yes        |
| Facilitator| Yes        | No          | Yes        |

Devnet tokens:

- SOL: https://faucet.solana.com
- USDC: https://spl-token-faucet.com

## Security

- Do not commit the `.env` file.
- Keep private keys secure and separate for facilitator and merchant where appropriate.
- Prefer testnets for development and testing.
- The merchant server only requires an address to receive payments when using a facilitator.
- Facilitator keys should be isolated and treated as operational keys.

## Next Steps

- Replace the example OpenAI/EigenAI service with your own application logic.
- Deploy a facilitator for mainnet usage.
- Add support for multiple pricing tiers.
- Add caching, rate limiting, and monitoring.
- Integrate logging and analytics appropriate for your environment.

## License

MIT

## References

- [x402 Protocol Documentation](https://docs.cdp.coinbase.com/x402)
- [@x402/core on npm](https://www.npmjs.com/package/@x402/core)
- [@x402/evm on npm](https://www.npmjs.com/package/@x402/evm)
- [@x402/svm on npm](https://www.npmjs.com/package/@x402/svm)
