// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAutoTopUpExecutor} from "./IAutoTopUpExecutor.sol";
import {ERC7579ExecutorBase} from "modulekit/src/module-bases/ERC7579ExecutorBase.sol";
import {IModule} from "modulekit/src/accounts/common/interfaces/IERC7579Module.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BokkyPooBahsDateTimeLibrary} from "BokkyPooBahsDateTimeLibrary/contracts/BokkyPooBahsDateTimeLibrary.sol";

/**
 * @title AutoTopUpExecutor
 * @notice ERC-7579 executor module for automatic ERC-20 token balance management
 * @dev Enables permissionless triggering of pre-configured top-ups from Safe accounts to agent accounts
 */
contract AutoTopUpExecutor is IAutoTopUpExecutor, ERC7579ExecutorBase, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using SafeERC20 for IERC20;

    // ============ Storage ============

    /// @dev ERC-7201 namespace for storage
    /// @custom:storage-location erc7201:autotopup.storage.AutoTopUpExecutor
    // keccak256(abi.encode(uint256(keccak256("autotopup.storage.AutoTopUpExecutor")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_NAMESPACE = 0xf1fdef444005737c1eaec423fc423d55d53d0a09b4618f0f50ba7fb8df2b0400;

    /// @custom:storage-namespace AutoTopUpStorage
    struct AutoTopUpStorage {
        // Config ID => user configuration
        mapping(bytes32 => TopUpConfig) configs;
        // Config ID => internal state
        mapping(bytes32 => TopUpState) states;
        // Account => set of config IDs
        mapping(address => EnumerableSet.Bytes32Set) accountConfigs;
        // Account => initialized status
        mapping(address => bool) initializedAccounts;
    }

    // ============ Constructor ============

    constructor() {}

    // ============ Storage Access ============

    function _getStorage() private pure returns (AutoTopUpStorage storage $) {
        assembly {
            $.slot := STORAGE_NAMESPACE
        }
    }

    // ============ Module Management (ERC-7579) ============

    /**
     * @notice Called when module is installed for an account
     * @param data Encoded initial configurations (optional)
     * @dev Format: abi.encode(address[], address[], TopUpConfig[])
     * @dev Parallel arrays: agents, assets, and configs at same indices
     */
    function onInstall(bytes calldata data) external override(IAutoTopUpExecutor, IModule) {
        AutoTopUpStorage storage $ = _getStorage();
        address account = msg.sender;

        // Prevent double initialization
        require(!$.initializedAccounts[account], "Already initialized");

        // Mark account as initialized
        $.initializedAccounts[account] = true;

        uint256 configCount = 0;

        // Optional: decode and set initial configurations
        if (data.length > 0) {
            // Decode as parallel arrays: agents, assets, and configs
            (address[] memory agents, address[] memory assets, TopUpConfig[] memory configs) =
                abi.decode(data, (address[], address[], TopUpConfig[]));

            // Validate array lengths match
            require(agents.length == assets.length && agents.length == configs.length, InvalidConfigurationArrays());

            configCount = agents.length;

            // Process each configuration using the public function
            // This handles all validation, state initialization, and event emission
            for (uint256 i = 0; i < agents.length; i++) {
                configureTopUp(agents[i], assets[i], configs[i]);
            }
        }

        emit ModuleInstalled(account, configCount);
    }

    /**
     * @notice Called when module is uninstalled for an account
     * @dev Additional data parameter is unused
     */
    function onUninstall(bytes calldata) external override(IAutoTopUpExecutor, IModule) {
        AutoTopUpStorage storage $ = _getStorage();

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
    function isModuleType(uint256 _typeId) external pure override(IAutoTopUpExecutor, IModule) returns (bool) {
        return _typeId == TYPE_EXECUTOR;
    }

    // ============ Configuration Management ============

    /**
     * @notice Configure a new top-up or update an existing one
     * @param agent The agent account to top up
     * @param asset The ERC-20 token address
     * @param config The top-up configuration
     * @return configId The generated config ID
     */
    function configureTopUp(address agent, address asset, TopUpConfig memory config) public returns (bytes32 configId) {
        require(agent != address(0) && agent != msg.sender, InvalidAgent());
        require(asset != address(0), InvalidAsset());

        AutoTopUpStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[msg.sender], ModuleNotInitialized(msg.sender));

        configId = generateConfigId(msg.sender, agent, asset);

        // Check if this is a new config
        if ($.states[configId].agent == address(0)) {
            // Initialize state for new config
            $.states[configId] =
                TopUpState({agent: agent, asset: asset, lastTopUpDay: 0, monthlySpent: 0, lastResetMonth: 0});

            // Add to account's config set
            $.accountConfigs[msg.sender].add(configId);
        }

        // Update the configuration
        _configureTopUp(configId, config);
    }

    /**
     * @notice Update an existing top-up configuration by ID
     * @param configId The config ID to update
     * @param config The new configuration
     */
    function configureTopUpById(bytes32 configId, TopUpConfig memory config) external {
        AutoTopUpStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[msg.sender], ModuleNotInitialized(msg.sender));

        // Verify config exists and caller owns it
        require($.states[configId].agent != address(0), ConfigNotFound());
        require($.accountConfigs[msg.sender].contains(configId), Unauthorized(configId, msg.sender));

        // Update the configuration
        _configureTopUp(configId, config);
    }

    /**
     * @dev Internal function to configure a top-up
     * @dev IMPORTANT: This function does NOT validate that the config exists or belongs to the caller.
     * @dev Caller must perform these checks before calling this function.
     * @param configId The config ID to configure
     * @param config The configuration to apply
     */
    function _configureTopUp(bytes32 configId, TopUpConfig memory config) internal {
        // Note: dailyLimit can be greater than monthlyLimit for use cases where users want
        // monthly budget constraints but no daily restrictions
        require(config.dailyLimit > 0 && config.monthlyLimit > 0, InvalidConfiguration());

        AutoTopUpStorage storage $ = _getStorage();
        TopUpState memory state = $.states[configId];

        bool wasEnabled = $.configs[configId].enabled;
        $.configs[configId] = config;

        emit TopUpConfigured(msg.sender, state.agent, state.asset, configId, config);

        // Emit enable/disable events if status changed
        if (config.enabled && !wasEnabled) {
            emit TopUpEnabled(msg.sender, state.agent, state.asset, configId);
        } else if (!config.enabled && wasEnabled) {
            emit TopUpDisabled(msg.sender, state.agent, state.asset, configId);
        }
    }

    /**
     * @notice Enable a top-up configuration
     * @param configId The config ID to enable
     */
    function enableTopUp(bytes32 configId) external {
        AutoTopUpStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[msg.sender], ModuleNotInitialized(msg.sender));

        TopUpState memory state = $.states[configId];
        require(state.agent != address(0), ConfigNotFound());

        // Verify caller owns this config
        address account = msg.sender;
        require($.accountConfigs[account].contains(configId), Unauthorized(configId, account));

        if (!$.configs[configId].enabled) {
            $.configs[configId].enabled = true;
            emit TopUpEnabled(account, state.agent, state.asset, configId);
        }
    }

    /**
     * @notice Disable a top-up configuration
     * @param configId The config ID to disable
     */
    function disableTopUp(bytes32 configId) external {
        AutoTopUpStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[msg.sender], ModuleNotInitialized(msg.sender));

        TopUpState memory state = $.states[configId];
        require(state.agent != address(0), ConfigNotFound());

        // Verify caller owns this config
        address account = msg.sender;
        require($.accountConfigs[account].contains(configId), Unauthorized(configId, account));

        if ($.configs[configId].enabled) {
            $.configs[configId].enabled = false;
            emit TopUpDisabled(account, state.agent, state.asset, configId);
        }
    }

    // ============ Execution ============

    /**
     * @notice Trigger all top-ups for a specific account
     * @param account The account to trigger top-ups for
     * @dev Emits TopUpExecuted for each successful top-up
     */
    function triggerTopUps(address account) external nonReentrant {
        AutoTopUpStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[account], ModuleNotInitialized(account));

        bytes32[] memory configIds = $.accountConfigs[account].values();

        // Calculate date once for all configs
        (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(block.timestamp);

        for (uint256 i = 0; i < configIds.length; i++) {
            _tryExecuteTopUp(configIds[i], account, year, month, day);
        }
    }

    /**
     * @notice Trigger a specific top-up by config ID
     * @param account The account that owns the config
     * @param configId The config ID to trigger
     * @dev Emits TopUpExecuted if successful, reverts on transfer failure
     */
    function triggerTopUp(address account, bytes32 configId) external nonReentrant {
        AutoTopUpStorage storage $ = _getStorage();

        // Check if module is initialized for this account
        require($.initializedAccounts[account], ModuleNotInitialized(account));

        // Verify config exists and belongs to the account
        require($.states[configId].agent != address(0), ConfigNotFound());
        require($.accountConfigs[account].contains(configId), Unauthorized(configId, account));

        // Calculate current date
        (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(block.timestamp);

        _tryExecuteTopUp(configId, account, year, month, day);
    }

    /**
     * @notice Execute a top-up transfer (external for try-catch)
     * @param account The main account to transfer from
     * @param asset The token address
     * @param agent The agent account to transfer to
     * @param amount The amount to transfer
     * @dev Must be external/public for try-catch. Only callable by this contract.
     */
    function _executeTopUpTransfer(address account, address asset, address agent, uint256 amount) external {
        require(msg.sender == address(this), "Only self");

        bytes memory result =
            _execute(account, asset, 0, abi.encodeWithSelector(IERC20.transfer.selector, agent, amount));

        // Check return value (handle non-standard tokens like USDT that don't return bool)
        if (result.length > 0) {
            require(result.length == 32, InvalidTransferReturn(result));
            require(abi.decode(result, (bool)), TransferReturnedFalse(result));
        }
    }

    /**
     * @dev Internal function to attempt a top-up execution
     * @param configId The config ID to execute
     * @param account The Safe account that owns the configuration
     * @param year Current year
     * @param month Current month (1-12)
     * @param day Current day (1-31)
     * @dev Emits TopUpExecuted on success, TopUpFailed for insufficient balance
     * @dev Reverts on transfer failure (indicates configuration error)
     */
    /**
     * @dev Validates if a top-up can be executed and calculates the amount
     * @param config The top-up configuration
     * @param state The top-up state (storage pointer for reading)
     * @param account The Safe account
     * @param year Current year
     * @param month Current month (1-12)
     * @param day Current day (1-31)
     * @return canExecute Whether the top-up can be executed
     * @return topUpAmount The amount to top up (0 if cannot execute)
     * @return currentDay The encoded current day (YYYYMMDD)
     * @return currentMonth The encoded current month (year * 12 + month)
     * @return reason Error message if cannot execute
     */
    function _validateAndCalculateTopUp(
        TopUpConfig memory config,
        TopUpState memory state,
        address account,
        uint256 year,
        uint256 month,
        uint256 day
    )
        private
        view
        returns (bool canExecute, uint256 topUpAmount, uint256 currentDay, uint256 currentMonth, string memory reason)
    {
        // Check if enabled
        if (!config.enabled) {
            return (false, 0, 0, 0, "Top-up not enabled");
        }

        // Check once per day limit using calendar days
        currentDay = year * 10000 + month * 100 + day;
        if (currentDay <= state.lastTopUpDay) {
            return (false, 0, currentDay, 0, "Already topped up today");
        }

        // Check monthly limit using calendar months
        currentMonth = year * 12 + month;
        uint256 monthlySpent = state.monthlySpent;
        if (currentMonth > state.lastResetMonth) {
            monthlySpent = 0; // Will be reset in actual execution
        }

        // Check if agent needs top-up
        uint256 agentBalance = IERC20(state.asset).balanceOf(state.agent);
        if (agentBalance >= config.dailyLimit) {
            return (false, 0, currentDay, currentMonth, "Agent balance sufficient");
        }

        // Calculate top-up amount
        topUpAmount = config.dailyLimit - agentBalance;

        // Apply monthly limit
        if (monthlySpent + topUpAmount > config.monthlyLimit) {
            topUpAmount = config.monthlyLimit - monthlySpent;
            if (topUpAmount == 0) {
                return (false, 0, currentDay, currentMonth, "Monthly limit reached");
            }
        }

        // Check account has sufficient balance
        if (IERC20(state.asset).balanceOf(account) < topUpAmount) {
            return (false, 0, currentDay, currentMonth, "Insufficient account balance");
        }

        return (true, topUpAmount, currentDay, currentMonth, "");
    }

    function _tryExecuteTopUp(bytes32 configId, address account, uint256 year, uint256 month, uint256 day) private {
        AutoTopUpStorage storage $ = _getStorage();

        TopUpConfig memory config = $.configs[configId];
        TopUpState storage state = $.states[configId];

        // Validate and calculate top-up
        (bool canExecute, uint256 topUpAmount, uint256 currentDay, uint256 currentMonth, string memory reason) =
            _validateAndCalculateTopUp(config, state, account, year, month, day);

        if (!canExecute) {
            // Only emit failure for insufficient balance (not for normal conditions like already topped up)
            if (keccak256(bytes(reason)) == keccak256(bytes("Insufficient account balance"))) {
                emit TopUpFailed(account, state.agent, state.asset, configId, reason);
            }
            return;
        }

        // Try to execute transfer - wrapped in try-catch to prevent batch operation failure
        // If this fails, other top-ups in the batch can still succeed
        try this._executeTopUpTransfer(account, state.asset, state.agent, topUpAmount) {
            // Update state AFTER successful transfer

            // Reset monthly counter if needed
            if (currentMonth > state.lastResetMonth) {
                state.monthlySpent = 0;
                state.lastResetMonth = currentMonth;
            }

            state.lastTopUpDay = currentDay;
            state.monthlySpent += topUpAmount;

            emit TopUpExecuted(account, state.agent, state.asset, configId, topUpAmount);
        } catch Error(string memory errorReason) {
            emit TopUpFailed(account, state.agent, state.asset, configId, errorReason);
        } catch (bytes memory) {
            emit TopUpFailed(account, state.agent, state.asset, configId, "Transfer failed");
        }
    }

    // ============ View Functions ============

    /// @inheritdoc IAutoTopUpExecutor
    function isInitialized(address smartAccount) external view override(IAutoTopUpExecutor, IModule) returns (bool) {
        AutoTopUpStorage storage $ = _getStorage();
        return $.initializedAccounts[smartAccount];
    }

    /**
     * @notice Generate a config ID for given parameters
     * @param account The Safe account
     * @param agent The agent account
     * @param asset The token address
     * @return The generated config ID
     */
    function generateConfigId(address account, address agent, address asset) public pure returns (bytes32) {
        return keccak256(abi.encode("TopUpConfig", account, agent, asset));
    }

    /**
     * @notice Get all top-up configurations for an account
     * @param account The account to query
     * @return configs Array of configurations
     * @return states Array of states
     */
    function getTopUpConfigs(address account)
        external
        view
        returns (TopUpConfig[] memory configs, TopUpState[] memory states)
    {
        AutoTopUpStorage storage $ = _getStorage();

        bytes32[] memory configIds = $.accountConfigs[account].values();
        configs = new TopUpConfig[](configIds.length);
        states = new TopUpState[](configIds.length);

        for (uint256 i = 0; i < configIds.length; i++) {
            configs[i] = $.configs[configIds[i]];
            states[i] = $.states[configIds[i]];
        }
    }

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
        returns (bool canExecute, string memory reason)
    {
        AutoTopUpStorage storage $ = _getStorage();

        TopUpConfig memory config = $.configs[configId];
        TopUpState memory state = $.states[configId];

        if (state.agent == address(0)) {
            return (false, "Config not found");
        }

        if (!$.accountConfigs[account].contains(configId)) {
            return (false, "Account doesn't own config");
        }

        if (!config.enabled) {
            return (false, "Top-up disabled");
        }

        // Get current date
        (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(block.timestamp);

        // Use shared validation logic
        (bool canExec,,,, string memory errorReason) =
            _validateAndCalculateTopUp(config, state, account, year, month, day);

        return (canExec, errorReason);
    }

    /**
     * @notice Get top-up by config ID
     * @param configId The config ID
     * @return config The configuration
     * @return state The state
     */
    function getTopUpById(bytes32 configId) external view returns (TopUpConfig memory config, TopUpState memory state) {
        AutoTopUpStorage storage $ = _getStorage();
        config = $.configs[configId];
        state = $.states[configId];
    }

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
        returns (TopUpConfig memory config, TopUpState memory state)
    {
        bytes32 configId = generateConfigId(account, agent, asset);
        AutoTopUpStorage storage $ = _getStorage();
        config = $.configs[configId];
        state = $.states[configId];
    }
}
