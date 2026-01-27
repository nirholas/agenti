# Smart Contract Integration Guide

Interact with X402 smart contracts for tool registration, payment channels, and subscriptions.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Interacting with ToolRegistry](#interacting-with-toolregistry)
3. [Opening Payment Channels](#opening-payment-channels)
4. [Managing Subscriptions On-Chain](#managing-subscriptions-on-chain)
5. [Handling USDs Rebasing](#handling-usds-rebasing)
6. [Gas Optimization Tips](#gas-optimization-tips)
7. [Upgradeability Patterns](#upgradeability-patterns)
8. [Troubleshooting](#troubleshooting)
9. [Related Guides](#related-guides)

---

## Prerequisites

Before you begin, ensure you have:

- **Solidity knowledge** (0.8.x)
- **Foundry** installed for testing and deployment
- An Arbitrum wallet with ETH for gas
- USDs tokens for payments

### Contract Addresses (Arbitrum Mainnet)

| Contract | Address |
|----------|---------|
| ToolRegistry | `0x...` (deploy from repo) |
| X402PaymentChannel | `0x...` (deploy from repo) |
| X402Subscription | `0x...` (deploy from repo) |
| USDs Token | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` |

### Development Setup

```bash
# Clone the repository
git clone https://github.com/nirholas/x402.git
cd x402/contracts

# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test
```

---

## Interacting with ToolRegistry

The ToolRegistry is the core marketplace for registering AI tools and processing payments.

### Registering a Tool

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IToolRegistry {
    function registerTool(
        string calldata name,
        address developer,
        uint256 price,
        address token
    ) external;
    
    function payForTool(string calldata name) external;
    
    function getToolInfo(string calldata name) external view returns (
        address developer,
        address paymentToken,
        uint256 pricePerCall,
        uint256 totalCalls,
        uint256 totalRevenue,
        bool active,
        uint256 createdAt
    );
}

contract MyToolIntegration {
    IToolRegistry public registry;
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;
    
    constructor(address _registry) {
        registry = IToolRegistry(_registry);
    }
    
    // Register your tool
    function registerMyTool(string calldata toolName, uint256 pricePerCall) external {
        registry.registerTool(
            toolName,      // e.g., "my-weather-api"
            msg.sender,    // Developer receives payments
            pricePerCall,  // Price in USDs (18 decimals)
            USDS           // Payment token
        );
    }
    
    // User pays for tool
    function useMyTool(string calldata toolName) external {
        // First approve the registry to spend USDs
        (, address token, uint256 price, , , , ) = registry.getToolInfo(toolName);
        IERC20(token).approve(address(registry), price);
        
        // Pay for the tool
        registry.payForTool(toolName);
    }
}
```

### Using viem to Register Tools

```typescript
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const TOOL_REGISTRY_ADDRESS = '0x...' as const;
const USDS_ADDRESS = '0xD74f5255D557944cf7Dd0E45FF521520002D5748' as const;

// Tool Registry ABI (partial)
const toolRegistryABI = [
  {
    name: 'registerTool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'developer', type: 'address' },
      { name: 'price', type: 'uint256' },
      { name: 'token', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'payForTool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [],
  },
  {
    name: 'getToolInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [
      { name: 'developer', type: 'address' },
      { name: 'paymentToken', type: 'address' },
      { name: 'pricePerCall', type: 'uint256' },
      { name: 'totalCalls', type: 'uint256' },
      { name: 'totalRevenue', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'createdAt', type: 'uint256' },
    ],
  },
] as const;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

// Register a new tool
async function registerTool(name: string, priceUsd: string) {
  const priceWei = parseUnits(priceUsd, 18);
  
  const hash = await walletClient.writeContract({
    address: TOOL_REGISTRY_ADDRESS,
    abi: toolRegistryABI,
    functionName: 'registerTool',
    args: [name, account.address, priceWei, USDS_ADDRESS],
  });
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Tool registered: ${receipt.transactionHash}`);
  return receipt;
}

// Pay for tool usage
async function payForTool(name: string) {
  // Get tool price first
  const [, , pricePerCall] = await publicClient.readContract({
    address: TOOL_REGISTRY_ADDRESS,
    abi: toolRegistryABI,
    functionName: 'getToolInfo',
    args: [name],
  });
  
  // Approve USDs spending
  await walletClient.writeContract({
    address: USDS_ADDRESS,
    abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }],
    functionName: 'approve',
    args: [TOOL_REGISTRY_ADDRESS, pricePerCall],
  });
  
  // Pay for tool
  const hash = await walletClient.writeContract({
    address: TOOL_REGISTRY_ADDRESS,
    abi: toolRegistryABI,
    functionName: 'payForTool',
    args: [name],
  });
  
  return publicClient.waitForTransactionReceipt({ hash });
}
```

---

## Opening Payment Channels

Payment channels enable streaming micro-payments between AI agents and tools.

### Creating a Channel

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IX402PaymentChannel {
    function openChannel(
        address recipient,
        address token,
        uint256 deposit
    ) external returns (bytes32 channelId);
    
    function signedPayment(
        bytes32 channelId,
        uint256 amount,
        bytes calldata signature
    ) external;
    
    function closeChannel(bytes32 channelId) external;
    
    function getChannel(bytes32 channelId) external view returns (
        address sender,
        address recipient,
        address token,
        uint256 deposit,
        uint256 withdrawn,
        uint256 nonce,
        uint8 state
    );
}

contract ChannelManager {
    IX402PaymentChannel public channelContract;
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;
    
    mapping(address => bytes32[]) public userChannels;
    
    constructor(address _channelContract) {
        channelContract = IX402PaymentChannel(_channelContract);
    }
    
    // Open a channel with a tool provider
    function openChannel(
        address toolProvider,
        uint256 initialDeposit
    ) external returns (bytes32) {
        // Approve tokens
        IERC20(USDS).transferFrom(msg.sender, address(this), initialDeposit);
        IERC20(USDS).approve(address(channelContract), initialDeposit);
        
        // Open channel
        bytes32 channelId = channelContract.openChannel(
            toolProvider,
            USDS,
            initialDeposit
        );
        
        userChannels[msg.sender].push(channelId);
        return channelId;
    }
}
```

### Off-Chain Payment Signing

```typescript
import { createWalletClient, http, keccak256, encodePacked, parseUnits } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount, signTypedData } from 'viem/accounts';

const CHANNEL_CONTRACT = '0x...' as const;

// EIP-712 types for payment increments
const paymentTypes = {
  PaymentIncrement: [
    { name: 'channelId', type: 'bytes32' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

const domain = {
  name: 'X402PaymentChannel',
  version: '1',
  chainId: 42161, // Arbitrum
  verifyingContract: CHANNEL_CONTRACT,
};

// Sign a payment increment off-chain
async function signPaymentIncrement(
  channelId: `0x${string}`,
  amount: bigint,
  nonce: bigint
) {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  
  const signature = await account.signTypedData({
    domain,
    types: paymentTypes,
    primaryType: 'PaymentIncrement',
    message: {
      channelId,
      amount,
      nonce,
    },
  });
  
  return signature;
}

// Example: Create payment vouchers
async function createPaymentVoucher(channelId: `0x${string}`, amountUsd: string, nonce: number) {
  const amount = parseUnits(amountUsd, 18);
  const signature = await signPaymentIncrement(channelId, amount, BigInt(nonce));
  
  return {
    channelId,
    amount: amount.toString(),
    nonce,
    signature,
    // Include timestamp for tracking
    timestamp: Date.now(),
  };
}

// Tool provider can submit the voucher on-chain
async function redeemPaymentVoucher(voucher: any) {
  const walletClient = createWalletClient({
    account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
    chain: arbitrum,
    transport: http(),
  });
  
  const hash = await walletClient.writeContract({
    address: CHANNEL_CONTRACT,
    abi: channelABI,
    functionName: 'signedPayment',
    args: [voucher.channelId, BigInt(voucher.amount), voucher.signature],
  });
  
  return hash;
}
```

---

## Managing Subscriptions On-Chain

### Creating a Subscription

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IX402Subscription {
    function createSubscription(
        address recipient,
        uint256 amount,
        uint256 interval
    ) external returns (uint256 subscriptionId);
    
    function depositFunds(uint256 amount) external;
    
    function executeSubscription(uint256 subscriptionId) external;
    
    function cancelSubscription(uint256 subscriptionId) external;
    
    function getSubscription(uint256 subscriptionId) external view returns (
        address subscriber,
        address recipient,
        uint256 amount,
        uint256 interval,
        uint256 lastExecution,
        bool active
    );
}

contract SubscriptionManager {
    IX402Subscription public subscriptionContract;
    
    // Create a monthly subscription
    function subscribeMonthly(
        address toolProvider,
        uint256 monthlyAmount
    ) external returns (uint256) {
        // Deposit funds first (3 months worth)
        uint256 depositAmount = monthlyAmount * 3;
        subscriptionContract.depositFunds(depositAmount);
        
        // Create subscription (30 day interval)
        return subscriptionContract.createSubscription(
            toolProvider,
            monthlyAmount,
            30 days
        );
    }
}
```

### TypeScript Subscription Management

```typescript
const SUBSCRIPTION_CONTRACT = '0x...' as const;

const subscriptionABI = [
  {
    name: 'createSubscription',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interval', type: 'uint256' },
    ],
    outputs: [{ name: 'subscriptionId', type: 'uint256' }],
  },
  {
    name: 'depositFunds',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'executeSubscription',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subscriber', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

// Create a new subscription
async function createSubscription(
  recipient: `0x${string}`,
  monthlyAmount: string,
  months: number = 1
) {
  const amount = parseUnits(monthlyAmount, 18);
  const interval = 30n * 24n * 60n * 60n; // 30 days in seconds
  
  // First, deposit funds
  const depositAmount = amount * BigInt(months);
  
  // Approve USDs
  await walletClient.writeContract({
    address: USDS_ADDRESS,
    abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
    functionName: 'approve',
    args: [SUBSCRIPTION_CONTRACT, depositAmount],
  });
  
  // Deposit
  await walletClient.writeContract({
    address: SUBSCRIPTION_CONTRACT,
    abi: subscriptionABI,
    functionName: 'depositFunds',
    args: [depositAmount],
  });
  
  // Create subscription
  const hash = await walletClient.writeContract({
    address: SUBSCRIPTION_CONTRACT,
    abi: subscriptionABI,
    functionName: 'createSubscription',
    args: [recipient, amount, interval],
  });
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  // Parse subscription ID from logs
  // ...
  
  return receipt;
}

// Keeper function: Execute due subscriptions
async function executeSubscriptions(subscriptionIds: bigint[]) {
  for (const id of subscriptionIds) {
    try {
      const hash = await walletClient.writeContract({
        address: SUBSCRIPTION_CONTRACT,
        abi: subscriptionABI,
        functionName: 'executeSubscription',
        args: [id],
      });
      console.log(`Executed subscription ${id}: ${hash}`);
    } catch (error) {
      console.error(`Failed to execute subscription ${id}:`, error);
    }
  }
}
```

---

## Handling USDs Rebasing

USDs is a rebasing token - balances increase automatically as yield accrues. This requires special handling.

### Understanding Rebasing

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUSDs {
    // Get current balance (rebases automatically)
    function balanceOf(address account) external view returns (uint256);
    
    // Get credit balance (doesn't rebase, for internal tracking)
    function creditBalanceOf(address account) external view returns (
        uint256 creditBalance,
        uint256 creditsPerToken
    );
    
    // Current credits per token (increases with rebases)
    function creditsPerToken() external view returns (uint256);
    
    // Opt-in to receive rebases (contracts must call this)
    function rebaseOptIn() external;
    
    // Opt-out of rebases (balance stays static)
    function rebaseOptOut() external;
}

contract RebasingAwareContract {
    IUSDs public usds;
    
    // Track deposits using credits (stable value)
    mapping(address => uint256) public depositCredits;
    
    constructor(address _usds) {
        usds = IUSDs(_usds);
        // Opt-in to receive rebases
        usds.rebaseOptIn();
    }
    
    function deposit(uint256 amount) external {
        // Convert amount to credits
        uint256 creditsPerToken = usds.creditsPerToken();
        uint256 credits = amount * creditsPerToken;
        
        // Track in credits
        depositCredits[msg.sender] += credits;
        
        // Transfer tokens
        // ...
    }
    
    function getBalance(address user) external view returns (uint256) {
        // Convert credits back to tokens (includes yield)
        uint256 creditsPerToken = usds.creditsPerToken();
        return depositCredits[user] / creditsPerToken;
    }
    
    function getYieldEarned(address user, uint256 originalDeposit) external view returns (uint256) {
        uint256 currentBalance = this.getBalance(user);
        if (currentBalance > originalDeposit) {
            return currentBalance - originalDeposit;
        }
        return 0;
    }
}
```

### TypeScript Yield Tracking

```typescript
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
  {
    name: 'creditsPerToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Track yield from a starting point
async function trackYield(address: `0x${string}`, startingBalance: bigint) {
  const currentBalance = await publicClient.readContract({
    address: USDS_ADDRESS,
    abi: USDS_ABI,
    functionName: 'balanceOf',
    args: [address],
  });
  
  const yieldEarned = currentBalance - startingBalance;
  const yieldPercent = Number(yieldEarned * 10000n / startingBalance) / 100;
  
  return {
    startingBalance: formatUnits(startingBalance, 18),
    currentBalance: formatUnits(currentBalance, 18),
    yieldEarned: formatUnits(yieldEarned, 18),
    yieldPercent: `${yieldPercent}%`,
  };
}

// Get yield rate (APY estimate)
async function getYieldRate() {
  // Get credits per token at two points
  const creditsNow = await publicClient.readContract({
    address: USDS_ADDRESS,
    abi: USDS_ABI,
    functionName: 'creditsPerToken',
  });
  
  // Wait 1 hour (or use historical data)
  // const creditsLater = await ...
  
  // Calculate APY from rate change
  // APY = (creditsNow / creditsBefore - 1) * periods_per_year
}
```

---

## Gas Optimization Tips

### 1. Batch Operations

```solidity
// Instead of multiple individual calls
function batchPayForTools(string[] calldata toolNames) external {
    uint256 length = toolNames.length;
    for (uint256 i = 0; i < length;) {
        _payForTool(toolNames[i]);
        unchecked { ++i; }
    }
}

// Use unchecked for loop counters (saves gas)
// Cache array length to avoid repeated SLOAD
```

### 2. Storage Optimization

```solidity
// Pack related variables into single storage slot
struct ToolInfo {
    address developer;    // 20 bytes
    uint96 pricePerCall;  // 12 bytes (fits in same slot)
    // --- slot boundary ---
    uint128 totalCalls;   // 16 bytes
    uint128 totalRevenue; // 16 bytes (same slot)
    // --- slot boundary ---
    bool active;          // 1 byte
    uint40 createdAt;     // 5 bytes (same slot)
    // 26 bytes remaining in slot
}
```

### 3. Minimize External Calls

```typescript
// BAD: Multiple calls
const balance = await usds.balanceOf(address);
const credits = await usds.creditBalanceOf(address);
const rate = await usds.creditsPerToken();

// GOOD: Use multicall
const results = await publicClient.multicall({
  contracts: [
    { address: USDS_ADDRESS, abi: USDS_ABI, functionName: 'balanceOf', args: [address] },
    { address: USDS_ADDRESS, abi: USDS_ABI, functionName: 'creditBalanceOf', args: [address] },
    { address: USDS_ADDRESS, abi: USDS_ABI, functionName: 'creditsPerToken' },
  ],
});
```

### 4. Arbitrum-Specific Tips

```solidity
// Arbitrum has different gas costs than Ethereum mainnet
// - Storage operations are cheaper
// - Calldata is relatively more expensive

// Prefer storing data over passing large calldata
// Use events for off-chain data that doesn't need on-chain access
emit ToolUsed(toolId, msg.sender, block.timestamp);
```

---

## Upgradeability Patterns

X402 contracts use the UUPS (Universal Upgradeable Proxy Standard) pattern.

### Upgrading Contracts

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract ToolRegistryV2 is ToolRegistry {
    // New storage must be added at the end
    mapping(bytes32 => string) public toolDescriptions;
    
    // New functionality
    function setToolDescription(
        string calldata name,
        string calldata description
    ) external onlyDeveloper(name) {
        bytes32 toolId = _getToolId(name);
        toolDescriptions[toolId] = description;
    }
    
    // Required for UUPS
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

### Deploying Upgrades

```typescript
import { deployContract, upgradeProxy } from './deploy-utils';

// Initial deployment
const proxy = await deployContract('ERC1967Proxy', [
  implementationAddress,
  initializeCalldata,
]);

// Upgrade to V2
const newImplementation = await deployContract('ToolRegistryV2', []);

const proxyContract = await getContractAt('UUPSUpgradeable', proxy.address);
await proxyContract.upgradeToAndCall(
  newImplementation.address,
  '0x' // Optional migration calldata
);
```

### Storage Layout Safety

```solidity
// IMPORTANT: Never change the order of existing storage variables
// Always add new variables at the end
// Use storage gaps for future additions

contract ToolRegistry {
    address public platformWallet;        // slot 0
    uint256 public platformFeeBps;        // slot 1
    mapping(bytes32 => ToolInfo) private _tools; // slot 2
    
    // Reserve slots for future use
    uint256[50] private __gap;
}

contract ToolRegistryV2 is ToolRegistry {
    // New storage uses gap slots
    mapping(bytes32 => string) public toolDescriptions; // uses one gap slot
    
    // Update gap size
    uint256[49] private __gap; // 50 - 1 = 49
}
```

---

## Troubleshooting

### "Unauthorized" error when registering tool

**Cause:** You're not the owner or don't have permission.

**Solution:** Check contract ownership and permissions:
```typescript
const owner = await publicClient.readContract({
  address: TOOL_REGISTRY_ADDRESS,
  abi: [{ name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
  functionName: 'owner',
});
console.log('Contract owner:', owner);
```

### Transaction reverts with no clear error

**Cause:** Insufficient allowance or balance.

**Solution:**
```typescript
// Check allowance
const allowance = await publicClient.readContract({
  address: USDS_ADDRESS,
  abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] }],
  functionName: 'allowance',
  args: [account.address, TOOL_REGISTRY_ADDRESS],
});

// Check balance
const balance = await publicClient.readContract({
  address: USDS_ADDRESS,
  abi: USDS_ABI,
  functionName: 'balanceOf',
  args: [account.address],
});

console.log('Allowance:', formatUnits(allowance, 18));
console.log('Balance:', formatUnits(balance, 18));
```

### USDs balance shows less than expected

**Cause:** You may have opted out of rebasing.

**Solution:**
```solidity
// Check if opted out
function isRebasingOptedIn(address account) external view returns (bool) {
    // Implementation varies - check USDs contract
}

// Opt back in
usds.rebaseOptIn();
```

### Gas estimation fails

**Cause:** Transaction would revert on-chain.

**Solution:** Simulate the transaction first:
```typescript
try {
  await publicClient.simulateContract({
    address: TOOL_REGISTRY_ADDRESS,
    abi: toolRegistryABI,
    functionName: 'payForTool',
    args: ['my-tool'],
    account: account.address,
  });
} catch (error) {
  console.error('Simulation failed:', error);
  // Inspect error.cause for revert reason
}
```

---

## Related Guides

- [Quick Start](./QUICK_START.md) - Basic X402 setup
- [Express Middleware](./EXPRESS_MIDDLEWARE.md) - HTTP-based payment gates
- [Yield Tracking](./YIELD_TRACKING.md) - Monitor USDs yield
- [AI Agent Integration](./AI_AGENT_INTEGRATION.md) - Build AI agents

---

## Resources

- [X402 Contract Source Code](https://github.com/nirholas/x402/tree/main/contracts)
- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades)
- [Foundry Documentation](https://book.getfoundry.sh/)
- [Arbitrum Developer Docs](https://docs.arbitrum.io/for-devs)
- [Sperax USDs Documentation](https://docs.sperax.io/)
