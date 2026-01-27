// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/X402Subscription.sol";
import "../src/interfaces/IUSDs.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title SubscriptionTest
 * @notice Comprehensive tests for the X402Subscription contract
 */
contract SubscriptionTest is Test {
    X402Subscription public subscription;
    X402Subscription public subscriptionImpl;

    address public owner = address(this);
    address public subscriber = makeAddr("subscriber");
    address public recipient = makeAddr("recipient");
    address public keeper = makeAddr("keeper");

    // USDs address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    // Test amounts
    uint256 public constant DEPOSIT_AMOUNT = 1000e18; // 1000 USDs
    uint256 public constant SUBSCRIPTION_AMOUNT = 10e18; // 10 USDs per interval
    uint256 public constant INTERVAL = 1 days;

    // Mock creditsPerToken (1:1 for simplicity)
    uint256 public constant CREDITS_PER_TOKEN = 1e18;

    // Events
    event SubscriptionCreated(
        uint256 indexed subscriptionId,
        address indexed subscriber,
        address indexed recipient,
        uint256 amount,
        uint256 interval
    );
    event SubscriptionPayment(uint256 indexed subscriptionId, uint256 amount, uint256 timestamp);
    event SubscriptionCancelled(uint256 indexed subscriptionId);
    event Deposited(address indexed subscriber, uint256 amount);
    event Withdrawn(address indexed subscriber, uint256 amount);

    function setUp() public {
        // Mock USDs - must happen before proxy deployment
        _mockUSDs();

        // Deploy implementation
        subscriptionImpl = new X402Subscription();

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(X402Subscription.initialize.selector);
        ERC1967Proxy proxy = new ERC1967Proxy(address(subscriptionImpl), initData);
        subscription = X402Subscription(address(proxy));
    }

    function _mockUSDs() internal {
        // Mock rebaseOptIn - use explicit selector for no-params version
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
            abi.encode()
        );

        // Mock creditsPerToken
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IUSDs.creditsPerToken.selector),
            abi.encode(CREDITS_PER_TOKEN)
        );
    }

    /*//////////////////////////////////////////////////////////////
                          INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Initialize() public view {
        assertEq(subscription.owner(), owner);
        assertTrue(subscription.supportedTokens(USDS));
        assertEq(subscription.subscriptionCounter(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            DEPOSIT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DepositFunds() public {
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector, subscriber, address(subscription), DEPOSIT_AMOUNT),
            abi.encode(true)
        );

        vm.prank(subscriber);
        subscription.depositFunds(DEPOSIT_AMOUNT);

        assertEq(subscription.deposits(subscriber), DEPOSIT_AMOUNT);
    }

    function test_DepositFunds_RevertZeroAmount() public {
        vm.prank(subscriber);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        subscription.depositFunds(0);
    }

    function test_WithdrawFunds() public {
        // First deposit
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );

        vm.prank(subscriber);
        subscription.depositFunds(DEPOSIT_AMOUNT);

        // Then withdraw
        uint256 withdrawAmount = 500e18;
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector, subscriber, withdrawAmount),
            abi.encode(true)
        );

        vm.prank(subscriber);
        subscription.withdrawFunds(withdrawAmount);
    }

    /*//////////////////////////////////////////////////////////////
                        SUBSCRIPTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CreateSubscription() public {
        vm.expectEmit(true, true, true, true);
        emit SubscriptionCreated(1, subscriber, recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        assertEq(subId, 1);
        assertEq(subscription.subscriptionCounter(), 1);
        assertEq(subscription.activeSubscriptions(), 1);

        IX402Subscription.Subscription memory sub = subscription.getSubscription(subId);
        assertEq(sub.subscriber, subscriber);
        assertEq(sub.recipient, recipient);
        assertEq(sub.amount, SUBSCRIPTION_AMOUNT);
        assertEq(sub.interval, INTERVAL);
        assertEq(uint256(sub.status), uint256(IX402Subscription.SubscriptionStatus.Active));
    }

    function test_CreateSubscription_RevertInvalidRecipient() public {
        vm.prank(subscriber);
        vm.expectRevert(IX402Common.InvalidAddress.selector);
        subscription.createSubscription(address(0), SUBSCRIPTION_AMOUNT, INTERVAL);
    }

    function test_CreateSubscription_RevertSelfSubscription() public {
        vm.prank(subscriber);
        vm.expectRevert(IX402Common.InvalidAddress.selector);
        subscription.createSubscription(subscriber, SUBSCRIPTION_AMOUNT, INTERVAL);
    }

    function test_CreateSubscription_RevertZeroAmount() public {
        vm.prank(subscriber);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        subscription.createSubscription(recipient, 0, INTERVAL);
    }

    function test_CreateSubscription_RevertInvalidInterval() public {
        // Too short
        vm.prank(subscriber);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, 30 minutes);

        // Too long
        vm.prank(subscriber);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, 400 days);
    }

    function test_CancelSubscription() public {
        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        vm.expectEmit(true, true, true, true);
        emit SubscriptionCancelled(subId);

        vm.prank(subscriber);
        subscription.cancelSubscription(subId);

        IX402Subscription.Subscription memory sub = subscription.getSubscription(subId);
        assertEq(uint256(sub.status), uint256(IX402Subscription.SubscriptionStatus.Cancelled));
        assertEq(subscription.activeSubscriptions(), 0);
    }

    function test_CancelSubscription_RevertNotSubscriber() public {
        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        vm.prank(recipient);
        vm.expectRevert(IX402Common.Unauthorized.selector);
        subscription.cancelSubscription(subId);
    }

    function test_PauseResumeSubscription() public {
        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        // Pause
        vm.prank(subscriber);
        subscription.pauseSubscription(subId);

        IX402Subscription.Subscription memory sub = subscription.getSubscription(subId);
        assertEq(uint256(sub.status), uint256(IX402Subscription.SubscriptionStatus.Paused));

        // Resume
        vm.prank(subscriber);
        subscription.resumeSubscription(subId);

        sub = subscription.getSubscription(subId);
        assertEq(uint256(sub.status), uint256(IX402Subscription.SubscriptionStatus.Active));
    }

    function test_UpdateSubscriptionAmount() public {
        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        uint256 newAmount = 20e18;
        vm.prank(subscriber);
        subscription.updateSubscriptionAmount(subId, newAmount);

        IX402Subscription.Subscription memory sub = subscription.getSubscription(subId);
        assertEq(sub.amount, newAmount);
    }

    /*//////////////////////////////////////////////////////////////
                        EXECUTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ExecuteSubscription() public {
        // Setup: deposit funds and create subscription
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );

        vm.prank(subscriber);
        subscription.depositFunds(DEPOSIT_AMOUNT);

        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        // Wait for interval
        vm.warp(block.timestamp + INTERVAL + 1);

        // Mock transfers
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        // Execute by keeper
        vm.prank(keeper);
        subscription.executeSubscription(subId);

        IX402Subscription.Subscription memory sub = subscription.getSubscription(subId);
        assertEq(sub.paymentCount, 1);
        assertEq(sub.totalPaid, SUBSCRIPTION_AMOUNT);
    }

    function test_ExecuteSubscription_RevertTooEarly() public {
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );

        vm.prank(subscriber);
        subscription.depositFunds(DEPOSIT_AMOUNT);

        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        // Try to execute before interval
        vm.prank(keeper);
        vm.expectRevert(IX402Common.NotAllowed.selector);
        subscription.executeSubscription(subId);
    }

    function test_ExecuteSubscription_RevertInsufficientFunds() public {
        // Create subscription without depositing
        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        // Wait for interval
        vm.warp(block.timestamp + INTERVAL + 1);

        // Try to execute without funds
        vm.prank(keeper);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        subscription.executeSubscription(subId);
    }

    function test_BatchExecuteSubscriptions() public {
        // Setup multiple subscriptions
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );

        vm.prank(subscriber);
        subscription.depositFunds(DEPOSIT_AMOUNT);

        vm.prank(subscriber);
        uint256 subId1 = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        address recipient2 = makeAddr("recipient2");
        vm.prank(subscriber);
        uint256 subId2 = subscription.createSubscription(recipient2, SUBSCRIPTION_AMOUNT, INTERVAL);

        // Wait for interval
        vm.warp(block.timestamp + INTERVAL + 1);

        // Mock transfers
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        // Batch execute
        uint256[] memory subIds = new uint256[](2);
        subIds[0] = subId1;
        subIds[1] = subId2;

        vm.prank(keeper);
        subscription.batchExecuteSubscriptions(subIds);

        IX402Subscription.Subscription memory sub1 = subscription.getSubscription(subId1);
        IX402Subscription.Subscription memory sub2 = subscription.getSubscription(subId2);
        assertEq(sub1.paymentCount, 1);
        assertEq(sub2.paymentCount, 1);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CanExecute() public {
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );

        vm.prank(subscriber);
        subscription.depositFunds(DEPOSIT_AMOUNT);

        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        // Before interval
        assertFalse(subscription.canExecute(subId));

        // After interval
        vm.warp(block.timestamp + INTERVAL + 1);
        assertTrue(subscription.canExecute(subId));
    }

    function test_GetSubscriberSubscriptions() public {
        vm.prank(subscriber);
        subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        address recipient2 = makeAddr("recipient2");
        vm.prank(subscriber);
        subscription.createSubscription(recipient2, SUBSCRIPTION_AMOUNT, INTERVAL);

        uint256[] memory subs = subscription.getSubscriberSubscriptions(subscriber);
        assertEq(subs.length, 2);
        assertEq(subs[0], 1);
        assertEq(subs[1], 2);
    }

    function test_GetRecipientSubscriptions() public {
        vm.prank(subscriber);
        subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);

        address subscriber2 = makeAddr("subscriber2");
        vm.prank(subscriber2);
        subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT * 2, INTERVAL);

        uint256[] memory subs = subscription.getRecipientSubscriptions(recipient);
        assertEq(subs.length, 2);
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AddSupportedToken() public {
        address newToken = makeAddr("newToken");

        subscription.addSupportedToken(newToken);
        assertTrue(subscription.supportedTokens(newToken));
    }

    function test_Pause() public {
        subscription.pause();
        assertTrue(subscription.paused());

        vm.prank(subscriber);
        vm.expectRevert();
        subscription.createSubscription(recipient, SUBSCRIPTION_AMOUNT, INTERVAL);
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_CreateSubscription(uint256 amount, uint256 interval) public {
        vm.assume(amount > 0);
        vm.assume(interval >= 1 hours);
        vm.assume(interval <= 365 days);

        vm.prank(subscriber);
        uint256 subId = subscription.createSubscription(recipient, amount, interval);

        IX402Subscription.Subscription memory sub = subscription.getSubscription(subId);
        assertEq(sub.amount, amount);
        assertEq(sub.interval, interval);
    }
}
