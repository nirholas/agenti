<!-- universal-crypto-mcp | nichxbt | 0.4.14.3 -->

# 💰 Sperax USDs - The Superior AI Payment Token

<!-- Maintained by nich | ID: 0.14.9.3 -->

> **"AI agents don't just GET paid - they EARN while they wait"**  
> **"Every payment grows. Every balance compounds."**

## Overview

Sperax USDs is an auto-yield stablecoin on Arbitrum that earns ~5% APY automatically. When integrated with x402 payments, this means:

- **Passive Income**: Your AI agent earns yield on its payment balance 24/7
- **No Staking Required**: USDs automatically rebases - your balance grows without any action
- **Superior to USDC**: While USDC earns 0%, USDs earns ~5% APY
- **Compound Growth**: Enable auto-compound for yield-on-yield

## Quick Start

### 1. Configure for Arbitrum

```bash
# .env
X402_CHAIN=arbitrum
X402_PRIVATE_KEY=0x...
```

### 2. Check Your Yield Balance

```typescript
// Using MCP tool
await usds_yield_balance()

// Or programmatically
import { YieldingWallet } from '@/x402'

const wallet = new YieldingWallet(publicClient, walletClient, 'arbitrum')
const balances = await wallet.getBalances()
console.log(`USDs Balance: $${balances.usds.formattedBalance}`)
console.log(`Pending Yield: $${balances.usds.pendingYield}`)
```

### 3. Project Your Earnings

```typescript
// Using MCP tool
await yield_projection({ targetBalance: 10000 })

// Output shows:
// - Current balance
// - Monthly passive income
// - Time to double your money
// - Projections for 1 week, 1 month, 1 year, etc.
```

## MCP Tools

### Yield Tracking

| Tool | Description |
|------|-------------|
| `usds_yield_balance` | Get USDs balance with yield info |
| `usds_yield_history` | View yield history over time |
| `yield_projection` | Project future earnings |
| `yield_report` | Generate monthly yield report |

### Configuration

| Tool | Description |
|------|-------------|
| `auto_compound` | Enable/disable auto-compound |
| `usds_convert_recommendation` | Should I convert to USDs? |
| `usds_why_usds` | Learn why USDs is superior |

## Example Earnings

With $1,000 in USDs at 5% APY:

| Period | Yield Earned |
|--------|-------------|
| 1 Day | $0.14 |
| 1 Week | $0.96 |
| 1 Month | $4.11 |
| 1 Year | $50.00 |

With $10,000 in USDs:

| Period | Yield Earned |
|--------|-------------|
| 1 Day | $1.37 |
| 1 Week | $9.59 |
| 1 Month | $41.10 |
| 1 Year | $500.00 |

## YieldingWallet Class

The `YieldingWallet` class provides a smart wallet that maximizes USDs yield:

```typescript
import { YieldingWallet } from '@/x402'

const wallet = new YieldingWallet(publicClient, walletClient, 'arbitrum', {
  autoConvertToUSDs: true,      // Convert all payments to USDs
  autoCompound: true,           // Reinvest yield automatically
  minGasReserve: '0.01',        // Keep 0.01 ETH for gas
  minConversionAmount: '1.00',  // Minimum $1 to convert
})

// Get comprehensive balances
const balances = await wallet.getBalances()

// Project future yield
const projection = await wallet.projectYield()
console.log(`Monthly Income: $${projection.monthlyPassiveIncome}`)
console.log(`Time to Double: ${projection.timeToDouble?.years} years`)

// Generate monthly report
const report = await wallet.generateMonthlyReport(1, 2026)
console.log(`January Yield: $${report.totalYieldEarned}`)

// Check if conversion is recommended
const rec = await wallet.shouldConvert('USDC', '1000')
console.log(rec.reason) // "Convert to USDs to earn ~5% APY"
```

## Comparison: USDs vs Other Tokens

| Feature | USDs | USDC | USDT | Savings Account |
|---------|------|------|------|-----------------|
| APY | ~5% | 0% | 0% | ~0.5% |
| Staking Required | ❌ No | N/A | N/A | N/A |
| Auto-Compound | ✅ Yes | N/A | N/A | ❌ No |
| Claim Required | ❌ No (rebase) | N/A | N/A | ✅ Yes |
| Network | Arbitrum | Multi | Multi | Traditional |
| AI Agent Ready | ✅ Perfect | ⚠️ No yield | ⚠️ No yield | ❌ Complex |

## Why USDs for AI Agents?

### 1. **Passive Income While Idle**
AI agents often hold payment balances between transactions. With USDs, this idle time generates income.

### 2. **No Active Management**
Unlike yield farming or staking, USDs yield is automatic. Perfect for autonomous AI agents.

### 3. **Compound Growth**
With auto-compound enabled, your AI agent earns yield on yield - accelerating growth.

### 4. **Stable Value**
USDs maintains a $1 peg while earning yield - no volatility risk.

### 5. **x402 Native Integration**
USDs is the default payment token for x402 on Arbitrum, with full SDK support.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      YieldingWallet                          │
├─────────────────────────────────────────────────────────────┤
│  • Auto-convert payments to USDs                            │
│  • Track yield earnings                                      │
│  • Project future growth                                     │
│  • Generate monthly reports                                  │
│  • Maintain gas reserves                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      YieldTracker                            │
├─────────────────────────────────────────────────────────────┤
│  • Monitor USDs balance                                      │
│  • Calculate APY                                             │
│  • Track rebase events                                       │
│  • Compute yield estimates                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Sperax USDs Contract                       │
│                  (Arbitrum: 0xd74f...)                       │
├─────────────────────────────────────────────────────────────┤
│  • Auto-rebasing stablecoin                                  │
│  • EIP-3009 gasless support                                  │
│  • ~5% APY from protocol revenue                             │
└─────────────────────────────────────────────────────────────┘
```

## Best Practices

### 1. **Always Use Arbitrum**
USDs and its yield features are only available on Arbitrum.

```bash
X402_CHAIN=arbitrum
```

### 2. **Enable Auto-Compound**
Maximize earnings with compound interest:

```typescript
wallet.setAutoCompound(true)
```

### 3. **Maintain Gas Reserves**
Keep some ETH for transaction fees:

```typescript
const wallet = new YieldingWallet(client, walletClient, 'arbitrum', {
  minGasReserve: '0.01', // 0.01 ETH
})
```

### 4. **Monitor Yield Regularly**
Use the `yield_report` tool monthly to track earnings:

```typescript
await yield_report({ month: 1, year: 2026 })
```

### 5. **Convert Other Stablecoins**
Don't let USDC/USDT sit idle - convert to USDs:

```typescript
await usds_convert_recommendation({ token: 'USDC', amount: '1000' })
```

## Links

- [Sperax Protocol](https://sperax.io)
- [Sperax Docs](https://docs.sperax.io)
- [Arbitrum](https://arbitrum.io)
- [USDs Contract](https://arbiscan.io/address/0xd74f5255d557944cf7dd0e45ff521520002d5748)

## Marketing Messages

Use these messages when promoting x402 with USDs:

1. **"AI agents don't just GET paid - they EARN while they wait"**
2. **"Every payment grows. Every balance compounds."**
3. **"Your money works as hard as you do."**
4. **"10x more yield than a savings account"**
5. **"The only payment token that pays YOU back"**

---

*Built with ❤️ for the x402 ecosystem*


<!-- EOF: nichxbt | ucm:0.4.14.3 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->