# Sperax Protocol Documentation

Complete technical specifications for the Sperax DeFi protocol ecosystem.

**Last Updated**: January 2026  
**Primary Chain**: Arbitrum One (Chain ID: 42161)

---

## 📖 Documentation

<div class="grid cards" markdown>

-   :material-file-document:{ .lg .middle } **Overview**

    ---

    Protocol architecture and yield flow

    [:octicons-arrow-right-24: Read Overview](overview.md)

-   :material-currency-usd:{ .lg .middle } **USDs Token**

    ---

    Auto-yield stablecoin and rebase mechanics

    [:octicons-arrow-right-24: USDs Docs](usds-token.md)

-   :material-safe-square-outline:{ .lg .middle } **Vault Core**

    ---

    Mint, redeem, and collateral management

    [:octicons-arrow-right-24: Vault Docs](vault-core.md)

-   :material-database-cog:{ .lg .middle } **Collateral Manager**

    ---

    Collateral configuration and fees

    [:octicons-arrow-right-24: Collateral Docs](collateral-manager.md)

-   :material-chart-line:{ .lg .middle } **Strategies**

    ---

    Aave, Compound, Stargate yield strategies

    [:octicons-arrow-right-24: Strategies](strategies.md)

-   :material-water-outline:{ .lg .middle } **Rebase Dripper**

    ---

    RebaseManager and Dripper contracts

    [:octicons-arrow-right-24: Dripper Docs](rebase-dripper.md)

-   :material-chart-bubble:{ .lg .middle } **Oracles**

    ---

    MasterPriceOracle, Chainlink, DIA, TWAP

    [:octicons-arrow-right-24: Oracle Docs](oracles.md)

-   :material-swap-horizontal:{ .lg .middle } **SPA Buyback**

    ---

    SPABuyback and YieldReserve

    [:octicons-arrow-right-24: Buyback Docs](spa-buyback.md)

-   :material-lock-outline:{ .lg .middle } **SPA Staking**

    ---

    SPA, veSPA, xSPA tokenomics

    [:octicons-arrow-right-24: Staking Docs](spa-staking.md)

-   :material-tractor:{ .lg .middle } **Demeter Farms**

    ---

    Farm contracts and registry

    [:octicons-arrow-right-24: Farm Docs](demeter-farms.md)

-   :material-gift-outline:{ .lg .middle } **Rewarder**

    ---

    APR-based reward distribution

    [:octicons-arrow-right-24: Rewarder Docs](rewarder.md)

-   :material-map-marker:{ .lg .middle } **Addresses**

    ---

    All deployed contract addresses

    [:octicons-arrow-right-24: Addresses](addresses.md)

-   :material-alert-circle-outline:{ .lg .middle } **Errors & Events**

    ---

    Complete error and event reference

    [:octicons-arrow-right-24: Reference](errors-events.md)

</div>

---

## 🔗 Quick Links

### Official Resources
- **Website**: https://sperax.io
- **dApp**: https://app.sperax.io
- **Docs**: https://docs.sperax.io
- **GitHub**: https://github.com/Sperax

### Source Repositories
- [Sperax/USDs-v2](https://github.com/Sperax/USDs-v2) - Core USDs Protocol
- [Sperax/Demeter-Protocol-Contracts](https://github.com/Sperax/Demeter-Protocol-Contracts) - Yield Farming

---

## 🎯 Key Contract Addresses (Arbitrum)

| Contract | Address |
|----------|---------|
| USDs | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` |
| SPA | `0x5575552988A3A80504bBaeB1311674fCFd40aD4B` |
| veSPA | `0x2e2071180682Ce6C247B1eF93d382D509F5F6A17` |
| xSPA | `0x0966E72256d6055145902F72F9D3B6a194B9cCc3` |
| Vault | `0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca` |
| SPABuyback | `0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3` |
| Farm Registry | `0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0` |
| MasterPriceOracle | `0x14D99412dAB1878dC01Fe7a1664cdE85896e8E50` |

---

## 📐 Key Formulas

```solidity
// veSPA calculation
veSPA = SPA_staked × (lockup_days / 365)
// Lock range: 7 days to 4 years (1461 days)

// xSPA redemption (15-180 day vesting)
SPA_received = xSPA_amount × (vesting_days + 150) / 330
// 15 days = 50%, 180 days = 100%

// USDs auto-yield
yield_to_holders = collateral_yield × 0.70
yield_to_buyback = collateral_yield × 0.30
// Capped at 25% APR to holders

// Rebase formula
new_balance = credit_balance / credits_per_token
// credits_per_token decreases as yield accrues
```

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Mint USDs    Redeem USDs    Stake SPA    Create Farm           │
└──────┬──────────────┬─────────────┬────────────┬────────────────┘
       │              │             │            │
       ▼              ▼             ▼            ▼
┌──────────────────────────────────────────────────────────────────┐
│                       CORE CONTRACTS                              │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│   VaultCore  │    USDs      │   veSPA      │   FarmRegistry      │
│   (Mint/     │   (Rebase    │   (Vote      │   (Deploy           │
│   Redeem)    │   Token)     │   Escrow)    │   Farms)            │
└──────┬───────┴──────┬───────┴──────┬───────┴─────────┬───────────┘
       │              │              │                 │
       ▼              ▼              ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE                               │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│ Collateral   │   Rebase     │   SPA        │   Rewarder          │
│ Manager      │   Manager    │   Buyback    │   Factory           │
├──────────────┼──────────────┼──────────────┼─────────────────────┤
│ Fee          │   Dripper    │   Yield      │   Farm              │
│ Calculator   │              │   Reserve    │   Deployers         │
└──────┬───────┴──────────────┴──────┬───────┴─────────────────────┘
       │                             │
       ▼                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                      YIELD STRATEGIES                             │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│    Aave      │   Compound   │   Stargate   │   Fluid             │
│   Strategy   │   Strategy   │   Strategy   │   Strategy          │
└──────────────┴──────────────┴──────────────┴─────────────────────┘
```
