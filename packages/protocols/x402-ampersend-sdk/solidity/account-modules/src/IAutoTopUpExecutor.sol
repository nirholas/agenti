// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IAutoTopUpExecutor
 * @notice Interface for the ERC-7579 executor module that manages automatic ERC-20 token balance top-ups
 * @dev Enables permissionless triggering of pre-configured top-ups from Safe accounts to agent accounts
 */
interface IAutoTopUpExecutor {
    // ============ Structs ============

    /// @notice User-configurable parameters
    struct TopUpConfig {
        uint256 dailyLimit; // Target balance to maintain (max top-up per day)
        uint256 monthlyLimit; // Maximum total top-ups per month
        bool enabled; // Configuration active status
    }

    /// @notice Immutable identity and internal state (not user-editable)
    struct TopUpState {
        address agent; // Target agent account (immutable, part of config ID)
        address asset; // ERC-20 token address (immutable, part of config ID)
        uint256 lastTopUpDay; // Last top-up day (year * 10000 + month * 100 + day)
        uint256 monthlySpent; // Amount topped up this month
        uint256 lastResetMonth; // Last reset month (year * 12 + month)
    }

    // ============ Events ============

    event ModuleInstalled(address indexed account, uint256 initialConfigs);

    event ModuleUninstalled(address indexed account, uint256 removedConfigs);

    event TopUpConfigured(
        address indexed account, address indexed agent, address asset, bytes32 indexed configId, TopUpConfig config
    );

    event TopUpExecuted(
        address indexed account, address indexed agent, address asset, bytes32 indexed configId, uint256 amount
    );

    event TopUpFailed(
        address indexed account, address indexed agent, address asset, bytes32 indexed configId, string reason
    );

    event TopUpEnabled(address indexed account, address indexed agent, address asset, bytes32 indexed configId);

    event TopUpDisabled(address indexed account, address indexed agent, address asset, bytes32 indexed configId);

    // ============ Errors ============

    error ModuleNotInitialized(address account);
    error InvalidConfiguration();
    error ConfigNotFound();
    error Unauthorized(bytes32 configId, address caller);
    error InvalidAgent();
    error InvalidAsset();
    error AlreadyToppedUpToday();
    error MonthlyLimitExceeded();
    error InsufficientBalance();
    error TopUpNotEnabled();
    error TransferFailed();
    error InvalidTransferReturn(bytes result);
    error TransferReturnedFalse(bytes result);
    error InvalidConfigurationArrays();

    // ============ Module Management (ERC-7579) ============

    /**
     * @notice Called when module is installed for an account
     * @param data Encoded initial configurations (optional)
     * @dev Format: abi.encode(address[], address[], TopUpConfig[])
     * @dev Parallel arrays: agents, assets, and configs at same indices
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
     * @notice Configure a new top-up or update an existing one
     * @param agent The agent account to top up
     * @param asset The ERC-20 token address
     * @param config The top-up configuration
     * @return configId The generated config ID
     */
    function configureTopUp(address agent, address asset, TopUpConfig memory config) external returns (bytes32 configId);

    /**
     * @notice Update an existing top-up configuration by ID
     * @param configId The config ID to update
     * @param config The new configuration
     */
    function configureTopUpById(bytes32 configId, TopUpConfig memory config) external;

    /**
     * @notice Enable a top-up configuration
     * @param configId The config ID to enable
     */
    function enableTopUp(bytes32 configId) external;

    /**
     * @notice Disable a top-up configuration
     * @param configId The config ID to disable
     */
    function disableTopUp(bytes32 configId) external;

    // ============ Execution ============

    /**
     * @notice Trigger all top-ups for a specific account
     * @param account The account to trigger top-ups for
     * @dev Emits TopUpExecuted for each successful top-up
     */
    function triggerTopUps(address account) external;

    /**
     * @notice Trigger a specific top-up by config ID
     * @param account The account that owns the config
     * @param configId The config ID to trigger
     * @dev Emits TopUpExecuted if successful, reverts on transfer failure
     */
    function triggerTopUp(address account, bytes32 configId) external;

    // ============ View Functions ============

    /**
     * @notice Generate a config ID for given parameters
     * @param account The Safe account
     * @param agent The agent account
     * @param asset The token address
     * @return The generated config ID
     */
    function generateConfigId(address account, address agent, address asset) external pure returns (bytes32);

    /**
     * @notice Get all top-up configurations for an account
     * @param account The account to query
     * @return configs Array of configurations
     * @return states Array of states
     */
    function getTopUpConfigs(address account)
        external
        view
        returns (TopUpConfig[] memory configs, TopUpState[] memory states);

    /**
     * @notice Check if a top-up can be executed
     * @param account The account that owns the config
     * @param configId The config ID to check
     * @return canExecute Whether the top-up can be executed
     * @return reason Reason if cannot execute
     */
    function canExecuteTopUp(address account, bytes32 configId)
        external
        view
        returns (bool canExecute, string memory reason);

    /**
     * @notice Get top-up by config ID
     * @param configId The config ID
     * @return config The configuration
     * @return state The state
     */
    function getTopUpById(bytes32 configId) external view returns (TopUpConfig memory config, TopUpState memory state);

    /**
     * @notice Get top-up by account, agent, and asset
     * @param account The Safe account
     * @param agent The agent account
     * @param asset The token address
     * @return config The configuration
     * @return state The state
     */
    function getTopUp(address account, address agent, address asset)
        external
        view
        returns (TopUpConfig memory config, TopUpState memory state);
}
