// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IX402.sol";
import "./interfaces/IUSDs.sol";

/**
 * @title X402Subscription
 * @author X402 Protocol
 * @notice Recurring payment system for AI tool subscriptions
 * @dev Supports permissionless execution and USDs auto-yield accumulation
 * 
 * Features:
 * - Create subscriptions with flexible intervals
 * - Anyone can execute payments after interval passes
 * - Subscribers can pause/resume subscriptions
 * - USDs deposits earn yield between payments
 * - Batch execution for gas efficiency
 * - Keeper incentives for execution
 * 
 * Subscription Flow:
 * 1. Subscriber creates subscription with amount, interval, recipient
 * 2. Subscriber deposits USDs to fund payments
 * 3. After each interval, anyone can call executeSubscription
 * 4. Payment transfers from deposit to recipient
 * 5. Deposits earn USDs auto-yield while waiting
 */
contract X402Subscription is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable,
    UUPSUpgradeable,
    IX402Subscription
{
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice USDs token address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    /// @notice Minimum subscription interval (1 hour)
    uint256 public constant MIN_INTERVAL = 1 hours;

    /// @notice Maximum subscription interval (365 days)
    uint256 public constant MAX_INTERVAL = 365 days;

    /// @notice Keeper reward in basis points (0.1%)
    uint256 public constant KEEPER_REWARD_BPS = 10;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Subscription counter
    uint256 public subscriptionCounter;

    /// @notice Mapping of subscription ID to subscription info
    mapping(uint256 => Subscription) public subscriptions;

    /// @notice Mapping of subscriber to their subscription IDs
    mapping(address => uint256[]) public subscriberSubscriptions;

    /// @notice Mapping of recipient to subscriptions they receive
    mapping(address => uint256[]) public recipientSubscriptions;

    /// @notice Subscriber deposits (balance held for payments)
    mapping(address => uint256) public deposits;

    /// @notice USDs credits for accurate yield tracking
    mapping(address => uint256) private _depositCredits;

    /// @notice Supported tokens for subscriptions
    mapping(address => bool) public supportedTokens;

    /// @notice Total active subscriptions
    uint256 public activeSubscriptions;

    /// @notice Total volume processed
    uint256 public totalVolumeProcessed;

    /// @notice Storage gap for upgrades
    uint256[42] private __gap;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when funds are deposited
    event Deposited(address indexed subscriber, uint256 amount);

    /// @notice Emitted when funds are withdrawn
    event Withdrawn(address indexed subscriber, uint256 amount);

    /// @notice Emitted when subscription is paused
    event SubscriptionPaused(uint256 indexed subscriptionId);

    /// @notice Emitted when subscription is resumed
    event SubscriptionResumed(uint256 indexed subscriptionId);

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Ensure subscription exists
    modifier subscriptionExists(uint256 subscriptionId) {
        if (subscriptions[subscriptionId].subscriber == address(0)) {
            revert InvalidAddress();
        }
        _;
    }

    /// @notice Ensure caller is subscriber
    modifier onlySubscriber(uint256 subscriptionId) {
        if (subscriptions[subscriptionId].subscriber != msg.sender) {
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
     * @notice Initialize the subscription contract
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();

        // Add USDs as default supported token
        supportedTokens[USDS] = true;

        // Opt-in for USDs auto-yield
        IUSDs(USDS).rebaseOptIn();
    }

    /*//////////////////////////////////////////////////////////////
                            DEPOSITS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deposit USDs to fund subscriptions
     * @param amount Amount to deposit
     * @dev Deposits earn yield while held in contract
     */
    function depositFunds(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();

        // Get current credits per token for accurate tracking
        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();

        // Transfer USDs from subscriber
        IERC20(USDS).safeTransferFrom(msg.sender, address(this), amount);

        // Track in credits for rebasing
        uint256 credits = amount * creditsPerToken;
        _depositCredits[msg.sender] += credits;
        deposits[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw deposited funds
     * @param amount Amount to withdraw
     */
    function withdrawFunds(uint256 amount) external nonReentrant {
        uint256 balance = getDepositBalance(msg.sender);
        if (amount > balance) revert InvalidAmount();

        // Calculate credits to remove
        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        uint256 creditsToRemove = amount * creditsPerToken;

        _depositCredits[msg.sender] -= creditsToRemove;
        deposits[msg.sender] = balance - amount;

        IERC20(USDS).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Get current deposit balance including yield
     * @param subscriber Subscriber address
     * @return Current balance with accrued yield
     */
    function getDepositBalance(address subscriber) public view returns (uint256) {
        uint256 credits = _depositCredits[subscriber];
        if (credits == 0) return 0;

        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        return credits / creditsPerToken;
    }

    /*//////////////////////////////////////////////////////////////
                        SUBSCRIPTION MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new subscription
     * @param recipient Payment recipient address
     * @param amount Payment amount per interval
     * @param interval Payment interval in seconds
     * @return subscriptionId The new subscription ID
     */
    function createSubscription(
        address recipient,
        uint256 amount,
        uint256 interval
    ) external override nonReentrant whenNotPaused returns (uint256 subscriptionId) {
        if (recipient == address(0)) revert InvalidAddress();
        if (recipient == msg.sender) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (interval < MIN_INTERVAL || interval > MAX_INTERVAL) {
            revert InvalidAmount();
        }

        subscriptionId = ++subscriptionCounter;

        subscriptions[subscriptionId] = Subscription({
            subscriber: msg.sender,
            recipient: recipient,
            token: USDS,
            amount: amount,
            interval: interval,
            nextPayment: block.timestamp + interval,
            totalPaid: 0,
            paymentCount: 0,
            status: SubscriptionStatus.Active,
            createdAt: block.timestamp
        });

        subscriberSubscriptions[msg.sender].push(subscriptionId);
        recipientSubscriptions[recipient].push(subscriptionId);
        activeSubscriptions++;

        emit SubscriptionCreated(subscriptionId, msg.sender, recipient, amount, interval);

        return subscriptionId;
    }

    /**
     * @notice Create subscription with custom token
     * @param recipient Payment recipient address
     * @param token Payment token address
     * @param amount Payment amount per interval
     * @param interval Payment interval in seconds
     * @return subscriptionId The new subscription ID
     */
    function createSubscriptionWithToken(
        address recipient,
        address token,
        uint256 amount,
        uint256 interval
    ) external nonReentrant whenNotPaused returns (uint256 subscriptionId) {
        if (recipient == address(0)) revert InvalidAddress();
        if (!supportedTokens[token]) revert NotAllowed();
        if (amount == 0) revert InvalidAmount();
        if (interval < MIN_INTERVAL || interval > MAX_INTERVAL) {
            revert InvalidAmount();
        }

        subscriptionId = ++subscriptionCounter;

        subscriptions[subscriptionId] = Subscription({
            subscriber: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            interval: interval,
            nextPayment: block.timestamp + interval,
            totalPaid: 0,
            paymentCount: 0,
            status: SubscriptionStatus.Active,
            createdAt: block.timestamp
        });

        subscriberSubscriptions[msg.sender].push(subscriptionId);
        recipientSubscriptions[recipient].push(subscriptionId);
        activeSubscriptions++;

        emit SubscriptionCreated(subscriptionId, msg.sender, recipient, amount, interval);

        return subscriptionId;
    }

    /**
     * @notice Cancel a subscription
     * @param subscriptionId Subscription identifier
     */
    function cancelSubscription(
        uint256 subscriptionId
    ) external override subscriptionExists(subscriptionId) onlySubscriber(subscriptionId) {
        Subscription storage sub = subscriptions[subscriptionId];

        if (sub.status == SubscriptionStatus.Cancelled) revert NotAllowed();

        sub.status = SubscriptionStatus.Cancelled;
        activeSubscriptions--;

        emit SubscriptionCancelled(subscriptionId);
    }

    /**
     * @notice Pause a subscription
     * @param subscriptionId Subscription identifier
     */
    function pauseSubscription(
        uint256 subscriptionId
    ) external subscriptionExists(subscriptionId) onlySubscriber(subscriptionId) {
        Subscription storage sub = subscriptions[subscriptionId];

        if (sub.status != SubscriptionStatus.Active) revert NotAllowed();

        sub.status = SubscriptionStatus.Paused;

        emit SubscriptionPaused(subscriptionId);
    }

    /**
     * @notice Resume a paused subscription
     * @param subscriptionId Subscription identifier
     */
    function resumeSubscription(
        uint256 subscriptionId
    ) external subscriptionExists(subscriptionId) onlySubscriber(subscriptionId) {
        Subscription storage sub = subscriptions[subscriptionId];

        if (sub.status != SubscriptionStatus.Paused) revert NotAllowed();

        sub.status = SubscriptionStatus.Active;
        // Reset next payment to now + interval
        sub.nextPayment = block.timestamp + sub.interval;

        emit SubscriptionResumed(subscriptionId);
    }

    /**
     * @notice Update subscription amount
     * @param subscriptionId Subscription identifier
     * @param newAmount New payment amount
     */
    function updateSubscriptionAmount(
        uint256 subscriptionId,
        uint256 newAmount
    ) external subscriptionExists(subscriptionId) onlySubscriber(subscriptionId) {
        if (newAmount == 0) revert InvalidAmount();

        subscriptions[subscriptionId].amount = newAmount;
    }

    /*//////////////////////////////////////////////////////////////
                        SUBSCRIPTION EXECUTION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Execute a subscription payment
     * @param subscriptionId Subscription identifier
     * @dev Anyone can call after interval passes. Caller gets small reward.
     */
    function executeSubscription(
        uint256 subscriptionId
    ) external override nonReentrant whenNotPaused subscriptionExists(subscriptionId) {
        Subscription storage sub = subscriptions[subscriptionId];

        if (sub.status != SubscriptionStatus.Active) revert NotAllowed();
        if (block.timestamp < sub.nextPayment) revert NotAllowed();

        uint256 balance = getDepositBalance(sub.subscriber);
        if (balance < sub.amount) {
            sub.status = SubscriptionStatus.Expired;
            revert InvalidAmount();
        }

        // Calculate keeper reward
        uint256 keeperReward = (sub.amount * KEEPER_REWARD_BPS) / BPS_DENOMINATOR;
        uint256 recipientAmount = sub.amount - keeperReward;

        // Deduct from subscriber's deposit
        uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
        uint256 creditsToDeduct = sub.amount * creditsPerToken;
        _depositCredits[sub.subscriber] -= creditsToDeduct;
        deposits[sub.subscriber] = balance - sub.amount;

        // Transfer to recipient
        IERC20(sub.token).safeTransfer(sub.recipient, recipientAmount);

        // Transfer keeper reward
        if (keeperReward > 0 && msg.sender != sub.subscriber) {
            IERC20(sub.token).safeTransfer(msg.sender, keeperReward);
        } else {
            // If subscriber executes, send full amount to recipient
            IERC20(sub.token).safeTransfer(sub.recipient, keeperReward);
        }

        // Update subscription
        sub.nextPayment = block.timestamp + sub.interval;
        sub.totalPaid += sub.amount;
        sub.paymentCount++;
        totalVolumeProcessed += sub.amount;

        emit SubscriptionPayment(subscriptionId, sub.amount, block.timestamp);
    }

    /**
     * @notice Batch execute multiple subscriptions
     * @param subscriptionIds Array of subscription IDs
     * @dev Gas efficient execution for keepers
     */
    function batchExecuteSubscriptions(
        uint256[] calldata subscriptionIds
    ) external nonReentrant whenNotPaused {
        uint256 len = subscriptionIds.length;

        for (uint256 i = 0; i < len;) {
            uint256 subscriptionId = subscriptionIds[i];
            Subscription storage sub = subscriptions[subscriptionId];

            // Skip invalid subscriptions
            if (sub.subscriber == address(0)) {
                unchecked { ++i; }
                continue;
            }
            if (sub.status != SubscriptionStatus.Active) {
                unchecked { ++i; }
                continue;
            }
            if (block.timestamp < sub.nextPayment) {
                unchecked { ++i; }
                continue;
            }

            uint256 balance = getDepositBalance(sub.subscriber);
            if (balance < sub.amount) {
                sub.status = SubscriptionStatus.Expired;
                unchecked { ++i; }
                continue;
            }

            // Calculate keeper reward
            uint256 keeperReward = (sub.amount * KEEPER_REWARD_BPS) / BPS_DENOMINATOR;
            uint256 recipientAmount = sub.amount - keeperReward;

            // Deduct from deposit
            uint256 creditsPerToken = IUSDs(USDS).creditsPerToken();
            uint256 creditsToDeduct = sub.amount * creditsPerToken;
            _depositCredits[sub.subscriber] -= creditsToDeduct;
            deposits[sub.subscriber] = balance - sub.amount;

            // Transfer payments
            IERC20(sub.token).safeTransfer(sub.recipient, recipientAmount);
            if (keeperReward > 0) {
                IERC20(sub.token).safeTransfer(msg.sender, keeperReward);
            }

            // Update subscription
            sub.nextPayment = block.timestamp + sub.interval;
            sub.totalPaid += sub.amount;
            sub.paymentCount++;
            totalVolumeProcessed += sub.amount;

            emit SubscriptionPayment(subscriptionId, sub.amount, block.timestamp);

            unchecked { ++i; }
        }
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get subscription details
     * @param subscriptionId Subscription identifier
     * @return Full subscription struct
     */
    function getSubscription(
        uint256 subscriptionId
    ) external view returns (Subscription memory) {
        return subscriptions[subscriptionId];
    }

    /**
     * @notice Get all subscriptions for a subscriber
     * @param subscriber Subscriber address
     * @return Array of subscription IDs
     */
    function getSubscriberSubscriptions(
        address subscriber
    ) external view returns (uint256[] memory) {
        return subscriberSubscriptions[subscriber];
    }

    /**
     * @notice Get all subscriptions for a recipient
     * @param recipient Recipient address
     * @return Array of subscription IDs
     */
    function getRecipientSubscriptions(
        address recipient
    ) external view returns (uint256[] memory) {
        return recipientSubscriptions[recipient];
    }

    /**
     * @notice Check if subscription can be executed
     * @param subscriptionId Subscription identifier
     * @return True if ready for execution
     */
    function canExecute(uint256 subscriptionId) external view returns (bool) {
        Subscription storage sub = subscriptions[subscriptionId];

        if (sub.subscriber == address(0)) return false;
        if (sub.status != SubscriptionStatus.Active) return false;
        if (block.timestamp < sub.nextPayment) return false;

        uint256 balance = getDepositBalance(sub.subscriber);
        return balance >= sub.amount;
    }

    /**
     * @notice Get executable subscriptions (for keepers)
     * @param limit Maximum number to return
     * @return Array of executable subscription IDs
     */
    function getExecutableSubscriptions(
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] memory executable = new uint256[](limit);
        uint256 count = 0;

        for (uint256 i = 1; i <= subscriptionCounter && count < limit; i++) {
            Subscription storage sub = subscriptions[i];

            if (sub.status != SubscriptionStatus.Active) continue;
            if (block.timestamp < sub.nextPayment) continue;

            uint256 balance = getDepositBalance(sub.subscriber);
            if (balance >= sub.amount) {
                executable[count] = i;
                count++;
            }
        }

        // Resize array
        assembly {
            mstore(executable, count)
        }

        return executable;
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
     * @notice Emergency withdrawal
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
     * @notice Authorize upgrade (UUPS)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
