# AutoTopUpExecutor Module Architecture

## Overview

The AutoTopUpExecutor is an ERC-7579 executor module that enables automatic balance management for Safe smart accounts.
It allows anyone to trigger pre-configured ERC-20 token transfers from a main Safe account to designated agent accounts
when their balances fall below specified thresholds.

## Core Design Principles

### 1. Non-Custodial Architecture

- Module operates as part of the Safe's execution context
- Never holds funds directly
- User maintains full control over configuration and can disable at any time
- Executions happen through Safe's module system

### 2. Permissionless Triggering

- Anyone can call the trigger function to execute configured top-ups
- Security enforced through on-chain configuration and limits
- Primary automation through our keeper infrastructure (with option for users to self-host)

### 3. Multi-Agent Support

- Single module instance manages multiple agent configurations
- Each agent has independent thresholds, amounts, and limits
- Efficient batch operations for checking and executing multiple top-ups

## Technical Architecture

### Module Type

- **Type**: Executor Module (0x01)
- **Standard**: ERC-7579 compliant
- **Base**: Rhinestone ModuleKit's `ERC7579ExecutorBase`
- **Upgradeable**: Yes, using UUPS pattern with OpenZeppelin

### Storage Pattern

- **ERC-7201**: Namespaced storage for upgrade safety
- **Storage Layout**:

  ```solidity
  // User-configurable parameters
  struct TopUpConfig {
      uint256 dailyLimit;     // Target balance to maintain (max top-up per day)
      uint256 monthlyLimit;   // Maximum total top-ups per month
      bool enabled;           // Configuration active status
  }

  // Immutable identity and internal state (not user-editable)
  struct TopUpState {
      address agent;           // Target agent account (immutable, part of config ID)
      address asset;          // ERC-20 token address (immutable, part of config ID)
      uint256 lastTopUpTime;  // Last top-up timestamp (enforces once-per-day)
      uint256 monthlySpent;   // Amount topped up this month
      uint256 lastResetMonth; // Last monthly reset timestamp
  }

  struct AutoTopUpStorage {
      // Config ID => user configuration
      mapping(bytes32 => TopUpConfig) configs;

      // Config ID => internal state
      mapping(bytes32 => TopUpState) states;

      // Account => set of config IDs
      mapping(address => EnumerableSet.Bytes32Set) accountConfigs;
  }
  ```

- **Config ID Generation**: `keccak256(abi.encode("TopUpConfig", account, agent, asset))` returns bytes32 for unique
  configs
- **Namespaced IDs**: "TopUpConfig" prefix prevents collision with other system hashes
- **Per-Account Execution**: Each account's configs are triggered separately to avoid gas limits
- **Gas Optimization**: EnumerableSet allows O(1) add/remove and efficient iteration within an account

### Key Functions

#### Module Interface (ERC-7579 via ModuleKit)

```solidity
// Inherited from ERC7579ExecutorBase
function onInstall(bytes calldata data) external
function onUninstall(bytes calldata data) external
function isModuleType(uint256 typeID) external view returns (bool)
function isInitialized(address smartAccount) external view returns (bool)

// Internal execution helpers from base (used within our functions)
// _execute(address account, address to, uint256 value, bytes memory data) - single tx
// _execute(address account, Execution[] memory execs) - batch tx
// (Plus msg.sender variants and delegatecall versions we won't use)
```

#### Configuration Management

```solidity
function configureTopUp(
    address agent,
    address asset,
    TopUpConfig calldata config
) external returns (bytes32 configId)

function configureTopUpById(
    bytes32 configId,
    TopUpConfig calldata config
) external

function disableTopUp(bytes32 configId) external
function enableTopUp(bytes32 configId) external
```

#### Execution

```solidity
function triggerTopUps(address account) external returns (bytes32[] memory executed)
function triggerTopUp(bytes32 configId) external returns (bool executed)
```

#### View Functions

```solidity
function generateConfigId(address account, address agent, address asset) external pure returns (bytes32)
function getTopUpConfigs(address account) external view returns (TopUpConfig[] memory, TopUpState[] memory)
function canExecuteTopUp(bytes32 configId) external view returns (bool, string memory reason)
function getTopUpById(bytes32 configId) external view returns (TopUpConfig memory config, TopUpState memory state)
function getTopUp(address account, address agent, address asset) external view returns (TopUpConfig memory config, TopUpState memory state)
```

## Execution Flow

### 1. Installation

1. Safe owner calls module management to install AutoTopUpExecutor
2. Module's `onInstall` is called with initial configurations (optional)
3. Module registers the Safe account as initialized

### 2. Configuration

1. Safe owner sends transaction to module to configure top-ups
2. Config ID generated: `keccak256(abi.encode("TopUpConfig", account, agent, asset))`
3. `configureTopUp()` creates new or updates existing config for agent/asset pair
4. `configureTopUpById()` updates existing config by its ID
5. Agent and asset are immutable once set (part of the config ID)
6. Only dailyLimit, monthlyLimit, and enabled status can be updated
7. Multiple configurations can exist for different agents and different tokens
8. Frontend/keeper can precompute config IDs using `generateConfigId()`

### 3. Triggering

1. Keeper calls `triggerTopUps(account)` for each account (separate transactions)
2. Module iterates through all enabled configurations for that specific account
3. For each configuration:
   - Check if already topped up today (via `lastTopUpTime`)
   - Calculate top-up amount: `min(dailyLimit - agentBalance, monthlyLimit - monthlySpent)`
   - Skip if amount ≤ 0 (agent already funded or monthly limit reached)
   - Execute transfer via internal `_execute()` helper (triggers Safe's module execution)
   - Update `lastTopUpTime` and `monthlySpent`

### 4. Limit Management

- **Daily**: Enforced by once-per-day check using `lastTopUpTime`
- **Monthly**: Reset on the 1st of each month (tracked via `lastResetMonth`)
- **Top-up calculation**: Always maintains balance up to `dailyLimit`, respecting `monthlyLimit`
- **No partial days**: If a top-up happens, it's for the full daily amount (up to monthly remaining)

## Security Considerations

### Access Control

- Only Safe account can configure its own top-ups
- Configuration updates require Safe transaction
- No admin keys or external control

### Limit Enforcement

- Once-per-day enforcement prevents abuse
- Monthly budget caps provide spending control
- Simple calculation: top up to daily limit, not exceeding monthly budget

### Reentrancy Protection

- OpenZeppelin's ReentrancyGuard on all state-changing functions
- Checks-effects-interactions pattern
- State updates before external calls

### Validation

- Balance checks before transfers
- Sufficient Safe balance validation
- Asset address validation (ensure valid ERC-20 contract)
- Agent address validation (prevent self-transfers)

## Gas Optimization

### Batch Operations

- Per-account batch execution (all configs for one account in one tx)
- Bounded gas usage per transaction
- Keeper maintains off-chain list of accounts to service

### Storage Efficiency

- EnumerableSet for per-account config tracking
- O(1) config lookups via mapping
- Config IDs prevent duplicate account/agent/asset combinations
- No global account list needed (keeper tracks off-chain)

## Integration Points

### ERC-7579 Module System

- Registered as executor module (type 0x01)
- Uses ModuleKit's `_execute()` helpers for execution
- Works across all ERC-7579 compliant accounts (Safe, Kernel, Biconomy)

### Token Contracts

- ERC20 interface for balance checks
- OpenZeppelin's SafeERC20 for safe token transfers
- Transfers executed via Safe module system (using \_execute)
- No direct token approvals needed

### Monitoring & Events

```solidity
event TopUpConfigured(address indexed account, address indexed agent, address asset, bytes32 indexed configId, TopUpConfig config)
event TopUpExecuted(address indexed account, address indexed agent, address asset, bytes32 indexed configId, uint256 amount)
event TopUpFailed(address indexed account, address indexed agent, address asset, bytes32 indexed configId, string reason)
event TopUpEnabled(address indexed account, address indexed agent, address asset, bytes32 indexed configId)
event TopUpDisabled(address indexed account, address indexed agent, address asset, bytes32 indexed configId)
```

- **TopUpConfigured**: Emitted on both initial configuration and updates
- **TopUpEnabled/Disabled**: Emitted whenever enabled status changes (via any function)

## Future Enhancements

### Post-MVP Improvements

1. **Native Token Support**: ETH/MATIC/etc. alongside ERC-20s
2. **Off-chain Signatures**: Gasless configuration updates via EIP-712 signed messages

## Testing Strategy

### Unit Tests

- Configuration CRUD operations
- Daily limit enforcement (once per day)
- Monthly limit tracking and resets
- Balance calculation logic (top up to daily limit)

### Integration Tests

- Safe module installation/uninstallation using ModuleKit test utilities
- Token transfer execution through Safe
- Multi-account scenarios using ModuleKit's `makeAccountInstance`
- Cross-implementation tests (Safe, Kernel, Biconomy) - lower priority

### Security Tests

- Reentrancy attempts
- Limit bypass attempts (trying to trigger multiple times per day)
- Unauthorized configuration changes
- Edge cases around month transitions

## Implementation Stack

### Dependencies

- **ModuleKit** (v0.5.9+): Rhinestone's development kit for ERC-7579 modules
  - Provides `ERC7579ExecutorBase` for executor functionality
  - Built-in test utilities for multi-account testing (Safe, Kernel, Biconomy)
  - Helper functions for module deployment
  - Integration with Module Registry
  - Main import: `import "modulekit/Modules.sol"`
  - **Important**: Requires `npm install` in lib/modulekit directory for ERC4337 dependencies
- **OpenZeppelin Contracts Upgradeable**: For UUPS proxy pattern and utilities
- **OpenZeppelin Contracts**: For ERC20 interface and security utilities

### Inheritance Chain

```
AutoTopUpExecutor
    ├── ERC7579ExecutorBase (from ModuleKit)
    │   └── IERC7579Module
    ├── UUPSUpgradeable (from OpenZeppelin)
    ├── OwnableUpgradeable (from OpenZeppelin)
    └── ReentrancyGuardUpgradeable (from OpenZeppelin)
```

## Deployment Considerations

### Deployment Steps

1. Deploy implementation contract
2. Deploy proxy with initializer
3. Register in Rhinestone module registry
4. Integrate with Safe deployment flow
5. Utilize ModuleKit's deployment helpers

### Monitoring

- Subgraph for indexing all contract events
- Track and alert on failed top-ups (especially during initial rollout)
