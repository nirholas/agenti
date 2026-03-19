// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAutoCollectExecutor} from "./IAutoCollectExecutor.sol";
import {ERC7579ExecutorBase} from "modulekit/src/module-bases/ERC7579ExecutorBase.sol";
import {IModule} from "modulekit/src/accounts/common/interfaces/IERC7579Module.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BokkyPooBahsDateTimeLibrary} from "BokkyPooBahsDateTimeLibrary/contracts/BokkyPooBahsDateTimeLibrary.sol";

/**
 * @title AutoCollectExecutor
 * @notice ERC-7579 executor module for automatic ERC-20 token collection from service accounts
 * @dev Enables permissionless triggering of pre-configured collections from service accounts to main accounts
 */
contract AutoCollectExecutor is IAutoCollectExecutor, ERC7579ExecutorBase, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // ============ Storage ============

    /// @dev ERC-7201 namespace for storage
    /// @custom:storage-location erc7201:autocollect.storage.AutoCollectExecutor
    // keccak256(abi.encode(uint256(keccak256("autocollect.storage.AutoCollectExecutor")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_NAMESPACE = 0x6ede4012bbf78b7156310dfe77e035f310125e160497f34e20b746b314ff2200;

    /// @custom:storage-namespace AutoCollectStorage
    struct AutoCollectStorage {
        // Config ID => user configuration
        mapping(bytes32 => CollectConfig) configs;
        // Config ID => internal state
        mapping(bytes32 => CollectState) states;
        // Account => set of config IDs
        mapping(address => EnumerableSet.Bytes32Set) accountConfigs;
        // Account => initialized status
        mapping(address => bool) initializedAccounts;
    }

    // ============ Constructor ============

    constructor() {}

    // ============ Storage Access ============

    function _getStorage() private pure returns (AutoCollectStorage storage $) {
        assembly {
            $.slot := STORAGE_NAMESPACE
        }
    }

    // ============ Module Management (ERC-7579) ============

    /**
     * @notice Called when module is installed for an account
     * @param data Encoded initial configurations (optional)
     * @dev Format: abi.encode(address[], CollectConfig[])
     * @dev Parallel arrays: assets and configs at same indices
     */
    function onInstall(bytes calldata data) external override(IAutoCollectExecutor, IModule) {
        AutoCollectStorage storage $ = _getStorage();
        address account = msg.sender;

        // Prevent double initialization
        require(!$.initializedAccounts[account], "Already initialized");

        // Mark account as initialized
        $.initializedAccounts[account] = true;

        uint256 configCount = 0;

        // Optional: decode and set initial configurations
        if (data.length > 0) {
            // Decode as parallel arrays: assets and configs
            (address[] memory assets, CollectConfig[] memory configs) = abi.decode(data, (address[], CollectConfig[]));

            // Validate array lengths match
            require(assets.length == configs.length, InvalidConfigurationArrays());

            configCount = assets.length;

            // Process each configuration using the public function
            // This handles all validation, state initialization, and event emission
            for (uint256 i = 0; i < assets.length; i++) {
                configureCollection(assets[i], configs[i]);
            }
        }

        emit ModuleInstalled(account, configCount);
    }

    /**
     * @notice Called when module is uninstalled for an account
     * @dev Additional data parameter is unused
     */
    function onUninstall(bytes calldata) external override(IAutoCollectExecutor, IModule) {
        AutoCollectStorage storage $ = _getStorage();

        // Clean up all configs for this account
        address account = msg.sender;
        bytes32[] memory configIds = $.accountConfigs[account].values();

        // Iterate in reverse to efficiently remove from set while deleting configs
        for (uint256 i = configIds.length; i > 0; i--) {
            bytes32 configId = configIds[i - 1];
            delete $.configs[configId];
            delete $.states[configId];
            $.accountConfigs[account].remove(configId);
        }

        // Mark account as uninitialized
        delete $.initializedAccounts[account];

        emit ModuleUninstalled(account, configIds.length);
    }

    /**
     * @notice Returns whether this module is of a certain type
     * @param _typeId The type ID to check
     * @return True if this module is an executor (type 0x01)
     */
    function isModuleType(uint256 _typeId) external pure override(IAutoCollectExecutor, IModule) returns (bool) {
        return _typeId == TYPE_EXECUTOR;
    }

    // ============ Configuration Management ============

    /**
     * @notice Configure a new collection or update an existing one
     * @param asset The ERC-20 token address
     * @param config The collection configuration
     * @return configId The generated config ID
     */
    function configureCollection(address asset, CollectConfig memory config) public returns (bytes32 configId) {
        require(asset != address(0), InvalidAsset());
        require(config.target != address(0), InvalidTarget());

        AutoCollectStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[msg.sender], ModuleNotInitialized(msg.sender));

        configId = generateConfigId(msg.sender, asset);

        // Check if this is a new config
        if ($.states[configId].asset == address(0)) {
            // Initialize state for new config
            $.states[configId] = CollectState({asset: asset, lastCollectDate: 0});

            // Add to account's config set
            $.accountConfigs[msg.sender].add(configId);
        }

        // Update the configuration
        _configureCollection(configId, config);
    }

    /**
     * @notice Update an existing collection configuration by ID
     * @param configId The config ID to update
     * @param config The new configuration
     */
    function configureCollectionById(bytes32 configId, CollectConfig memory config) external {
        AutoCollectStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[msg.sender], ModuleNotInitialized(msg.sender));

        // Verify config exists and caller owns it
        require($.states[configId].asset != address(0), ConfigNotFound());
        require($.accountConfigs[msg.sender].contains(configId), Unauthorized(configId, msg.sender));

        // Update the configuration
        _configureCollection(configId, config);
    }

    /**
     * @dev Internal function to configure a collection
     * @dev IMPORTANT: This function does NOT validate that the config exists or belongs to the caller.
     * @dev Caller must perform these checks before calling this function.
     * @param configId The config ID to configure
     * @param config The configuration to apply
     */
    function _configureCollection(bytes32 configId, CollectConfig memory config) internal {
        require(config.target != address(0), InvalidTarget());

        AutoCollectStorage storage $ = _getStorage();
        CollectState memory state = $.states[configId];

        bool wasEnabled = $.configs[configId].enabled;
        $.configs[configId] = config;

        emit CollectionConfigured(msg.sender, state.asset, config.target, configId, config);

        // Emit enable/disable events if status changed
        if (config.enabled && !wasEnabled) {
            emit CollectionEnabled(msg.sender, state.asset, configId);
        } else if (!config.enabled && wasEnabled) {
            emit CollectionDisabled(msg.sender, state.asset, configId);
        }
    }

    /**
     * @notice Enable a collection configuration by asset address
     * @param asset The asset address
     */
    function enableCollection(address asset) external {
        bytes32 configId = generateConfigId(msg.sender, asset);
        enableCollection(configId);
    }

    /**
     * @notice Enable a collection configuration by config ID
     * @param configId The config ID to enable
     */
    function enableCollection(bytes32 configId) public {
        AutoCollectStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[msg.sender], ModuleNotInitialized(msg.sender));

        CollectState memory state = $.states[configId];
        require(state.asset != address(0), ConfigNotFound());

        // Verify caller owns this config
        address account = msg.sender;
        require($.accountConfigs[account].contains(configId), Unauthorized(configId, account));

        if (!$.configs[configId].enabled) {
            $.configs[configId].enabled = true;
            emit CollectionEnabled(account, state.asset, configId);
        }
    }

    /**
     * @notice Disable a collection configuration by asset address
     * @param asset The asset address
     */
    function disableCollection(address asset) external {
        bytes32 configId = generateConfigId(msg.sender, asset);
        disableCollection(configId);
    }

    /**
     * @notice Disable a collection configuration by config ID
     * @param configId The config ID to disable
     */
    function disableCollection(bytes32 configId) public {
        AutoCollectStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[msg.sender], ModuleNotInitialized(msg.sender));

        CollectState memory state = $.states[configId];
        require(state.asset != address(0), ConfigNotFound());

        // Verify caller owns this config
        address account = msg.sender;
        require($.accountConfigs[account].contains(configId), Unauthorized(configId, account));

        if ($.configs[configId].enabled) {
            $.configs[configId].enabled = false;
            emit CollectionDisabled(account, state.asset, configId);
        }
    }

    // ============ Execution ============

    /**
     * @notice Trigger all collections for a specific account
     * @param account The service account to trigger collections for
     * @dev Emits CollectionExecuted for each successful collection
     */
    function triggerAllCollections(address account) external nonReentrant {
        AutoCollectStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[account], ModuleNotInitialized(account));

        bytes32[] memory configIds = $.accountConfigs[account].values();

        // Calculate date once for all configs
        (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(block.timestamp);

        for (uint256 i = 0; i < configIds.length; i++) {
            _tryExecuteCollection(configIds[i], account, year, month, day);
        }
    }

    /**
     * @notice Trigger a specific collection by asset
     * @param account The service account to collect from
     * @param asset The asset to collect
     * @dev Emits CollectionExecuted if successful, CollectionSkipped if conditions not met
     */
    function triggerCollection(address account, address asset) external nonReentrant {
        AutoCollectStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[account], ModuleNotInitialized(account));

        bytes32 configId = generateConfigId(account, asset);

        // Verify config exists and belongs to the account
        require($.states[configId].asset != address(0), ConfigNotFound());
        require($.accountConfigs[account].contains(configId), Unauthorized(configId, account));

        // Calculate current date
        (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(block.timestamp);

        _tryExecuteCollection(configId, account, year, month, day);
    }

    /**
     * @notice Execute a collection transfer (external for try-catch)
     * @param account The service account to transfer from
     * @param asset The token address
     * @param target The target address to transfer to
     * @param amount The amount to transfer
     * @dev Must be external/public for try-catch. Only callable by this contract.
     */
    function _executeCollectionTransfer(address account, address asset, address target, uint256 amount) external {
        require(msg.sender == address(this), "Only self");

        bytes memory result =
            _execute(account, asset, 0, abi.encodeWithSelector(IERC20.transfer.selector, target, amount));

        // Check return value (handle non-standard tokens like USDT that don't return bool)
        if (result.length > 0) {
            require(result.length == 32, InvalidTransferReturn(result));
            require(abi.decode(result, (bool)), TransferReturnedFalse(result));
        }
    }

    /**
     * @dev Internal function to attempt a collection execution
     * @param configId The config ID to execute
     * @param account The service account that owns the configuration
     * @param year Current year
     * @param month Current month (1-12)
     * @param day Current day (1-31)
     * @dev Emits CollectionExecuted on success, CollectionSkipped for conditions not met
     * @dev Uses graceful failure handling - does not revert on collection failures
     */
    function _tryExecuteCollection(bytes32 configId, address account, uint256 year, uint256 month, uint256 day)
        private
    {
        AutoCollectStorage storage $ = _getStorage();

        CollectConfig memory config = $.configs[configId];
        CollectState storage state = $.states[configId];

        // Validate and calculate collection
        (bool canExecute, uint256 currentBalance, uint256 collectAmount, uint256 currentDate,) =
            _validateAndCalculateCollection(config, state, account, year, month, day);

        if (!canExecute) {
            // Always emit skip event for complete visibility
            emit CollectionSkipped(
                account, state.asset, configId, currentBalance, config.threshold, config.minimumRemaining, collectAmount
            );
            return;
        }

        // Try to execute transfer - wrapped in try-catch to prevent batch operation failure
        // If this fails, other collections in the batch can still succeed
        try this._executeCollectionTransfer(account, state.asset, config.target, collectAmount) {
            // Update state AFTER successful transfer
            state.lastCollectDate = currentDate;
            emit CollectionExecuted(account, state.asset, config.target, configId, collectAmount);
        } catch Error(string memory reason) {
            emit CollectionFailed(account, state.asset, configId, reason);
        } catch (bytes memory) {
            emit CollectionFailed(account, state.asset, configId, "Transfer failed");
        }
    }

    /**
     * @dev Validates if a collection can be executed and calculates the amount
     * @param config The collection configuration
     * @param state The collection state (storage pointer for reading)
     * @param account The service account
     * @param year Current year
     * @param month Current month (1-12)
     * @param day Current day (1-31)
     * @return canExecute Whether the collection can be executed
     * @return currentBalance The current balance of the asset in the account
     * @return collectAmount The amount that would be collected (balance - minimumRemaining)
     * @return currentDate The encoded current date (YYYYMMDD)
     * @return reason Error message if cannot execute
     */
    function _validateAndCalculateCollection(
        CollectConfig memory config,
        CollectState memory state,
        address account,
        uint256 year,
        uint256 month,
        uint256 day
    )
        private
        view
        returns (
            bool canExecute,
            uint256 currentBalance,
            uint256 collectAmount,
            uint256 currentDate,
            string memory reason
        )
    {
        // Check if enabled
        if (!config.enabled) {
            return (false, 0, 0, 0, "Collection not enabled");
        }

        // Check once per day limit using calendar days
        currentDate = year * 10000 + month * 100 + day;
        if (currentDate <= state.lastCollectDate) {
            return (false, 0, 0, currentDate, "Already collected today");
        }

        // Get current balance
        currentBalance = IERC20(state.asset).balanceOf(account);

        // Calculate collect amount (balance minus what we want to keep)
        collectAmount = currentBalance >= config.minimumRemaining ? currentBalance - config.minimumRemaining : 0;

        // Check for zero balance (skip collection)
        if (currentBalance == 0) {
            return (false, currentBalance, collectAmount, currentDate, "Balance is zero");
        }

        // Check threshold requirement
        if (currentBalance < config.threshold) {
            return (false, currentBalance, collectAmount, currentDate, "Balance below threshold");
        }

        // Skip if nothing to collect
        if (collectAmount == 0) {
            return (false, currentBalance, collectAmount, currentDate, "Collect amount would be zero");
        }

        return (true, currentBalance, collectAmount, currentDate, "");
    }

    // ============ View Functions ============

    /// @inheritdoc IAutoCollectExecutor
    function isInitialized(address smartAccount) external view override(IAutoCollectExecutor, IModule) returns (bool) {
        AutoCollectStorage storage $ = _getStorage();
        return $.initializedAccounts[smartAccount];
    }

    /**
     * @notice Generate a config ID for given parameters
     * @param account The service account
     * @param asset The token address
     * @return The generated config ID
     */
    function generateConfigId(address account, address asset) public pure returns (bytes32) {
        return keccak256(abi.encode("CollectConfig", account, asset));
    }

    /**
     * @notice Get all collection configurations for an account
     * @param account The account to query
     * @return configs Array of configurations
     * @return states Array of states
     */
    function getCollectionConfigs(address account)
        external
        view
        returns (CollectConfig[] memory configs, CollectState[] memory states)
    {
        AutoCollectStorage storage $ = _getStorage();

        bytes32[] memory configIds = $.accountConfigs[account].values();
        configs = new CollectConfig[](configIds.length);
        states = new CollectState[](configIds.length);

        for (uint256 i = 0; i < configIds.length; i++) {
            configs[i] = $.configs[configIds[i]];
            states[i] = $.states[configIds[i]];
        }
    }

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
        returns (bool canExecute, string memory reason)
    {
        AutoCollectStorage storage $ = _getStorage();

        bytes32 configId = generateConfigId(account, asset);
        CollectConfig memory config = $.configs[configId];
        CollectState memory state = $.states[configId];

        if (state.asset == address(0)) {
            return (false, "Config not found");
        }

        if (!$.accountConfigs[account].contains(configId)) {
            return (false, "Account doesn't own config");
        }

        if (!config.enabled) {
            return (false, "Collection disabled");
        }

        // Get current date
        (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(block.timestamp);

        // Use shared validation logic
        (bool canExec,,,, string memory errorReason) =
            _validateAndCalculateCollection(config, state, account, year, month, day);

        return (canExec, errorReason);
    }

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
        returns (CollectConfig memory config, CollectState memory state)
    {
        bytes32 configId = generateConfigId(account, asset);
        AutoCollectStorage storage $ = _getStorage();
        config = $.configs[configId];
        state = $.states[configId];
    }

    /**
     * @notice Get collection config by config ID
     * @param configId The config ID
     * @return config The configuration
     * @return state The state
     */
    function getCollectionConfigById(bytes32 configId)
        external
        view
        returns (CollectConfig memory config, CollectState memory state)
    {
        AutoCollectStorage storage $ = _getStorage();
        config = $.configs[configId];
        state = $.states[configId];
    }
}
