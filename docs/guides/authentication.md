# Authentication & Security

This guide covers authentication mechanisms and security best practices for Agenti.

## Wallet Authentication

Agenti uses a private key for signing blockchain transactions. This key is provided via environment variable.

### Private Key Setup

```env
# EVM wallet private key (hex-encoded, with 0x prefix)
PRIVATE_KEY=0x...
```

The private key is used for:
- Signing on-chain transactions (transfers, swaps, DeFi interactions)
- x402 payment signing
- Message signing for authentication

### Key Security Best Practices

1. **Never commit keys** - Use `.env` files (gitignored) or secrets managers
2. **Use dedicated wallets** - Don't use your primary wallet for AI agent operations
3. **Limit funds** - Only keep necessary funds in the agent wallet
4. **Use testnets** - Test on Sepolia/Mumbai before mainnet
5. **Monitor activity** - Set up alerts for unexpected transactions

## API Key Authentication

Various data providers require API keys:

### CoinGecko

```env
COINGECKO_API_KEY=your_key
```

Free tier provides 30 requests/minute. Pro tier available for higher limits.

### Binance Exchange

```env
BINANCE_API_KEY=your_key
BINANCE_SECRET_KEY=your_secret
```

Required for exchange tools (order placement, account info). Use API key restrictions:
- Enable only necessary permissions (read, spot trading)
- Restrict to IP whitelist
- Disable withdrawal permissions

### LunarCrush

```env
LUNARCRUSH_API_KEY=your_key
```

Required for social sentiment data.

## HTTP Mode Authentication

When running in HTTP mode, Agenti can be exposed to the network. Secure it with:

### Bearer Token

```env
AUTH_TOKEN=your_secret_token
```

Clients must include the header:
```
Authorization: Bearer your_secret_token
```

### CORS Configuration

```env
CORS_ORIGINS=https://your-app.com,https://another-app.com
```

### Rate Limiting

```env
RATE_LIMIT_MAX=100         # Max requests per window
RATE_LIMIT_WINDOW=60000    # Window in milliseconds
```

## x402 Payment Authentication

The x402 protocol uses EIP-3009 for gasless payment authorization:

1. Agent receives 402 Payment Required response
2. Signs an EIP-3009 `transferWithAuthorization` message
3. Facilitator submits the signed authorization on-chain
4. Agent receives the paid content

No additional authentication is needed beyond the wallet private key.

## Multi-Wallet Setup

For advanced configurations, you can use different wallets for different chains:

```env
ETHEREUM_PRIVATE_KEY=0x...
SOLANA_PRIVATE_KEY=base58...
COSMOS_MNEMONIC=word1 word2 word3...
```

## Secrets Management

### Development
- Use `.env` files (add to `.gitignore`)
- Use `dotenv` for loading

### Production
- AWS Secrets Manager
- HashiCorp Vault
- GCP Secret Manager
- Docker secrets
- Kubernetes secrets

### Example: AWS Secrets Manager

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });
const response = await client.send(
  new GetSecretValueCommand({ SecretId: 'agenti/production' })
);
const secrets = JSON.parse(response.SecretString);
process.env.PRIVATE_KEY = secrets.PRIVATE_KEY;
```
