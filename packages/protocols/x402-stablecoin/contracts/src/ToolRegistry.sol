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
 * @title ToolRegistry
 * @author X402 Protocol
 * @notice On-chain marketplace for AI tools with payment processing
 * @dev Implements UUPS upgradeable pattern for future improvements
 * 
 * Features:
 * - Register and manage AI tools with pricing
 * - Process payments with automatic revenue splitting
 * - Support for USDs with auto-yield accumulation
 * - Developer self-service tool management
 * - Comprehensive event emission for indexing
 * 
 * Gas Optimizations (Arbitrum):
 * - Packed structs for storage efficiency
 * - Minimal storage operations
 * - Batch operations support
 */
contract ToolRegistry is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable,
    UUPSUpgradeable,
    IToolRegistry
{
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice USDs token address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    /// @notice Basis points denominator (100%)
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Maximum platform fee (50%)
    uint256 public constant MAX_PLATFORM_FEE_BPS = 5_000;

    /// @notice Minimum platform fee (1%)
    uint256 public constant MIN_PLATFORM_FEE_BPS = 100;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Platform wallet receiving fees
    address public platformWallet;

    /// @notice Platform fee in basis points (default 20%)
    uint256 public platformFeeBps;

    /// @notice Mapping of tool name hash to tool info
    mapping(bytes32 => ToolInfo) private _tools;

    /// @notice Mapping of tool name hash to tool name
    mapping(bytes32 => string) private _toolNames;

    /// @notice Mapping of developer to their registered tools
    mapping(address => bytes32[]) private _developerTools;

    /// @notice Total number of registered tools
    uint256 public totalTools;

    /// @notice Supported payment tokens
    mapping(address => bool) public supportedTokens;

    /// @notice Storage gap for upgrades
    uint256[44] private __gap;

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Ensure tool exists and is active
    modifier toolExists(string calldata name) {
        bytes32 toolId = _getToolId(name);
        if (!_tools[toolId].active) revert NotAllowed();
        _;
    }

    /// @notice Ensure caller is tool developer
    modifier onlyDeveloper(string calldata name) {
        bytes32 toolId = _getToolId(name);
        if (_tools[toolId].developer != msg.sender) revert Unauthorized();
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
     * @notice Initialize the ToolRegistry contract
     * @param _platformWallet Address to receive platform fees
     * @param _platformFeeBps Platform fee in basis points
     */
    function initialize(
        address _platformWallet,
        uint256 _platformFeeBps
    ) public initializer {
        if (_platformWallet == address(0)) revert InvalidAddress();
        if (_platformFeeBps < MIN_PLATFORM_FEE_BPS || _platformFeeBps > MAX_PLATFORM_FEE_BPS) {
            revert InvalidAmount();
        }

        __Ownable_init(msg.sender);
        __Pausable_init();

        platformWallet = _platformWallet;
        platformFeeBps = _platformFeeBps;

        // Add USDs as default supported token
        supportedTokens[USDS] = true;

        // Opt-in for USDs auto-yield
        IUSDs(USDS).rebaseOptIn();
    }

    /*//////////////////////////////////////////////////////////////
                          TOOL REGISTRATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Register a new tool in the marketplace
     * @param name Unique tool name (e.g., "weather-api", "image-gen")
     * @param developer Developer wallet address to receive payments
     * @param price Price per tool call in token units (18 decimals)
     * @param token Payment token address (must be supported)
     * @dev Emits ToolRegistered event for indexing
     */
    function registerTool(
        string calldata name,
        address developer,
        uint256 price,
        address token
    ) external override whenNotPaused {
        if (developer == address(0)) revert InvalidAddress();
        if (price == 0) revert InvalidAmount();
        if (!supportedTokens[token]) revert NotAllowed();

        bytes32 toolId = _getToolId(name);
        if (_tools[toolId].active) revert NotAllowed(); // Tool already exists

        _tools[toolId] = ToolInfo({
            developer: developer,
            paymentToken: token,
            pricePerCall: price,
            totalCalls: 0,
            totalRevenue: 0,
            active: true,
            createdAt: block.timestamp
        });

        _toolNames[toolId] = name;
        _developerTools[developer].push(toolId);
        totalTools++;

        emit ToolRegistered(name, developer, token, price);
    }

    /**
     * @notice Update tool price (developer only)
     * @param name Tool name
     * @param newPrice New price per call
     */
    function updateToolPrice(
        string calldata name,
        uint256 newPrice
    ) external override toolExists(name) onlyDeveloper(name) {
        if (newPrice == 0) revert InvalidAmount();

        bytes32 toolId = _getToolId(name);
        uint256 oldPrice = _tools[toolId].pricePerCall;
        _tools[toolId].pricePerCall = newPrice;

        emit ToolPriceUpdated(name, oldPrice, newPrice);
    }

    /**
     * @notice Update tool developer address
     * @param name Tool name
     * @param newDeveloper New developer address
     */
    function updateToolDeveloper(
        string calldata name,
        address newDeveloper
    ) external toolExists(name) onlyDeveloper(name) {
        if (newDeveloper == address(0)) revert InvalidAddress();

        bytes32 toolId = _getToolId(name);
        address oldDeveloper = _tools[toolId].developer;
        _tools[toolId].developer = newDeveloper;

        // Update developer tools mapping
        _developerTools[newDeveloper].push(toolId);
        _removeToolFromDeveloper(oldDeveloper, toolId);
    }

    /**
     * @notice Deactivate a tool (developer only)
     * @param name Tool name
     */
    function deactivateTool(
        string calldata name
    ) external toolExists(name) onlyDeveloper(name) {
        bytes32 toolId = _getToolId(name);
        _tools[toolId].active = false;
    }

    /**
     * @notice Reactivate a tool (developer only)
     * @param name Tool name
     */
    function reactivateTool(string calldata name) external onlyDeveloper(name) {
        bytes32 toolId = _getToolId(name);
        if (_tools[toolId].developer == address(0)) revert NotAllowed();
        _tools[toolId].active = true;
    }

    /*//////////////////////////////////////////////////////////////
                         PAYMENT PROCESSING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Process payment for a tool call
     * @param name Tool name
     * @dev Splits payment between developer and platform
     */
    function payForTool(
        string calldata name
    ) external nonReentrant whenNotPaused toolExists(name) {
        bytes32 toolId = _getToolId(name);
        ToolInfo storage tool = _tools[toolId];

        uint256 amount = tool.pricePerCall;
        address token = tool.paymentToken;

        // Calculate fee split
        uint256 platformAmount = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 developerAmount = amount - platformAmount;

        // Transfer from caller
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer to developer
        IERC20(token).safeTransfer(tool.developer, developerAmount);

        // Transfer to platform
        IERC20(token).safeTransfer(platformWallet, platformAmount);

        // Update stats
        tool.totalCalls++;
        tool.totalRevenue += amount;

        emit ToolCalled(name, msg.sender, amount);
    }

    /**
     * @notice Process payment for a tool call with custom amount
     * @param name Tool name
     * @param amount Custom payment amount
     */
    function payForToolWithAmount(
        string calldata name,
        uint256 amount
    ) external nonReentrant whenNotPaused toolExists(name) {
        if (amount == 0) revert InvalidAmount();

        bytes32 toolId = _getToolId(name);
        ToolInfo storage tool = _tools[toolId];

        address token = tool.paymentToken;

        // Calculate fee split
        uint256 platformAmount = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 developerAmount = amount - platformAmount;

        // Transfer from caller
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer to developer
        IERC20(token).safeTransfer(tool.developer, developerAmount);

        // Transfer to platform
        IERC20(token).safeTransfer(platformWallet, platformAmount);

        // Update stats
        tool.totalCalls++;
        tool.totalRevenue += amount;

        emit ToolCalled(name, msg.sender, amount);
    }

    /**
     * @notice Batch pay for multiple tools
     * @param names Array of tool names
     */
    function batchPayForTools(
        string[] calldata names
    ) external nonReentrant whenNotPaused {
        uint256 len = names.length;
        for (uint256 i = 0; i < len;) {
            bytes32 toolId = _getToolId(names[i]);
            ToolInfo storage tool = _tools[toolId];

            if (!tool.active) revert NotAllowed();

            uint256 amount = tool.pricePerCall;
            address token = tool.paymentToken;

            uint256 platformAmount = (amount * platformFeeBps) / BPS_DENOMINATOR;
            uint256 developerAmount = amount - platformAmount;

            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(token).safeTransfer(tool.developer, developerAmount);
            IERC20(token).safeTransfer(platformWallet, platformAmount);

            tool.totalCalls++;
            tool.totalRevenue += amount;

            emit ToolCalled(names[i], msg.sender, amount);

            unchecked { ++i; }
        }
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get tool information
     * @param name Tool name
     * @return developer Developer address
     * @return price Price per call
     * @return totalCalls Total calls made
     */
    function getToolInfo(
        string calldata name
    ) external view override returns (
        address developer,
        uint256 price,
        uint256 totalCalls
    ) {
        bytes32 toolId = _getToolId(name);
        ToolInfo storage tool = _tools[toolId];
        return (tool.developer, tool.pricePerCall, tool.totalCalls);
    }

    /**
     * @notice Get full tool information
     * @param name Tool name
     * @return Full ToolInfo struct
     */
    function getFullToolInfo(
        string calldata name
    ) external view returns (ToolInfo memory) {
        bytes32 toolId = _getToolId(name);
        return _tools[toolId];
    }

    /**
     * @notice Get tools registered by a developer
     * @param developer Developer address
     * @return Array of tool names
     */
    function getDeveloperTools(
        address developer
    ) external view returns (string[] memory) {
        bytes32[] storage toolIds = _developerTools[developer];
        uint256 len = toolIds.length;
        string[] memory names = new string[](len);

        for (uint256 i = 0; i < len;) {
            names[i] = _toolNames[toolIds[i]];
            unchecked { ++i; }
        }

        return names;
    }

    /**
     * @notice Check if a tool exists and is active
     * @param name Tool name
     * @return True if tool exists and is active
     */
    function isToolActive(string calldata name) external view returns (bool) {
        bytes32 toolId = _getToolId(name);
        return _tools[toolId].active;
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Add a supported payment token
     * @param token Token address
     */
    function addSupportedToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        supportedTokens[token] = true;
    }

    /**
     * @notice Remove a supported payment token
     * @param token Token address
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @notice Update platform wallet
     * @param newWallet New platform wallet address
     */
    function updatePlatformWallet(address newWallet) external onlyOwner {
        if (newWallet == address(0)) revert InvalidAddress();
        platformWallet = newWallet;
    }

    /**
     * @notice Update platform fee
     * @param newFeeBps New fee in basis points
     */
    function updatePlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps < MIN_PLATFORM_FEE_BPS || newFeeBps > MAX_PLATFORM_FEE_BPS) {
            revert InvalidAmount();
        }
        platformFeeBps = newFeeBps;
    }

    /**
     * @notice Force deactivate a tool (admin only)
     * @param name Tool name
     */
    function forceDeactivateTool(string calldata name) external onlyOwner {
        bytes32 toolId = _getToolId(name);
        _tools[toolId].active = false;
    }

    /**
     * @notice Emergency withdrawal
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
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

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get tool ID from name
     * @param name Tool name
     * @return Tool ID hash
     */
    function _getToolId(string calldata name) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(name));
    }

    /**
     * @notice Remove tool from developer's list
     * @param developer Developer address
     * @param toolId Tool ID to remove
     */
    function _removeToolFromDeveloper(
        address developer,
        bytes32 toolId
    ) internal {
        bytes32[] storage tools = _developerTools[developer];
        uint256 len = tools.length;

        for (uint256 i = 0; i < len;) {
            if (tools[i] == toolId) {
                tools[i] = tools[len - 1];
                tools.pop();
                break;
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Authorize upgrade (UUPS)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
