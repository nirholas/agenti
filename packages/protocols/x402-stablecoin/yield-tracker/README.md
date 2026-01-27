# USDs Yield Tracker Service

Track auto-yield earnings from Sperax USDs payments on Arbitrum.

## Overview

USDs is an auto-yield stablecoin that automatically distributes yield to holders through a rebasing mechanism. This service tracks payments received in USDs and calculates the accumulated yield over time.

### Key Features

- **Track USDs balances** over time
- **Calculate yield earned** from rebasing mechanism
- **Historical yield analytics** with time-series data
- **Real-time APY estimation** based on rebase events
- **REST API** for integration with other services

## USDs Rebasing Mechanism

USDs uses a `creditsPerToken` mechanism for yield distribution:

1. Each address has a **credits balance** that stays constant
2. The global `creditsPerToken` **decreases** when yield is distributed
3. Balance = credits / creditsPerToken
4. When `creditsPerToken` decreases, all balances increase proportionally

Rebases occur approximately every 24 hours when yield exceeds 3%.

## Installation

```bash
cd yield-tracker
npm install
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ARBITRUM_RPC_URL` | `https://arb1.arbitrum.io/rpc` | Arbitrum RPC endpoint |
| `PORT` | `3003` | API server port |
| `DB_PATH` | `./yield-tracker.db` | SQLite database path |
| `NETWORK` | `mainnet` | Network (`mainnet` or `sepolia`) |
| `POLL_INTERVAL` | `60000` | Rebase polling interval (ms) |

## Usage

### Start the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check and status |
| GET | `/api/yield/:address` | Current yield info for address |
| GET | `/api/yield/:address/history` | Historical yield data |
| GET | `/api/yield/:address/payments` | All tracked payments |
| GET | `/api/apy` | Current USDs APY |
| GET | `/api/rebase/latest` | Latest rebase event |
| GET | `/api/rebase/history` | Rebase event history |
| POST | `/api/track` | Start tracking a payment |
| GET | `/api/estimate` | Estimate future yield |
| GET | `/api/contract/state` | USDs contract state |

### Examples

#### Track a Payment

```bash
curl -X POST http://localhost:3003/api/track \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890123456789012345678901234567890",
    "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "amount": "100.50",
    "description": "API payment"
  }'
```

#### Get Yield Info

```bash
curl http://localhost:3003/api/yield/0x1234567890123456789012345678901234567890
```

Response:
```json
{
  "success": true,
  "data": {
    "address": "0x1234567890123456789012345678901234567890",
    "currentBalance": "102.58",
    "totalInitialDeposits": "100.50",
    "totalYieldEarned": "2.08",
    "yieldPercentage": "2.0697",
    "currentAPY": "8.50%",
    "paymentCount": 1,
    "isRebasing": true,
    "lastUpdated": 1737561600
  },
  "timestamp": 1737561600
}
```

#### Get Current APY

```bash
curl http://localhost:3003/api/apy
```

Response:
```json
{
  "success": true,
  "data": {
    "currentAPY": "8.50%",
    "weeklyAverageAPY": "8.45%",
    "monthlyAverageAPY": "8.52%",
    "currentCreditsPerToken": "1000000000000000000",
    "lastRebaseTimestamp": 1737475200,
    "totalRebasesTracked": 30
  },
  "timestamp": 1737561600
}
```

#### Estimate Future Yield

```bash
curl "http://localhost:3003/api/estimate?balance=1000&days=30"
```

Response:
```json
{
  "success": true,
  "data": {
    "estimatedYield": "6.89",
    "estimatedBalance": "1006.89",
    "estimatedAPY": "8.50%"
  },
  "timestamp": 1737561600
}
```

## Programmatic Usage

```typescript
import { createYieldTracker } from '@x402/yield-tracker';

// Create tracker instance
const tracker = createYieldTracker({
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  network: 'mainnet',
  dbPath: './my-tracker.db',
});

// Start tracking
await tracker.start();

// Track a payment
const payment = await tracker.trackPayment({
  address: '0x1234...',
  txHash: '0xabcd...',
  amount: '100.00',
  description: 'Payment for API access',
});

// Get yield info
const yieldInfo = await tracker.getYieldInfo('0x1234...');
console.log(`Yield earned: ${yieldInfo.totalYieldEarned} USDs`);
console.log(`Current APY: ${yieldInfo.currentAPY}`);

// Get APY info
const apyInfo = await tracker.getAPYInfo();
console.log(`Weekly average: ${apyInfo.weeklyAverageAPY}`);

// Estimate future yield
const estimate = await tracker.estimateFutureYield('1000', 365);
console.log(`Estimated yearly yield: ${estimate.estimatedYield} USDs`);

// Clean up
tracker.close();
```

## Contract Addresses

| Contract | Address |
|----------|---------|
| USDs Token | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` |
| USDs Vault | `0x8EC1877698ACF262Fe8Ad8a295ad94D6ea258988` |

## Architecture

```
yield-tracker/
├── src/
│   ├── index.ts              # Main entry point & server
│   ├── tracker.ts            # Core yield tracking logic
│   ├── types.ts              # TypeScript types
│   ├── contracts/
│   │   └── usds.ts           # USDs contract interface
│   ├── services/
│   │   ├── rebase-monitor.ts # Monitor rebase events
│   │   └── yield-calculator.ts # Calculate APY and earnings
│   ├── storage/
│   │   └── payments.ts       # SQLite payment storage
│   └── api/
│       └── routes.ts         # REST API endpoints
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Payment Tracking**: When a payment is tracked, we record:
   - Initial USDs amount
   - User's credit balance
   - Current `creditsPerToken`
   - Transaction details

2. **Rebase Monitoring**: The service monitors for rebase events:
   - Watches `TotalSupplyUpdatedHighres` events
   - Polls `rebasingCreditsPerToken()` as backup
   - Records rebase percentage and estimated APY

3. **Yield Calculation**: Yield is calculated as:
   ```
   initialBalance = credits / initialCreditsPerToken
   currentBalance = credits / currentCreditsPerToken
   yield = currentBalance - initialBalance
   ```

4. **APY Estimation**: Based on historical rebase data:
   ```
   dailyRate = totalRebasePercent / days
   APY = (1 + dailyRate)^365 - 1
   ```

## Integration with x402

This service integrates with the x402 payment protocol to track yield on payments received in USDs:

```typescript
import { createArbitrumAdapter } from '@x402/x402';
import { createYieldTracker } from '@x402/yield-tracker';

// Set up x402 adapter
const adapter = createArbitrumAdapter({
  network: 'mainnet',
  privateKey: '0x...',
});

// Set up yield tracker
const tracker = createYieldTracker({
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
});
await tracker.start();

// After receiving a payment, track it
const payment = await adapter.executeStandardPayment(paymentRequest);
await tracker.trackPayment({
  address: paymentRequest.recipient,
  txHash: payment.hash,
  amount: paymentRequest.price,
  description: 'x402 API payment',
});

// Later, check yield earned
const yieldInfo = await tracker.getYieldInfo(paymentRequest.recipient);
console.log(`Total yield: ${yieldInfo.totalYieldEarned} USDs`);
```

## License

MIT
