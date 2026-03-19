# Environment Variables Reference

Complete reference for all environment variables supported by Agenti.

## Core Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | HTTP/SSE server port | `3000` | No |
| `HOST` | Server bind address | `0.0.0.0` | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` | No |

## Wallet & Authentication

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PRIVATE_KEY` | EVM wallet private key (0x-prefixed hex) | - | For write ops |
| `SOLANA_PRIVATE_KEY` | Solana wallet private key (base58) | - | For Solana ops |
| `COSMOS_MNEMONIC` | Cosmos wallet mnemonic phrase | - | For Cosmos ops |
| `NEAR_ACCOUNT_ID` | Near Protocol account ID | - | For Near ops |
| `NEAR_PRIVATE_KEY` | Near account private key | - | For Near ops |

## RPC Endpoints

| Variable | Description | Default |
|----------|-------------|---------|
| `ETHEREUM_RPC_URL` | Ethereum mainnet RPC | Public endpoint |
| `BASE_RPC_URL` | Base mainnet RPC | `https://mainnet.base.org` |
| `POLYGON_RPC_URL` | Polygon mainnet RPC | `https://polygon-rpc.com` |
| `ARBITRUM_RPC_URL` | Arbitrum One RPC | `https://arb1.arbitrum.io/rpc` |
| `OPTIMISM_RPC_URL` | Optimism mainnet RPC | `https://mainnet.optimism.io` |
| `BSC_RPC_URL` | BNB Smart Chain RPC | `https://bsc-dataseed.binance.org` |
| `OPBNB_RPC_URL` | opBNB RPC | `https://opbnb-mainnet-rpc.bnbchain.org` |
| `IOTEX_RPC_URL` | IoTeX mainnet RPC | Public endpoint |
| `SOLANA_RPC_URL` | Solana mainnet RPC | `https://api.mainnet-beta.solana.com` |
| `NEAR_RPC_URL` | Near mainnet RPC | `https://rpc.mainnet.near.org` |
| `SUI_RPC_URL` | Sui mainnet RPC | `https://fullnode.mainnet.sui.io` |
| `COSMOS_RPC_URL` | Cosmos Hub RPC | `https://rpc.cosmos.network` |

## API Keys

| Variable | Description | Required For |
|----------|-------------|-------------|
| `COINGECKO_API_KEY` | CoinGecko API key | Enhanced market data |
| `LUNARCRUSH_API_KEY` | LunarCrush API key | Sentiment data |
| `ETHERSCAN_API_KEY` | Etherscan API key | Contract verification |
| `BASESCAN_API_KEY` | BaseScan API key | Base explorer |
| `ARBISCAN_API_KEY` | Arbiscan API key | Arbitrum explorer |
| `POLYGONSCAN_API_KEY` | PolygonScan API key | Polygon explorer |
| `BSCSCAN_API_KEY` | BscScan API key | BSC explorer |
| `TATUM_API_KEY` | Tatum API key | Multi-chain data |

## Exchange Keys

| Variable | Description | Required For |
|----------|-------------|-------------|
| `BINANCE_API_KEY` | Binance API key | Binance exchange tools |
| `BINANCE_SECRET_KEY` | Binance API secret | Binance exchange tools |
| `BINANCE_US_API_KEY` | Binance US API key | Binance US tools |
| `BINANCE_US_SECRET_KEY` | Binance US API secret | Binance US tools |

## x402 Payment Protocol

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_ENABLED` | Enable x402 payment tools | `true` |
| `X402_DEFAULT_CHAIN` | Default payment chain | `base` |
| `X402_MAX_PAYMENT` | Max payment amount in USD | `10` |
| `X402_AUTO_PAY` | Auto-approve payments under max | `false` |

## Server Security (HTTP/SSE Modes)

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_TOKEN` | Bearer token for authentication | - |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `*` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `RATE_LIMIT_WINDOW` | Rate limit window in ms | `60000` |

## Example .env File

```env
# Wallet
PRIVATE_KEY=0x...

# RPC (use dedicated providers for production)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# APIs
COINGECKO_API_KEY=your_key
LUNARCRUSH_API_KEY=your_key

# x402
X402_ENABLED=true
X402_MAX_PAYMENT=5

# Server (HTTP mode)
PORT=3000
AUTH_TOKEN=your_secret
```
