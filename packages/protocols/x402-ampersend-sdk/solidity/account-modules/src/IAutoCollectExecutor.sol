// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IAutoCollectExecutor
 * @notice Interface for the ERC-7579 executor module that manages automatic ERC-20 token collection
 * @dev Enables permissionless triggering of pre-configured collections from service accounts to main accounts
 */
interface IAutoCollectExecutor {
    // ============ Structs ============

    /// @notice User-configurable parameters
    struct CollectConfig {
        address target; // Main account to collect funds to
        uint256 threshold; // Minimum balance to trigger collection (0 = no threshold)
        uint256 minimumRemaining; // Minimum amount to leave in account after collection (0 = collect all)
        bool enabled; // Configuration active status
    }

    /// @notice Immutable identity and internal state (not user-editable)
    struct CollectState {
        address asset; // ERC-20 token address (immutable, part of config ID)
        uint256 lastCollectDate; // Last collection date (YYYYMMDD format)
    }

    // ============ Events ============

    event ModuleInstalled(address indexed account, uint256 initialConfigs);

    event ModuleUninstalled(address indexed account, uint256 removedConfigs);

    event CollectionConfigured(
        address indexed account, address indexed asset, address target, bytes32 indexed configId, CollectConfig config
    );

    event CollectionExecuted(
        address indexed account, address indexed asset, address target, bytes32 indexed configId, uint256 amount
    );

    event CollectionSkipped(
        address indexed account,
        address indexed asset,
        bytes32 indexed configId,
        uint256 balance,
        uint256 threshold,
        uint256 minimumRemaining,
        uint256 collectAmount
    );

    event CollectionFailed(address indexed account, address indexed asset, bytes32 indexed configId, string reason);

    event CollectionEnabled(address indexed account, address indexed asset, bytes32 indexed configId);

    event CollectionDisabled(address indexed account, address indexed asset, bytes32 indexed configId);

    // ============ Errors ============

    error ModuleNotInitialized(address account);
    error InvalidConfiguration();
    error ConfigNotFound();
    error Unauthorized(bytes32 configId, address caller);
    error InvalidAsset();
    error InvalidTarget();
    error AlreadyCollectedToday();
    error BalanceBelowThreshold();
    error InvalidConfigurationArrays();
    error TransferFailed();
    error InvalidTransferReturn(bytes result);
    error TransferReturnedFalse(bytes result);

    // ============ Module Management (ERC-7579) ============

    /**
     * @notice Called when module is installed for an account
     * @param data Encoded initial configurations (optional)
     * @dev Format: abi.encode(address[], CollectConfig[])
     * @dev Parallel arrays: assets and configs at same indices
     */
    function onInstall(bytes calldata data) external;

    /**
     * @notice Called when module is uninstalled for an account
     * @dev Additional data parameter is unused
     */
    function onUninstall(bytes calldata) external;

    /**
     * @notice Returns whether this module is of a certain type
     * @param _typeId The type ID to check
     * @return True if this module is an executor (type 0x01)
     */
    function isModuleType(uint256 _typeId) external pure returns (bool);

    /**
     * @notice Check if module is initialized for an account
     * @param smartAccount The account to check
     * @return Whether the module is initialized
     */
    function isInitialized(address smartAccount) external view returns (bool);

    // ============ Configuration Management ============

    /**
     * @notice Configure a new collection or update an existing one
     * @param asset The ERC-20 token address
     * @param config The collection configuration
     * @return configId The generated config ID
     */
    function configureCollection(address asset, CollectConfig memory config) external returns (bytes32 configId);

    /**
     * @notice Update an existing collection configuration by ID
     * @param configId The config ID to update
     * @param config The new configuration
     */
    function configureCollectionById(bytes32 configId, CollectConfig memory config) external;

    /**
     * @notice Enable a collection configuration by asset address
     * @param asset The asset address
     */
    function enableCollection(address asset) external;

    /**
     * @notice Enable a collection configuration by config ID
     * @param configId The config ID to enable
     */
    function enableCollection(bytes32 configId) external;

    /**
     * @notice Disable a collection configuration by asset address
     * @param asset The asset address
     */
    function disableCollection(address asset) external;

    /**
     * @notice Disable a collection configuration by config ID
     * @param configId The config ID to disable
     */
    function disableCollection(bytes32 configId) external;

    // ============ Execution ============

    /**
     * @notice Trigger all collections for a specific account
     * @param account The service account to trigger collections for
     * @dev Emits CollectionExecuted for each successful collection
     */
    function triggerAllCollections(address account) external;

    /**
     * @notice Trigger a specific collection by asset
     * @param account The service account to collect from
     * @param asset The asset to collect
     * @dev Emits CollectionExecuted if successful, CollectionSkipped if conditions not met
     */
    function triggerCollection(address account, address asset) external;

    // ============ View Functions ============

    /**
     * @notice Generate a config ID for given parameters
     * @param account The service account
     * @param asset The token address
     * @return The generated config ID
     */
    function generateConfigId(address account, address asset) external pure returns (bytes32);

    /**
     * @notice Get all collection configurations for an account
     * @param account The account to query
     * @return configs Array of configurations
     * @return states Array of states
     */
    function getCollectionConfigs(address account)
        external
        view
        returns (CollectConfig[] memory configs, CollectState[] memory states);

    /**
     * @notice Check if a collection can be executed
     * @param account The account that owns the config
     * @param asset The asset to check
     * @return canExecute Whether the collection can be executed
     * @return reason Reason if cannot execute
     */
    function canExecuteCollection(address account, address asset)
        external
        view
        returns (bool canExecute, string memory reason);

    /**
     * @notice Get collection config by asset
     * @param account The service account
     * @param asset The token address
     * @return config The configuration
     * @return state The state
     */
    function getCollectionConfig(address account, address asset)
        external
        view
        returns (CollectConfig memory config, CollectState memory state);

    /**
     * @notice Get collection config by config ID
     * @param configId The config ID
     * @return config The configuration
     * @return state The state
     */
    function getCollectionConfigById(bytes32 configId)
        external
        view
        returns (CollectConfig memory config, CollectState memory state);
}
