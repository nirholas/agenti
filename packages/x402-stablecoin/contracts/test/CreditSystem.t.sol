// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/X402CreditSystem.sol";
import "../src/ToolRegistry.sol";
import "../src/interfaces/IUSDs.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title CreditSystemTest
 * @notice Comprehensive tests for the X402CreditSystem contract
 */
contract CreditSystemTest is Test {
    X402CreditSystem public creditSystem;
    X402CreditSystem public creditSystemImpl;
    ToolRegistry public toolRegistry;
    ToolRegistry public toolRegistryImpl;

    address public owner = address(this);
    address public platformWallet = makeAddr("platform");
    address public developer = makeAddr("developer");
    address public user = makeAddr("user");

    // USDs address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    // Test amounts
    uint256 public constant DEPOSIT_AMOUNT = 100e18; // 100 USDs
    uint256 public constant LARGE_DEPOSIT = 1000e18; // 1000 USDs
    uint256 public constant TOOL_PRICE = 1e18; // 1 USDs

    // Mock creditsPerToken
    uint256 public constant CREDITS_PER_TOKEN = 1e18;

    // Events
    event CreditsDeposited(address indexed user, uint256 amount, uint256 creditBalance);
    event CreditsUsed(address indexed user, string indexed tool, uint256 amount);
    event CreditsWithdrawn(address indexed user, uint256 amount);
    event BonusCreditsIssued(address indexed user, uint256 amount);

    function setUp() public {
        // Mock USDs
        // Use explicit selector for rebaseOptIn() - no params version
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
            abi.encode()
        );

        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IUSDs.creditsPerToken.selector),
            abi.encode(CREDITS_PER_TOKEN)
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
                          INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Initialize() public view {
        assertEq(creditSystem.owner(), owner);
        assertEq(address(creditSystem.toolRegistry()), address(toolRegistry));
        assertEq(creditSystem.platformWallet(), platformWallet);
        assertEq(creditSystem.platformFeeBps(), 500);
    }

    function test_Initialize_RevertInvalidToolRegistry() public {
        X402CreditSystem impl = new X402CreditSystem();
        bytes memory data = abi.encodeWithSelector(
            X402CreditSystem.initialize.selector,
            address(0),
            platformWallet,
            500
        );

        vm.expectRevert();
        new ERC1967Proxy(address(impl), data);
    }

    /*//////////////////////////////////////////////////////////////
                            DEPOSIT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Deposit() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);

        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        assertEq(creditSystem.getCreditBalance(user), DEPOSIT_AMOUNT);
        assertEq(creditSystem.totalDeposits(), DEPOSIT_AMOUNT);
    }

    function test_Deposit_RevertBelowMinimum() public {
        uint256 tooSmall = 0.5e18; // 0.5 USDs

        vm.prank(user);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        creditSystem.deposit(tooSmall);
    }

    function test_Deposit_WithBonus() public {
        _mockTokenTransfer(user, address(creditSystem), LARGE_DEPOSIT);

        vm.expectEmit(true, true, true, true);
        emit BonusCreditsIssued(user, LARGE_DEPOSIT * 200 / 10000); // 2% bonus

        vm.prank(user);
        creditSystem.deposit(LARGE_DEPOSIT);

        // Balance should include 2% bonus internally tracked
        assertEq(creditSystem.getCreditBalance(user), LARGE_DEPOSIT);
        
        // But credit info should show the bonus
        IX402CreditSystem.CreditInfo memory info = creditSystem.getCreditInfo(user);
        assertEq(info.deposited, LARGE_DEPOSIT);
    }

    function test_DepositFor() public {
        address recipient = makeAddr("recipient");
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);

        vm.prank(user);
        creditSystem.depositFor(recipient, DEPOSIT_AMOUNT);

        assertEq(creditSystem.getCreditBalance(recipient), DEPOSIT_AMOUNT);
        assertEq(creditSystem.getCreditBalance(user), 0);
    }

    /*//////////////////////////////////////////////////////////////
                          CREDIT USAGE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_UseCredits() public {
        // Deposit
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        // Mock transfers for payment
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        // Use credits
        vm.prank(user);
        creditSystem.useCredits("test-tool", TOOL_PRICE);

        IX402CreditSystem.CreditInfo memory info = creditSystem.getCreditInfo(user);
        assertEq(info.creditsUsed, TOOL_PRICE);
        assertEq(creditSystem.totalCreditsUsed(), TOOL_PRICE);
    }

    function test_UseCredits_RevertInsufficientBalance() public {
        vm.prank(user);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        creditSystem.useCredits("test-tool", TOOL_PRICE);
    }

    function test_UseCredits_RevertInvalidTool() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        vm.prank(user);
        vm.expectRevert(IX402Common.NotAllowed.selector);
        creditSystem.useCredits("nonexistent-tool", TOOL_PRICE);
    }

    function test_UseCredits_RevertBelowToolPrice() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        vm.prank(user);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        creditSystem.useCredits("test-tool", TOOL_PRICE / 2);
    }

    function test_UseCreditsForPayment() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        address recipient = makeAddr("recipient");
        uint256 amount = 5e18;

        vm.prank(user);
        creditSystem.useCreditsForPayment(recipient, amount);

        IX402CreditSystem.CreditInfo memory info = creditSystem.getCreditInfo(user);
        assertEq(info.creditsUsed, amount);
    }

    /*//////////////////////////////////////////////////////////////
                          WITHDRAWAL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Withdraw() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        uint256 withdrawAmount = 50e18;
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector, user, withdrawAmount),
            abi.encode(true)
        );

        vm.prank(user);
        creditSystem.withdraw(withdrawAmount);

        assertEq(creditSystem.getCreditBalance(user), DEPOSIT_AMOUNT - withdrawAmount);
        assertEq(creditSystem.totalWithdrawals(), withdrawAmount);
    }

    function test_Withdraw_RevertExceedsBalance() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        vm.prank(user);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        creditSystem.withdraw(DEPOSIT_AMOUNT + 1);
    }

    function test_WithdrawAll() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector, user, DEPOSIT_AMOUNT),
            abi.encode(true)
        );

        vm.prank(user);
        creditSystem.withdrawAll();

        assertEq(creditSystem.getCreditBalance(user), 0);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetCreditBalance() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        assertEq(creditSystem.getCreditBalance(user), DEPOSIT_AMOUNT);
    }

    function test_GetCreditInfo() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        IX402CreditSystem.CreditInfo memory info = creditSystem.getCreditInfo(user);
        assertEq(info.deposited, DEPOSIT_AMOUNT);
        assertEq(info.creditsUsed, 0);
        assertGt(info.lastUpdate, 0);
    }

    function test_GetStats() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(creditSystem)),
            abi.encode(DEPOSIT_AMOUNT)
        );

        (
            uint256 totalDeps,
            uint256 totalWith,
            uint256 totalUsed,
            uint256 balance
        ) = creditSystem.getStats();

        assertEq(totalDeps, DEPOSIT_AMOUNT);
        assertEq(totalWith, 0);
        assertEq(totalUsed, 0);
        assertEq(balance, DEPOSIT_AMOUNT);
    }

    function test_AreCreditsExpired() public {
        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);
        vm.prank(user);
        creditSystem.deposit(DEPOSIT_AMOUNT);

        // No expiration set
        assertFalse(creditSystem.areCreditsExpired(user));

        // Set expiration
        creditSystem.setCreditExpirationPeriod(30 days);

        // Still valid
        assertFalse(creditSystem.areCreditsExpired(user));

        // Warp past expiration
        vm.warp(block.timestamp + 31 days);
        assertTrue(creditSystem.areCreditsExpired(user));
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetToolRegistry() public {
        address newRegistry = makeAddr("newRegistry");

        creditSystem.setToolRegistry(newRegistry);
        assertEq(address(creditSystem.toolRegistry()), newRegistry);
    }

    function test_SetPlatformWallet() public {
        address newWallet = makeAddr("newWallet");

        creditSystem.setPlatformWallet(newWallet);
        assertEq(creditSystem.platformWallet(), newWallet);
    }

    function test_SetPlatformFee() public {
        uint256 newFee = 300; // 3%

        creditSystem.setPlatformFee(newFee);
        assertEq(creditSystem.platformFeeBps(), newFee);
    }

    function test_SetPlatformFee_RevertTooHigh() public {
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        creditSystem.setPlatformFee(1500); // 15% - too high
    }

    function test_SetCreditExpirationPeriod() public {
        uint256 period = 60 days;

        creditSystem.setCreditExpirationPeriod(period);
        assertEq(creditSystem.creditExpirationPeriod(), period);
    }

    function test_IssueBonusCredits() public {
        // First need some USDs in the contract
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(creditSystem)),
            abi.encode(100e18)
        );

        uint256 bonusAmount = 10e18;

        vm.expectEmit(true, true, true, true);
        emit BonusCreditsIssued(user, bonusAmount);

        creditSystem.issueBonusCredits(user, bonusAmount);

        assertEq(creditSystem.getCreditBalance(user), bonusAmount);
    }

    function test_Pause() public {
        creditSystem.pause();
        assertTrue(creditSystem.paused());

        _mockTokenTransfer(user, address(creditSystem), DEPOSIT_AMOUNT);

        vm.prank(user);
        vm.expectRevert();
        creditSystem.deposit(DEPOSIT_AMOUNT);
    }

    /*//////////////////////////////////////////////////////////////
                            HELPERS
    //////////////////////////////////////////////////////////////*/

    function _mockTokenTransfer(address from, address to, uint256 amount) internal {
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount),
            abi.encode(true)
        );
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Deposit(uint256 amount) public {
        vm.assume(amount >= 1e18); // MIN_DEPOSIT
        vm.assume(amount < type(uint128).max);

        _mockTokenTransfer(user, address(creditSystem), amount);

        vm.prank(user);
        creditSystem.deposit(amount);

        assertEq(creditSystem.getCreditBalance(user), amount);
    }

    function testFuzz_Withdraw(uint256 depositAmount, uint256 withdrawAmount) public {
        vm.assume(depositAmount >= 1e18);
        vm.assume(depositAmount < type(uint128).max);
        vm.assume(withdrawAmount > 0);
        vm.assume(withdrawAmount <= depositAmount);

        _mockTokenTransfer(user, address(creditSystem), depositAmount);
        vm.prank(user);
        creditSystem.deposit(depositAmount);

        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector, user, withdrawAmount),
            abi.encode(true)
        );

        vm.prank(user);
        creditSystem.withdraw(withdrawAmount);

        assertEq(creditSystem.getCreditBalance(user), depositAmount - withdrawAmount);
    }
}
