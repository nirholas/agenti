# 01 - Protocol Overview

## What is Sperax?

Sperax is a DeFi protocol ecosystem built primarily on **Arbitrum** (Layer 2) consisting of:

1. **USDs** - An auto-yield stablecoin that grows in your wallet
2. **SPA** - Governance token with deflationary mechanics
3. **veSPA** - Vote-escrowed SPA for governance voting
4. **xSPA** - Reward token redeemable for SPA
5. **Demeter** - No-code yield farm deployer

---

## USDs: Auto-Yield Stablecoin

### Core Features

| Feature | Description |
|---------|-------------|
| **Collateralization** | 100% backed by USDC, USDC.e, USDT |
| **Auto-Yield** | Balance grows automatically via rebase (~25% APY) |
| **No Staking Required** | Yield accrues to all EOA holders |
| **Yield Source** | Collateral deployed to DeFi protocols |

### How Auto-Yield Works

```
┌─────────────────┐
│   User holds    │
│   100 USDs      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Collateral in  │────▶│  Yield earned   │
│  Aave/Compound  │     │  from lending   │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌───────────────┐         ┌───────────────┐
           │  70% → Rebase │         │ 30% → Buyback │
           │  (to holders) │         │ (burn SPA)    │
           └───────┬───────┘         └───────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  User now has   │
         │  100.05 USDs    │
         │  (after rebase) │
         └─────────────────┘
```

### Yield Distribution Split

| Destination | Percentage | Purpose |
|-------------|------------|---------|
| USDs Holders | 70% | Auto-yield via rebase |
| SPA Buyback | 30% | Buy & burn SPA (deflationary) |

### Yield Sources (Strategies)

| Strategy | Protocol | Risk Level |
|----------|----------|------------|
| AaveStrategy | Aave V3 | Low |
| CompoundStrategy | Compound V3 | Low |
| StargateStrategy | Stargate Finance | Medium |
| FluidStrategy | Fluid Protocol | Medium |

---

## Mint & Redeem Flow

### Minting USDs

```
User deposits USDC ──▶ VaultCore.mint() ──▶ User receives USDs
                              │
                              ├── Collateral → Strategy (yield)
                              ├── Mint fee collected
                              └── USDs minted 1:1 (minus fee)
```

**Supported Collaterals**:
- USDC (Native)
- USDC.e (Bridged)
- USDT
- DAI
- FRAX
- LUSD

### Redeeming USDs

```
User burns USDs ──▶ VaultCore.redeem() ──▶ User receives USDC
                           │
                           ├── USDs burned
                           ├── Redeem fee collected
                           └── Collateral returned from strategy
```

### Fee Structure

| Operation | Base Fee | Dynamic Adjustment |
|-----------|----------|-------------------|
| Mint | 0.0% - 0.1% | Lower if collateral below target |
| Redeem | 0.1% - 0.5% | Higher if collateral below target |

---

## SPA Tokenomics

### Token Utility

| Use Case | Description |
|----------|-------------|
| Governance | Vote on protocol parameters via veSPA |
| Staking Rewards | Earn xSPA rewards for locking SPA |
| Buyback & Burn | 30% of yield buys and burns SPA |

### Deflationary Mechanics

```
Collateral Yield
       │
       └── 30% ──▶ SPABuyback Contract
                         │
                         ├── Buy SPA from market
                         │
                         └── 50% Burn SPA
                             50% → veSPA Rewards
```

### Token Supply

| Metric | Value |
|--------|-------|
| Initial Supply | 5,000,000,000 SPA |
| Burned to Date | 375,000,000+ SPA |
| Circulating | Dynamic (check Arbiscan) |

---

## veSPA: Vote-Escrowed SPA

### Lock Mechanics

```solidity
// Lock formula
veSPA = SPA_amount × (lock_days / 365)

// Examples:
// 1000 SPA locked 1 year  = 1000 veSPA
// 1000 SPA locked 4 years = 4000 veSPA
// 1000 SPA locked 7 days  = 19.18 veSPA
```

### Lock Parameters

| Parameter | Value |
|-----------|-------|
| Minimum Lock | 7 days |
| Maximum Lock | 4 years (1461 days) |
| veSPA Decay | Linear to expiry |

### veSPA Benefits

1. **Governance Voting** - Vote on Snapshot proposals
2. **Revenue Share** - Receive SPA from buyback
3. **Boosted Rewards** - Higher APR in Demeter farms

---

## xSPA: Reward Token

### Redemption Mechanics

xSPA can be redeemed for SPA with a vesting period:

```solidity
// Redemption formula
SPA_out = xSPA_amount × (vesting_days + 150) / 330

// Examples:
// 100 xSPA, 15-day vest  = 50 SPA  (50%)
// 100 xSPA, 90-day vest  = 72.7 SPA (72.7%)
// 100 xSPA, 180-day vest = 100 SPA (100%)
```

### Redemption Schedule

| Vesting Period | SPA Received |
|----------------|--------------|
| 15 days (min) | 50% |
| 30 days | 54.5% |
| 60 days | 63.6% |
| 90 days | 72.7% |
| 120 days | 81.8% |
| 150 days | 90.9% |
| 180 days (max) | 100% |

---

## Demeter: No-Code Farms

### Overview

Demeter allows anyone to create yield farms for their LP tokens without coding.

### Farm Types

| Type | Description |
|------|-------------|
| E20Farm | ERC-20 LP token farms |
| E721Farm | NFT position farms (Uniswap V3, Camelot) |
| CamelotV2Farm | Camelot DEX LP farms |
| CamelotV3Farm | Camelot V3 concentrated liquidity |
| UniswapV3Farm | Uniswap V3 position farms |

### Creation Fee

| Parameter | Value |
|-----------|-------|
| Creation Fee | 100 USDs |
| Extension Fee | 1 USDs/day |
| Fee Receiver | SPABuyback contract |

### Farm Features

- **Lockup Option**: Optional cooldown period (0-30 days)
- **Multi-Reward**: Up to 4 reward tokens per farm
- **APR-Based Rewards**: Via Rewarder contract
- **Expirable Farms**: Optional expiry with extension
