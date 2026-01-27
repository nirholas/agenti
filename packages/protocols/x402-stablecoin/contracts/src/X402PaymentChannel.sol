// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./interfaces/IX402.sol";
import "./interfaces/IUSDs.sol";

/**
 * @title X402PaymentChannel
 * @author X402 Protocol
 * @notice State channels for streaming micro-payments between AI agents and tools
 * @dev Implements bidirectional payment channels with dispute resolution
 * 
 * Features:
 * - Open channels with USDs deposits
 * - Off-chain payment increments with signatures
 * - Cooperative and unilateral channel closing
 * - Dispute resolution with challenge period
 * - USDs yield accumulation during channel lifetime
 * 
 * Security:
 * - EIP-712 typed signatures
 * - Reentrancy protection
 * - Challenge period for disputes
 * - Nonce-based replay protection
 */
contract X402PaymentChannel is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable,
    UUPSUpgradeable,
    EIP712Upgradeable,
    IX402PaymentChannel
{
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice USDs token address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    /// @notice Default challenge period (24 hours)
    uint256 public constant DEFAULT_CHALLENGE_PERIOD = 24 hours;

    /// @notice Minimum challenge period (1 hour)
    uint256 public constant MIN_CHALLENGE_PERIOD = 1 hours;

    /// @notice Maximum challenge period (7 days)
    uint256 public constant MAX_CHALLENGE_PERIOD = 7 days;

    /// @notice Payment increment typehash for EIP-712
    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "PaymentIncrement(bytes32 channelId,uint256 amount,uint256 nonce)"
    );

    /// @notice Close channel typehash for EIP-712
    bytes32 public constant CLOSE_TYPEHASH = keccak256(
        "CloseChannel(bytes32 channelId,uint256 finalAmount,uint256 nonce)"
    );

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping of channel ID to channel info
    mapping(bytes32 => Channel) public channels;

    /// @notice Mapping of user to their channel IDs
    mapping(address => bytes32[]) public userChannels;

    /// @notice Total number of channels
    uint256 public totalChannels;

    /// @notice Total value locked in channels
    uint256 public totalValueLocked;

    /// @notice Supported tokens for channels
    mapping(address => bool) public supportedTokens;

    /// @notice Storage gap for upgrades
    uint256[44] private __gap;

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Ensure channel exists
    modifier channelExists(bytes32 channelId) {
        if (channels[channelId].sender == address(0)) revert InvalidAddress();
        _;
    }

    /// @notice Ensure caller is channel participant
    modifier onlyParticipant(bytes32 channelId) {
        Channel storage channel = channels[channelId];
        if (msg.sender != channel.sender && msg.sender != channel.recipient) {
            revert Unauthorized();
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /*//////////////////////////////////////////////////////////////
                             INITIALIZER
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize the payment channel contract
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __EIP712_init("X402PaymentChannel", "1");

        // Add USDs as default supported token
        supportedTokens[USDS] = true;

        // Opt-in for USDs auto-yield
        IUSDs(USDS).rebaseOptIn();
    }

    /*//////////////////////////////////////////////////////////////
                          CHANNEL MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Open a new payment channel
     * @param recipient Payment recipient address
     * @param token Payment token address
     * @param deposit Initial deposit amount
     * @return channelId The unique channel identifier
     * @dev Sender must approve token transfer before calling
     */
    function openChannel(
        address recipient,
        address token,
        uint256 deposit
    ) external override nonReentrant whenNotPaused returns (bytes32 channelId) {
        if (recipient == address(0)) revert InvalidAddress();
        if (recipient == msg.sender) revert InvalidAddress();
        if (deposit == 0) revert InvalidAmount();
        if (!supportedTokens[token]) revert NotAllowed();

        // Generate unique channel ID
        channelId = keccak256(abi.encodePacked(
            msg.sender,
            recipient,
            token,
            block.timestamp,
            totalChannels
        ));

        // Create channel
        channels[channelId] = Channel({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            deposit: deposit,
            withdrawn: 0,
            nonce: 0,
            state: ChannelState.Open,
            challengePeriod: DEFAULT_CHALLENGE_PERIOD,
            closingTime: 0
        });

        // Track channels
        userChannels[msg.sender].push(channelId);
        userChannels[recipient].push(channelId);
        totalChannels++;
        totalValueLocked += deposit;

        // Transfer tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), deposit);

        emit ChannelOpened(channelId, msg.sender, recipient, token, deposit);

        return channelId;
    }

    /**
     * @notice Open channel with custom challenge period
     * @param recipient Payment recipient address
     * @param token Payment token address
     * @param deposit Initial deposit amount
     * @param challengePeriod Custom challenge period in seconds
     * @return channelId The unique channel identifier
     */
    function openChannelWithPeriod(
        address recipient,
        address token,
        uint256 deposit,
        uint256 challengePeriod
    ) external nonReentrant whenNotPaused returns (bytes32 channelId) {
        if (recipient == address(0)) revert InvalidAddress();
        if (recipient == msg.sender) revert InvalidAddress();
        if (deposit == 0) revert InvalidAmount();
        if (!supportedTokens[token]) revert NotAllowed();
        if (challengePeriod < MIN_CHALLENGE_PERIOD || challengePeriod > MAX_CHALLENGE_PERIOD) {
            revert InvalidAmount();
        }

        channelId = keccak256(abi.encodePacked(
            msg.sender,
            recipient,
            token,
            block.timestamp,
            totalChannels
        ));

        channels[channelId] = Channel({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            deposit: deposit,
            withdrawn: 0,
            nonce: 0,
            state: ChannelState.Open,
            challengePeriod: challengePeriod,
            closingTime: 0
        });

        userChannels[msg.sender].push(channelId);
        userChannels[recipient].push(channelId);
        totalChannels++;
        totalValueLocked += deposit;

        IERC20(token).safeTransferFrom(msg.sender, address(this), deposit);

        emit ChannelOpened(channelId, msg.sender, recipient, token, deposit);

        return channelId;
    }

    /**
     * @notice Add more funds to an existing channel
     * @param channelId Channel identifier
     * @param amount Amount to add
     */
    function topUpChannel(
        bytes32 channelId,
        uint256 amount
    ) external nonReentrant channelExists(channelId) {
        Channel storage channel = channels[channelId];

        if (msg.sender != channel.sender) revert Unauthorized();
        if (channel.state != ChannelState.Open) revert NotAllowed();
        if (amount == 0) revert InvalidAmount();

        channel.deposit += amount;
        totalValueLocked += amount;

        IERC20(channel.token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /*//////////////////////////////////////////////////////////////
                         PAYMENT PROCESSING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Increment payment in channel (recipient claims with sender's signature)
     * @param channelId Channel identifier
     * @param amount Cumulative amount owed to recipient
     * @param signature Sender's EIP-712 signature
     * @dev Amount is cumulative, not incremental
     */
    function incrementPayment(
        bytes32 channelId,
        uint256 amount,
        bytes calldata signature
    ) external override nonReentrant channelExists(channelId) {
        Channel storage channel = channels[channelId];

        if (channel.state != ChannelState.Open) revert NotAllowed();
        if (amount > channel.deposit) revert InvalidAmount();
        if (amount <= channel.withdrawn) revert InvalidAmount();

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_TYPEHASH,
            channelId,
            amount,
            channel.nonce + 1
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        if (signer != channel.sender) revert InvalidSignature();

        // Update channel state
        uint256 paymentAmount = amount - channel.withdrawn;
        channel.withdrawn = amount;
        channel.nonce++;

        // Transfer to recipient
        IERC20(channel.token).safeTransfer(channel.recipient, paymentAmount);
        totalValueLocked -= paymentAmount;

        emit PaymentIncremented(channelId, paymentAmount, channel.nonce);
    }

    /**
     * @notice Batch increment payments across multiple channels
     * @param channelIds Array of channel identifiers
     * @param amounts Array of cumulative amounts
     * @param signatures Array of sender signatures
     */
    function batchIncrementPayments(
        bytes32[] calldata channelIds,
        uint256[] calldata amounts,
        bytes[] calldata signatures
    ) external nonReentrant {
        uint256 len = channelIds.length;
        if (len != amounts.length || len != signatures.length) revert InvalidAmount();

        for (uint256 i = 0; i < len;) {
            bytes32 channelId = channelIds[i];
            Channel storage channel = channels[channelId];

            if (channel.sender == address(0)) revert InvalidAddress();
            if (channel.state != ChannelState.Open) revert NotAllowed();
            if (amounts[i] > channel.deposit) revert InvalidAmount();
            if (amounts[i] <= channel.withdrawn) revert InvalidAmount();

            bytes32 structHash = keccak256(abi.encode(
                PAYMENT_TYPEHASH,
                channelId,
                amounts[i],
                channel.nonce + 1
            ));
            bytes32 digest = _hashTypedDataV4(structHash);
            address signer = digest.recover(signatures[i]);

            if (signer != channel.sender) revert InvalidSignature();

            uint256 paymentAmount = amounts[i] - channel.withdrawn;
            channel.withdrawn = amounts[i];
            channel.nonce++;

            IERC20(channel.token).safeTransfer(channel.recipient, paymentAmount);
            totalValueLocked -= paymentAmount;

            emit PaymentIncremented(channelId, paymentAmount, channel.nonce);

            unchecked { ++i; }
        }
    }

    /*//////////////////////////////////////////////////////////////
                          CHANNEL CLOSING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Close channel cooperatively with both signatures
     * @param channelId Channel identifier
     * @param finalAmount Final amount owed to recipient
     * @param signatures Concatenated signatures (sender + recipient)
     * @dev Both parties must sign to close immediately
     */
    function closeChannel(
        bytes32 channelId,
        uint256 finalAmount,
        bytes calldata signatures
    ) external override nonReentrant channelExists(channelId) {
        Channel storage channel = channels[channelId];

        if (channel.state != ChannelState.Open) revert NotAllowed();
        if (finalAmount > channel.deposit) revert InvalidAmount();
        if (signatures.length != 130) revert InvalidSignature(); // 65 bytes each

        // Split signatures
        bytes memory senderSig = signatures[0:65];
        bytes memory recipientSig = signatures[65:130];

        // Verify both signatures
        bytes32 structHash = keccak256(abi.encode(
            CLOSE_TYPEHASH,
            channelId,
            finalAmount,
            channel.nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        address senderSigner = digest.recover(senderSig);
        address recipientSigner = digest.recover(recipientSig);

        if (senderSigner != channel.sender) revert InvalidSignature();
        if (recipientSigner != channel.recipient) revert InvalidSignature();

        // Close channel and distribute funds
        _finalizeChannel(channelId, finalAmount);
    }

    /**
     * @notice Initiate unilateral channel closing (starts challenge period)
     * @param channelId Channel identifier
     * @param claimedAmount Amount claimed for recipient
     * @param signature Claimant's signature
     */
    function initiateClose(
        bytes32 channelId,
        uint256 claimedAmount,
        bytes calldata signature
    ) external nonReentrant channelExists(channelId) onlyParticipant(channelId) {
        Channel storage channel = channels[channelId];

        if (channel.state != ChannelState.Open) revert NotAllowed();
        if (claimedAmount > channel.deposit) revert InvalidAmount();

        // Verify signature matches claimed amount
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_TYPEHASH,
            channelId,
            claimedAmount,
            channel.nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        // Signature must be from sender
        if (signer != channel.sender) revert InvalidSignature();

        // Start closing period
        channel.state = ChannelState.Closing;
        channel.closingTime = block.timestamp;
        channel.withdrawn = claimedAmount;

        emit DisputeRaised(channelId, msg.sender, claimedAmount);
    }

    /**
     * @notice Challenge a unilateral close with a higher nonce state
     * @param channelId Channel identifier
     * @param amount Amount from higher nonce state
     * @param nonce The nonce proving later state
     * @param signature Sender's signature for higher nonce
     */
    function challengeClose(
        bytes32 channelId,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant channelExists(channelId) onlyParticipant(channelId) {
        Channel storage channel = channels[channelId];

        if (channel.state != ChannelState.Closing) revert NotAllowed();
        if (nonce <= channel.nonce) revert InvalidAmount();
        if (amount > channel.deposit) revert InvalidAmount();

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_TYPEHASH,
            channelId,
            amount,
            nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        if (signer != channel.sender) revert InvalidSignature();

        // Update to higher nonce state
        channel.nonce = nonce;
        channel.withdrawn = amount;

        // Reset challenge period
        channel.closingTime = block.timestamp;

        emit DisputeRaised(channelId, msg.sender, amount);
    }

    /**
     * @notice Finalize a channel after challenge period
     * @param channelId Channel identifier
     */
    function finalizeClose(bytes32 channelId) external nonReentrant channelExists(channelId) {
        Channel storage channel = channels[channelId];

        if (channel.state != ChannelState.Closing) revert NotAllowed();
        if (block.timestamp < channel.closingTime + channel.challengePeriod) {
            revert NotAllowed();
        }

        _finalizeChannel(channelId, channel.withdrawn);
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get channel details
     * @param channelId Channel identifier
     * @return Full channel struct
     */
    function getChannel(bytes32 channelId) external view returns (Channel memory) {
        return channels[channelId];
    }

    /**
     * @notice Get available balance in channel (for sender)
     * @param channelId Channel identifier
     * @return Remaining balance
     */
    function getAvailableBalance(bytes32 channelId) external view returns (uint256) {
        Channel storage channel = channels[channelId];
        return channel.deposit - channel.withdrawn;
    }

    /**
     * @notice Get all channels for a user
     * @param user User address
     * @return Array of channel IDs
     */
    function getUserChannels(address user) external view returns (bytes32[] memory) {
        return userChannels[user];
    }

    /**
     * @notice Get EIP-712 domain separator
     * @return Domain separator hash
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Generate payment increment hash for signing
     * @param channelId Channel identifier
     * @param amount Cumulative amount
     * @param nonce State nonce
     * @return Typed data hash to sign
     */
    function getPaymentHash(
        bytes32 channelId,
        uint256 amount,
        uint256 nonce
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_TYPEHASH,
            channelId,
            amount,
            nonce
        ));
        return _hashTypedDataV4(structHash);
    }

    /**
     * @notice Generate close channel hash for signing
     * @param channelId Channel identifier
     * @param finalAmount Final amount for recipient
     * @param nonce Current nonce
     * @return Typed data hash to sign
     */
    function getCloseHash(
        bytes32 channelId,
        uint256 finalAmount,
        uint256 nonce
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            CLOSE_TYPEHASH,
            channelId,
            finalAmount,
            nonce
        ));
        return _hashTypedDataV4(structHash);
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Add supported token
     * @param token Token address
     */
    function addSupportedToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        supportedTokens[token] = true;
    }

    /**
     * @notice Remove supported token
     * @param token Token address
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @notice Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdrawal (only for stuck funds)
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Finalize channel and distribute funds
     * @param channelId Channel identifier
     * @param recipientAmount Amount for recipient
     */
    function _finalizeChannel(bytes32 channelId, uint256 recipientAmount) internal {
        Channel storage channel = channels[channelId];

        channel.state = ChannelState.Closed;

        uint256 senderAmount = channel.deposit - recipientAmount;
        address token = channel.token;

        // Transfer remaining funds
        if (recipientAmount > channel.withdrawn) {
            uint256 remaining = recipientAmount - channel.withdrawn;
            IERC20(token).safeTransfer(channel.recipient, remaining);
        }

        if (senderAmount > 0) {
            IERC20(token).safeTransfer(channel.sender, senderAmount);
        }

        totalValueLocked -= (channel.deposit - channel.withdrawn);

        emit ChannelClosed(channelId, senderAmount, recipientAmount);
    }

    /**
     * @notice Authorize upgrade (UUPS)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
