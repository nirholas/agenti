# Paymaster Setup Guide for Server Operators

This guide explains how to set up and configure the paymaster service required for operating x402 payment flows on Starknet.

## Overview

Starknet uses account abstraction, which means every transaction requires gas fees to be paid. The x402 protocol on Starknet achieves gasless payments through **paymaster sponsorship** - a third-party service that pays the gas fees on behalf of users.

### Why Paymaster is Required

Unlike EVM chains where EIP-3009 allows direct `transferWithAuthorization` calls, Starknet requires:

1. **Account Abstraction**: All accounts are smart contracts; there's no externally-owned account (EOA) concept
2. **Gas Fees**: Every transaction must pay gas fees in ETH or approved tokens
3. **Signature Model**: Transactions use typed data (SNIP-12) signed by the account owner

The paymaster solves this by:

- Constructing transactions on behalf of users
- Sponsoring gas fees (paying from its own balance)
- Broadcasting transactions to the network

## Paymaster Options

### Option 1: AVNU Paymaster (Production)

AVNU provides a hosted paymaster service for Starknet.

**Endpoints:**

- **Mainnet**: `https://starknet.paymaster.avnu.fi`
- **Sepolia**: Contact AVNU for testnet access

**Setup:**

1. Register at [AVNU](https://www.avnu.fi/) for API access
2. Obtain an API key for sponsored mode
3. Configure your server with the API key

```typescript
import { createPaymasterClient } from 'x402-starknet';

const paymaster = createPaymasterClient({
  endpoint: 'https://starknet.paymaster.avnu.fi',
  network: 'starknet:mainnet',
  apiKey: process.env.AVNU_API_KEY, // Required for sponsored mode
});
```

**Cost Model:**

- AVNU may charge fees for sponsored transactions
- Contact AVNU for pricing details
- Consider the cost when setting payment amounts

### Option 2: Self-Hosted Paymaster (Development/Custom)

For development or custom deployments, you can run your own paymaster.

**Requirements:**

- Rust toolchain
- Funded Starknet account for gas sponsorship
- RPC access to Starknet node

**Installation:**

```bash
# Clone the AVNU paymaster repository
git clone https://github.com/avnu-labs/paymaster
cd paymaster

# Build the paymaster service
cargo build --release --bin paymaster-service

# Create a profile configuration
cat > profile.json << 'EOF'
{
  "network": "sepolia",
  "rpc_url": "https://starknet-sepolia.public.blastapi.io",
  "sponsor_account": {
    "address": "0x...",
    "private_key": "0x..."
  },
  "port": 12777
}
EOF

# Run the paymaster
./target/release/paymaster-service --profile profile.json
```

**Configuration (`profile.json`):**

```json
{
  "network": "sepolia",
  "rpc_url": "https://starknet-sepolia.public.blastapi.io",
  "sponsor_account": {
    "address": "0xYOUR_ACCOUNT_ADDRESS",
    "private_key": "0xYOUR_PRIVATE_KEY"
  },
  "port": 12777,
  "max_gas_price": "1000000000000",
  "supported_tokens": [
    "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
  ]
}
```

**Security Considerations:**

- Store private keys securely (use environment variables or secret managers)
- Run behind a reverse proxy with TLS
- Implement rate limiting
- Monitor sponsor account balance

### Option 3: Katana/Devnet (Local Development)

For local development, use Katana (Starknet devnet) with a local paymaster.

```bash
# Start Katana
katana --seed 0

# In another terminal, start local paymaster
# (pointing to Katana RPC)
./paymaster-service --profile devnet-profile.json
```

**Devnet Profile:**

```json
{
  "network": "devnet",
  "rpc_url": "http://localhost:5050",
  "sponsor_account": {
    "address": "0x...",
    "private_key": "0x..."
  },
  "port": 12777
}
```

## Server Configuration

### Facilitator Setup

The facilitator (resource server) needs paymaster configuration to settle payments:

```typescript
import {
  settlePayment,
  createProvider,
  createSettlementOptions,
  createPaymasterConfig,
} from 'x402-starknet';

// Create provider using the factory function
const provider = createProvider('starknet:sepolia');

// Option 1: Using createSettlementOptions helper (recommended)
const options = createSettlementOptions('starknet:mainnet', {
  apiKey: process.env.PAYMASTER_API_KEY,
});

const result = await settlePayment(
  provider,
  paymentPayload,
  paymentRequirements,
  options
);

// Option 2: Using createPaymasterConfig directly
const paymasterConfig = createPaymasterConfig('starknet:mainnet', {
  endpoint: process.env.PAYMASTER_ENDPOINT, // Optional: uses default if not provided
  apiKey: process.env.PAYMASTER_API_KEY,
});

const result = await settlePayment(
  provider,
  paymentPayload,
  paymentRequirements,
  { paymasterConfig }
);
```

### Environment Variables

Recommended environment variables for production:

```bash
# Paymaster Configuration
PAYMASTER_ENDPOINT=https://starknet.paymaster.avnu.fi
PAYMASTER_API_KEY=your-api-key-here
PAYMASTER_NETWORK=starknet:mainnet

# Starknet RPC
STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io

# Server Configuration
PORT=3000
NODE_ENV=production
```

### Client-Side Integration

Clients using the library receive paymaster configuration from the server or use defaults:

```typescript
import {
  createPaymentPayload,
  DEFAULT_PAYMASTER_ENDPOINTS,
  isStarknetNetwork,
} from 'x402-starknet';

// Validate network before use
const network = 'starknet:sepolia';
if (!isStarknetNetwork(network)) {
  throw new Error('Invalid network');
}

const paymentPayload = await createPaymentPayload(
  account,
  2, // x402 version
  paymentRequirements,
  {
    endpoint: DEFAULT_PAYMASTER_ENDPOINTS[network],
    network,
  }
);
```

## Paymaster API Reference

The paymaster implements a JSON-RPC API:

### `paymaster_buildTransaction`

Builds a transaction for user signing.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "method": "paymaster_buildTransaction",
  "params": {
    "transaction": {
      "type": "invoke",
      "invoke": {
        "user_address": "0x...",
        "calls": [
          {
            "to": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
            "selector": "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e",
            "calldata": ["0x...", "0x...", "0x0"]
          }
        ]
      }
    },
    "parameters": {
      "version": "0x1",
      "fee_mode": { "mode": "sponsored" }
    }
  },
  "id": 1
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "type": "invoke",
    "typed_data": {
      "types": { ... },
      "primaryType": "...",
      "domain": { ... },
      "message": { ... }
    }
  },
  "id": 1
}
```

### `paymaster_executeTransaction`

Executes a signed transaction.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "method": "paymaster_executeTransaction",
  "params": {
    "transaction": {
      "type": "invoke",
      "invoke": {
        "user_address": "0x...",
        "typed_data": { ... },
        "signature": ["0x...", "0x..."]
      }
    },
    "parameters": {
      "version": "0x1",
      "fee_mode": { "mode": "sponsored" }
    }
  },
  "id": 2
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "transaction_hash": "0x..."
  },
  "id": 2
}
```

### `paymaster_isAvailable`

Health check endpoint.

```json
{
  "jsonrpc": "2.0",
  "method": "paymaster_isAvailable",
  "params": {},
  "id": 3
}
```

### `paymaster_getSupportedTokens`

Get supported gas tokens.

```json
{
  "jsonrpc": "2.0",
  "method": "paymaster_getSupportedTokens",
  "params": {},
  "id": 4
}
```

## Fee Modes

### Sponsored Mode (Default for x402)

The paymaster pays all gas fees. Requires API key for AVNU hosted service.

```typescript
{
  fee_mode: {
    mode: 'sponsored';
  }
}
```

### Default Mode (User Pays in Token)

User pays gas in a supported token (deducted from their balance).

```typescript
{
  fee_mode: {
    mode: 'default',
    gas_token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
  }
}
```

## Monitoring & Operations

### Health Checks

Implement health checks for your paymaster:

```typescript
const paymaster = createPaymasterClient(config);

// Periodic health check
async function checkPaymasterHealth() {
  try {
    const status = await paymaster.isAvailable();
    if (!status.available) {
      console.error('Paymaster unavailable');
      // Alert operations team
    }
  } catch (error) {
    console.error('Paymaster health check failed:', error);
  }
}

setInterval(checkPaymasterHealth, 60000); // Every minute
```

### Balance Monitoring

For self-hosted paymasters, monitor sponsor account balance:

```typescript
import { RpcProvider } from 'starknet';
import { ETH_ADDRESSES, toAtomicUnits, fromAtomicUnits } from 'x402-starknet';

async function checkSponsorBalance(
  provider: RpcProvider,
  sponsorAddress: string,
  network: 'starknet:mainnet' | 'starknet:sepolia'
) {
  const ethAddress = ETH_ADDRESSES[network];
  if (!ethAddress) {
    throw new Error(`ETH not available on ${network}`);
  }

  const result = await provider.callContract({
    contractAddress: ethAddress,
    entrypoint: 'balanceOf',
    calldata: [sponsorAddress],
  });

  const balance = BigInt(result[0]);
  const threshold = BigInt(toAtomicUnits(0.1, 'ETH')); // 0.1 ETH

  if (balance < threshold) {
    const humanBalance = fromAtomicUnits(balance.toString(), 'ETH');
    console.warn(`Sponsor balance low: ${humanBalance} ETH`);
    // Alert operations team
  }
}
```

### Error Handling

Common paymaster errors and solutions:

| Error                  | Cause                        | Solution                     |
| ---------------------- | ---------------------------- | ---------------------------- |
| `insufficient_balance` | Sponsor account out of funds | Top up sponsor account       |
| `invalid_signature`    | Client signature invalid     | Check signing implementation |
| `nonce_too_low`        | Transaction replay           | Use fresh nonce              |
| `rate_limited`         | Too many requests            | Implement backoff            |
| `unsupported_token`    | Token not in whitelist       | Add token to config          |

## Security Best Practices

### For Self-Hosted Paymaster

1. **Key Management**
   - Never store private keys in code
   - Use hardware security modules (HSM) for production
   - Rotate keys periodically

2. **Network Security**
   - Run behind TLS-terminating reverse proxy
   - Whitelist client IPs if possible
   - Use VPN for internal services

3. **Rate Limiting**
   - Limit requests per IP/account
   - Set maximum gas price caps
   - Implement circuit breakers

4. **Monitoring**
   - Log all transactions
   - Alert on anomalies
   - Track gas costs

### For AVNU Hosted

1. **API Key Security**
   - Store API keys in secret managers
   - Rotate keys periodically
   - Use separate keys per environment

2. **Request Validation**
   - Validate all payment requests
   - Check amounts against expected values
   - Verify recipient addresses

## Troubleshooting

### Common Issues

**1. "Paymaster endpoint not configured"**

```
Solution: Set PAYMASTER_ENDPOINT environment variable or pass endpoint in config
```

**2. "Transaction simulation failed"**

```
Causes:
- Insufficient token balance
- Invalid contract call
- Network congestion

Solution: Check balance, verify call parameters, retry with backoff
```

**3. "API key unauthorized"**

```
Solution: Verify API key is correct and has sponsored mode enabled
```

**4. "Nonce already used"**

```
Solution: The paymaster handles nonces automatically. If this occurs,
there may be a race condition. Implement request queuing.
```

## References

- [AVNU Paymaster Documentation](https://doc.avnu.fi/avnu-paymaster/cover-your-users-gas-fees)
- [Starknet Account Abstraction](https://docs.starknet.io/documentation/architecture_and_concepts/Account_Abstraction/)
- [SNIP-12: Typed Structured Data](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-12.md)
- [x402 Exact Scheme for Starknet](./scheme_exact_starknet.md)
