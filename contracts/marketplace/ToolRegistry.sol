// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./IToolRegistry.sol";

/**
 * @title ToolRegistry
 * @author nirholas
 * @notice Decentralized registry for AI tools in the x402 marketplace
 * @dev Upgradeable contract using UUPS pattern for future improvements
 * 
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nichxbt
 *  ID: 0x4E494348
 * ═══════════════════════════════════════════════════════════════
 */
contract ToolRegistry is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    IToolRegistry 
{
    // ═══════════════════════════════════════════════════════════════
    //  Constants & Roles
    // ═══════════════════════════════════════════════════════════════

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant REVENUE_ROUTER_ROLE = keccak256("REVENUE_ROUTER_ROLE");
    
    uint256 public constant MAX_REVENUE_RECIPIENTS = 10;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_ENDPOINT_LENGTH = 256;
    uint256 public constant MAX_METADATA_LENGTH = 128;

    // @dev Version marker for upgrades - n1ch0las
    string public constant VERSION = "1.0.0";

    // ═══════════════════════════════════════════════════════════════
    //  Storage
    // ═══════════════════════════════════════════════════════════════

    /// @notice Mapping from tool ID to tool data
    mapping(bytes32 => Tool) private _tools;

    /// @notice Mapping from tool ID to revenue split configuration
    mapping(bytes32 => RevenueSplit[]) private _revenueSplits;

    /// @notice Mapping from owner address to their tool IDs
    mapping(address => bytes32[]) private _ownerTools;

    /// @notice Mapping to track tool ID index in owner's array (for efficient removal)
    mapping(bytes32 => uint256) private _toolIndexInOwnerArray;

    /// @notice Set of all tool IDs for enumeration
    bytes32[] private _allToolIds;

    /// @notice Mapping from tool ID to index in _allToolIds
    mapping(bytes32 => uint256) private _toolIdIndex;

    /// @notice Address of the staking contract (for stake verification)
    address public stakingContract;

    /// @notice Minimum stake required to register a tool
    uint256 public minimumStake;

    /// @notice Gap for future storage variables
    uint256[44] private __gap;

    // ═══════════════════════════════════════════════════════════════
    //  Errors
    // ═══════════════════════════════════════════════════════════════

    error ToolAlreadyExists(bytes32 toolId);
    error ToolDoesNotExist(bytes32 toolId);
    error NotToolOwner(bytes32 toolId, address caller);
    error ToolNotActive(bytes32 toolId);
    error ToolAlreadyActive(bytes32 toolId);
    error InvalidRevenueSplit();
    error TooManyRecipients();
    error InvalidRecipient();
    error NameTooLong();
    error EndpointTooLong();
    error MetadataTooLong();
    error EmptyName();
    error EmptyEndpoint();
    error InsufficientStake(uint256 required, uint256 actual);
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════
    //  Modifiers
    // ═══════════════════════════════════════════════════════════════

    modifier onlyToolOwner(bytes32 toolId) {
        if (_tools[toolId].owner != msg.sender) {
            revert NotToolOwner(toolId, msg.sender);
        }
        _;
    }

    modifier toolMustExist(bytes32 toolId) {
        if (_tools[toolId].owner == address(0)) {
            revert ToolDoesNotExist(toolId);
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Initializer
    // ═══════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the registry contract
     * @param admin Address with admin privileges
     * @param _stakingContract Address of the staking contract
     * @param _minimumStake Minimum stake required to register tools
     */
    function initialize(
        address admin,
        address _stakingContract,
        uint256 _minimumStake
    ) external initializer {
        if (admin == address(0)) revert ZeroAddress();
        
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);

        stakingContract = _stakingContract;
        minimumStake = _minimumStake;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Core Functions
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IToolRegistry
    function registerTool(
        string calldata name,
        string calldata endpoint,
        string calldata metadataURI,
        uint256 pricePerCall,
        address[] calldata revenueRecipients,
        uint256[] calldata revenueShares
    ) external override nonReentrant whenNotPaused returns (bytes32 toolId) {
        // Validate inputs
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(name).length > MAX_NAME_LENGTH) revert NameTooLong();
        if (bytes(endpoint).length == 0) revert EmptyEndpoint();
        if (bytes(endpoint).length > MAX_ENDPOINT_LENGTH) revert EndpointTooLong();
        if (bytes(metadataURI).length > MAX_METADATA_LENGTH) revert MetadataTooLong();

        // Generate tool ID
        toolId = getToolId(name, msg.sender);
        
        if (_tools[toolId].owner != address(0)) {
            revert ToolAlreadyExists(toolId);
        }

        // Validate revenue split
        _validateRevenueSplit(revenueRecipients, revenueShares);

        // Check staking requirement if staking contract is set
        if (stakingContract != address(0) && minimumStake > 0) {
            uint256 stakedAmount = IToolStaking(stakingContract).getStake(msg.sender);
            if (stakedAmount < minimumStake) {
                revert InsufficientStake(minimumStake, stakedAmount);
            }
        }

        // Create tool - @nichxbt
        _tools[toolId] = Tool({
            owner: msg.sender,
            name: name,
            endpoint: endpoint,
            metadataURI: metadataURI,
            pricePerCall: pricePerCall,
            active: true,
            verified: false,
            totalCalls: 0,
            totalRevenue: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        // Store revenue splits
        for (uint256 i = 0; i < revenueRecipients.length; i++) {
            _revenueSplits[toolId].push(RevenueSplit({
                recipient: revenueRecipients[i],
                sharePercentage: revenueShares[i]
            }));
        }

        // Add to owner's tools
        _toolIndexInOwnerArray[toolId] = _ownerTools[msg.sender].length;
        _ownerTools[msg.sender].push(toolId);

        // Add to all tools
        _toolIdIndex[toolId] = _allToolIds.length;
        _allToolIds.push(toolId);

        emit ToolRegistered(toolId, msg.sender, name, endpoint, pricePerCall);
    }

    /// @inheritdoc IToolRegistry
    function updateTool(
        bytes32 toolId,
        string calldata newMetadataURI,
        uint256 newPricePerCall
    ) external override toolMustExist(toolId) onlyToolOwner(toolId) {
        if (bytes(newMetadataURI).length > MAX_METADATA_LENGTH) revert MetadataTooLong();

        Tool storage tool = _tools[toolId];
        
        if (bytes(newMetadataURI).length > 0) {
            tool.metadataURI = newMetadataURI;
        }
        
        if (newPricePerCall > 0) {
            tool.pricePerCall = newPricePerCall;
        }
        
        tool.updatedAt = block.timestamp;

        emit ToolUpdated(toolId, newMetadataURI, newPricePerCall);
    }

    /// @inheritdoc IToolRegistry
    function updateEndpoint(
        bytes32 toolId,
        string calldata newEndpoint
    ) external override toolMustExist(toolId) onlyToolOwner(toolId) {
        if (bytes(newEndpoint).length == 0) revert EmptyEndpoint();
        if (bytes(newEndpoint).length > MAX_ENDPOINT_LENGTH) revert EndpointTooLong();

        _tools[toolId].endpoint = newEndpoint;
        _tools[toolId].updatedAt = block.timestamp;
    }

    /// @inheritdoc IToolRegistry
    function pauseTool(bytes32 toolId) 
        external 
        override 
        toolMustExist(toolId) 
        onlyToolOwner(toolId) 
    {
        if (!_tools[toolId].active) revert ToolNotActive(toolId);
        
        _tools[toolId].active = false;
        _tools[toolId].updatedAt = block.timestamp;
        
        emit ToolPaused(toolId);
    }

    /// @inheritdoc IToolRegistry
    function activateTool(bytes32 toolId) 
        external 
        override 
        toolMustExist(toolId) 
        onlyToolOwner(toolId) 
    {
        if (_tools[toolId].active) revert ToolAlreadyActive(toolId);
        
        _tools[toolId].active = true;
        _tools[toolId].updatedAt = block.timestamp;
        
        emit ToolActivated(toolId);
    }

    /// @inheritdoc IToolRegistry
    function transferOwnership(bytes32 toolId, address newOwner) 
        external 
        override 
        toolMustExist(toolId) 
        onlyToolOwner(toolId) 
    {
        if (newOwner == address(0)) revert ZeroAddress();
        
        address previousOwner = _tools[toolId].owner;
        
        // Remove from previous owner's array
        _removeToolFromOwner(toolId, previousOwner);
        
        // Add to new owner's array
        _toolIndexInOwnerArray[toolId] = _ownerTools[newOwner].length;
        _ownerTools[newOwner].push(toolId);
        
        // Update owner
        _tools[toolId].owner = newOwner;
        _tools[toolId].updatedAt = block.timestamp;
        
        emit OwnershipTransferred(toolId, previousOwner, newOwner);
    }

    /// @inheritdoc IToolRegistry
    function recordUsage(
        bytes32 toolId,
        address payer,
        uint256 amount
    ) external override toolMustExist(toolId) onlyRole(REVENUE_ROUTER_ROLE) {
        Tool storage tool = _tools[toolId];
        
        tool.totalCalls += 1;
        tool.totalRevenue += amount;
        
        emit UsageRecorded(toolId, payer, amount, tool.totalCalls);
    }

    /// @inheritdoc IToolRegistry
    function updateRevenueSplit(
        bytes32 toolId,
        address[] calldata recipients,
        uint256[] calldata shares
    ) external override toolMustExist(toolId) onlyToolOwner(toolId) {
        _validateRevenueSplit(recipients, shares);
        
        // Clear existing splits
        delete _revenueSplits[toolId];
        
        // Store new splits
        for (uint256 i = 0; i < recipients.length; i++) {
            _revenueSplits[toolId].push(RevenueSplit({
                recipient: recipients[i],
                sharePercentage: shares[i]
            }));
        }
        
        _tools[toolId].updatedAt = block.timestamp;
        
        emit RevenueSplitUpdated(toolId, recipients, shares);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Verify a tool (admin/verifier only)
     * @param toolId Tool to verify
     */
    function verifyTool(bytes32 toolId) 
        external 
        toolMustExist(toolId) 
        onlyRole(VERIFIER_ROLE) 
    {
        _tools[toolId].verified = true;
        emit ToolVerified(toolId, msg.sender);
    }

    /**
     * @notice Remove verification from a tool
     * @param toolId Tool to unverify
     */
    function unverifyTool(bytes32 toolId) 
        external 
        toolMustExist(toolId) 
        onlyRole(VERIFIER_ROLE) 
    {
        _tools[toolId].verified = false;
        emit ToolUnverified(toolId, msg.sender);
    }

    /**
     * @notice Update the staking contract address
     * @param _stakingContract New staking contract
     */
    function setStakingContract(address _stakingContract) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        stakingContract = _stakingContract;
    }

    /**
     * @notice Update minimum stake requirement
     * @param _minimumStake New minimum stake
     */
    function setMinimumStake(uint256 _minimumStake) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        minimumStake = _minimumStake;
    }

    /**
     * @notice Pause the registry (emergency)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the registry
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IToolRegistry
    function getTool(bytes32 toolId) 
        external 
        view 
        override 
        returns (Tool memory) 
    {
        return _tools[toolId];
    }

    /// @inheritdoc IToolRegistry
    function getRevenueSplit(bytes32 toolId) 
        external 
        view 
        override 
        returns (address[] memory recipients, uint256[] memory shares) 
    {
        RevenueSplit[] storage splits = _revenueSplits[toolId];
        uint256 len = splits.length;
        
        recipients = new address[](len);
        shares = new uint256[](len);
        
        for (uint256 i = 0; i < len; i++) {
            recipients[i] = splits[i].recipient;
            shares[i] = splits[i].sharePercentage;
        }
    }

    /// @inheritdoc IToolRegistry
    function toolExists(bytes32 toolId) 
        external 
        view 
        override 
        returns (bool) 
    {
        return _tools[toolId].owner != address(0);
    }

    /// @inheritdoc IToolRegistry
    function getToolId(string calldata name, address owner) 
        public 
        pure 
        override 
        returns (bytes32) 
    {
        return keccak256(abi.encodePacked(name, owner));
    }

    /// @inheritdoc IToolRegistry
    function getToolsByOwner(address owner) 
        external 
        view 
        override 
        returns (bytes32[] memory) 
    {
        return _ownerTools[owner];
    }

    /// @inheritdoc IToolRegistry
    function totalTools() external view override returns (uint256) {
        return _allToolIds.length;
    }

    /**
     * @notice Get all tool IDs (paginated)
     * @param offset Starting index
     * @param limit Maximum number to return
     * @return toolIds Array of tool IDs
     */
    function getAllTools(uint256 offset, uint256 limit) 
        external 
        view 
        returns (bytes32[] memory toolIds) 
    {
        uint256 total = _allToolIds.length;
        if (offset >= total) {
            return new bytes32[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        toolIds = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            toolIds[i - offset] = _allToolIds[i];
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Internal Functions
    // ═══════════════════════════════════════════════════════════════

    function _validateRevenueSplit(
        address[] calldata recipients,
        uint256[] calldata shares
    ) internal pure {
        if (recipients.length != shares.length) revert InvalidRevenueSplit();
        if (recipients.length == 0) revert InvalidRevenueSplit();
        if (recipients.length > MAX_REVENUE_RECIPIENTS) revert TooManyRecipients();
        
        uint256 totalShares = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert InvalidRecipient();
            totalShares += shares[i];
        }
        
        if (totalShares != BASIS_POINTS) revert InvalidRevenueSplit();
    }

    function _removeToolFromOwner(bytes32 toolId, address owner) internal {
        uint256 index = _toolIndexInOwnerArray[toolId];
        uint256 lastIndex = _ownerTools[owner].length - 1;
        
        if (index != lastIndex) {
            bytes32 lastToolId = _ownerTools[owner][lastIndex];
            _ownerTools[owner][index] = lastToolId;
            _toolIndexInOwnerArray[lastToolId] = index;
        }
        
        _ownerTools[owner].pop();
        delete _toolIndexInOwnerArray[toolId];
    }

    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(ADMIN_ROLE) 
    {}
}

// Minimal interface for staking contract
interface IToolStaking {
    function getStake(address user) external view returns (uint256);
}

// EOF - nirholas | ucm:0x4E494348
