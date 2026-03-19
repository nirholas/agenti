# Account Modules

ERC-7579 compliant executor modules for smart account automation in the x402 payments system.

## Modules

### AutoTopUpModule

- Automatically tops up agent accounts when balance falls below threshold
- Configurable per-agent limits (daily, monthly)
- Permissionless triggering with proper checks
- Used by: Main accounts to fund agent accounts

### AutoCollectModule

- Automatically collects payments from service accounts
- Configurable collection thresholds (amount and time)
- Batch collection optimization
- Used by: Service accounts to collect to main accounts

## Architecture

All modules implement the ERC-7579 executor module interface:

- `onInstall(bytes calldata data)` - Module installation
- `onUninstall(bytes calldata data)` - Module removal
- `isModuleType(uint256 typeID)` - Returns true for executor type (0x01)
- `isInitialized(address account)` - Check if module is initialized for account

## Deployment

The modules are deployed as immutable singletons using Safe's Singleton Factory, ensuring the same addresses across all
chains:

- **AutoTopUpExecutor**: `0x16f13052FbFFfcE34E5752b7F4CFF881a030F40B`
- **AutoCollectExecutor**: `0x29864bd91370886c38dE9Fe95F5589E7EbE15130`

These addresses are deterministic and will remain consistent on all supported chains (Base, Base Sepolia, etc.).

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [pnpm](https://pnpm.io/installation) (for ModuleKit dependencies)

### Setup

```bash
# Install Forge dependencies
forge install

# Install ModuleKit node dependencies (required for compilation)
cd lib/modulekit && npm install && cd ../..

# Build contracts
forge build

# Run tests
forge test

# Deploy
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

**Important**: ModuleKit requires its node modules to be installed for proper compilation. This step (`pnpm install` in
the modulekit directory) must be performed after cloning the repository and before building.

## Security

- Non-custodial design - modules only execute based on user-defined rules
- Access control via ERC-7579 standards
- Immutable singleton contracts - no upgradeability, no owner
- Comprehensive event logging
