# Yield Tracking Guide

Monitor and claim auto-yield earnings from USDs payments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding USDs Auto-Yield](#understanding-usds-auto-yield)
3. [Setting Up yield-tracker](#setting-up-yield-tracker)
4. [Viewing Yield Reports](#viewing-yield-reports)
5. [Claiming Accumulated Yield](#claiming-accumulated-yield)
6. [Tax Considerations](#tax-considerations)
7. [Troubleshooting](#troubleshooting)
8. [Related Guides](#related-guides)

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed
- USDs tokens on Arbitrum
- Basic understanding of DeFi yield concepts

### What is USDs?

USDs is Sperax's auto-yield stablecoin on Arbitrum. Unlike traditional stablecoins:

- **Auto-rebasing**: Your balance increases automatically as yield accrues
- **No staking required**: Just hold USDs in your wallet
- **~10% APY**: Current yield rate (varies based on DeFi strategies)
- **Dollar-pegged**: 1 USDs ≈ 1 USD

**USDs Contract**: `0xD74f5255D557944cf7Dd0E45FF521520002D5748`  
**Vault Contract**: `0x8EC1877698ACF262Fe8Ad8a295ad94D6ea258988`

---

## Understanding USDs Auto-Yield

### How Rebasing Works

USDs uses a **positive rebasing** mechanism:

```
Day 0: You hold 100 USDs
Day 30: You still "hold" 100 USDs, but...
        Balance shows: 100.82 USDs (0.82 yield earned)
```

The contract tracks your balance using **credits** (internal accounting units) that remain constant. The `creditsPerToken` ratio decreases over time as yield accrues, making each credit worth more tokens.

```
balance = credits / creditsPerToken
```

### Yield Sources

USDs yield comes from:
1. **Lending protocols** (Aave, Compound)
2. **Liquidity provision** (Uniswap, Curve)
3. **Yield aggregators** (Yearn)

The Sperax vault automatically allocates funds to optimize yield while maintaining stability.

### Opt-In vs Opt-Out

| Mode | Balance Changes | Use Case |
|------|-----------------|----------|
| **Opt-In** (default for EOAs) | Yes, increases with yield | Regular users who want yield |
| **Opt-Out** | No, stays constant | Smart contracts that need predictable balances |

Smart contracts must explicitly call `rebaseOptIn()` to receive yield.

---

## Setting Up yield-tracker

### Installation

```bash
# Install the yield-tracker package
cd /workspaces/x402/yield-tracker
pnpm install

# Or install globally
pnpm add -g @x402/yield-tracker
```

### Quick Start

```typescript
import { createYieldTracker, startServer } from '@x402/yield-tracker';

// Start the yield tracker service
const { tracker, app, close } = await startServer({
  port: 3003,
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  dbPath: './yield-data.db',
  pollInterval: 60000, // Check every minute
});

console.log('Yield tracker running on http://localhost:3003');

// Track a specific address
await tracker.trackAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f3bF97');

// Get yield info
const yieldInfo = await tracker.getYieldInfo('0x742d35Cc6634C0532925a3b844Bc9e7595f3bF97');
console.log('Yield earned:', yieldInfo.yieldEarned);
```

### Configuration Options

```typescript
interface YieldTrackerConfig {
  // Network settings
  rpcUrl: string;           // Arbitrum RPC URL
  network: 'mainnet' | 'testnet';
  
  // Storage
  dbPath: string;           // SQLite database path
  
  // Polling
  pollInterval: number;     // How often to check for rebases (ms)
  
  // Server
  port: number;             // API server port
}
```

### Environment Variables

```bash
# .env
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
DB_PATH=./yield-tracker.db
PORT=3003
POLL_INTERVAL=60000
```

---

## Viewing Yield Reports

### API Endpoints

The yield tracker provides a REST API:

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Service health check |
| `GET /api/yield/:address` | Get yield info for an address |
| `GET /api/yield/:address/history` | Historical yield data |
| `GET /api/apy` | Current APY estimate |
| `GET /api/rebase/latest` | Latest rebase event |
| `GET /api/rebase/history` | Rebase history |
| `POST /api/track` | Start tracking a new address |

### Example API Usage

```typescript
// Get yield info for an address
const response = await fetch('http://localhost:3003/api/yield/0x742d35...');
const yieldInfo = await response.json();

console.log(yieldInfo);
// {
//   address: "0x742d35...",
//   currentBalance: "1000.50",
//   initialBalance: "1000.00",
//   yieldEarned: "0.50",
//   yieldPercent: "0.05%",
//   estimatedAPY: "10.2%",
//   trackingSince: "2026-01-01T00:00:00Z"
// }

// Get yield history
const history = await fetch('http://localhost:3003/api/yield/0x742d.../history');
const data = await history.json();

// {
//   address: "0x742d35...",
//   history: [
//     { date: "2026-01-01", balance: "1000.00", yieldEarned: "0.00" },
//     { date: "2026-01-02", balance: "1000.03", yieldEarned: "0.03" },
//     { date: "2026-01-03", balance: "1000.06", yieldEarned: "0.06" },
//     // ...
//   ]
// }
```

### CLI Usage

```bash
# Start the tracker server
pnpm start

# Check yield for an address
curl http://localhost:3003/api/yield/0x742d35Cc6634C0532925a3b844Bc9e7595f3bF97

# Get current APY
curl http://localhost:3003/api/apy

# Track a new address
curl -X POST http://localhost:3003/api/track \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f3bF97"}'
```

### Generating Reports

```typescript
import { createYieldTracker } from '@x402/yield-tracker';

const tracker = createYieldTracker({
  rpcUrl: process.env.ARBITRUM_RPC_URL!,
  dbPath: './yield-data.db',
});

await tracker.start();

// Generate monthly report
async function generateMonthlyReport(address: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const history = await tracker.getYieldHistory(address, thirtyDaysAgo);
  const currentInfo = await tracker.getYieldInfo(address);
  
  const report = {
    address,
    period: '30 days',
    startDate: thirtyDaysAgo.toISOString(),
    endDate: new Date().toISOString(),
    
    // Balance changes
    startingBalance: history[0]?.balance || '0',
    endingBalance: currentInfo.currentBalance,
    
    // Yield metrics
    totalYieldEarned: currentInfo.yieldEarned,
    averageDailyYield: (parseFloat(currentInfo.yieldEarned) / 30).toFixed(6),
    effectiveAPY: currentInfo.estimatedAPY,
    
    // Detailed history
    dailySnapshots: history,
  };
  
  return report;
}

// Usage
const report = await generateMonthlyReport('0x742d35...');
console.log(JSON.stringify(report, null, 2));
```

---

## Claiming Accumulated Yield

Unlike many DeFi protocols, USDs yield is **automatically credited to your balance**. There's no separate claim process needed!

### Verifying Yield Receipt

```typescript
import { createPublicClient, http, formatUnits } from 'viem';
import { arbitrum } from 'viem/chains';

const USDS_ADDRESS = '0xD74f5255D557944cf7Dd0E45FF521520002D5748';

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

const USDS_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'creditBalanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'creditBalance', type: 'uint256' },
      { name: 'creditsPerToken', type: 'uint256' },
    ],
  },
] as const;

async function verifyYield(address: `0x${string}`, originalDeposit: string) {
  // Get current balance
  const currentBalance = await publicClient.readContract({
    address: USDS_ADDRESS,
    abi: USDS_ABI,
    functionName: 'balanceOf',
    args: [address],
  });
  
  const currentBalanceFormatted = formatUnits(currentBalance, 18);
  const originalDepositNum = parseFloat(originalDeposit);
  const yieldEarned = parseFloat(currentBalanceFormatted) - originalDepositNum;
  
  console.log(`Original deposit: $${originalDeposit} USDs`);
  console.log(`Current balance:  $${currentBalanceFormatted} USDs`);
  console.log(`Yield earned:     $${yieldEarned.toFixed(6)} USDs`);
  console.log(`Yield %:          ${((yieldEarned / originalDepositNum) * 100).toFixed(4)}%`);
  
  return {
    originalDeposit,
    currentBalance: currentBalanceFormatted,
    yieldEarned: yieldEarned.toFixed(6),
    yieldPercent: ((yieldEarned / originalDepositNum) * 100).toFixed(4),
  };
}

// Usage
await verifyYield('0x742d35Cc6634C0532925a3b844Bc9e7595f3bF97', '1000.00');
```

### Withdrawing Yield

Since yield is automatically added to your balance, "claiming" yield simply means transferring or using your USDs:

```typescript
import { createWalletClient, http, parseUnits } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(),
});

// Transfer yield to another wallet
async function withdrawYield(
  yieldAmount: string,
  destinationAddress: `0x${string}`
) {
  const amount = parseUnits(yieldAmount, 18);
  
  const hash = await walletClient.writeContract({
    address: USDS_ADDRESS,
    abi: [{
      name: 'transfer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    }],
    functionName: 'transfer',
    args: [destinationAddress, amount],
  });
  
  console.log(`Yield withdrawn: ${hash}`);
  return hash;
}
```

### Compound Yield (Keep It Working)

To maximize yield, simply leave your USDs in your wallet. The longer you hold, the more you earn:

```typescript
// Estimate future yield
function estimateFutureYield(
  currentBalance: number,
  apy: number,
  days: number
): number {
  // Simple interest approximation
  const dailyRate = apy / 365 / 100;
  const futureBalance = currentBalance * Math.pow(1 + dailyRate, days);
  return futureBalance - currentBalance;
}

// Example: $10,000 at 10% APY for 1 year
const futureYield = estimateFutureYield(10000, 10, 365);
console.log(`Estimated yield after 1 year: $${futureYield.toFixed(2)}`);
// Output: Estimated yield after 1 year: $1051.56 (compounded)
```

---

## Tax Considerations

> ⚠️ **Disclaimer**: This is not tax advice. Consult a qualified tax professional for your specific situation.

### Understanding Tax Implications

USDs rebasing creates unique tax considerations:

| Event | Potential Tax Treatment |
|-------|------------------------|
| Receiving yield | Income (interest/other income) |
| Selling USDs | Capital gains/losses |
| Using USDs for payments | Potential capital gains |

### Record-Keeping Best Practices

```typescript
interface TaxRecord {
  date: Date;
  type: 'yield' | 'transfer_in' | 'transfer_out' | 'payment';
  amount: string;
  balance_before: string;
  balance_after: string;
  tx_hash?: string;
  notes?: string;
}

class TaxRecordKeeper {
  private records: TaxRecord[] = [];
  
  addYieldRecord(date: Date, yieldAmount: string, newBalance: string) {
    this.records.push({
      date,
      type: 'yield',
      amount: yieldAmount,
      balance_before: (parseFloat(newBalance) - parseFloat(yieldAmount)).toFixed(6),
      balance_after: newBalance,
      notes: 'Daily USDs rebase yield',
    });
  }
  
  exportForTaxSoftware(): string {
    // Export in CSV format for tax software
    const headers = 'Date,Type,Amount,Balance Before,Balance After,TX Hash,Notes\n';
    const rows = this.records.map(r => 
      `${r.date.toISOString()},${r.type},${r.amount},${r.balance_before},${r.balance_after},${r.tx_hash || ''},${r.notes || ''}`
    ).join('\n');
    
    return headers + rows;
  }
  
  getAnnualYieldSummary(year: number): { totalYield: string; records: TaxRecord[] } {
    const yearRecords = this.records.filter(r => 
      r.type === 'yield' && r.date.getFullYear() === year
    );
    
    const totalYield = yearRecords.reduce(
      (sum, r) => sum + parseFloat(r.amount),
      0
    );
    
    return {
      totalYield: totalYield.toFixed(6),
      records: yearRecords,
    };
  }
}
```

### Automated Yield Tracking for Taxes

```typescript
import { createYieldTracker } from '@x402/yield-tracker';

// Set up daily yield snapshots for tax records
const tracker = createYieldTracker({
  rpcUrl: process.env.ARBITRUM_RPC_URL!,
  dbPath: './tax-records.db',
  pollInterval: 24 * 60 * 60 * 1000, // Daily snapshots
});

// Generate year-end tax report
async function generateTaxReport(address: string, year: number) {
  const startOfYear = new Date(`${year}-01-01`);
  const endOfYear = new Date(`${year}-12-31`);
  
  const history = await tracker.getYieldHistory(address, startOfYear, endOfYear);
  
  // Calculate daily yield increments
  const dailyYields = history.map((day, i) => {
    const prevDay = history[i - 1];
    const yieldAmount = prevDay 
      ? parseFloat(day.balance) - parseFloat(prevDay.balance)
      : 0;
    
    return {
      date: day.date,
      balance: day.balance,
      yieldEarned: yieldAmount.toFixed(6),
    };
  });
  
  const totalYield = dailyYields.reduce(
    (sum, d) => sum + parseFloat(d.yieldEarned),
    0
  );
  
  return {
    address,
    year,
    totalYieldEarned: totalYield.toFixed(6),
    dailyBreakdown: dailyYields,
    
    // Summary for tax forms
    taxSummary: {
      interestIncome: totalYield.toFixed(2),
      currency: 'USD',
      source: 'Sperax USDs Auto-Yield',
      blockchain: 'Arbitrum',
    },
  };
}
```

### Cost Basis Tracking

```typescript
interface CostBasisLot {
  acquiredDate: Date;
  amount: string;
  costBasis: string; // USD value at acquisition
  source: 'purchase' | 'yield' | 'transfer';
}

class CostBasisTracker {
  private lots: CostBasisLot[] = [];
  
  addLot(lot: CostBasisLot) {
    this.lots.push(lot);
  }
  
  // FIFO (First In, First Out) method
  calculateGainFIFO(saleAmount: string, salePrice: string): {
    gain: string;
    shortTerm: string;
    longTerm: string;
    lotsUsed: CostBasisLot[];
  } {
    let remaining = parseFloat(saleAmount);
    let totalCostBasis = 0;
    const lotsUsed: CostBasisLot[] = [];
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    let shortTermBasis = 0;
    let longTermBasis = 0;
    
    for (const lot of this.lots) {
      if (remaining <= 0) break;
      
      const lotAmount = parseFloat(lot.amount);
      const amountFromLot = Math.min(remaining, lotAmount);
      const costBasisUsed = (amountFromLot / lotAmount) * parseFloat(lot.costBasis);
      
      totalCostBasis += costBasisUsed;
      
      if (lot.acquiredDate > oneYearAgo) {
        shortTermBasis += costBasisUsed;
      } else {
        longTermBasis += costBasisUsed;
      }
      
      lotsUsed.push({
        ...lot,
        amount: amountFromLot.toFixed(6),
        costBasis: costBasisUsed.toFixed(2),
      });
      
      remaining -= amountFromLot;
    }
    
    const proceeds = parseFloat(saleAmount) * parseFloat(salePrice);
    const totalGain = proceeds - totalCostBasis;
    
    return {
      gain: totalGain.toFixed(2),
      shortTerm: (totalGain * (shortTermBasis / totalCostBasis)).toFixed(2),
      longTerm: (totalGain * (longTermBasis / totalCostBasis)).toFixed(2),
      lotsUsed,
    };
  }
}
```

---

## Troubleshooting

### Balance not increasing (no yield)

**Cause 1:** Contract is opted out of rebasing.

**Solution:**
```solidity
// In your contract
IUSDs(USDS).rebaseOptIn();
```

**Cause 2:** Balance is too small to show visible yield.

**Solution:** Yield accrues proportionally. A $1 balance at 10% APY earns ~$0.0003/day. Try tracking over longer periods.

### yield-tracker not connecting

**Cause:** RPC URL issues or rate limiting.

**Solution:**
```typescript
// Use a reliable RPC provider
const tracker = createYieldTracker({
  rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
  // ...
});
```

### Historical data missing

**Cause:** Tracker wasn't running during that period.

**Solution:** The tracker only captures data while running. For historical data, query on-chain events:

```typescript
// Query past rebase events
const logs = await publicClient.getLogs({
  address: USDS_ADDRESS,
  event: {
    type: 'event',
    name: 'TotalSupplyUpdatedHighres',
    inputs: [
      { indexed: false, name: 'totalSupply', type: 'uint256' },
      { indexed: false, name: 'rebasingCredits', type: 'uint256' },
      { indexed: false, name: 'rebasingCreditsPerToken', type: 'uint256' },
    ],
  },
  fromBlock: 'earliest',
  toBlock: 'latest',
});
```

### Yield calculations seem wrong

**Cause:** Not accounting for deposits/withdrawals.

**Solution:** Track all token movements, not just balance changes:

```typescript
// Track transfers to distinguish yield from deposits
const transferLogs = await publicClient.getLogs({
  address: USDS_ADDRESS,
  event: {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
  args: {
    to: yourAddress, // Incoming transfers
  },
  fromBlock: startBlock,
});
```

---

## Related Guides

- [Quick Start](./QUICK_START.md) - Get started with X402 payments
- [Smart Contract Integration](./SMART_CONTRACT_INTEGRATION.md) - Handle USDs rebasing in contracts
- [Express Middleware](./EXPRESS_MIDDLEWARE.md) - Build paid APIs
- [AI Agent Integration](./AI_AGENT_INTEGRATION.md) - AI agents with payment capabilities

---

## Resources

- [Sperax USDs Documentation](https://docs.sperax.io/)
- [USDs Contract on Arbiscan](https://arbiscan.io/address/0xD74f5255D557944cf7Dd0E45FF521520002D5748)
- [Yield Tracker Source Code](https://github.com/nirholas/x402/tree/main/yield-tracker)
- [DeFiLlama USDs Stats](https://defillama.com/protocol/sperax)
