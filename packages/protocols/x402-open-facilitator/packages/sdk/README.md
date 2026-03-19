# @openfacilitator/sdk

TypeScript SDK for x402 payment facilitation. Works with OpenFacilitator or any x402-compatible facilitator.

## Installation

```bash
npm install @openfacilitator/sdk
```

## Quick Start

```typescript
import { OpenFacilitator } from '@openfacilitator/sdk';

// Use custom facilitator
const facilitator = new OpenFacilitator({
  url: 'https://pay.yourdomain.com',
});

// Or use the default OpenFacilitator
import { createDefaultFacilitator } from '@openfacilitator/sdk';
const facilitator = createDefaultFacilitator();
```

## Usage

### Verify a Payment

```typescript
// Payment payload from the client
const payment = {
  x402Version: 1,
  scheme: 'exact',
  network: 'base',
  payload: {
    signature: '0x...',
    authorization: {
      from: '0xSenderAddress',
      to: '0xRecipientAddress',
      amount: '1000000',
      asset: '0xTokenAddress',
    },
  },
};

// Requirements from the server/resource
const requirements = {
  scheme: 'exact',
  network: 'base',
  maxAmountRequired: '1000000',
  asset: '0xTokenAddress',
  payTo: '0xRecipientAddress',
};

const result = await facilitator.verify(payment, requirements);

if (result.valid) {
  console.log('Payment is valid!');
} else {
  console.error('Invalid payment:', result.error);
}
```

### Settle a Payment

```typescript
const result = await facilitator.settle(payment, requirements);

if (result.success) {
  console.log('Transaction hash:', result.transactionHash);
} else {
  console.error('Settlement failed:', result.error);
}
```

### Get Supported Networks

```typescript
const supported = await facilitator.supported();

console.log('Supported networks:');
supported.kinds.forEach(kind => {
  console.log(`- ${kind.network} (v${kind.x402Version})`);
});
```

### Network Utilities

```typescript
import {
  getNetwork,
  getNetworkType,
  toV2NetworkId,
  NETWORKS,
} from '@openfacilitator/sdk';

// Get network info
const base = getNetwork('base');
console.log(base?.chainId); // 8453

// Convert v1 to v2 ID
const v2Id = toV2NetworkId('base'); // 'eip155:8453'

// Get all mainnets
const mainnets = NETWORKS.filter(n => !n.testnet);
```

## Error Handling

```typescript
import {
  FacilitatorError,
  VerificationError,
  SettlementError,
} from '@openfacilitator/sdk';

try {
  await facilitator.settle(payment, requirements);
} catch (error) {
  if (error instanceof SettlementError) {
    console.error('Settlement failed:', error.message);
  } else if (error instanceof FacilitatorError) {
    console.error('Facilitator error:', error.code, error.message);
  }
}
```

## x402 Version Support

This SDK supports both x402 v1 and v2:

- **v1**: Human-readable network names (`base`, `solana`)
- **v2**: CAIP-2 chain identifiers (`eip155:8453`, `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)

## Supported Networks

### EVM Mainnets

| Network   | v1 ID       | v2 ID (CAIP-2)   | Chain ID |
| --------- | ----------- | ---------------- | -------- |
| Base      | `base`      | `eip155:8453`    | 8453     |
| Polygon   | `polygon`   | `eip155:137`     | 137      |
| Avalanche | `avalanche` | `eip155:43114`   | 43114    |
| Sei       | `sei`       | `eip155:1329`    | 1329     |
| IoTeX     | `iotex`     | `eip155:4689`    | 4689     |
| Peaq      | `peaq`      | `eip155:3338`    | 3338     |
| X Layer   | `xlayer`    | `eip155:196`     | 196      |

### Solana

| Network       | v1 ID           | v2 ID (CAIP-2)                           |
| ------------- | --------------- | ---------------------------------------- |
| Solana        | `solana`        | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Solana Devnet | `solana-devnet` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |

## License

MIT
