# AutoCollectExecutor Architecture

## Overview

AutoCollectExecutor is an ERC-7579 executor module that automatically collects funds from service accounts to a main
seller account. It mirrors the AutoTopUpExecutor pattern but reverses the transfer direction - collecting funds FROM the
account where the module is installed TO a configured target account.

## Key Design Principles

1. **Installation Location**: Module is installed ON each service account (not on main account)
2. **Transfer Direction**: FROM service account (where module is installed) TO main account
3. **Permissionless Execution**: Anyone can trigger collections (gas incentives for automation)
4. **Calendar-Based Limits**: Collections limited to once per calendar day (UTC)
5. **Per-Asset Configuration**: Each token has its own collection configuration

## Architecture Components

### Storage Structure

```solidity
// Configuration per asset
struct CollectConfig {
    address target;           // Main account to collect funds to
    address asset;           // ERC-20 token address
    uint256 threshold;       // Minimum balance to trigger collection (0 = no threshold)
    uint256 minimumRemaining; // Minimum amount to leave in account (0 = collect all)
    bool enabled;            // Whether collection is enabled
}

// State tracking per configuration
struct CollectState {
    uint256 lastCollectDate; // Last collection date (YYYYMMDD format)
}

// Storage mappings
mapping(uint256 => CollectConfig) configs;  // configId => config
mapping(uint256 => CollectState) states;    // configId => state
mapping(address => EnumerableSet.Bytes32Set) accountConfigs; // service account => configIds (using EnumerableSet)

// Config ID generation (deterministic)
configId = keccak256(abi.encode("CollectConfig", serviceAccount, asset))
```

### Core Functions

#### Module Lifecycle

- `onInstall(bytes calldata data)` - Install with optional initial configurations
- `onUninstall(bytes calldata)` - Clean up all configurations and state
- `isModuleType(uint256 typeID)` - Returns MODULE_TYPE_EXECUTOR constant
- `isInitialized(address account)` - Check if module is initialized for account

#### Configuration Management

- `configureCollection(address asset, CollectConfig config)` - Create/update config for msg.sender
- `enableCollection(bytes32 configId)` - Enable collection for a config
- `disableCollection(bytes32 configId)` - Disable collection for a config

#### Collection Execution

- `triggerCollection(address account, address asset)` - Trigger collection for specific asset on account
- `triggerAllCollections(address account)` - Trigger all enabled collections for specific account
- `canExecuteCollection(address account, address asset)` - Check if collection can execute

#### View Functions

- `getCollectionConfig(address account, address asset)` - Get specific config
- `getCollectionConfigs(address account)` - Get all configs for an account
- `getCollectionState(address account, address asset)` - Get collection state

## Execution Flow

### Collection Trigger Flow

```
1. External caller → triggerCollection(account, asset)
2. Module validates:
   - Configuration exists and is enabled for account
   - Calendar day has changed since last collection
   - Balance meets threshold (if threshold > 0)
   - Balance >= minimumRemaining (can leave the required amount)
   - collectAmount = balance - minimumRemaining > 0
3. Module executes:
   - Get current balance of asset in account
   - Calculate collect amount: balance - minimumRemaining
   - Transfer collect amount to configured target
   - Leave minimumRemaining in account
   - If transfer fails, emit CollectionSkipped event and continue
   - Update lastCollectDate only on successful transfer
4. Emit CollectionExecuted or CollectionSkipped event
```

### Calendar Day Tracking

- Uses BokkyPooBah's DateTime Library (same as AutoTopUpExecutor)
- Dates encoded as YYYYMMDD (e.g., 20240829)
- All timestamps are UTC-based
- Prevents multiple collections per calendar day

## Security Considerations

1. **Access Control**
   - Only service account (msg.sender) can configure its own collections
   - Anyone can trigger collections (permissionless)
   - Module can only transfer FROM the account it's installed on

2. **Reentrancy Protection**
   - CEI (Checks-Effects-Interactions) pattern
   - State updates before external calls
   - ReentrancyGuard on execution functions

3. **Token Safety**
   - Execute transfers via Safe's \_execute() (like AutoTopUpExecutor)
   - Handle non-standard token returns by checking returndata length
   - Decode and validate return value if present
   - Zero-value transfer protection

## Events

```solidity
event CollectionConfigured(
    address indexed account,
    address indexed asset,
    address indexed target,
    uint256 threshold
);

event CollectionExecuted(
    address indexed account,
    address indexed asset,
    address indexed target,
    uint256 amount
);

event CollectionSkipped(
    address indexed account,
    address indexed asset,
    bytes32 indexed configId,
    uint256 balance,
    uint256 threshold,
    uint256 minimumRemaining,
    uint256 collectAmount
);

event CollectionEnabled(address indexed account, address indexed asset);
event CollectionDisabled(address indexed account, address indexed asset);
```

## Edge Cases & Validation

1. **Collection Validation**
   - If balance < threshold: Skip collection, emit CollectionSkipped event
   - If balance = 0: Skip collection, emit CollectionSkipped event
   - If balance < minimumRemaining: Skip collection, emit CollectionSkipped event
   - If balance - minimumRemaining = 0: Skip collection, emit CollectionSkipped event
   - Threshold = 0 means trigger collection on any balance
   - minimumRemaining = 0 means collect full balance (default behavior)

2. **Valid Configurations**
   - minimumRemaining > threshold: Valid (effective threshold is minimumRemaining)
   - minimumRemaining = threshold: Valid (collect when balance exactly at or above threshold)
   - minimumRemaining = 0, threshold = 0: Valid (collect any non-zero balance)
   - minimumRemaining > 0, threshold = 0: Valid (collect when balance > minimumRemaining)

3. **Invalid Configuration**
   - Target cannot be zero address
   - Asset must be valid ERC-20 contract
   - Threshold and minimumRemaining can both be 0

4. **Date Boundaries**
   - Month transitions handled correctly
   - Year transitions handled correctly
   - Leap years considered

5. **Token Edge Cases**
   - Non-standard return values (USDT)
   - Tokens with transfer fees
   - Balance changes between check and transfer (handled gracefully by skipping collection)

## Gas Optimization

1. **Storage Patterns**
   - Separate config and state structs for efficient updates
   - Pack struct fields for optimal storage slots
   - Use mappings instead of arrays where possible

2. **Execution Optimization**
   - Calculate date once per execution
   - Batch operations where possible
   - Skip zero-balance collections early

## Differences from AutoTopUpExecutor

| Aspect             | AutoTopUpExecutor     | AutoCollectExecutor         |
| ------------------ | --------------------- | --------------------------- |
| Installation       | On main account       | On service accounts         |
| Transfer Direction | Main → Agent accounts | Service account → Main      |
| Config Storage     | Per (agent, asset)    | Per (asset) on each account |
| Limits             | Daily/Monthly amounts | Once per calendar day       |
| Threshold          | Top-up when below     | Collect when above          |
| Target             | Multiple agents       | Single main account         |

## Integration with Safe Accounts

Service accounts will have AutoCollectExecutor installed as an ERC-7579 module:

```solidity
Safe Service Account
├── Owner: User's Privy Wallet
├── Modules:
│   └── AutoCollectExecutor
│       ├── Collection configs per asset
│       ├── Target: Main account (also owned by Privy wallet)
│       └── Thresholds and state
└── Holdings: USDC, other tokens (to be collected)
```

## Testing Strategy

1. **Unit Tests**
   - All configuration functions
   - Collection execution logic
   - Calendar day calculations
   - Edge cases and error conditions

2. **Integration Tests (ModuleKit)**
   - Module installation/uninstallation
   - Cross-account interactions
   - Real Safe account testing
   - Gas usage validation

3. **Fuzz Testing**
   - Date arithmetic edge cases
   - Random threshold values
   - Multiple asset scenarios

## Implementation Notes

### Upgradeability

- Use UUPS proxy pattern (same as AutoTopUpExecutor)
- OwnableUpgradeable for upgrade admin control
- ERC-7201 namespaced storage for upgrade safety

### Dependencies

- BokkyPooBah's DateTime Library (already in lib/)
- OpenZeppelin contracts upgradeable (including EnumerableSet)
- ModuleKit for ERC-7579 compliance
- ERC7579ExecutorBase for \_execute() functionality

## Implementation Checklist

- [ ] Core contract implementation (UUPS upgradeable)
- [ ] Interface extraction (IAutoCollectExecutor)
- [ ] Token transfer via \_execute() with returndata validation
- [ ] Calendar-based date tracking with DateTime library
- [ ] Event and error definitions
- [ ] Unit tests following AutoTopUpExecutor.t.sol patterns
- [ ] Integration tests with ModuleKit
- [ ] Gas optimization and forge fmt
- [ ] Security review
