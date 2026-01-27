# X402 Testing Guide

This document provides comprehensive testing guidance for the X402 protocol, covering TypeScript packages, smart contracts, and integration testing.

## Table of Contents

- [Testing Strategy Overview](#testing-strategy-overview)
- [TypeScript Package Testing](#typescript-package-testing)
- [Smart Contract Testing](#smart-contract-testing)
- [Integration Testing](#integration-testing)
- [Manual Testing Checklist](#manual-testing-checklist)

---

## Testing Strategy Overview

### Test Pyramid

X402 follows the test pyramid approach, prioritizing tests by speed and cost:

```
           /‾‾‾‾‾‾‾‾‾‾‾‾\
          /   E2E Tests   \      ← Few, slow, expensive
         /________________\
        /                    \
       /  Integration Tests   \  ← Moderate coverage
      /________________________\
     /                          \
    /       Unit Tests          \  ← Many, fast, cheap
   /____________________________\
```

| Type | Coverage Target | Runtime | Purpose |
|------|-----------------|---------|---------|
| Unit | 80%+ | < 1 min | Test individual functions |
| Integration | 60%+ | < 5 min | Test component interactions |
| E2E | Critical paths | < 15 min | Test full user flows |

### Coverage Targets

| Package | Line Coverage | Branch Coverage |
|---------|---------------|-----------------|
| `@x402/sdk` | 85% | 80% |
| `facilitator` | 80% | 75% |
| `contracts` | 90% | 85% |
| `cli` | 75% | 70% |

### CI/CD Pipeline

```yaml
# Tests run on every PR and push to main
stages:
  1. Lint & Type Check (parallel)
  2. Unit Tests (parallel per package)
  3. Contract Tests (Forge)
  4. Integration Tests
  5. E2E Tests (staging only)
  6. Coverage Report
```

---

## TypeScript Package Testing

### Running Tests

```bash
# Run all tests across the monorepo
pnpm test

# Run tests for a specific package
pnpm --filter @x402/sdk test
pnpm --filter facilitator test
pnpm --filter @x402/cli test

# Run tests in watch mode
pnpm --filter @x402/sdk test:watch

# Run tests with coverage
pnpm --filter @x402/sdk test:coverage

# Run a specific test file
pnpm --filter @x402/sdk test src/payments/__tests__/client.test.ts
```

### Writing Tests with Vitest

X402 uses [Vitest](https://vitest.dev/) for TypeScript testing. Tests follow the **Arrange-Act-Assert (AAA)** pattern:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { X402Client } from '../client';

describe('X402Client', () => {
  // Shared setup
  let client: X402Client;

  beforeEach(() => {
    // ARRANGE: Set up test fixtures
    client = new X402Client({
      network: 'arbitrum',
      facilitatorUrl: 'http://localhost:3000',
    });
  });

  describe('payForResource', () => {
    it('should successfully pay for a valid resource', async () => {
      // ARRANGE: Prepare test data
      const resource = 'https://api.example.com/weather';
      const paymentHeader = 'X402 payment-data...';

      // ACT: Execute the action being tested
      const result = await client.payForResource(resource, paymentHeader);

      // ASSERT: Verify the expected outcome
      expect(result.success).toBe(true);
      expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should throw on invalid payment header', async () => {
      // ARRANGE
      const resource = 'https://api.example.com/weather';
      const invalidHeader = 'invalid';

      // ACT & ASSERT: Expect specific error
      await expect(
        client.payForResource(resource, invalidHeader)
      ).rejects.toThrow('Invalid payment header format');
    });
  });
});
```

### Mocking External Services

#### Mocking HTTP Requests

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('FacilitatorService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should verify payment through facilitator', async () => {
    // ARRANGE: Mock the HTTP response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verified: true,
        transactionHash: '0x123...',
      }),
    });

    // ACT
    const result = await facilitator.verifyPayment(paymentData);

    // ASSERT
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/verify'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(result.verified).toBe(true);
  });
});
```

#### Mocking Ethereum Provider

```typescript
import { vi, describe, it, expect } from 'vitest';
import { createPublicClient, createWalletClient } from 'viem';
import { arbitrum } from 'viem/chains';

// Mock viem clients
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(),
    createWalletClient: vi.fn(),
  };
});

describe('PaymentService', () => {
  it('should submit transaction to Arbitrum', async () => {
    // ARRANGE
    const mockSendTransaction = vi.fn().mockResolvedValue('0xtxhash...');
    const mockWaitForTransactionReceipt = vi.fn().mockResolvedValue({
      status: 'success',
    });

    (createWalletClient as any).mockReturnValue({
      sendTransaction: mockSendTransaction,
    });
    (createPublicClient as any).mockReturnValue({
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    });

    // ACT
    const result = await paymentService.pay(toolName, amount);

    // ASSERT
    expect(mockSendTransaction).toHaveBeenCalled();
    expect(result.status).toBe('success');
  });
});
```

### Snapshot Testing

Use snapshot tests for complex response structures:

```typescript
import { describe, it, expect } from 'vitest';

describe('PaymentHeader', () => {
  it('should serialize payment header correctly', () => {
    // ARRANGE
    const payment = {
      version: 1,
      network: 'arbitrum',
      token: '0xD74f5255D557944cf7Dd0E45FF521520002D5748',
      amount: '1000000000000000000',
      recipient: '0x1234...',
      deadline: 1735689600,
    };

    // ACT
    const header = serializePaymentHeader(payment);

    // ASSERT: Compare against stored snapshot
    expect(header).toMatchSnapshot();
  });
});
```

Update snapshots when intentional changes occur:

```bash
pnpm --filter @x402/sdk test -- --update-snapshots
```

### Test Utilities and Helpers

Create shared test utilities in `__tests__/utils/`:

```typescript
// packages/sdk/src/__tests__/utils/fixtures.ts
import { createTestClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Test wallet with known private key (DO NOT use in production)
 */
export const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export const TEST_ACCOUNT = privateKeyToAccount(TEST_PRIVATE_KEY);

/**
 * Mock USDs token address on Arbitrum
 */
export const USDS_ADDRESS = '0xD74f5255D557944cf7Dd0E45FF521520002D5748';

/**
 * Create a test client configured for local Anvil
 */
export function createTestVClient() {
  return createTestClient({
    chain: arbitrum,
    mode: 'anvil',
    transport: http('http://localhost:8545'),
  });
}

/**
 * Generate a random Ethereum address
 */
export function randomAddress(): `0x${string}` {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Advance blockchain time (for Anvil)
 */
export async function advanceTime(client: ReturnType<typeof createTestVClient>, seconds: number) {
  await client.increaseTime({ seconds });
  await client.mine({ blocks: 1 });
}
```

```typescript
// packages/sdk/src/__tests__/utils/mocks.ts
import { vi } from 'vitest';

/**
 * Create a mock X402 payment response
 */
export function mockPaymentResponse(overrides = {}) {
  return {
    success: true,
    transactionHash: '0x' + '1'.repeat(64),
    blockNumber: 12345678n,
    gasUsed: 21000n,
    ...overrides,
  };
}

/**
 * Create a mock tool registry entry
 */
export function mockToolInfo(overrides = {}) {
  return {
    name: 'test-tool',
    developer: '0x' + '2'.repeat(40),
    paymentToken: USDS_ADDRESS,
    pricePerCall: BigInt(1e18),
    active: true,
    ...overrides,
  };
}
```

---

## Smart Contract Testing

### Running Contract Tests

```bash
# Navigate to contracts directory
cd contracts

# Run all tests
forge test

# Run tests with verbosity (shows logs)
forge test -vv

# Run tests with more details (shows traces)
forge test -vvv

# Run specific test file
forge test --match-path test/ToolRegistry.t.sol

# Run specific test function
forge test --match-test test_RegisterTool

# Run tests with gas reporting
forge test --gas-report

# Run with coverage
forge coverage

# Generate coverage report
forge coverage --report lcov
```

### Unit Tests with Forge

Unit tests validate individual contract functions in isolation:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ToolRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ToolRegistryTest is Test {
    ToolRegistry public registry;
    
    address public owner = address(this);
    address public platformWallet = makeAddr("platform");
    address public developer = makeAddr("developer");
    address public user = makeAddr("user");
    
    // USDs address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;
    
    /**
     * @notice ARRANGE: Set up test environment before each test
     */
    function setUp() public {
        // Mock USDs rebaseOptIn (must happen before deployment)
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
            abi.encode()
        );
        
        // Deploy implementation
        ToolRegistry impl = new ToolRegistry();
        
        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            platformWallet,
            2000 // 20% fee
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = ToolRegistry(address(proxy));
    }
    
    /*//////////////////////////////////////////////////////////////
                        BASIC UNIT TESTS (AAA Pattern)
    //////////////////////////////////////////////////////////////*/
    
    function test_RegisterTool() public {
        // ARRANGE: Prepare test data
        string memory toolName = "weather-api";
        uint256 price = 1e18;
        
        // ACT: Execute the function
        registry.registerTool(toolName, developer, price, USDS);
        
        // ASSERT: Verify results
        (address dev, uint256 p, uint256 calls) = registry.getToolInfo(toolName);
        assertEq(dev, developer, "Developer should match");
        assertEq(p, price, "Price should match");
        assertEq(calls, 0, "Calls should be zero initially");
    }
    
    function test_RegisterTool_RevertInvalidDeveloper() public {
        // ARRANGE
        string memory toolName = "weather-api";
        
        // ACT & ASSERT: Expect specific revert
        vm.expectRevert(IX402Common.InvalidAddress.selector);
        registry.registerTool(toolName, address(0), 1e18, USDS);
    }
}
```

### Fuzz Testing Configuration

Fuzz testing automatically generates random inputs to find edge cases:

```solidity
contract FuzzTests is Test {
    ToolRegistry public registry;
    
    function setUp() public {
        // ... setup code ...
    }
    
    /**
     * @notice Fuzz test: registerTool should work with any valid inputs
     * @param name Random tool name
     * @param developer Random developer address
     * @param price Random price
     */
    function testFuzz_RegisterTool(
        string calldata name,
        address developer,
        uint256 price
    ) public {
        // ARRANGE: Bound inputs to valid ranges
        vm.assume(developer != address(0));  // Skip zero address
        vm.assume(price > 0);                 // Skip zero price
        vm.assume(bytes(name).length > 0);    // Skip empty name
        vm.assume(bytes(name).length <= 64);  // Reasonable name length
        
        // ACT
        registry.registerTool(name, developer, price, USDS);
        
        // ASSERT
        (address dev, uint256 p, ) = registry.getToolInfo(name);
        assertEq(dev, developer);
        assertEq(p, price);
    }
    
    /**
     * @notice Fuzz test: payment fee calculations should never overflow
     * @param amount Random payment amount
     */
    function testFuzz_PaymentFeesNoOverflow(uint256 amount) public {
        // ARRANGE: Bound to reasonable amounts (1 wei to 1 billion tokens)
        amount = bound(amount, 1, 1_000_000_000e18);
        
        // Set up tool
        registry.registerTool("tool", developer, amount, USDS);
        
        // Mock token transfers
        vm.mockCall(USDS, abi.encodeWithSelector(IERC20.transferFrom.selector), abi.encode(true));
        vm.mockCall(USDS, abi.encodeWithSelector(IERC20.transfer.selector), abi.encode(true));
        
        // ACT: Should not revert
        vm.prank(user);
        registry.payForToolWithAmount("tool", amount);
        
        // ASSERT: Verify stats updated
        IToolRegistry.ToolInfo memory info = registry.getFullToolInfo("tool");
        assertEq(info.totalRevenue, amount);
    }
}
```

Configure fuzz runs in `foundry.toml`:

```toml
[profile.default]
fuzz = { runs = 256 }

[profile.ci]
fuzz = { runs = 1000 }

[profile.deep]
fuzz = { runs = 10000 }
```

### Invariant Testing

Invariant tests verify properties that should always hold:

```solidity
// test/invariants/ToolRegistryInvariant.t.sol
contract ToolRegistryInvariantTest is Test {
    ToolRegistry public registry;
    ToolRegistryHandler public handler;
    
    function setUp() public {
        // Deploy registry
        registry = deployRegistry();
        
        // Deploy handler (actor that calls contract)
        handler = new ToolRegistryHandler(registry);
        
        // Target the handler for invariant testing
        targetContract(address(handler));
    }
    
    /**
     * @notice Invariant: Total tools should equal registered tools count
     */
    function invariant_toolCountConsistent() public view {
        assertEq(
            registry.totalTools(),
            handler.toolsRegistered(),
            "Tool count mismatch"
        );
    }
    
    /**
     * @notice Invariant: Platform fee should always be within bounds
     */
    function invariant_platformFeeInBounds() public view {
        uint256 fee = registry.platformFeeBps();
        assertGe(fee, 100, "Fee below minimum");   // >= 1%
        assertLe(fee, 5000, "Fee above maximum");  // <= 50%
    }
    
    /**
     * @notice Invariant: Contract should never hold user funds
     * (All payments should be forwarded immediately)
     */
    function invariant_noLockedFunds() public view {
        uint256 balance = IERC20(USDS).balanceOf(address(registry));
        assertEq(balance, 0, "Contract should not hold funds");
    }
}

/**
 * @title Handler contract for invariant testing
 * @notice Simulates user actions on the registry
 */
contract ToolRegistryHandler is Test {
    ToolRegistry public registry;
    uint256 public toolsRegistered;
    
    constructor(ToolRegistry _registry) {
        registry = _registry;
    }
    
    function registerTool(string calldata name, uint256 price) external {
        price = bound(price, 1, 1000e18);
        if (bytes(name).length == 0) return;
        
        try registry.registerTool(name, msg.sender, price, USDS) {
            toolsRegistered++;
        } catch {}
    }
}
```

### Fork Testing Against Mainnet

Test against real Arbitrum state:

```solidity
contract ForkTest is Test {
    ToolRegistry public registry;
    
    // Real USDs holder on Arbitrum
    address constant USDS_WHALE = 0x...; // Find a real holder
    
    function setUp() public {
        // Fork Arbitrum mainnet at specific block
        vm.createSelectFork(vm.envString("ARBITRUM_RPC_URL"), 150_000_000);
        
        // Deploy registry (will interact with real USDs)
        registry = deployRegistry();
    }
    
    function test_PayWithRealUSDs() public {
        // ARRANGE
        registry.registerTool("test-tool", developer, 1e18, USDS);
        
        // Impersonate whale to get real USDs
        vm.startPrank(USDS_WHALE);
        IERC20(USDS).approve(address(registry), type(uint256).max);
        
        uint256 balanceBefore = IERC20(USDS).balanceOf(USDS_WHALE);
        
        // ACT
        registry.payForTool("test-tool");
        
        // ASSERT: Real balance decreased
        uint256 balanceAfter = IERC20(USDS).balanceOf(USDS_WHALE);
        assertEq(balanceBefore - balanceAfter, 1e18);
        
        vm.stopPrank();
    }
    
    function test_USDsRebaseIntegration() public {
        // Test that USDs rebasing works correctly with our contracts
        // ... verify yield accumulates properly ...
    }
}
```

### Gas Benchmarking

Track gas usage for optimization:

```solidity
contract GasBenchmarks is Test {
    ToolRegistry public registry;
    
    function setUp() public {
        registry = deployRegistry();
        // Register 100 tools for realistic state
        for (uint i = 0; i < 100; i++) {
            registry.registerTool(
                string(abi.encodePacked("tool-", vm.toString(i))),
                makeAddr(string(abi.encodePacked("dev-", vm.toString(i)))),
                1e18,
                USDS
            );
        }
    }
    
    function test_Gas_RegisterTool() public {
        uint256 gasBefore = gasleft();
        registry.registerTool("new-tool", developer, 1e18, USDS);
        uint256 gasUsed = gasBefore - gasleft();
        
        // Log gas usage
        emit log_named_uint("registerTool gas", gasUsed);
        
        // Assert gas within expected bounds
        assertLt(gasUsed, 200_000, "Gas too high for registerTool");
    }
    
    function test_Gas_PayForTool() public {
        // Mock transfers
        vm.mockCall(USDS, abi.encodeWithSelector(IERC20.transferFrom.selector), abi.encode(true));
        vm.mockCall(USDS, abi.encodeWithSelector(IERC20.transfer.selector), abi.encode(true));
        
        uint256 gasBefore = gasleft();
        registry.payForTool("tool-50");
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("payForTool gas", gasUsed);
        assertLt(gasUsed, 100_000, "Gas too high for payForTool");
    }
    
    function test_Gas_BatchPayForTools() public {
        string[] memory tools = new string[](10);
        for (uint i = 0; i < 10; i++) {
            tools[i] = string(abi.encodePacked("tool-", vm.toString(i)));
        }
        
        vm.mockCall(USDS, abi.encodeWithSelector(IERC20.transferFrom.selector), abi.encode(true));
        vm.mockCall(USDS, abi.encodeWithSelector(IERC20.transfer.selector), abi.encode(true));
        
        uint256 gasBefore = gasleft();
        registry.batchPayForTools(tools);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("batchPayForTools (10) gas", gasUsed);
        
        // Should be more efficient than 10 individual calls
        uint256 gasPerTool = gasUsed / 10;
        assertLt(gasPerTool, 80_000, "Batch not efficient enough");
    }
}
```

Run gas report:

```bash
forge test --gas-report

# Output:
# | Contract    | Function        | Min    | Avg    | Max    | # Calls |
# |-------------|-----------------|--------|--------|--------|---------|
# | ToolRegistry| registerTool    | 145234 | 156789 | 189012 | 256     |
# | ToolRegistry| payForTool      | 67891  | 72345  | 89012  | 128     |
```

### Coverage Reporting

```bash
# Generate coverage report
forge coverage

# Generate LCOV report for CI integration
forge coverage --report lcov

# View detailed report
forge coverage --report summary
```

Coverage output example:

```
| File                        | % Lines        | % Statements   | % Branches     | % Funcs        |
|-----------------------------|----------------|----------------|----------------|----------------|
| src/ToolRegistry.sol        | 95.2% (40/42)  | 94.1% (48/51)  | 87.5% (14/16)  | 100% (15/15)   |
| src/X402CreditSystem.sol    | 92.3% (48/52)  | 91.2% (52/57)  | 83.3% (10/12)  | 93.3% (14/15)  |
| src/X402PaymentChannel.sol  | 88.9% (32/36)  | 87.5% (35/40)  | 80.0% (8/10)   | 90.0% (9/10)   |
| Total                       | 91.5%          | 90.5%          | 84.2%          | 95.0%          |
```

---

## Integration Testing

### Local Testnet Setup (Anvil)

Create a local Arbitrum fork for integration testing:

```bash
# Start Anvil with Arbitrum fork
anvil --fork-url $ARBITRUM_RPC_URL --fork-block-number 150000000

# Or use the npm script
pnpm run anvil
```

Create a helper script:

```bash
#!/bin/bash
# scripts/start-anvil.sh

# Load environment
source .env

# Start Anvil with specific configuration
anvil \
  --fork-url "$ARBITRUM_RPC_URL" \
  --fork-block-number 150000000 \
  --block-time 1 \
  --accounts 10 \
  --balance 10000 \
  --port 8545 \
  --chain-id 31337
```

### Test Fixtures

Create reusable fixtures for integration tests:

```typescript
// integration/fixtures/deployment.ts
import { createWalletClient, createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export interface TestFixture {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  deployer: ReturnType<typeof privateKeyToAccount>;
  contracts: {
    toolRegistry: `0x${string}`;
    creditSystem: `0x${string}`;
    paymentChannel: `0x${string}`;
  };
}

/**
 * Deploy all X402 contracts for integration testing
 */
export async function deployTestFixture(): Promise<TestFixture> {
  // Use Anvil's default account
  const deployer = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  );

  const publicClient = createPublicClient({
    chain: { ...arbitrum, id: 31337 },
    transport: http('http://localhost:8545'),
  });

  const walletClient = createWalletClient({
    account: deployer,
    chain: { ...arbitrum, id: 31337 },
    transport: http('http://localhost:8545'),
  });

  // Deploy contracts
  const toolRegistry = await deployToolRegistry(walletClient, publicClient);
  const creditSystem = await deployCreditSystem(walletClient, publicClient, toolRegistry);
  const paymentChannel = await deployPaymentChannel(walletClient, publicClient);

  return {
    publicClient,
    walletClient,
    deployer,
    contracts: {
      toolRegistry,
      creditSystem,
      paymentChannel,
    },
  };
}

/**
 * Get USDs balance for an address (works on fork)
 */
export async function getUSDsBalance(
  publicClient: ReturnType<typeof createPublicClient>,
  address: `0x${string}`
): Promise<bigint> {
  const balance = await publicClient.readContract({
    address: USDS_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  });
  return balance as bigint;
}
```

### Mock USDs Deployment

For isolated tests without forking:

```solidity
// test/mocks/MockUSDs.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDs
 * @notice Mock USDs token for testing without Arbitrum fork
 */
contract MockUSDs is ERC20 {
    uint256 private _creditsPerToken = 1e18;
    mapping(address => bool) private _rebaseOptedIn;
    
    constructor() ERC20("Mock USDs", "mUSDs") {}
    
    /**
     * @notice Mint tokens for testing
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @notice Mock rebaseOptIn function
     */
    function rebaseOptIn() external {
        _rebaseOptedIn[msg.sender] = true;
    }
    
    /**
     * @notice Get credits per token (for yield calculations)
     */
    function creditsPerToken() external view returns (uint256) {
        return _creditsPerToken;
    }
    
    /**
     * @notice Simulate rebase by adjusting creditsPerToken
     * @param multiplier Multiplier in basis points (10000 = no change)
     */
    function simulateRebase(uint256 multiplier) external {
        _creditsPerToken = (_creditsPerToken * multiplier) / 10000;
    }
    
    /**
     * @notice Check if address has opted into rebase
     */
    function isRebaseOptedIn(address account) external view returns (bool) {
        return _rebaseOptedIn[account];
    }
}
```

### End-to-End Payment Flows

```typescript
// integration/e2e/payment-flow.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { deployTestFixture, TestFixture } from '../fixtures/deployment';
import { parseEther, formatEther } from 'viem';

describe('E2E: Complete Payment Flow', () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await deployTestFixture();
  }, 60_000); // 60s timeout for deployment

  it('should complete full payment lifecycle', async () => {
    const { publicClient, walletClient, contracts } = fixture;
    const developer = '0x1234...';
    const user = walletClient.account.address;

    // 1. Register a tool
    await walletClient.writeContract({
      address: contracts.toolRegistry,
      abi: toolRegistryAbi,
      functionName: 'registerTool',
      args: ['weather-api', developer, parseEther('1'), USDS_ADDRESS],
    });

    // 2. Verify tool is registered
    const toolInfo = await publicClient.readContract({
      address: contracts.toolRegistry,
      abi: toolRegistryAbi,
      functionName: 'getToolInfo',
      args: ['weather-api'],
    });
    expect(toolInfo[0]).toBe(developer);

    // 3. Approve USDs spending
    await walletClient.writeContract({
      address: USDS_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [contracts.toolRegistry, parseEther('100')],
    });

    // 4. Pay for tool
    const balanceBefore = await getUSDsBalance(publicClient, user);
    
    await walletClient.writeContract({
      address: contracts.toolRegistry,
      abi: toolRegistryAbi,
      functionName: 'payForTool',
      args: ['weather-api'],
    });

    // 5. Verify payment
    const balanceAfter = await getUSDsBalance(publicClient, user);
    expect(balanceBefore - balanceAfter).toBe(parseEther('1'));

    // 6. Verify developer received payment (minus platform fee)
    const developerBalance = await getUSDsBalance(publicClient, developer);
    expect(developerBalance).toBe(parseEther('0.8')); // 80% of 1 USDs
  });

  it('should accumulate yield in credit system', async () => {
    const { publicClient, walletClient, contracts } = fixture;

    // 1. Deposit to credit system
    await walletClient.writeContract({
      address: USDS_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [contracts.creditSystem, parseEther('100')],
    });

    await walletClient.writeContract({
      address: contracts.creditSystem,
      abi: creditSystemAbi,
      functionName: 'deposit',
      args: [parseEther('100')],
    });

    const balanceBefore = await publicClient.readContract({
      address: contracts.creditSystem,
      abi: creditSystemAbi,
      functionName: 'getCreditBalance',
      args: [walletClient.account.address],
    });

    // 2. Simulate time passing + rebase
    await advanceTime(publicClient, 30 * 24 * 60 * 60); // 30 days
    
    // Note: In real tests, you'd need to simulate USDs rebase
    // This requires either a fork with real time or mock rebase

    // 3. Verify yield accumulated
    const balanceAfter = await publicClient.readContract({
      address: contracts.creditSystem,
      abi: creditSystemAbi,
      functionName: 'getCreditBalance',
      args: [walletClient.account.address],
    });

    // Balance should have increased from yield
    expect(balanceAfter >= balanceBefore).toBe(true);
  });
});
```

---

## Manual Testing Checklist

### Pre-Release QA Checklist

#### Smart Contracts

- [ ] **Deployment Verification**
  - [ ] All contracts deploy without errors
  - [ ] Initialization parameters are correct
  - [ ] Owner/admin addresses are correct
  - [ ] Proxies point to correct implementations

- [ ] **Core Functionality**
  - [ ] Tool registration works
  - [ ] Tool payment processes correctly
  - [ ] Fee splits are accurate (developer/platform)
  - [ ] Batch payments work
  - [ ] Credit deposits/withdrawals work
  - [ ] Payment channels open/close correctly

- [ ] **Access Control**
  - [ ] Only owner can call admin functions
  - [ ] Only developer can modify their tools
  - [ ] Pause/unpause works correctly

- [ ] **Edge Cases**
  - [ ] Zero amount transfers revert
  - [ ] Invalid addresses revert
  - [ ] Duplicate tool names revert
  - [ ] Expired credits handled correctly

- [ ] **Upgrades**
  - [ ] Contract can be upgraded
  - [ ] Storage layout is preserved
  - [ ] New functions work post-upgrade

#### TypeScript SDK

- [ ] **Client Initialization**
  - [ ] Connects to Arbitrum mainnet
  - [ ] Connects to Arbitrum Sepolia
  - [ ] Handles invalid RPC URLs gracefully

- [ ] **Payment Flow**
  - [ ] Can create payment headers
  - [ ] Can verify payments
  - [ ] Timeout handling works

- [ ] **Error Handling**
  - [ ] Network errors are caught
  - [ ] Invalid inputs throw descriptive errors
  - [ ] Retries work for transient failures

### Browser Testing Matrix

| Browser | Version | Desktop | Mobile | Status |
|---------|---------|---------|--------|--------|
| Chrome | Latest | ✅ | ✅ | |
| Firefox | Latest | ✅ | ✅ | |
| Safari | Latest | ✅ | ✅ | |
| Edge | Latest | ✅ | N/A | |
| Brave | Latest | ✅ | ✅ | |

**Test scenarios per browser:**
- [ ] Connect wallet (MetaMask, WalletConnect)
- [ ] Sign transactions
- [ ] View payment history
- [ ] Error states display correctly

### Network Testing (Mainnet Fork)

```bash
# Start mainnet fork
anvil --fork-url $ARBITRUM_RPC_URL

# Run fork tests
forge test --fork-url http://localhost:8545 --match-path test/fork/**

# Specific scenarios to test:
```

- [ ] **Real USDs Integration**
  - [ ] Payments work with real USDs holders
  - [ ] Rebase opt-in works
  - [ ] Yield accumulates correctly

- [ ] **Gas Estimation**
  - [ ] Gas estimates are accurate
  - [ ] No transactions run out of gas
  - [ ] Batch operations stay under block limit

- [ ] **State Consistency**
  - [ ] Balances update correctly
  - [ ] Events emit properly
  - [ ] View functions return accurate data

---

## Appendix: Test Commands Quick Reference

```bash
# TypeScript Tests
pnpm test                           # All packages
pnpm --filter @x402/sdk test        # SDK only
pnpm --filter @x402/sdk test:cov    # With coverage

# Contract Tests
cd contracts
forge test                          # All tests
forge test -vvv                     # Verbose
forge test --match-test "test_Pay"  # Pattern match
forge test --gas-report             # Gas report
forge coverage                      # Coverage

# Integration Tests
pnpm run test:integration           # Full integration
anvil --fork-url $ARBITRUM_RPC_URL  # Start local fork

# CI Simulation
pnpm run lint && pnpm run typecheck && pnpm test && cd contracts && forge test
```

---

## See Also

- [contracts/test/TESTING_GUIDE.md](../contracts/test/TESTING_GUIDE.md) - Contract-specific testing patterns
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [Forge Book](https://book.getfoundry.sh/) - Foundry documentation
- [Vitest Documentation](https://vitest.dev/) - TypeScript testing framework
