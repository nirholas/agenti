# Configuration Guide

Complete configuration reference for Universal Crypto MCP.

---

## Environment Variables

### Core Configuration

```bash
# Server port (default: 3001)
PORT=3001

# Logging level: DEBUG, INFO, WARN, ERROR
LOG_LEVEL=INFO
```

### Wallet Configuration

```bash
# EVM private key for write operations (hex format, with or without 0x prefix)
PRIVATE_KEY=your_evm_private_key

# Solana private key (base58 format)
SOLANA_PRIVATE_KEY=your_solana_private_key

# TON mnemonic (24 words)
TON_MNEMONIC=word1 word2 word3 ... word24

# XRP secret
XRP_SECRET=sEdxxxxxxxx
```

### API Keys (Optional - Enhances Functionality)

```bash
# CoinGecko Pro API key (higher rate limits)
COINGECKO_API_KEY=your_key

# CoinStats API key
COINSTATS_API_KEY=your_key

# LunarCrush API key (social metrics)
LUNARCRUSH_API_KEY=your_key

# CryptoCompare API key
CRYPTOCOMPARE_API_KEY=your_key

# Alchemy API key (enhanced RPC)
ALCHEMY_API_KEY=your_key

# Infura Project ID
INFURA_PROJECT_ID=your_project_id

# GoPlus API key (security analysis)
GOPLUS_API_KEY=your_key
```

### Network Configuration

```bash
# Default chain for EVM operations
DEFAULT_CHAIN=ethereum

# Custom RPC URLs (optional)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/...
BSC_RPC_URL=https://bsc-dataseed.binance.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Solana RPC URL
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# TON Network
TON_NETWORK=mainnet

# XRP Network
XRP_NETWORK=mainnet
```

---

## Claude Desktop Configuration

### Basic Setup

Add to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

### Full Configuration

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_evm_private_key",
        "SOLANA_PRIVATE_KEY": "your_solana_key",
        "COINGECKO_API_KEY": "your_coingecko_key",
        "LUNARCRUSH_API_KEY": "your_lunarcrush_key",
        "DEFAULT_CHAIN": "ethereum",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

### Local Development

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "node",
      "args": ["/path/to/universal-crypto-mcp/dist/index.js"],
      "env": {
        "PRIVATE_KEY": "your_private_key",
        "LOG_LEVEL": "DEBUG"
      }
    }
  }
}
```

---

## Cursor Configuration

Add to your MCP settings in Cursor:

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

---

## ChatGPT Developer Mode

### HTTP Mode

Start the server in HTTP mode:

```bash
npx @nirholas/universal-crypto-mcp --http
```

Or with environment variables:

```bash
PORT=3001 PRIVATE_KEY=your_key npx @nirholas/universal-crypto-mcp --http
```

Configure in ChatGPT:
1. Go to ChatGPT → Settings → Developer Mode
2. Add new action with URL: `http://localhost:3001`
3. Import OpenAPI spec from `http://localhost:3001/openapi.json`

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN npm install -g @nirholas/universal-crypto-mcp
EXPOSE 3001
CMD ["universal-crypto-mcp", "--http"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  mcp-server:
    image: universal-crypto-mcp
    ports:
      - "3001:3001"
    environment:
      - PRIVATE_KEY=${PRIVATE_KEY}
      - LOG_LEVEL=INFO
```

---

## Server Modes

### STDIO Mode (Default)

Used by Claude Desktop and most MCP clients:

```bash
npx @nirholas/universal-crypto-mcp
```

### HTTP Mode

For ChatGPT and HTTP-based clients:

```bash
npx @nirholas/universal-crypto-mcp --http
```

### SSE Mode (Legacy)

Server-Sent Events mode:

```bash
npx @nirholas/universal-crypto-mcp --sse
```

---

## Rate Limiting

### Default Limits

| Service | Limit |
|---------|-------|
| General API | 100 req/min |
| CoinGecko (free) | 10-30 req/min |
| CoinGecko (Pro) | 500 req/min |
| RPC Calls | 50 req/sec |

### Configuring Custom Limits

```typescript
// In your custom deployment
import { RateLimiter } from '@nirholas/universal-crypto-mcp'

const customLimiter = new RateLimiter({
  maxTokens: 100,
  refillRate: 10 // tokens per second
})
```

---

## Caching

### Default Cache TTLs

| Cache Type | TTL |
|------------|-----|
| API Responses | 5 minutes |
| Price Data | 30 seconds |
| Market Data | 1 minute |
| Block Data | 12 seconds |

### Disabling Cache

```bash
DISABLE_CACHE=true npx @nirholas/universal-crypto-mcp
```

---

## Supported Chains

### EVM Chains (Mainnet)

| Chain | Chain ID | RPC URL |
|-------|----------|---------|
| Ethereum | 1 | https://eth.llamarpc.com |
| Polygon | 137 | https://polygon-rpc.com |
| BSC | 56 | https://bsc-dataseed.binance.org |
| Arbitrum | 42161 | https://arb1.arbitrum.io/rpc |
| Base | 8453 | https://mainnet.base.org |
| Optimism | 10 | https://mainnet.optimism.io |
| Avalanche | 43114 | https://api.avax.network/ext/bc/C/rpc |
| opBNB | 204 | https://opbnb-mainnet-rpc.bnbchain.org |
| zkSync | 324 | https://mainnet.era.zksync.io |
| Linea | 59144 | https://rpc.linea.build |

### EVM Chains (Testnet)

| Chain | Chain ID | RPC URL |
|-------|----------|---------|
| Sepolia | 11155111 | https://sepolia.drpc.org |
| Goerli | 5 | https://goerli.drpc.org |
| Mumbai | 80001 | https://rpc-mumbai.maticvigil.com |
| BSC Testnet | 97 | https://data-seed-prebsc-1-s1.binance.org:8545 |

### Non-EVM Chains

| Chain | Network | Endpoint |
|-------|---------|----------|
| Solana | Mainnet | https://api.mainnet-beta.solana.com |
| Solana | Devnet | https://api.devnet.solana.com |
| TON | Mainnet | https://toncenter.com/api/v2 |
| XRP | Mainnet | wss://xrplcluster.com |
| THORChain | Mainnet | https://thornode.ninerealms.com |

---

## Security Best Practices

### Private Key Security

1. **Never commit keys to git**
2. **Use environment variables**
3. **Use hardware wallets for large amounts**
4. **Rotate keys periodically**
5. **Use separate keys for testing**

### Environment File

Create `.env` file (add to `.gitignore`):

```bash
# .env
PRIVATE_KEY=your_private_key
SOLANA_PRIVATE_KEY=your_solana_key
COINGECKO_API_KEY=your_api_key
```

### Production Deployment

Use secrets management:

```bash
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id crypto-mcp/private-key

# HashiCorp Vault
vault kv get secret/crypto-mcp/private-key

# Kubernetes Secrets
kubectl create secret generic crypto-mcp-secrets \
  --from-literal=private-key=your_key
```

---

## Troubleshooting

### Common Issues

**1. "Invalid private key"**
- Ensure key is hex format for EVM
- Check for extra whitespace
- Remove 0x prefix if present

**2. "Rate limit exceeded"**
- Add API keys for higher limits
- Reduce request frequency
- Use caching

**3. "Network timeout"**
- Check RPC URL is accessible
- Try alternative RPC endpoints
- Increase timeout settings

**4. "Module not found"**
- Run `npm install` in project directory
- Check Node.js version (>= 18)
- Clear npm cache: `npm cache clean --force`

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=DEBUG npx @nirholas/universal-crypto-mcp
```

### Health Check

Check server status:

```bash
curl http://localhost:3001/health
```
