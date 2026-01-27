/**
 * X402 Revenue Smart Contract
 * 
 * Solidity smart contract for automated revenue splits
 * Distributes payments between developers and platform
 * 
 * Features:
 * - Automated 80/20 revenue splits
 * - Multi-token support (USDC, USDT, DAI)
 * - Batch payment processing
 * - Emergency withdrawal
 * - Upgradeable architecture
 * 
 * @dev Deploy on Base, BSC, and other EVM chains
 * @since November 30, 2025
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title X402RevenueSplitter
 * @dev Automated revenue splitting for X402 tool payments
 */
contract X402RevenueSplitter is 
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Platform wallet address (receives platform fee)
    address public platformWallet;

    /// @notice Default platform fee (in basis points, 2000 = 20%)
    uint256 public defaultPlatformFeeBps;

    /// @notice Minimum platform fee (in basis points)
    uint256 public constant MIN_PLATFORM_FEE_BPS = 500; // 5%

    /// @notice Maximum platform fee (in basis points)
    uint256 public constant MAX_PLATFORM_FEE_BPS = 5000; // 50%

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Tool registration struct
    struct ToolInfo {
        address developer;
        uint256 platformFeeBps;
        uint256 totalRevenue;
        uint256 totalCalls;
        bool active;
    }

    /// @notice Mapping of tool name to tool info
    mapping(string => ToolInfo) public tools;

    /// @notice Mapping of developer to total earnings
    mapping(address => uint256) public developerEarnings;

    /// @notice Total platform revenue
    uint256 public totalPlatformRevenue;

    /// @notice Supported payment tokens
    mapping(address => bool) public supportedTokens;

    /// @notice Events
    event ToolRegistered(string indexed toolName, address indexed developer, uint256 platformFeeBps);
    event ToolUpdated(string indexed toolName, address indexed newDeveloper, uint256 newPlatformFeeBps);
    event PaymentProcessed(
        string indexed toolName,
        address indexed payer,
        address indexed token,
        uint256 amount,
        uint256 developerAmount,
        uint256 platformAmount
    );
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event PlatformWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event DefaultPlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event EmergencyWithdrawal(address indexed token, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param _platformWallet Platform wallet address
     * @param _defaultPlatformFeeBps Default platform fee in basis points
     */
    function initialize(
        address _platformWallet,
        uint256 _defaultPlatformFeeBps
    ) public initializer {
        require(_platformWallet != address(0), "Invalid platform wallet");
        require(
            _defaultPlatformFeeBps >= MIN_PLATFORM_FEE_BPS &&
            _defaultPlatformFeeBps <= MAX_PLATFORM_FEE_BPS,
            "Invalid platform fee"
        );

        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        platformWallet = _platformWallet;
        defaultPlatformFeeBps = _defaultPlatformFeeBps;
    }

    /**
     * @notice Register a new tool
     * @param toolName Unique tool identifier
     * @param developer Developer wallet address
     * @param platformFeeBps Platform fee in basis points (0 = use default)
     */
    function registerTool(
        string calldata toolName,
        address developer,
        uint256 platformFeeBps
    ) external onlyOwner {
        require(developer != address(0), "Invalid developer address");
        require(!tools[toolName].active, "Tool already registered");

        uint256 feeBps = platformFeeBps == 0 ? defaultPlatformFeeBps : platformFeeBps;
        require(
            feeBps >= MIN_PLATFORM_FEE_BPS && feeBps <= MAX_PLATFORM_FEE_BPS,
            "Invalid platform fee"
        );

        tools[toolName] = ToolInfo({
            developer: developer,
            platformFeeBps: feeBps,
            totalRevenue: 0,
            totalCalls: 0,
            active: true
        });

        emit ToolRegistered(toolName, developer, feeBps);
    }

    /**
     * @notice Update tool information
     * @param toolName Tool identifier
     * @param newDeveloper New developer address (address(0) = no change)
     * @param newPlatformFeeBps New platform fee (0 = no change)
     */
    function updateTool(
        string calldata toolName,
        address newDeveloper,
        uint256 newPlatformFeeBps
    ) external onlyOwner {
        require(tools[toolName].active, "Tool not found");

        ToolInfo storage tool = tools[toolName];

        if (newDeveloper != address(0)) {
            tool.developer = newDeveloper;
        }

        if (newPlatformFeeBps > 0) {
            require(
                newPlatformFeeBps >= MIN_PLATFORM_FEE_BPS &&
                newPlatformFeeBps <= MAX_PLATFORM_FEE_BPS,
                "Invalid platform fee"
            );
            tool.platformFeeBps = newPlatformFeeBps;
        }

        emit ToolUpdated(toolName, tool.developer, tool.platformFeeBps);
    }

    /**
     * @notice Process payment for a tool
     * @param toolName Tool identifier
     * @param token Payment token address
     * @param amount Payment amount
     */
    function processPayment(
        string calldata toolName,
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(tools[toolName].active, "Tool not found or inactive");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be positive");

        ToolInfo storage tool = tools[toolName];

        // Calculate splits
        uint256 platformAmount = (amount * tool.platformFeeBps) / BPS_DENOMINATOR;
        uint256 developerAmount = amount - platformAmount;

        // Transfer tokens from payer
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer to developer
        IERC20(token).safeTransfer(tool.developer, developerAmount);

        // Transfer to platform
        IERC20(token).safeTransfer(platformWallet, platformAmount);

        // Update statistics
        tool.totalRevenue += amount;
        tool.totalCalls += 1;
        developerEarnings[tool.developer] += developerAmount;
        totalPlatformRevenue += platformAmount;

        emit PaymentProcessed(
            toolName,
            msg.sender,
            token,
            amount,
            developerAmount,
            platformAmount
        );
    }

    /**
     * @notice Batch process multiple payments
     * @param toolNames Array of tool identifiers
     * @param token Payment token address
     * @param amounts Array of payment amounts
     */
    function batchProcessPayments(
        string[] calldata toolNames,
        address token,
        uint256[] calldata amounts
    ) external nonReentrant whenNotPaused {
        require(toolNames.length == amounts.length, "Array length mismatch");
        require(supportedTokens[token], "Token not supported");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        // Transfer total amount once
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Process each payment
        for (uint256 i = 0; i < toolNames.length; i++) {
            string calldata toolName = toolNames[i];
            uint256 amount = amounts[i];

            require(tools[toolName].active, "Tool not found or inactive");
            require(amount > 0, "Amount must be positive");

            ToolInfo storage tool = tools[toolName];

            // Calculate splits
            uint256 platformAmount = (amount * tool.platformFeeBps) / BPS_DENOMINATOR;
            uint256 developerAmount = amount - platformAmount;

            // Transfer to developer
            IERC20(token).safeTransfer(tool.developer, developerAmount);

            // Transfer to platform
            IERC20(token).safeTransfer(platformWallet, platformAmount);

            // Update statistics
            tool.totalRevenue += amount;
            tool.totalCalls += 1;
            developerEarnings[tool.developer] += developerAmount;
            totalPlatformRevenue += platformAmount;

            emit PaymentProcessed(
                toolName,
                msg.sender,
                token,
                amount,
                developerAmount,
                platformAmount
            );
        }
    }

    /**
     * @notice Add supported payment token
     * @param token Token address
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Token already supported");

        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    /**
     * @notice Remove supported payment token
     * @param token Token address
     */
    function removeSupportedToken(address token) external onlyOwner {
        require(supportedTokens[token], "Token not supported");

        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    /**
     * @notice Update platform wallet
     * @param newPlatformWallet New platform wallet address
     */
    function updatePlatformWallet(address newPlatformWallet) external onlyOwner {
        require(newPlatformWallet != address(0), "Invalid wallet address");
        
        address oldWallet = platformWallet;
        platformWallet = newPlatformWallet;

        emit PlatformWalletUpdated(oldWallet, newPlatformWallet);
    }

    /**
     * @notice Update default platform fee
     * @param newFeeBps New fee in basis points
     */
    function updateDefaultPlatformFee(uint256 newFeeBps) external onlyOwner {
        require(
            newFeeBps >= MIN_PLATFORM_FEE_BPS && newFeeBps <= MAX_PLATFORM_FEE_BPS,
            "Invalid platform fee"
        );

        uint256 oldFeeBps = defaultPlatformFeeBps;
        defaultPlatformFeeBps = newFeeBps;

        emit DefaultPlatformFeeUpdated(oldFeeBps, newFeeBps);
    }

    /**
     * @notice Get tool information
     * @param toolName Tool identifier
     */
    function getToolInfo(string calldata toolName)
        external
        view
        returns (
            address developer,
            uint256 platformFeeBps,
            uint256 totalRevenue,
            uint256 totalCalls,
            bool active
        )
    {
        ToolInfo memory tool = tools[toolName];
        return (
            tool.developer,
            tool.platformFeeBps,
            tool.totalRevenue,
            tool.totalCalls,
            tool.active
        );
    }

    /**
     * @notice Emergency withdrawal (only owner)
     * @param token Token address (address(0) for native token)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            // Native token
            payable(owner()).transfer(amount);
        } else {
            // ERC-20 token
            IERC20(token).safeTransfer(owner(), amount);
        }

        emit EmergencyWithdrawal(token, amount);
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
     * @notice Receive native tokens
     */
    receive() external payable {}
}
