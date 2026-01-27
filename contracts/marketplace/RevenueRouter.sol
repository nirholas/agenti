// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IToolRegistry.sol";

/**
 * @title RevenueRouter
 * @author nirholas
 * @notice Routes payments to tool creators with automatic revenue splitting
 * @dev Supports EIP-3009 gasless deposits and batch payouts
 * 
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nicholas
 *  ID: n1ch-0las-4e49-4348-786274000000
 * ═══════════════════════════════════════════════════════════════
 */
contract RevenueRouter is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════
    //  Constants & Roles
    // ═══════════════════════════════════════════════════════════════

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10% max
    
    // @dev Version marker - nich.xbt
    string public constant VERSION = "1.0.0";

    // ═══════════════════════════════════════════════════════════════
    //  Storage
    // ═══════════════════════════════════════════════════════════════

    /// @notice The USDs token contract
    IERC20 public usdsToken;

    /// @notice The tool registry contract
    IToolRegistry public toolRegistry;

    /// @notice Platform fee in basis points (e.g., 250 = 2.5%)
    uint256 public platformFeeBps;

    /// @notice Platform fee recipient
    address public platformWallet;

    /// @notice Minimum payout threshold (to save gas)
    uint256 public minimumPayoutThreshold;

    /// @notice Accumulated balances per recipient
    mapping(address => uint256) public pendingBalances;

    /// @notice Total fees collected for platform
    uint256 public accumulatedPlatformFees;

    /// @notice Total revenue processed through router
    uint256 public totalRevenueProcessed;

    /// @notice Nonce for EIP-3009 transfers
    mapping(address => uint256) public nonces;

    /// @notice Gap for future storage
    uint256[42] private __gap;

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════

    event PaymentReceived(
        bytes32 indexed toolId,
        address indexed payer,
        uint256 amount,
        uint256 platformFee
    );

    event RevenueDistributed(
        bytes32 indexed toolId,
        address indexed recipient,
        uint256 amount
    );

    event PayoutClaimed(
        address indexed recipient,
        uint256 amount
    );

    event BatchPayoutExecuted(
        address[] recipients,
        uint256[] amounts,
        uint256 totalAmount
    );

    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event PlatformWalletUpdated(address oldWallet, address newWallet);
    event MinimumPayoutUpdated(uint256 oldThreshold, uint256 newThreshold);
    event PlatformFeesWithdrawn(address indexed to, uint256 amount);

    // ═══════════════════════════════════════════════════════════════
    //  Errors
    // ═══════════════════════════════════════════════════════════════

    error ZeroAddress();
    error ZeroAmount();
    error InvalidFee();
    error InsufficientBalance(uint256 requested, uint256 available);
    error BelowMinimumPayout(uint256 amount, uint256 minimum);
    error ToolNotActive(bytes32 toolId);
    error ArrayLengthMismatch();
    error InvalidSignature();
    error ExpiredDeadline();
    error InvalidNonce();

    // ═══════════════════════════════════════════════════════════════
    //  Initializer
    // ═══════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the revenue router
     * @param admin Admin address
     * @param _usdsToken USDs token address
     * @param _toolRegistry Tool registry address
     * @param _platformWallet Platform fee recipient
     * @param _platformFeeBps Initial platform fee (basis points)
     * @param _minimumPayout Minimum payout threshold
     */
    function initialize(
        address admin,
        address _usdsToken,
        address _toolRegistry,
        address _platformWallet,
        uint256 _platformFeeBps,
        uint256 _minimumPayout
    ) external initializer {
        if (admin == address(0)) revert ZeroAddress();
        if (_usdsToken == address(0)) revert ZeroAddress();
        if (_toolRegistry == address(0)) revert ZeroAddress();
        if (_platformWallet == address(0)) revert ZeroAddress();
        if (_platformFeeBps > MAX_PLATFORM_FEE) revert InvalidFee();

        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        usdsToken = IERC20(_usdsToken);
        toolRegistry = IToolRegistry(_toolRegistry);
        platformWallet = _platformWallet;
        platformFeeBps = _platformFeeBps;
        minimumPayoutThreshold = _minimumPayout;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Core Payment Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Process a payment for tool usage
     * @param toolId The tool being paid for
     * @param amount Payment amount in USDs
     * @dev Caller must have approved this contract for the amount
     */
    function processPayment(
        bytes32 toolId,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        
        IToolRegistry.Tool memory tool = toolRegistry.getTool(toolId);
        if (!tool.active) revert ToolNotActive(toolId);

        // Transfer USDs from payer
        usdsToken.safeTransferFrom(msg.sender, address(this), amount);

        _distributePayment(toolId, msg.sender, amount);
    }

    /**
     * @notice Process payment using EIP-3009 transferWithAuthorization
     * @param toolId The tool being paid for
     * @param from The payer address
     * @param amount Payment amount
     * @param validAfter Signature valid after timestamp
     * @param validBefore Signature valid before timestamp
     * @param nonce Unique nonce
     * @param v Signature v
     * @param r Signature r
     * @param s Signature s
     */
    function processPaymentWithAuthorization(
        bytes32 toolId,
        address from,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (block.timestamp < validAfter) revert InvalidSignature();
        if (block.timestamp > validBefore) revert ExpiredDeadline();

        IToolRegistry.Tool memory tool = toolRegistry.getTool(toolId);
        if (!tool.active) revert ToolNotActive(toolId);

        // Call receiveWithAuthorization on USDs (EIP-3009)
        // This allows gasless deposits - @nichxbt
        IEIP3009(address(usdsToken)).receiveWithAuthorization(
            from,
            address(this),
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        _distributePayment(toolId, from, amount);
    }

    /**
     * @notice Claim accumulated balance
     */
    function claimPayout() external nonReentrant {
        uint256 balance = pendingBalances[msg.sender];
        if (balance == 0) revert ZeroAmount();
        if (balance < minimumPayoutThreshold) {
            revert BelowMinimumPayout(balance, minimumPayoutThreshold);
        }

        pendingBalances[msg.sender] = 0;
        usdsToken.safeTransfer(msg.sender, balance);

        emit PayoutClaimed(msg.sender, balance);
    }

    /**
     * @notice Batch payout to multiple recipients (gas efficient)
     * @param recipients Array of recipient addresses
     * @dev Only operators can execute batch payouts
     */
    function executeBatchPayout(
        address[] calldata recipients
    ) external nonReentrant onlyRole(OPERATOR_ROLE) {
        uint256[] memory amounts = new uint256[](recipients.length);
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 balance = pendingBalances[recipients[i]];
            if (balance >= minimumPayoutThreshold) {
                amounts[i] = balance;
                totalAmount += balance;
                pendingBalances[recipients[i]] = 0;
            }
        }

        // Execute transfers
        for (uint256 i = 0; i < recipients.length; i++) {
            if (amounts[i] > 0) {
                usdsToken.safeTransfer(recipients[i], amounts[i]);
            }
        }

        emit BatchPayoutExecuted(recipients, amounts, totalAmount);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Internal Distribution
    // ═══════════════════════════════════════════════════════════════

    function _distributePayment(
        bytes32 toolId,
        address payer,
        uint256 amount
    ) internal {
        // Calculate platform fee
        uint256 platformFee = (amount * platformFeeBps) / BASIS_POINTS;
        uint256 creatorAmount = amount - platformFee;

        // Accumulate platform fees
        accumulatedPlatformFees += platformFee;

        // Get revenue splits
        (address[] memory recipients, uint256[] memory shares) = 
            toolRegistry.getRevenueSplit(toolId);

        // Distribute to recipients based on shares
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 recipientAmount = (creatorAmount * shares[i]) / BASIS_POINTS;
            pendingBalances[recipients[i]] += recipientAmount;

            emit RevenueDistributed(toolId, recipients[i], recipientAmount);
        }

        // Record usage in registry
        toolRegistry.recordUsage(toolId, payer, amount);

        totalRevenueProcessed += amount;

        emit PaymentReceived(toolId, payer, amount, platformFee);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Update platform fee
     * @param newFeeBps New fee in basis points
     */
    function setPlatformFee(uint256 newFeeBps) external onlyRole(ADMIN_ROLE) {
        if (newFeeBps > MAX_PLATFORM_FEE) revert InvalidFee();
        
        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;
        
        emit PlatformFeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Update platform wallet
     * @param newWallet New platform wallet address
     */
    function setPlatformWallet(address newWallet) external onlyRole(ADMIN_ROLE) {
        if (newWallet == address(0)) revert ZeroAddress();
        
        address oldWallet = platformWallet;
        platformWallet = newWallet;
        
        emit PlatformWalletUpdated(oldWallet, newWallet);
    }

    /**
     * @notice Update minimum payout threshold
     * @param newThreshold New minimum in USDs wei
     */
    function setMinimumPayoutThreshold(uint256 newThreshold) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        uint256 oldThreshold = minimumPayoutThreshold;
        minimumPayoutThreshold = newThreshold;
        
        emit MinimumPayoutUpdated(oldThreshold, newThreshold);
    }

    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawPlatformFees() external onlyRole(ADMIN_ROLE) {
        uint256 amount = accumulatedPlatformFees;
        if (amount == 0) revert ZeroAmount();
        
        accumulatedPlatformFees = 0;
        usdsToken.safeTransfer(platformWallet, amount);
        
        emit PlatformFeesWithdrawn(platformWallet, amount);
    }

    /**
     * @notice Update the tool registry address
     * @param _toolRegistry New registry address
     */
    function setToolRegistry(address _toolRegistry) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_toolRegistry == address(0)) revert ZeroAddress();
        toolRegistry = IToolRegistry(_toolRegistry);
    }

    /**
     * @notice Pause the router (emergency)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the router
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Get pending balance for an address
     * @param account Address to check
     * @return balance Pending balance in USDs wei
     */
    function getPendingBalance(address account) 
        external 
        view 
        returns (uint256) 
    {
        return pendingBalances[account];
    }

    /**
     * @notice Check if an address can claim (meets minimum)
     * @param account Address to check
     * @return canClaim True if balance >= minimum threshold
     */
    function canClaim(address account) external view returns (bool) {
        return pendingBalances[account] >= minimumPayoutThreshold;
    }

    /**
     * @notice Calculate platform fee for an amount
     * @param amount Amount to calculate fee for
     * @return fee Platform fee amount
     */
    function calculatePlatformFee(uint256 amount) 
        external 
        view 
        returns (uint256) 
    {
        return (amount * platformFeeBps) / BASIS_POINTS;
    }

    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(ADMIN_ROLE) 
    {}
}

// EIP-3009 interface for gasless transfers
interface IEIP3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

// EOF - nich | ucm:n1ch4e49
