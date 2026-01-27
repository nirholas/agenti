// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IToolRegistry
 * @author nirholas
 * @notice Interface for the decentralized AI tool marketplace registry
 * @dev Defines the core functionality for tool registration and management
 */
interface IToolRegistry {
    // ═══════════════════════════════════════════════════════════════
    //  Structs
    // ═══════════════════════════════════════════════════════════════

    struct Tool {
        address owner;
        string name;
        string endpoint;
        string metadataURI;      // IPFS hash for extended metadata
        uint256 pricePerCall;    // in wei (USDs has 18 decimals)
        bool active;
        bool verified;
        uint256 totalCalls;
        uint256 totalRevenue;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct RevenueSplit {
        address recipient;
        uint256 sharePercentage; // basis points (10000 = 100%)
    }

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════

    event ToolRegistered(
        bytes32 indexed toolId,
        address indexed owner,
        string name,
        string endpoint,
        uint256 pricePerCall
    );

    event ToolUpdated(
        bytes32 indexed toolId,
        string metadataURI,
        uint256 pricePerCall
    );

    event ToolPaused(bytes32 indexed toolId);
    event ToolActivated(bytes32 indexed toolId);
    event ToolVerified(bytes32 indexed toolId, address verifier);
    event ToolUnverified(bytes32 indexed toolId, address verifier);

    event OwnershipTransferred(
        bytes32 indexed toolId,
        address indexed previousOwner,
        address indexed newOwner
    );

    event UsageRecorded(
        bytes32 indexed toolId,
        address indexed payer,
        uint256 amount,
        uint256 totalCalls
    );

    event RevenueSplitUpdated(
        bytes32 indexed toolId,
        address[] recipients,
        uint256[] shares
    );

    // ═══════════════════════════════════════════════════════════════
    //  Core Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Register a new tool in the marketplace
     * @param name Human-readable tool name
     * @param endpoint API endpoint URL or ENS name
     * @param metadataURI IPFS hash containing extended metadata
     * @param pricePerCall Price per API call in USDs wei
     * @param revenueRecipients Addresses to receive revenue splits
     * @param revenueShares Share percentages in basis points (must sum to 10000)
     * @return toolId Unique identifier for the registered tool
     */
    function registerTool(
        string calldata name,
        string calldata endpoint,
        string calldata metadataURI,
        uint256 pricePerCall,
        address[] calldata revenueRecipients,
        uint256[] calldata revenueShares
    ) external returns (bytes32 toolId);

    /**
     * @notice Update tool metadata and pricing
     * @param toolId Unique tool identifier
     * @param newMetadataURI New IPFS metadata hash
     * @param newPricePerCall New price per call (0 to keep current)
     */
    function updateTool(
        bytes32 toolId,
        string calldata newMetadataURI,
        uint256 newPricePerCall
    ) external;

    /**
     * @notice Update tool endpoint
     * @param toolId Unique tool identifier
     * @param newEndpoint New API endpoint URL
     */
    function updateEndpoint(
        bytes32 toolId,
        string calldata newEndpoint
    ) external;

    /**
     * @notice Pause a tool (stops accepting calls)
     * @param toolId Unique tool identifier
     */
    function pauseTool(bytes32 toolId) external;

    /**
     * @notice Reactivate a paused tool
     * @param toolId Unique tool identifier
     */
    function activateTool(bytes32 toolId) external;

    /**
     * @notice Transfer tool ownership to a new address
     * @param toolId Unique tool identifier
     * @param newOwner Address of the new owner
     */
    function transferOwnership(bytes32 toolId, address newOwner) external;

    /**
     * @notice Record a tool usage (called by RevenueRouter)
     * @param toolId Unique tool identifier
     * @param payer Address that paid for the call
     * @param amount Amount paid in USDs wei
     */
    function recordUsage(
        bytes32 toolId,
        address payer,
        uint256 amount
    ) external;

    /**
     * @notice Update revenue split configuration
     * @param toolId Unique tool identifier
     * @param recipients New revenue recipients
     * @param shares New share percentages
     */
    function updateRevenueSplit(
        bytes32 toolId,
        address[] calldata recipients,
        uint256[] calldata shares
    ) external;

    // ═══════════════════════════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Get tool information by ID
     * @param toolId Unique tool identifier
     * @return tool The tool struct
     */
    function getTool(bytes32 toolId) external view returns (Tool memory tool);

    /**
     * @notice Get revenue split configuration for a tool
     * @param toolId Unique tool identifier
     * @return recipients Array of recipient addresses
     * @return shares Array of share percentages
     */
    function getRevenueSplit(bytes32 toolId) 
        external 
        view 
        returns (address[] memory recipients, uint256[] memory shares);

    /**
     * @notice Check if a tool exists
     * @param toolId Unique tool identifier
     * @return exists True if tool exists
     */
    function toolExists(bytes32 toolId) external view returns (bool exists);

    /**
     * @notice Get tool ID by name and owner
     * @param name Tool name
     * @param owner Tool owner address
     * @return toolId The tool's unique identifier
     */
    function getToolId(string calldata name, address owner) 
        external 
        pure 
        returns (bytes32 toolId);

    /**
     * @notice Get all tools owned by an address
     * @param owner Owner address
     * @return toolIds Array of tool IDs
     */
    function getToolsByOwner(address owner) 
        external 
        view 
        returns (bytes32[] memory toolIds);

    /**
     * @notice Get total number of registered tools
     * @return count Total tool count
     */
    function totalTools() external view returns (uint256 count);
}
