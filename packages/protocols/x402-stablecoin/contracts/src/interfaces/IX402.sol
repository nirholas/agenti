// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IX402Common
 * @notice Common events and errors for X402 contracts
 */
interface IX402Common {
    /// @notice Emitted when an invalid address is provided
    error InvalidAddress();
    
    /// @notice Emitted when an invalid amount is provided
    error InvalidAmount();
    
    /// @notice Emitted when unauthorized access is attempted
    error Unauthorized();
    
    /// @notice Emitted when an operation is not allowed
    error NotAllowed();
    
    /// @notice Emitted when a deadline has passed
    error DeadlinePassed();
    
    /// @notice Emitted when a signature is invalid
    error InvalidSignature();
}

/**
 * @title IToolRegistry
 * @notice Interface for the X402 Tool Registry - On-chain tool marketplace
 */
interface IToolRegistry is IX402Common {
    /// @notice Tool information structure
    struct ToolInfo {
        address developer;      // Developer wallet address
        address paymentToken;   // Token used for payment (USDs)
        uint256 pricePerCall;   // Price per tool call in token units
        uint256 totalCalls;     // Total number of calls made
        uint256 totalRevenue;   // Total revenue generated
        bool active;            // Whether the tool is active
        uint256 createdAt;      // Timestamp of registration
    }

    /// @notice Emitted when a tool is registered
    event ToolRegistered(
        string indexed name,
        address indexed developer,
        address paymentToken,
        uint256 pricePerCall
    );

    /// @notice Emitted when tool price is updated
    event ToolPriceUpdated(
        string indexed name,
        uint256 oldPrice,
        uint256 newPrice
    );

    /// @notice Emitted when a tool call is recorded
    event ToolCalled(
        string indexed name,
        address indexed caller,
        uint256 amount
    );

    /**
     * @notice Register a new tool
     * @param name Unique tool name
     * @param developer Developer wallet address
     * @param price Price per call in payment token units
     * @param token Payment token address
     */
    function registerTool(
        string calldata name,
        address developer,
        uint256 price,
        address token
    ) external;

    /**
     * @notice Update tool price
     * @param name Tool name
     * @param newPrice New price per call
     */
    function updateToolPrice(string calldata name, uint256 newPrice) external;

    /**
     * @notice Get tool information
     * @param name Tool name
     * @return developer Developer address
     * @return price Price per call
     * @return totalCalls Total calls made
     */
    function getToolInfo(string calldata name)
        external
        view
        returns (address developer, uint256 price, uint256 totalCalls);
}

/**
 * @title IX402PaymentChannel
 * @notice Interface for X402 Payment Channels - State channels for streaming payments
 */
interface IX402PaymentChannel is IX402Common {
    /// @notice Channel state enum
    enum ChannelState {
        Open,
        Closing,
        Closed,
        Disputed
    }

    /// @notice Channel information structure
    struct Channel {
        address sender;         // Channel opener
        address recipient;      // Payment recipient
        address token;          // Payment token
        uint256 deposit;        // Total deposited amount
        uint256 withdrawn;      // Amount withdrawn by recipient
        uint256 nonce;          // State update nonce
        ChannelState state;     // Current channel state
        uint256 challengePeriod;// Dispute challenge period in seconds
        uint256 closingTime;    // Timestamp when closing was initiated
    }

    /// @notice Emitted when a channel is opened
    event ChannelOpened(
        bytes32 indexed channelId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 deposit
    );

    /// @notice Emitted when payment is incremented
    event PaymentIncremented(
        bytes32 indexed channelId,
        uint256 amount,
        uint256 nonce
    );

    /// @notice Emitted when channel is closed
    event ChannelClosed(
        bytes32 indexed channelId,
        uint256 senderAmount,
        uint256 recipientAmount
    );

    /// @notice Emitted when a dispute is raised
    event DisputeRaised(
        bytes32 indexed channelId,
        address indexed disputer,
        uint256 claimedAmount
    );

    /**
     * @notice Open a new payment channel
     * @param recipient Payment recipient
     * @param token Payment token address
     * @param deposit Initial deposit amount
     * @return channelId The unique channel identifier
     */
    function openChannel(
        address recipient,
        address token,
        uint256 deposit
    ) external returns (bytes32 channelId);

    /**
     * @notice Increment payment in a channel (off-chain signature)
     * @param channelId Channel identifier
     * @param amount Cumulative amount to recipient
     * @param signature Sender's signature
     */
    function incrementPayment(
        bytes32 channelId,
        uint256 amount,
        bytes calldata signature
    ) external;

    /**
     * @notice Close a channel cooperatively
     * @param channelId Channel identifier
     * @param finalAmount Final amount to recipient
     * @param signatures Both party signatures
     */
    function closeChannel(
        bytes32 channelId,
        uint256 finalAmount,
        bytes calldata signatures
    ) external;
}

/**
 * @title IX402Subscription
 * @notice Interface for X402 Subscriptions - Recurring payment system
 */
interface IX402Subscription is IX402Common {
    /// @notice Subscription status enum
    enum SubscriptionStatus {
        Active,
        Paused,
        Cancelled,
        Expired
    }

    /// @notice Subscription information structure
    struct Subscription {
        address subscriber;     // The subscriber address
        address recipient;      // Payment recipient
        address token;          // Payment token
        uint256 amount;         // Payment amount per interval
        uint256 interval;       // Payment interval in seconds
        uint256 nextPayment;    // Timestamp of next payment
        uint256 totalPaid;      // Total amount paid
        uint256 paymentCount;   // Number of payments made
        SubscriptionStatus status; // Current status
        uint256 createdAt;      // Creation timestamp
    }

    /// @notice Emitted when subscription is created
    event SubscriptionCreated(
        uint256 indexed subscriptionId,
        address indexed subscriber,
        address indexed recipient,
        uint256 amount,
        uint256 interval
    );

    /// @notice Emitted when subscription payment is executed
    event SubscriptionPayment(
        uint256 indexed subscriptionId,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when subscription is cancelled
    event SubscriptionCancelled(uint256 indexed subscriptionId);

    /**
     * @notice Create a new subscription
     * @param recipient Payment recipient
     * @param amount Payment amount per interval
     * @param interval Payment interval in seconds
     * @return subscriptionId The subscription identifier
     */
    function createSubscription(
        address recipient,
        uint256 amount,
        uint256 interval
    ) external returns (uint256 subscriptionId);

    /**
     * @notice Cancel a subscription
     * @param subscriptionId Subscription identifier
     */
    function cancelSubscription(uint256 subscriptionId) external;

    /**
     * @notice Execute a subscription payment
     * @dev Anyone can call this after the interval has passed
     * @param subscriptionId Subscription identifier
     */
    function executeSubscription(uint256 subscriptionId) external;
}

/**
 * @title IX402CreditSystem
 * @notice Interface for X402 Credit System - Prepaid credits with yield
 */
interface IX402CreditSystem is IX402Common {
    /// @notice User credit information
    struct CreditInfo {
        uint256 deposited;      // Total deposited (in USDs shares)
        uint256 creditsUsed;    // Total credits used
        uint256 lastUpdate;     // Last update timestamp
    }

    /// @notice Emitted when credits are deposited
    event CreditsDeposited(
        address indexed user,
        uint256 amount,
        uint256 creditBalance
    );

    /// @notice Emitted when credits are used
    event CreditsUsed(
        address indexed user,
        string indexed tool,
        uint256 amount
    );

    /// @notice Emitted when credits are withdrawn
    event CreditsWithdrawn(
        address indexed user,
        uint256 amount
    );

    /**
     * @notice Deposit USDs to receive credits
     * @param amount Amount of USDs to deposit
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Use credits for tool payment
     * @param tool Tool name
     * @param amount Credit amount to use
     */
    function useCredits(string calldata tool, uint256 amount) external;

    /**
     * @notice Withdraw remaining credits as USDs
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external;

    /**
     * @notice Get user's credit balance (including yield)
     * @param user User address
     * @return Current credit balance
     */
    function getCreditBalance(address user) external view returns (uint256);
}
