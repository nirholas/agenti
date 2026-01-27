// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/X402PaymentChannel.sol";
import "../src/interfaces/IUSDs.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title PaymentChannelTest
 * @notice Comprehensive tests for the X402PaymentChannel contract
 */
contract PaymentChannelTest is Test {
    X402PaymentChannel public channel;
    X402PaymentChannel public channelImpl;

    address public owner = address(this);
    address public sender = makeAddr("sender");
    address public recipient = makeAddr("recipient");
    address public keeper = makeAddr("keeper");

    uint256 public senderPrivateKey = 0x1234;
    uint256 public recipientPrivateKey = 0x5678;

    // USDs address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    // Test amounts
    uint256 public constant DEPOSIT_AMOUNT = 100e18; // 100 USDs
    uint256 public constant PAYMENT_AMOUNT = 10e18;  // 10 USDs

    // Events
    event ChannelOpened(
        bytes32 indexed channelId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 deposit
    );
    event PaymentIncremented(bytes32 indexed channelId, uint256 amount, uint256 nonce);
    event ChannelClosed(bytes32 indexed channelId, uint256 senderAmount, uint256 recipientAmount);
    event DisputeRaised(bytes32 indexed channelId, address indexed disputer, uint256 claimedAmount);

    function setUp() public {
        // Create sender/recipient with known private keys for signing
        sender = vm.addr(senderPrivateKey);
        recipient = vm.addr(recipientPrivateKey);

        // Mock USDs rebaseOptIn - must happen before proxy deployment
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
            abi.encode()
        );

        // Deploy implementation
        channelImpl = new X402PaymentChannel();

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(X402PaymentChannel.initialize.selector);
        ERC1967Proxy proxy = new ERC1967Proxy(address(channelImpl), initData);
        channel = X402PaymentChannel(address(proxy));

        // Fund sender
        vm.deal(sender, 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Initialize() public view {
        assertEq(channel.owner(), owner);
        assertTrue(channel.supportedTokens(USDS));
        assertEq(channel.totalChannels(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                        CHANNEL OPENING TESTS
    //////////////////////////////////////////////////////////////*/

    function test_OpenChannel() public {
        _mockTokenTransfer(sender, address(channel), DEPOSIT_AMOUNT);

        vm.prank(sender);
        bytes32 channelId = channel.openChannel(recipient, USDS, DEPOSIT_AMOUNT);

        assertNotEq(channelId, bytes32(0));
        assertEq(channel.totalChannels(), 1);
        assertEq(channel.totalValueLocked(), DEPOSIT_AMOUNT);

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(ch.sender, sender);
        assertEq(ch.recipient, recipient);
        assertEq(ch.token, USDS);
        assertEq(ch.deposit, DEPOSIT_AMOUNT);
        assertEq(ch.withdrawn, 0);
        assertEq(ch.nonce, 0);
        assertEq(uint256(ch.state), uint256(IX402PaymentChannel.ChannelState.Open));
    }

    function test_OpenChannel_RevertInvalidRecipient() public {
        vm.prank(sender);
        vm.expectRevert(IX402Common.InvalidAddress.selector);
        channel.openChannel(address(0), USDS, DEPOSIT_AMOUNT);
    }

    function test_OpenChannel_RevertSelfChannel() public {
        vm.prank(sender);
        vm.expectRevert(IX402Common.InvalidAddress.selector);
        channel.openChannel(sender, USDS, DEPOSIT_AMOUNT);
    }

    function test_OpenChannel_RevertZeroDeposit() public {
        vm.prank(sender);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        channel.openChannel(recipient, USDS, 0);
    }

    function test_OpenChannel_RevertUnsupportedToken() public {
        address fakeToken = makeAddr("fakeToken");
        vm.prank(sender);
        vm.expectRevert(IX402Common.NotAllowed.selector);
        channel.openChannel(recipient, fakeToken, DEPOSIT_AMOUNT);
    }

    function test_OpenChannelWithCustomPeriod() public {
        _mockTokenTransfer(sender, address(channel), DEPOSIT_AMOUNT);

        uint256 customPeriod = 2 days;

        vm.prank(sender);
        bytes32 channelId = channel.openChannelWithPeriod(recipient, USDS, DEPOSIT_AMOUNT, customPeriod);

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(ch.challengePeriod, customPeriod);
    }

    function test_TopUpChannel() public {
        _mockTokenTransfer(sender, address(channel), DEPOSIT_AMOUNT);

        vm.prank(sender);
        bytes32 channelId = channel.openChannel(recipient, USDS, DEPOSIT_AMOUNT);

        uint256 topUpAmount = 50e18;
        _mockTokenTransfer(sender, address(channel), topUpAmount);

        vm.prank(sender);
        channel.topUpChannel(channelId, topUpAmount);

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(ch.deposit, DEPOSIT_AMOUNT + topUpAmount);
        assertEq(channel.totalValueLocked(), DEPOSIT_AMOUNT + topUpAmount);
    }

    /*//////////////////////////////////////////////////////////////
                        PAYMENT INCREMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_IncrementPayment() public {
        bytes32 channelId = _openTestChannel();

        // Create signature
        bytes32 paymentHash = channel.getPaymentHash(channelId, PAYMENT_AMOUNT, 1);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(senderPrivateKey, paymentHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Mock token transfer to recipient
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector, recipient, PAYMENT_AMOUNT),
            abi.encode(true)
        );

        vm.prank(recipient);
        channel.incrementPayment(channelId, PAYMENT_AMOUNT, signature);

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(ch.withdrawn, PAYMENT_AMOUNT);
        assertEq(ch.nonce, 1);
    }

    function test_IncrementPayment_RevertInvalidSignature() public {
        bytes32 channelId = _openTestChannel();

        // Create signature with wrong private key
        bytes32 paymentHash = channel.getPaymentHash(channelId, PAYMENT_AMOUNT, 1);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(recipientPrivateKey, paymentHash); // Wrong key
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(recipient);
        vm.expectRevert(IX402Common.InvalidSignature.selector);
        channel.incrementPayment(channelId, PAYMENT_AMOUNT, signature);
    }

    function test_IncrementPayment_RevertExceedsDeposit() public {
        bytes32 channelId = _openTestChannel();

        uint256 tooMuch = DEPOSIT_AMOUNT + 1;
        bytes32 paymentHash = channel.getPaymentHash(channelId, tooMuch, 1);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(senderPrivateKey, paymentHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(recipient);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        channel.incrementPayment(channelId, tooMuch, signature);
    }

    function test_MultipleIncrements() public {
        bytes32 channelId = _openTestChannel();

        // First increment
        uint256 amount1 = 10e18;
        bytes32 hash1 = channel.getPaymentHash(channelId, amount1, 1);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(senderPrivateKey, hash1);

        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        vm.prank(recipient);
        channel.incrementPayment(channelId, amount1, abi.encodePacked(r1, s1, v1));

        // Second increment (cumulative)
        uint256 amount2 = 25e18;
        bytes32 hash2 = channel.getPaymentHash(channelId, amount2, 2);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(senderPrivateKey, hash2);

        vm.prank(recipient);
        channel.incrementPayment(channelId, amount2, abi.encodePacked(r2, s2, v2));

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(ch.withdrawn, amount2);
        assertEq(ch.nonce, 2);
    }

    /*//////////////////////////////////////////////////////////////
                        CHANNEL CLOSING TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CloseChannelCooperative() public {
        bytes32 channelId = _openTestChannel();

        uint256 finalAmount = 50e18;

        // Create close hash
        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        bytes32 closeHash = channel.getCloseHash(channelId, finalAmount, ch.nonce);

        // Both parties sign
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(senderPrivateKey, closeHash);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(recipientPrivateKey, closeHash);

        bytes memory signatures = abi.encodePacked(r1, s1, v1, r2, s2, v2);

        // Mock transfers
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        vm.prank(sender);
        channel.closeChannel(channelId, finalAmount, signatures);

        ch = channel.getChannel(channelId);
        assertEq(uint256(ch.state), uint256(IX402PaymentChannel.ChannelState.Closed));
    }

    function test_InitiateClose() public {
        bytes32 channelId = _openTestChannel();

        uint256 claimedAmount = 30e18;

        // Sender signs payment state
        bytes32 paymentHash = channel.getPaymentHash(channelId, claimedAmount, 0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(senderPrivateKey, paymentHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(recipient);
        channel.initiateClose(channelId, claimedAmount, signature);

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(uint256(ch.state), uint256(IX402PaymentChannel.ChannelState.Closing));
        assertEq(ch.withdrawn, claimedAmount);
        assertGt(ch.closingTime, 0);
    }

    function test_ChallengeClose() public {
        bytes32 channelId = _openTestChannel();

        // Initiate close with old state
        uint256 oldAmount = 20e18;
        bytes32 oldHash = channel.getPaymentHash(channelId, oldAmount, 0);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(senderPrivateKey, oldHash);

        vm.prank(recipient);
        channel.initiateClose(channelId, oldAmount, abi.encodePacked(r1, s1, v1));

        // Challenge with newer state
        uint256 newAmount = 40e18;
        uint256 newNonce = 5;
        bytes32 newHash = channel.getPaymentHash(channelId, newAmount, newNonce);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(senderPrivateKey, newHash);

        vm.prank(sender);
        channel.challengeClose(channelId, newAmount, newNonce, abi.encodePacked(r2, s2, v2));

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(ch.nonce, newNonce);
        assertEq(ch.withdrawn, newAmount);
    }

    function test_FinalizeClose() public {
        bytes32 channelId = _openTestChannel();

        // Initiate close
        uint256 claimedAmount = 30e18;
        bytes32 paymentHash = channel.getPaymentHash(channelId, claimedAmount, 0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(senderPrivateKey, paymentHash);

        vm.prank(recipient);
        channel.initiateClose(channelId, claimedAmount, abi.encodePacked(r, s, v));

        // Wait for challenge period
        vm.warp(block.timestamp + 25 hours);

        // Mock transfers
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        channel.finalizeClose(channelId);

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(uint256(ch.state), uint256(IX402PaymentChannel.ChannelState.Closed));
    }

    function test_FinalizeClose_RevertBeforeChallengePeriod() public {
        bytes32 channelId = _openTestChannel();

        // Initiate close
        uint256 claimedAmount = 30e18;
        bytes32 paymentHash = channel.getPaymentHash(channelId, claimedAmount, 0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(senderPrivateKey, paymentHash);

        vm.prank(recipient);
        channel.initiateClose(channelId, claimedAmount, abi.encodePacked(r, s, v));

        // Try to finalize too early
        vm.warp(block.timestamp + 12 hours); // Only 12 hours, need 24

        vm.expectRevert(IX402Common.NotAllowed.selector);
        channel.finalizeClose(channelId);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetAvailableBalance() public {
        bytes32 channelId = _openTestChannel();

        assertEq(channel.getAvailableBalance(channelId), DEPOSIT_AMOUNT);

        // Simulate withdrawal
        uint256 withdrawn = 30e18;
        bytes32 paymentHash = channel.getPaymentHash(channelId, withdrawn, 1);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(senderPrivateKey, paymentHash);

        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        vm.prank(recipient);
        channel.incrementPayment(channelId, withdrawn, abi.encodePacked(r, s, v));

        assertEq(channel.getAvailableBalance(channelId), DEPOSIT_AMOUNT - withdrawn);
    }

    function test_GetUserChannels() public {
        _mockTokenTransfer(sender, address(channel), DEPOSIT_AMOUNT);

        vm.prank(sender);
        bytes32 channel1 = channel.openChannel(recipient, USDS, DEPOSIT_AMOUNT);

        address recipient2 = makeAddr("recipient2");
        _mockTokenTransfer(sender, address(channel), DEPOSIT_AMOUNT);

        vm.prank(sender);
        bytes32 channel2 = channel.openChannel(recipient2, USDS, DEPOSIT_AMOUNT);

        bytes32[] memory senderChannels = channel.getUserChannels(sender);
        assertEq(senderChannels.length, 2);
        assertEq(senderChannels[0], channel1);
        assertEq(senderChannels[1], channel2);

        bytes32[] memory recipientChannels = channel.getUserChannels(recipient);
        assertEq(recipientChannels.length, 1);
        assertEq(recipientChannels[0], channel1);
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AddSupportedToken() public {
        address newToken = makeAddr("newToken");

        channel.addSupportedToken(newToken);
        assertTrue(channel.supportedTokens(newToken));
    }

    function test_Pause() public {
        channel.pause();
        assertTrue(channel.paused());

        _mockTokenTransfer(sender, address(channel), DEPOSIT_AMOUNT);

        vm.prank(sender);
        vm.expectRevert();
        channel.openChannel(recipient, USDS, DEPOSIT_AMOUNT);
    }

    /*//////////////////////////////////////////////////////////////
                            HELPERS
    //////////////////////////////////////////////////////////////*/

    function _openTestChannel() internal returns (bytes32) {
        _mockTokenTransfer(sender, address(channel), DEPOSIT_AMOUNT);

        vm.prank(sender);
        return channel.openChannel(recipient, USDS, DEPOSIT_AMOUNT);
    }

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

    function testFuzz_OpenChannel(uint256 deposit) public {
        vm.assume(deposit > 0);
        vm.assume(deposit < type(uint128).max);

        _mockTokenTransfer(sender, address(channel), deposit);

        vm.prank(sender);
        bytes32 channelId = channel.openChannel(recipient, USDS, deposit);

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(ch.deposit, deposit);
    }

    function testFuzz_IncrementPayment(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= DEPOSIT_AMOUNT);

        bytes32 channelId = _openTestChannel();

        bytes32 paymentHash = channel.getPaymentHash(channelId, amount, 1);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(senderPrivateKey, paymentHash);

        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        vm.prank(recipient);
        channel.incrementPayment(channelId, amount, abi.encodePacked(r, s, v));

        IX402PaymentChannel.Channel memory ch = channel.getChannel(channelId);
        assertEq(ch.withdrawn, amount);
    }
}
