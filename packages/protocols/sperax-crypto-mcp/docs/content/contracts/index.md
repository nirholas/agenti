# Smart Contracts

Sperax Protocol smart contract documentation.

---

## 📖 Documentation

<div class="grid cards" markdown>

-   :material-file-code:{ .lg .middle } **ABIs**

    ---

    Contract ABIs for integration

    [:octicons-arrow-right-24: View ABIs](abis.md)

</div>

---

## Overview

The Sperax Protocol consists of interconnected smart contracts on Arbitrum One.

---

## Core Contracts

### USDs Token

The auto-yield stablecoin.

| Property | Value |
|----------|-------|
| Address | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` |
| Standard | ERC-20 (with rebasing) |
| Decimals | 18 |

**Key Functions:**
- `balanceOf(address)` - Get balance
- `rebasingCreditsPerToken()` - Current rebase ratio
- `rebaseOptIn()` - Enable yield
- `rebaseOptOut()` - Disable yield

---

### Vault

Collateral management and minting.

| Property | Value |
|----------|-------|
| Address | `0xF783DD830A4650D2A8594423F123250652340E3f` |

**Key Functions:**
- `mint(address collateral, uint256 amount)` - Mint USDs
- `redeem(address collateral, uint256 amount)` - Redeem USDs
- `getAllCollaterals()` - List collaterals
- `getCollateralData(address)` - Collateral info

---

### Collateral Manager

Manages collateral parameters and strategies.

| Property | Value |
|----------|-------|
| Address | `0x6d5240f086637Fb408c7F727010A10cf57D51B62` |

**Key Functions:**
- `getCollateralStrategy(address)` - Get strategy
- `updateCollateralData(address, CollateralData)` - Update params

---

### Oracle

Price feeds for collaterals.

| Property | Value |
|----------|-------|
| Address | `0x14e2E36c6D6327C628B73BE7249bAf850CB2cC1C` |

**Key Functions:**
- `getPrice(address)` - Get asset price
- `getSources(address)` - Get oracle sources

---

## Staking Contracts

### veSPA (Vote Escrow)

Lock SPA for voting power.

| Property | Value |
|----------|-------|
| Address | `0x2e2071180682Ce6C247B1eF93d382D509F5F6A17` |

**Key Functions:**
- `createLock(uint256 amount, uint256 duration)` - Lock SPA
- `increaseLockAmount(uint256 amount)` - Add to lock
- `increaseLockDuration(uint256 duration)` - Extend lock
- `withdraw()` - Withdraw after unlock
- `balanceOf(address)` - Get voting power

---

### xSPA

Liquid staking with exit options.

| Property | Value |
|----------|-------|
| Address | `0x...` |

**Key Functions:**
- `stake(uint256 amount)` - Stake SPA
- `startRedeem(uint256 amount)` - Start exit
- `completeRedeem()` - Complete exit

---

## Demeter Contracts

### Demeter Factory

Creates and manages farms.

| Property | Value |
|----------|-------|
| Address | `0xAaDFaBD19DeFbe3dA6eFB503A5f4a8167D10e5dF` |

**Key Functions:**
- `createFarm(FarmParams)` - Create new farm
- `getAllFarms()` - List all farms
- `getFarmDetails(uint256 id)` - Get farm info

---

### Rewarder

Distributes farming rewards.

| Property | Value |
|----------|-------|
| Address | Per-farm deployment |

**Key Functions:**
- `pendingReward(address user)` - Check pending
- `claim()` - Claim rewards

---

## Yield Contracts

### Dripper

Distributes yield to USDs holders.

| Property | Value |
|----------|-------|
| Address | `0x32f20404B6da2fC13fCAB28e2AF6b0E5c6e02C08` |

**Key Functions:**
- `drip()` - Execute drip
- `availableFunds()` - Check pending yield
- `dripRate()` - Current rate

---

### Yield Reserve

Collects and buffers yield.

| Property | Value |
|----------|-------|
| Address | `0x...` |

**Key Functions:**
- `collect()` - Collect from strategies
- `available()` - Check available yield

---

## Governance

### SPA Token

Governance token.

| Property | Value |
|----------|-------|
| Address | `0x5575552988A3A80504bBaeB1311674fCFd40aD4B` |
| Standard | ERC-20 |
| Decimals | 18 |

---

### Governor

On-chain governance.

| Property | Value |
|----------|-------|
| Address | `0x...` |

**Key Functions:**
- `propose(...)` - Create proposal
- `castVote(uint256 proposalId, bool support)` - Vote
- `execute(uint256 proposalId)` - Execute passed

---

## Strategies

Active yield strategies for collateral.

| Strategy | Collateral | Address |
|----------|------------|---------|
| Aave USDC | USDC | `0x...` |
| Aave USDT | USDT | `0x...` |
| Stargate | USDC | `0x...` |

---

## Related Documentation

- [../protocol/addresses.md](../protocol/addresses.md) - Complete address list
- [../protocol/vault-core.md](../protocol/vault-core.md) - Vault details
- [../protocol/usds-token.md](../protocol/usds-token.md) - USDs details
