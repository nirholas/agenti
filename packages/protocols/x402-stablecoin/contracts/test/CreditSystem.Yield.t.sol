// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/X402CreditSystem.sol";
import "../src/ToolRegistry.sol";
import "../mocks/MockUSDs.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title CreditSystemYieldTest
 * @notice Tests for yield accumulation and tracking in the X402CreditSystem
 * @dev Uses MockUSDs to simulate rebasing behavior
 * 
 * These tests verify:
 * - Yield accumulates correctly when USDs rebases
 * - getCreditBalance reflects yield
 * - getYieldEarned calculates correctly
 * - Withdrawals include accumulated yield
 * - Credit usage accounts for yield
 */
contract CreditSystemYieldTest is Test {
    X402CreditSystem public creditSystem;
    X402CreditSystem public creditSystemImpl;
    ToolRegistry public toolRegistry;
    ToolRegistry public toolRegistryImpl;
    MockUSDs public mockUSDs;

    address public owner = address(this);
    address public platformWallet = makeAddr("platform");
    address public developer = makeAddr("developer");
    address public user = makeAddr("user");

    uint256 public constant DEPOSIT_AMOUNT = 100e18; // 100 USDs
    uint256 public constant TOOL_PRICE = 1e18; // 1 USDs

    // Events
    event CreditsDeposited(address indexed user, uint256 amount, uint256 creditBalance);
    event CreditsWithdrawn(address indexed user, uint256 amount);

    function setUp() public {
        // Deploy Mock USDs
        mockUSDs = new MockUSDs();
        
        // Note: We need to deploy contracts that use mock USDs
        // This requires modifying the test setup to use mock address
        // For now, we'll use vm.mockCall with the real address
        
        address USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;
        
        // Mock USDs functions to return mock values
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
            abi.encode()
        );
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(1e18)
        );

        // Deploy ToolRegistry
        toolRegistryImpl = new ToolRegistry();
        bytes memory toolRegistryData = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            platformWallet,
            2000 // 20%
        );
        ERC1967Proxy toolRegistryProxy = new ERC1967Proxy(
            address(toolRegistryImpl),
            toolRegistryData
        );
        toolRegistry = ToolRegistry(address(toolRegistryProxy));

        // Register a test tool
        toolRegistry.registerTool("test-tool", developer, TOOL_PRICE, USDS);

        // Deploy CreditSystem
        creditSystemImpl = new X402CreditSystem();
        bytes memory creditSystemData = abi.encodeWithSelector(
            X402CreditSystem.initialize.selector,
            address(toolRegistry),
            platformWallet,
            500 // 5%
        );
        ERC1967Proxy creditSystemProxy = new ERC1967Proxy(
            address(creditSystemImpl),
            creditSystemData
        );
        creditSystem = X402CreditSystem(address(creditSystemProxy));
    }

    /*//////////////////////////////////////////////////////////////
                        YIELD ACCUMULATION TESTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Test that yield accumulates after USDs rebases
     * @dev Simulates creditsPerToken decreasing (positive yield)
     * 
     * Arrange-Act-Assert Pattern:
     * ARRANGE: Deposit funds, record initial balance
     * ACT: Simulate rebase by changing creditsPerToken
     * ASSERT: Verify balance increased
     */
    function test_YieldAccumulation_AfterPositiveRebase() public {
        // ARRANGE
        address USDS = creditSystem.USDS();
        
        // Mock deposit
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);
        
        uint256 balanceBefore = creditSystem.getCreditBalance(user);
        assertEq(balanceBefore, DEPOSIT_AMOUNT, "Initial balance should match deposit");
        
        // ACT: Simulate 5% positive rebase (creditsPerToken decreases)
        // New creditsPerToken = 0.95e18 (5% less)
        // User's credits stay the same, but balance = credits / creditsPerToken
        // So balance increases by ~5.26%
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(0.95e18) // 5% yield
        );
        
        // ASSERT
        uint256 balanceAfter = creditSystem.getCreditBalance(user);
        
        // Expected: 100e18 credits / 0.95e18 = ~105.26e18 tokens
        uint256 expectedBalance = (DEPOSIT_AMOUNT * 1e18) / 0.95e18;
        
        assertApproxEqRel(
            balanceAfter,
            expectedBalance,
            0.01e18, // 1% tolerance for rounding
            "Balance should increase after positive rebase"
        );
        
        assertGt(balanceAfter, balanceBefore, "Balance should be higher after yield");
    }

    /**
     * @notice Test getYieldEarned calculates correctly
     */
    function test_GetYieldEarned_CalculatesCorrectly() public {
        // ARRANGE
        address USDS = creditSystem.USDS();
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);
        
        // Initial yield should be 0
        uint256 initialYield = creditSystem.getYieldEarned(user);
        assertEq(initialYield, 0, "Initial yield should be zero");
        
        // ACT: Simulate 10% yield
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(0.9e18) // 10% yield (creditsPerToken decreased by 10%)
        );
        
        // ASSERT
        uint256 yieldEarned = creditSystem.getYieldEarned(user);
        
        // Expected yield: ~11.11 USDs (100/0.9 - 100 = ~11.11)
        uint256 expectedYield = (DEPOSIT_AMOUNT * 1e18 / 0.9e18) - DEPOSIT_AMOUNT;
        
        assertApproxEqRel(
            yieldEarned,
            expectedYield,
            0.01e18,
            "Yield earned should match expected"
        );
    }

    /**
     * @notice Test withdrawal includes accumulated yield
     */
    function test_Withdraw_IncludesYield() public {
        // ARRANGE
        address USDS = creditSystem.USDS();
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);
        
        // Simulate 5% yield
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(0.95e18)
        );
        
        uint256 balanceWithYield = creditSystem.getCreditBalance(user);
        
        // ACT: Withdraw full balance
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector, user, balanceWithYield),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.withdrawAll();
        
        // ASSERT
        assertEq(
            creditSystem.getCreditBalance(user),
            0,
            "Balance should be zero after withdrawAll"
        );
        
        // Verify total withdrawals includes yield
        assertGt(
            creditSystem.totalWithdrawals(),
            DEPOSIT_AMOUNT,
            "Withdrawals should be greater than deposits (includes yield)"
        );
    }

    /**
     * @notice Test partial withdrawal after yield
     */
    function test_PartialWithdraw_AfterYield() public {
        // ARRANGE
        address USDS = creditSystem.USDS();
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);
        
        // Simulate 10% yield
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(0.9e18)
        );
        
        uint256 balanceWithYield = creditSystem.getCreditBalance(user);
        uint256 withdrawAmount = 50e18;
        
        // ACT
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector, user, withdrawAmount),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.withdraw(withdrawAmount);
        
        // ASSERT
        uint256 remainingBalance = creditSystem.getCreditBalance(user);
        assertApproxEqRel(
            remainingBalance,
            balanceWithYield - withdrawAmount,
            0.01e18,
            "Remaining balance should be balance minus withdrawn"
        );
    }

    /*//////////////////////////////////////////////////////////////
                    CREDIT USAGE WITH YIELD TESTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Test using credits after yield accumulation
     */
    function test_UseCredits_AfterYieldAccumulation() public {
        // ARRANGE
        address USDS = creditSystem.USDS();
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);
        
        // Simulate yield so balance > deposit
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(0.9e18) // 10% yield
        );
        
        uint256 balanceWithYield = creditSystem.getCreditBalance(user);
        
        // Mock transfers for payment
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );
        
        // ACT: Use credits equal to original deposit + some yield
        uint256 useAmount = DEPOSIT_AMOUNT + 5e18; // Use more than original deposit
        
        vm.prank(user);
        creditSystem.useCredits("test-tool", useAmount);
        
        // ASSERT
        uint256 remainingBalance = creditSystem.getCreditBalance(user);
        assertApproxEqRel(
            remainingBalance,
            balanceWithYield - useAmount,
            0.01e18,
            "Should be able to use yield as credits"
        );
    }

    /**
     * @notice Test yield continues accumulating after credit usage
     */
    function test_YieldContinues_AfterCreditUsage() public {
        // ARRANGE
        address USDS = creditSystem.USDS();
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);
        
        // Use some credits
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.useCredits("test-tool", 10e18);
        
        uint256 balanceAfterUse = creditSystem.getCreditBalance(user);
        
        // ACT: Simulate additional yield
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(0.95e18) // 5% yield
        );
        
        // ASSERT
        uint256 balanceWithYield = creditSystem.getCreditBalance(user);
        assertGt(
            balanceWithYield,
            balanceAfterUse,
            "Remaining credits should continue earning yield"
        );
    }

    /*//////////////////////////////////////////////////////////////
                          EDGE CASE TESTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Test zero yield scenario
     */
    function test_ZeroYield_NoChange() public {
        // ARRANGE
        address USDS = creditSystem.USDS();
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);
        
        uint256 balanceBefore = creditSystem.getCreditBalance(user);
        
        // ACT: No change to creditsPerToken (no yield)
        
        // ASSERT
        uint256 balanceAfter = creditSystem.getCreditBalance(user);
        assertEq(balanceAfter, balanceBefore, "Balance should not change without rebase");
        assertEq(creditSystem.getYieldEarned(user), 0, "Yield should be zero");
    }

    /**
     * @notice Test negative yield scenario (rare but possible)
     */
    function test_NegativeYield_BalanceDecreases() public {
        // ARRANGE
        address USDS = creditSystem.USDS();
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);
        
        uint256 balanceBefore = creditSystem.getCreditBalance(user);
        
        // ACT: Simulate negative yield (creditsPerToken increases)
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(1.05e18) // 5% negative yield
        );
        
        // ASSERT
        uint256 balanceAfter = creditSystem.getCreditBalance(user);
        assertLt(balanceAfter, balanceBefore, "Balance should decrease with negative yield");
    }

    /**
     * @notice Test yield with multiple users
     */
    function test_Yield_MultipleUsers() public {
        // ARRANGE
        address USDS = creditSystem.USDS();
        address user2 = makeAddr("user2");
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        // User 1 deposits 100
        vm.prank(user);
        creditSystem.deposit(100e18);
        
        // User 2 deposits 200
        vm.prank(user2);
        creditSystem.deposit(200e18);
        
        // ACT: Simulate 10% yield
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(0.9e18)
        );
        
        // ASSERT: Both users get proportional yield
        uint256 user1Balance = creditSystem.getCreditBalance(user);
        uint256 user2Balance = creditSystem.getCreditBalance(user2);
        
        // User 1: 100 / 0.9 = ~111.11
        // User 2: 200 / 0.9 = ~222.22
        assertApproxEqRel(user1Balance, 111.11e18, 0.01e18, "User 1 yield incorrect");
        assertApproxEqRel(user2Balance, 222.22e18, 0.01e18, "User 2 yield incorrect");
        
        // Ratio should be preserved (1:2)
        assertApproxEqRel(
            user2Balance * 1e18 / user1Balance,
            2e18,
            0.01e18,
            "Yield ratio should be preserved"
        );
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Fuzz test: yield calculation with various rebase rates
     */
    function testFuzz_YieldCalculation(uint256 depositAmount, uint256 yieldBps) public {
        // Bound inputs
        depositAmount = bound(depositAmount, 1e18, 1_000_000e18); // 1 to 1M USDs
        yieldBps = bound(yieldBps, 1, 5000); // 0.01% to 50% yield
        
        // ARRANGE
        address USDS = creditSystem.USDS();
        
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        creditSystem.deposit(depositAmount);
        
        // ACT: Apply yield
        uint256 newCreditsPerToken = (1e18 * 10000) / (10000 + yieldBps);
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("creditsPerToken()"))),
            abi.encode(newCreditsPerToken)
        );
        
        // ASSERT
        uint256 balanceAfter = creditSystem.getCreditBalance(user);
        
        // Balance should increase
        assertGe(balanceAfter, depositAmount, "Balance should not decrease with positive yield");
        
        // Yield should be reasonable (not more than expected from bps)
        uint256 maxExpectedYield = (depositAmount * yieldBps * 2) / 10000; // 2x for safety
        assertLe(
            balanceAfter - depositAmount,
            maxExpectedYield,
            "Yield should not exceed expected maximum"
        );
    }
}
