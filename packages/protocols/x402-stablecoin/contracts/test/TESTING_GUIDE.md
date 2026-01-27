# X402 Smart Contract Testing Guide

This guide provides detailed patterns and best practices for testing X402 smart contracts using Foundry's Forge.

## Table of Contents

- [Test File Structure](#test-file-structure)
- [The AAA Pattern](#the-aaa-pattern)
- [Mock Contract Usage](#mock-contract-usage)
- [Event Testing](#event-testing)
- [Revert Testing](#revert-testing)
- [Upgrade Testing](#upgrade-testing)
- [Test Coverage Requirements](#test-coverage-requirements)
- [Common Patterns](#common-patterns)

---

## Test File Structure

Each contract should have a corresponding test file following this structure:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/YourContract.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title YourContractTest
 * @notice Comprehensive tests for YourContract
 * @dev Follow AAA pattern: Arrange-Act-Assert
 */
contract YourContractTest is Test {
    /*//////////////////////////////////////////////////////////////
                               STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    
    YourContract public yourContract;
    YourContract public implementation;
    
    // Test actors
    address public owner = address(this);
    address public platformWallet = makeAddr("platform");
    address public developer = makeAddr("developer");
    address public user = makeAddr("user");
    
    // Constants
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;
    uint256 public constant AMOUNT = 1e18;
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    // Re-declare events for expectEmit testing
    event SomeEvent(address indexed user, uint256 amount);
    
    /*//////////////////////////////////////////////////////////////
                                SETUP
    //////////////////////////////////////////////////////////////*/
    
    function setUp() public {
        // Deploy and initialize contracts
        // Mock external dependencies
    }
    
    /*//////////////////////////////////////////////////////////////
                          INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function test_Initialize() public { /* ... */ }
    function test_Initialize_RevertInvalidParams() public { /* ... */ }
    
    /*//////////////////////////////////////////////////////////////
                           CORE FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function test_CoreFunction() public { /* ... */ }
    function test_CoreFunction_RevertCondition() public { /* ... */ }
    
    /*//////////////////////////////////////////////////////////////
                            ADMIN TESTS
    //////////////////////////////////////////////////////////////*/
    
    function test_AdminFunction() public { /* ... */ }
    function test_AdminFunction_RevertNotOwner() public { /* ... */ }
    
    /*//////////////////////////////////////////////////////////////
                             FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testFuzz_CoreFunction(uint256 param) public { /* ... */ }
    
    /*//////////////////////////////////////////////////////////////
                           HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function _mockTokenTransfers() internal { /* ... */ }
}
```

---

## The AAA Pattern

All tests should follow the **Arrange-Act-Assert** pattern for clarity and maintainability:

### Basic Example

```solidity
function test_RegisterTool() public {
    // ═══════════════════════════════════════════════════════════
    // ARRANGE: Set up preconditions and inputs
    // ═══════════════════════════════════════════════════════════
    string memory toolName = "weather-api";
    address toolDeveloper = developer;
    uint256 toolPrice = 1e18;
    address paymentToken = USDS;
    
    // ═══════════════════════════════════════════════════════════
    // ACT: Execute the function being tested
    // ═══════════════════════════════════════════════════════════
    registry.registerTool(toolName, toolDeveloper, toolPrice, paymentToken);
    
    // ═══════════════════════════════════════════════════════════
    // ASSERT: Verify the expected outcomes
    // ═══════════════════════════════════════════════════════════
    (address dev, uint256 price, uint256 calls) = registry.getToolInfo(toolName);
    
    assertEq(dev, toolDeveloper, "Developer should be set correctly");
    assertEq(price, toolPrice, "Price should be set correctly");
    assertEq(calls, 0, "Initial calls should be zero");
    assertEq(registry.totalTools(), 1, "Total tools should increment");
}
```

### Complex Example with State Changes

```solidity
function test_PayForTool_DistributesFeeCorrectly() public {
    // ═══════════════════════════════════════════════════════════
    // ARRANGE
    // ═══════════════════════════════════════════════════════════
    
    // Register tool first
    registry.registerTool("test-tool", developer, TOOL_PRICE, USDS);
    
    // Fund user with tokens (for non-mocked tests)
    deal(USDS, user, 100e18);
    
    // Record initial balances
    uint256 developerBalanceBefore = IERC20(USDS).balanceOf(developer);
    uint256 platformBalanceBefore = IERC20(USDS).balanceOf(platformWallet);
    uint256 userBalanceBefore = IERC20(USDS).balanceOf(user);
    
    // Calculate expected splits (20% platform fee)
    uint256 expectedPlatformAmount = (TOOL_PRICE * 2000) / 10000;
    uint256 expectedDeveloperAmount = TOOL_PRICE - expectedPlatformAmount;
    
    // Approve spending
    vm.prank(user);
    IERC20(USDS).approve(address(registry), TOOL_PRICE);
    
    // ═══════════════════════════════════════════════════════════
    // ACT
    // ═══════════════════════════════════════════════════════════
    vm.prank(user);
    registry.payForTool("test-tool");
    
    // ═══════════════════════════════════════════════════════════
    // ASSERT
    // ═══════════════════════════════════════════════════════════
    
    // Verify user paid
    assertEq(
        IERC20(USDS).balanceOf(user),
        userBalanceBefore - TOOL_PRICE,
        "User should pay full amount"
    );
    
    // Verify developer received their share
    assertEq(
        IERC20(USDS).balanceOf(developer),
        developerBalanceBefore + expectedDeveloperAmount,
        "Developer should receive 80%"
    );
    
    // Verify platform received their share
    assertEq(
        IERC20(USDS).balanceOf(platformWallet),
        platformBalanceBefore + expectedPlatformAmount,
        "Platform should receive 20%"
    );
    
    // Verify stats updated
    (, , uint256 totalCalls) = registry.getToolInfo("test-tool");
    assertEq(totalCalls, 1, "Call count should increment");
}
```

---

## Mock Contract Usage

### When to Mock

| Scenario | Use Mock | Use Fork |
|----------|----------|----------|
| Unit testing single function | ✅ | ❌ |
| Testing error paths | ✅ | ❌ |
| Fast CI pipeline | ✅ | ❌ |
| Testing real token behavior | ❌ | ✅ |
| Testing yield/rebase | ❌ | ✅ |
| Integration testing | ❌ | ✅ |

### Mock USDs Token

```solidity
// test/mocks/MockUSDs.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDs
 * @notice Mock implementation of Sperax USDs for testing
 */
contract MockUSDs is ERC20 {
    uint256 private _creditsPerToken = 1e18;
    mapping(address => bool) private _rebaseOptedIn;
    
    constructor() ERC20("Mock USDs", "mUSDs") {}
    
    /// @notice Mint tokens for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /// @notice Mock rebaseOptIn - required by X402 contracts
    function rebaseOptIn() external {
        _rebaseOptedIn[msg.sender] = true;
    }
    
    /// @notice Get credits per token for yield calculations
    function creditsPerToken() external view returns (uint256) {
        return _creditsPerToken;
    }
    
    /// @notice Simulate a rebase event (increase/decrease yield)
    /// @param bps Basis points multiplier (10000 = no change, 10100 = 1% increase)
    function simulateRebase(uint256 bps) external {
        _creditsPerToken = (_creditsPerToken * 10000) / bps;
    }
    
    /// @notice Check if address opted into rebase
    function isRebaseOptedIn(address account) external view returns (bool) {
        return _rebaseOptedIn[account];
    }
}
```

### Using vm.mockCall

For quick mocking without deploying mock contracts:

```solidity
function setUp() public {
    // Mock USDs rebaseOptIn (must be before contract deployment)
    vm.mockCall(
        USDS,
        abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
        abi.encode()
    );
    
    // Mock creditsPerToken for yield calculations
    vm.mockCall(
        USDS,
        abi.encodeWithSelector(IUSDs.creditsPerToken.selector),
        abi.encode(1e18)
    );
    
    // Deploy your contract...
}

function test_PayForTool() public {
    // Mock all ERC20 transfer operations
    vm.mockCall(
        USDS,
        abi.encodeWithSelector(
            IERC20.transferFrom.selector,
            user,
            address(registry),
            TOOL_PRICE
        ),
        abi.encode(true)
    );
    
    vm.mockCall(
        USDS,
        abi.encodeWithSelector(IERC20.transfer.selector),
        abi.encode(true)
    );
    
    // Test proceeds without actual token transfers
    vm.prank(user);
    registry.payForTool("test-tool");
}
```

### Mock Contract for Payment Channels

```solidity
// test/mocks/MockPaymentRecipient.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockPaymentRecipient
 * @notice Mock contract that receives payments (for testing callbacks)
 */
contract MockPaymentRecipient {
    uint256 public paymentsReceived;
    uint256 public totalAmountReceived;
    
    event PaymentReceived(address indexed from, uint256 amount);
    
    /// @notice Called when payment is received
    function onPaymentReceived(address from, uint256 amount) external {
        paymentsReceived++;
        totalAmountReceived += amount;
        emit PaymentReceived(from, amount);
    }
    
    /// @notice For testing reentrancy protection
    bool public shouldReenter;
    address public targetContract;
    bytes public reenterData;
    
    function setReentrancy(address target, bytes calldata data) external {
        shouldReenter = true;
        targetContract = target;
        reenterData = data;
    }
    
    receive() external payable {
        if (shouldReenter) {
            (bool success, ) = targetContract.call(reenterData);
            require(success, "Reentrancy failed");
        }
    }
}
```

---

## Event Testing

### Testing Event Emission

```solidity
// Events must be re-declared in test contract
event ToolRegistered(
    string indexed name,
    address indexed developer,
    address paymentToken,
    uint256 pricePerCall
);

function test_RegisterTool_EmitsEvent() public {
    // ARRANGE
    string memory toolName = "weather-api";
    
    // Set up expectEmit before the action
    // Parameters: (checkTopic1, checkTopic2, checkTopic3, checkData)
    vm.expectEmit(true, true, true, true);
    
    // Emit the expected event (must match exactly)
    emit ToolRegistered(toolName, developer, USDS, TOOL_PRICE);
    
    // ACT: This should emit the event we're expecting
    registry.registerTool(toolName, developer, TOOL_PRICE, USDS);
}
```

### Testing Multiple Events

```solidity
function test_BatchPayForTools_EmitsMultipleEvents() public {
    // ARRANGE
    registry.registerTool("tool-1", developer, 1e18, USDS);
    registry.registerTool("tool-2", developer, 2e18, USDS);
    
    string[] memory tools = new string[](2);
    tools[0] = "tool-1";
    tools[1] = "tool-2";
    
    _mockTokenTransfers();
    
    // Expect first event
    vm.expectEmit(true, true, true, true);
    emit ToolCalled("tool-1", user, 1e18);
    
    // Expect second event
    vm.expectEmit(true, true, true, true);
    emit ToolCalled("tool-2", user, 2e18);
    
    // ACT
    vm.prank(user);
    registry.batchPayForTools(tools);
}
```

### Testing Event Parameters Partially

```solidity
function test_ToolCalled_EmitsWithCorrectTool() public {
    // ARRANGE
    registry.registerTool("test-tool", developer, TOOL_PRICE, USDS);
    _mockTokenTransfers();
    
    // Only check indexed parameters (topic1=name, topic2=caller)
    // Don't check non-indexed data
    vm.expectEmit(true, true, false, false);
    emit ToolCalled("test-tool", user, 0); // amount doesn't matter
    
    // ACT
    vm.prank(user);
    registry.payForTool("test-tool");
}
```

---

## Revert Testing

### Testing Custom Errors

```solidity
function test_RegisterTool_RevertInvalidDeveloper() public {
    // ARRANGE
    string memory toolName = "test-tool";
    
    // ACT & ASSERT: Expect specific custom error
    vm.expectRevert(IX402Common.InvalidAddress.selector);
    registry.registerTool(toolName, address(0), TOOL_PRICE, USDS);
}

function test_RegisterTool_RevertInvalidPrice() public {
    vm.expectRevert(IX402Common.InvalidAmount.selector);
    registry.registerTool("test-tool", developer, 0, USDS);
}

function test_RegisterTool_RevertUnsupportedToken() public {
    address fakeToken = makeAddr("fakeToken");
    
    vm.expectRevert(IX402Common.NotAllowed.selector);
    registry.registerTool("test-tool", developer, TOOL_PRICE, fakeToken);
}
```

### Testing Custom Errors with Parameters

```solidity
// If your error has parameters:
// error InsufficientBalance(uint256 required, uint256 available);

function test_Withdraw_RevertInsufficientBalance() public {
    // ARRANGE
    uint256 userBalance = 10e18;
    uint256 withdrawAmount = 100e18;
    
    // Encode the error with expected parameters
    vm.expectRevert(
        abi.encodeWithSelector(
            IX402CreditSystem.InsufficientBalance.selector,
            withdrawAmount,  // required
            userBalance      // available
        )
    );
    
    // ACT
    vm.prank(user);
    creditSystem.withdraw(withdrawAmount);
}
```

### Testing Access Control Reverts

```solidity
function test_AdminFunction_RevertNotOwner() public {
    // ARRANGE: Use non-owner address
    address notOwner = makeAddr("notOwner");
    
    // ACT & ASSERT
    vm.prank(notOwner);
    vm.expectRevert(
        abi.encodeWithSelector(
            OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
            notOwner
        )
    );
    registry.updatePlatformWallet(notOwner);
}

function test_UpdatePrice_RevertNotDeveloper() public {
    // ARRANGE
    registry.registerTool("test-tool", developer, TOOL_PRICE, USDS);
    address notDeveloper = makeAddr("notDeveloper");
    
    // ACT & ASSERT
    vm.prank(notDeveloper);
    vm.expectRevert(IX402Common.Unauthorized.selector);
    registry.updateToolPrice("test-tool", 2 * TOOL_PRICE);
}
```

### Testing Pause Functionality

```solidity
function test_RegisterTool_RevertWhenPaused() public {
    // ARRANGE
    registry.pause();
    assertTrue(registry.paused());
    
    // ACT & ASSERT
    vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
    registry.registerTool("test-tool", developer, TOOL_PRICE, USDS);
    
    // Verify can resume
    registry.unpause();
    registry.registerTool("test-tool", developer, TOOL_PRICE, USDS);
}
```

---

## Upgrade Testing

### UUPS Upgrade Pattern Tests

```solidity
// test/upgrades/ToolRegistryUpgrade.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/ToolRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title ToolRegistryV2
 * @notice Mock V2 implementation for upgrade testing
 */
contract ToolRegistryV2 is ToolRegistry {
    uint256 public newVariable;
    
    function setNewVariable(uint256 _value) external onlyOwner {
        newVariable = _value;
    }
    
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}

contract ToolRegistryUpgradeTest is Test {
    ToolRegistry public registry;
    ToolRegistry public implementation;
    ERC1967Proxy public proxy;
    
    address public owner = address(this);
    address public platformWallet = makeAddr("platform");
    
    function setUp() public {
        // Mock USDs
        vm.mockCall(
            0xD74f5255D557944cf7Dd0E45FF521520002D5748,
            abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
            abi.encode()
        );
        
        // Deploy V1
        implementation = new ToolRegistry();
        
        bytes memory initData = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            platformWallet,
            2000
        );
        
        proxy = new ERC1967Proxy(address(implementation), initData);
        registry = ToolRegistry(address(proxy));
    }
    
    function test_Upgrade_PreservesState() public {
        // ARRANGE: Create some state in V1
        registry.registerTool("test-tool", makeAddr("dev"), 1e18, 
            0xD74f5255D557944cf7Dd0E45FF521520002D5748);
        
        (address devBefore, uint256 priceBefore, ) = registry.getToolInfo("test-tool");
        uint256 totalToolsBefore = registry.totalTools();
        
        // ACT: Upgrade to V2
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        // Cast to V2 for new functions
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT: Old state preserved
        (address devAfter, uint256 priceAfter, ) = registryV2.getToolInfo("test-tool");
        assertEq(devAfter, devBefore, "Developer should be preserved");
        assertEq(priceAfter, priceBefore, "Price should be preserved");
        assertEq(registryV2.totalTools(), totalToolsBefore, "Total tools preserved");
        
        // ASSERT: New functionality works
        assertEq(registryV2.version(), "2.0.0");
        registryV2.setNewVariable(42);
        assertEq(registryV2.newVariable(), 42);
    }
    
    function test_Upgrade_RevertNotOwner() public {
        // ARRANGE
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        address notOwner = makeAddr("notOwner");
        
        // ACT & ASSERT
        vm.prank(notOwner);
        vm.expectRevert();
        registry.upgradeToAndCall(address(v2Implementation), "");
    }
    
    function test_Upgrade_CallsInitializerOnNewVersion() public {
        // For upgrades that need initialization
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        
        bytes memory initV2Data = abi.encodeWithSelector(
            ToolRegistryV2.setNewVariable.selector,
            100
        );
        
        registry.upgradeToAndCall(address(v2Implementation), initV2Data);
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        assertEq(registryV2.newVariable(), 100);
    }
}
```

### Storage Layout Verification

```solidity
function test_Upgrade_StorageLayoutCompatible() public {
    // This test verifies the storage layout hasn't changed
    // by checking specific storage slots
    
    // ARRANGE: Set state in V1
    registry.registerTool("tool-1", makeAddr("dev1"), 1e18, USDS);
    registry.registerTool("tool-2", makeAddr("dev2"), 2e18, USDS);
    
    // Read storage slots directly
    bytes32 slot0 = vm.load(address(proxy), bytes32(uint256(0)));
    bytes32 platformWalletSlot = vm.load(address(proxy), bytes32(uint256(1)));
    
    // ACT: Upgrade
    ToolRegistryV2 v2Implementation = new ToolRegistryV2();
    registry.upgradeToAndCall(address(v2Implementation), "");
    
    // ASSERT: Storage slots unchanged
    assertEq(vm.load(address(proxy), bytes32(uint256(0))), slot0);
    assertEq(vm.load(address(proxy), bytes32(uint256(1))), platformWalletSlot);
}
```

---

## Test Coverage Requirements

### Minimum Coverage by Contract

| Contract | Line | Branch | Function | Notes |
|----------|------|--------|----------|-------|
| ToolRegistry | 90% | 85% | 100% | Core contract |
| X402CreditSystem | 90% | 85% | 100% | Handles user funds |
| X402PaymentChannel | 90% | 85% | 100% | Critical payment flow |
| X402Subscription | 85% | 80% | 95% | Recurring payments |
| X402RevenueSplitter | 85% | 80% | 95% | Fee distribution |

### Required Test Categories

For each public/external function, include tests for:

1. **Happy Path** - Normal successful execution
2. **Revert Conditions** - Each require/revert statement
3. **Edge Cases** - Boundary values, empty inputs
4. **Access Control** - Unauthorized callers
5. **State Changes** - All storage modifications
6. **Events** - All event emissions
7. **Gas** - Gas consumption benchmarks (critical functions)

### Test Naming Convention

```
test_FunctionName()                    // Happy path
test_FunctionName_RevertCondition()    // Specific revert
test_FunctionName_WithCondition()      // Variant scenario
testFuzz_FunctionName()                // Fuzz test
invariant_PropertyName()               // Invariant test
```

---

## Common Patterns

### Testing Time-Dependent Logic

```solidity
function test_CreditsExpire() public {
    // ARRANGE
    _depositCredits(user, 100e18);
    creditSystem.setCreditExpirationPeriod(30 days);
    
    // ACT: Advance time past expiration
    vm.warp(block.timestamp + 31 days);
    
    // ASSERT
    assertTrue(creditSystem.areCreditsExpired(user));
    
    vm.prank(user);
    vm.expectRevert(IX402Common.NotAllowed.selector);
    creditSystem.useCredits("test-tool", 1e18);
}
```

### Testing with Multiple Actors

```solidity
function test_MultipleUsersCanRegisterTools() public {
    // Multiple developers register tools
    address[] memory developers = new address[](3);
    for (uint i = 0; i < 3; i++) {
        developers[i] = makeAddr(string(abi.encodePacked("developer", vm.toString(i))));
        
        vm.prank(developers[i]);
        registry.registerTool(
            string(abi.encodePacked("tool-", vm.toString(i))),
            developers[i],
            (i + 1) * 1e18,
            USDS
        );
    }
    
    assertEq(registry.totalTools(), 3);
    
    // Verify each developer owns their tool
    for (uint i = 0; i < 3; i++) {
        (address dev, , ) = registry.getToolInfo(
            string(abi.encodePacked("tool-", vm.toString(i)))
        );
        assertEq(dev, developers[i]);
    }
}
```

### Testing with deal() for Token Balances

```solidity
function test_PayWithRealBalance() public {
    // ARRANGE: Give user tokens using deal
    deal(USDS, user, 100e18);
    assertEq(IERC20(USDS).balanceOf(user), 100e18);
    
    // Register tool
    registry.registerTool("test-tool", developer, 1e18, USDS);
    
    // Approve and pay
    vm.startPrank(user);
    IERC20(USDS).approve(address(registry), 1e18);
    registry.payForTool("test-tool");
    vm.stopPrank();
    
    // ASSERT
    assertEq(IERC20(USDS).balanceOf(user), 99e18);
}
```

### Helper Functions Pattern

```solidity
/*//////////////////////////////////////////////////////////////
                        HELPER FUNCTIONS
//////////////////////////////////////////////////////////////*/

/// @notice Deploy and initialize registry with mocked USDs
function _deployRegistry() internal returns (ToolRegistry) {
    _mockUSDs();
    
    ToolRegistry impl = new ToolRegistry();
    bytes memory initData = abi.encodeWithSelector(
        ToolRegistry.initialize.selector,
        platformWallet,
        2000
    );
    ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
    return ToolRegistry(address(proxy));
}

/// @notice Mock all USDs calls needed for tests
function _mockUSDs() internal {
    vm.mockCall(
        USDS,
        abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
        abi.encode()
    );
    vm.mockCall(
        USDS,
        abi.encodeWithSelector(IUSDs.creditsPerToken.selector),
        abi.encode(1e18)
    );
}

/// @notice Mock token transfers for payment tests
function _mockTokenTransfers() internal {
    vm.mockCall(
        USDS,
        abi.encodeWithSelector(IERC20.transferFrom.selector),
        abi.encode(true)
    );
    vm.mockCall(
        USDS,
        abi.encodeWithSelector(IERC20.transfer.selector),
        abi.encode(true)
    );
}

/// @notice Register a tool for testing
function _registerTestTool(
    string memory name,
    address dev,
    uint256 price
) internal {
    registry.registerTool(name, dev, price, USDS);
}

/// @notice Deposit credits for a user
function _depositCredits(address user, uint256 amount) internal {
    deal(USDS, user, amount);
    
    vm.startPrank(user);
    IERC20(USDS).approve(address(creditSystem), amount);
    creditSystem.deposit(amount);
    vm.stopPrank();
}
```

---

## Running Tests

```bash
# All tests
forge test

# Verbose output
forge test -vvv

# Specific file
forge test --match-path test/ToolRegistry.t.sol

# Specific test
forge test --match-test test_RegisterTool

# With gas report
forge test --gas-report

# Coverage
forge coverage
forge coverage --report lcov

# CI mode (more fuzz runs)
FOUNDRY_PROFILE=ci forge test
```

---

## See Also

- [/docs/TESTING.md](../../docs/TESTING.md) - Main testing documentation
- [Foundry Book - Testing](https://book.getfoundry.sh/forge/tests)
- [OpenZeppelin Test Helpers](https://docs.openzeppelin.com/test-helpers)
