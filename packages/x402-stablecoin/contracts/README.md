# X402 Smart Contracts

Production-ready Solidity contracts for the X402 payment ecosystem on Arbitrum.

## Overview

The X402 smart contracts provide on-chain infrastructure for AI tool payments, featuring:

- **ToolRegistry**: On-chain marketplace for AI tools with pricing and revenue splitting
- **X402PaymentChannel**: State channels for streaming micro-payments
- **X402Subscription**: Recurring payment system with keeper incentives
- **X402CreditSystem**: Prepaid credits with USDs auto-yield accumulation

## Contracts

### ToolRegistry.sol

On-chain marketplace for registering and paying for AI tools.

**Features:**
- Register tools with name, developer, price, and payment token
- Developer self-service price updates
- Automatic platform fee splitting (default 20%)
- Batch payment processing
- Tool activation/deactivation

**Key Functions:**
```solidity
function registerTool(string name, address developer, uint256 price, address token)
function updateToolPrice(string name, uint256 newPrice)
function getToolInfo(string name) returns (address developer, uint256 price, uint256 totalCalls)
function payForTool(string name)
```

### X402PaymentChannel.sol

State channels for efficient streaming payments between AI agents and tool providers.

**Features:**
- Open channels with USDs deposits
- Off-chain payment increments with EIP-712 signatures
- Cooperative and unilateral channel closing
- Dispute resolution with 24-hour challenge period
- USDs yield accumulation during channel lifetime

**Key Functions:**
```solidity
function openChannel(address recipient, address token, uint256 deposit) returns (bytes32 channelId)
function incrementPayment(bytes32 channelId, uint256 amount, bytes signature)
function closeChannel(bytes32 channelId, uint256 finalAmount, bytes signatures)
```

### X402Subscription.sol

Recurring payment system for tool subscriptions.

**Features:**
- Flexible payment intervals (1 hour to 1 year)
- Permissionless execution after interval passes
- Keeper incentives (0.1% of payment)
- Pause/resume functionality
- USDs deposits earn yield between payments

**Key Functions:**
```solidity
function createSubscription(address recipient, uint256 amount, uint256 interval) returns (uint256 subscriptionId)
function cancelSubscription(uint256 subscriptionId)
function executeSubscription(uint256 subscriptionId)
```

### X402CreditSystem.sol

Prepaid credit system with integrated yield.

**Features:**
- Deposit USDs to receive credits
- Credits earn USDs auto-yield (~25% APY)
- 2% bonus for deposits ≥ 1000 USDs
- Use credits for tool payments
- Withdraw remaining credits with accrued yield

**Key Functions:**
```solidity
function deposit(uint256 amount)
function useCredits(string tool, uint256 amount)
function withdraw(uint256 amount)
function getCreditBalance(address user) returns (uint256)
```

## USDs Integration

All contracts integrate with Sperax USDs, a yield-bearing stablecoin on Arbitrum:

- **Address**: `0xD74f5255D557944cf7Dd0E45FF521520002D5748`
- **Decimals**: 18
- **Yield**: ~25% APY via auto-rebase

Contracts call `rebaseOptIn()` on deployment to receive auto-yield.

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+

### Install Dependencies

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0
forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.0.0
forge install foundry-rs/forge-std
```

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test test_RegisterTool

# Run with gas report
forge test --gas-report

# Fork testing on Arbitrum
forge test --fork-url $ARBITRUM_RPC_URL
```

### Deploy

1. Set environment variables:

```bash
export ARBITRUM_RPC_URL="https://arb1.arbitrum.io/rpc"
export DEPLOYER_PRIVATE_KEY="0x..."
export PLATFORM_WALLET="0x..."
export ARBISCAN_API_KEY="..."
```

2. Run deployment:

```bash
# Dry run
forge script script/Deploy.s.sol --rpc-url $ARBITRUM_RPC_URL

# Broadcast transaction
forge script script/Deploy.s.sol --rpc-url $ARBITRUM_RPC_URL --broadcast

# Verify contracts
forge script script/Deploy.s.sol --rpc-url $ARBITRUM_RPC_URL --broadcast --verify
```

### Verify Contracts

```bash
forge verify-contract <address> ToolRegistry --chain arbitrum --watch
```

## Architecture

### Upgradeability

All contracts use the UUPS (Universal Upgradeable Proxy Standard) pattern:

- Proxy contracts hold state
- Implementation contracts contain logic
- Only owner can authorize upgrades
- Storage gaps reserved for future variables

### Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Pausable**: Emergency pause functionality
- **Ownable**: Admin access control
- **SafeERC20**: Safe token transfers
- **EIP-712**: Typed structured data signing

### Gas Optimization

Optimized for Arbitrum L2:

- Packed storage structs
- Minimal storage operations
- Batch operations support
- `unchecked` blocks for safe arithmetic
- Via IR compilation for smaller bytecode

## Contract Addresses (Arbitrum Mainnet)

| Contract | Address |
|----------|---------|
| ToolRegistry | TBD |
| X402PaymentChannel | TBD |
| X402Subscription | TBD |
| X402CreditSystem | TBD |

## Audits

⚠️ These contracts have not been audited. Use at your own risk.

## License

MIT
