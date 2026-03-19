// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {AutoCollectExecutor} from "../src/AutoCollectExecutor.sol";
import {IAutoCollectExecutor} from "../src/IAutoCollectExecutor.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BokkyPooBahsDateTimeLibrary} from "BokkyPooBahsDateTimeLibrary/contracts/BokkyPooBahsDateTimeLibrary.sol";
import {
    MODULE_TYPE_VALIDATOR,
    MODULE_TYPE_EXECUTOR,
    MODULE_TYPE_FALLBACK,
    MODULE_TYPE_HOOK
} from "modulekit/src/accounts/common/interfaces/IERC7579Module.sol";

// Import mocks
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";
import {MockSafe} from "./mocks/MockSafe.sol";
import {MockTokenReturnsFalse} from "./mocks/MockTokenReturnsFalse.sol";

// Test contract with proper inheritance for module testing
contract AutoCollectExecutorTest is Test {
    // Main contracts
    AutoCollectExecutor public executor;
    MockERC20 public token;
    MockUSDT public usdt;
    MockSafe public serviceAccount;

    // Test addresses
    address public owner;
    address public mainAccount;
    address public stranger;

    // Test constants
    uint256 constant THRESHOLD = 10 ether;
    uint256 constant INITIAL_SERVICE_BALANCE = 100 ether;
    uint256 constant INITIAL_MAIN_BALANCE = 1000 ether;

    // Events to test
    event ModuleInstalled(address indexed account, uint256 initialConfigs);
    event ModuleUninstalled(address indexed account, uint256 removedConfigs);
    event CollectionConfigured(
        address indexed account,
        address indexed asset,
        address target,
        bytes32 indexed configId,
        IAutoCollectExecutor.CollectConfig config
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

    function setUp() public {
        // Set up test accounts
        owner = makeAddr("owner");
        mainAccount = makeAddr("mainAccount");
        stranger = makeAddr("stranger");

        // Deploy test tokens
        token = new MockERC20("Test Token", "TEST");
        usdt = new MockUSDT();

        // Deploy mock service account (Safe)
        serviceAccount = new MockSafe(owner);

        // Deploy AutoCollectExecutor as singleton
        executor = new AutoCollectExecutor();

        // Enable executor as module on service account
        vm.prank(owner);
        serviceAccount.enableModule(address(executor));

        // Fund service account with tokens
        token.mint(address(serviceAccount), INITIAL_SERVICE_BALANCE);
        usdt.mint(address(serviceAccount), INITIAL_SERVICE_BALANCE);

        // Give main account some initial balance
        token.mint(mainAccount, INITIAL_MAIN_BALANCE);
        usdt.mint(mainAccount, INITIAL_MAIN_BALANCE);
    }

    // ============ Module Installation Tests ============

    function test_OnInstall_EmptyData() public {
        // Install module without initial configs
        vm.expectEmit(true, false, false, true);
        emit ModuleInstalled(address(serviceAccount), 0);

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        assertTrue(executor.isInitialized(address(serviceAccount)));
    }

    function test_OnInstall_WithSingleConfig() public {
        // Prepare installation data
        address[] memory assets = new address[](1);
        IAutoCollectExecutor.CollectConfig[] memory configs = new IAutoCollectExecutor.CollectConfig[](1);

        assets[0] = address(token);
        configs[0] = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        bytes memory installData = abi.encode(assets, configs);

        // Calculate expected config ID
        bytes32 configId = executor.generateConfigId(address(serviceAccount), address(token));

        // Expect events
        vm.expectEmit(true, true, true, true);
        emit CollectionConfigured(address(serviceAccount), address(token), mainAccount, configId, configs[0]);

        vm.expectEmit(true, true, true, true);
        emit CollectionEnabled(address(serviceAccount), address(token), configId);

        vm.expectEmit(true, false, false, true);
        emit ModuleInstalled(address(serviceAccount), 1);

        vm.prank(address(serviceAccount));
        executor.onInstall(installData);

        assertTrue(executor.isInitialized(address(serviceAccount)));

        // Verify config was created
        (IAutoCollectExecutor.CollectConfig memory config,) = executor.getCollectionConfigById(configId);
        assertEq(config.target, mainAccount);
        assertEq(config.threshold, THRESHOLD);
        assertEq(config.minimumRemaining, 0);
        assertTrue(config.enabled);
    }

    function test_OnInstall_RevertInvalidAsset() public {
        // Try to install with zero address asset
        address[] memory assets = new address[](1);
        IAutoCollectExecutor.CollectConfig[] memory configs = new IAutoCollectExecutor.CollectConfig[](1);

        assets[0] = address(0); // Invalid
        configs[0] = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        bytes memory installData = abi.encode(assets, configs);

        vm.prank(address(serviceAccount));
        vm.expectRevert(IAutoCollectExecutor.InvalidAsset.selector);
        executor.onInstall(installData);
    }

    function test_OnInstall_RevertInvalidTarget() public {
        // Try to install with zero address target
        address[] memory assets = new address[](1);
        IAutoCollectExecutor.CollectConfig[] memory configs = new IAutoCollectExecutor.CollectConfig[](1);

        assets[0] = address(token);
        configs[0] = IAutoCollectExecutor.CollectConfig({
            target: address(0), threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        }); // Invalid target

        bytes memory installData = abi.encode(assets, configs);

        vm.prank(address(serviceAccount));
        vm.expectRevert(IAutoCollectExecutor.InvalidTarget.selector);
        executor.onInstall(installData);
    }

    // ============ Module Uninstallation Tests ============

    function test_OnUninstall_CleansUpAllState() public {
        // First install with configs
        address[] memory assets = new address[](2);
        IAutoCollectExecutor.CollectConfig[] memory configs = new IAutoCollectExecutor.CollectConfig[](2);

        assets[0] = address(token);
        assets[1] = address(usdt);
        configs[0] = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });
        configs[1] = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        executor.onInstall(abi.encode(assets, configs));

        // Verify installation
        assertTrue(executor.isInitialized(address(serviceAccount)));
        (IAutoCollectExecutor.CollectConfig[] memory retrievedConfigs,) =
            executor.getCollectionConfigs(address(serviceAccount));
        assertEq(retrievedConfigs.length, 2);

        // Now uninstall
        vm.expectEmit(true, false, false, true);
        emit ModuleUninstalled(address(serviceAccount), 2);

        vm.prank(address(serviceAccount));
        executor.onUninstall("");

        // Verify all state is cleaned
        assertFalse(executor.isInitialized(address(serviceAccount)));
        (retrievedConfigs,) = executor.getCollectionConfigs(address(serviceAccount));
        assertEq(retrievedConfigs.length, 0);
    }

    // ============ Configuration Management Tests ============

    function test_ConfigureCollection_NewConfig() public {
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        bytes32 expectedConfigId = executor.generateConfigId(address(serviceAccount), address(token));

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        assertEq(configId, expectedConfigId);

        // Verify config was created
        (IAutoCollectExecutor.CollectConfig memory retrievedConfig, IAutoCollectExecutor.CollectState memory state) =
            executor.getCollectionConfigById(configId);
        assertEq(retrievedConfig.target, mainAccount);
        assertEq(retrievedConfig.threshold, THRESHOLD);
        assertTrue(retrievedConfig.enabled);
        assertEq(state.asset, address(token));
        assertEq(state.lastCollectDate, 0);
    }

    function test_ConfigureCollection_RevertInvalidAsset() public {
        // Setup: Install module
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        // Try to configure with zero address asset
        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        vm.expectRevert(abi.encodeWithSelector(IAutoCollectExecutor.InvalidAsset.selector));
        executor.configureCollection(address(0), config);
    }

    function test_ConfigureCollection_RevertInvalidTarget() public {
        // Setup: Install module
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        // Try to configure with zero address target
        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: address(0), threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        vm.expectRevert(abi.encodeWithSelector(IAutoCollectExecutor.InvalidTarget.selector));
        executor.configureCollection(address(token), config);
    }

    function test_ConfigureCollection_ZeroThreshold() public {
        // Setup: Install module
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        // Test with zero threshold (should be valid - collect any balance)
        IAutoCollectExecutor.CollectConfig memory config =
            IAutoCollectExecutor.CollectConfig({target: mainAccount, threshold: 0, minimumRemaining: 0, enabled: true});

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        // Verify config was created successfully
        (IAutoCollectExecutor.CollectConfig memory retrievedConfig,) = executor.getCollectionConfigById(configId);
        assertEq(retrievedConfig.target, mainAccount);
        assertEq(retrievedConfig.threshold, 0);
        assertTrue(retrievedConfig.enabled);
    }

    function test_ConfigureCollection_RevertNotInitialized() public {
        // Don't install module - try to configure
        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        vm.expectRevert(
            abi.encodeWithSelector(IAutoCollectExecutor.ModuleNotInitialized.selector, address(serviceAccount))
        );
        executor.configureCollection(address(token), config);
    }

    // ============ Enable/Disable Tests ============

    function test_EnableDisableCollection() public {
        // Setup config (enabled by default)
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        // Disable it
        vm.expectEmit(true, true, true, true);
        emit CollectionDisabled(address(serviceAccount), address(token), configId);

        vm.prank(address(serviceAccount));
        executor.disableCollection(configId);

        // Verify it's disabled
        (IAutoCollectExecutor.CollectConfig memory retrievedConfig,) = executor.getCollectionConfigById(configId);
        assertFalse(retrievedConfig.enabled);

        // Enable it again
        vm.expectEmit(true, true, true, true);
        emit CollectionEnabled(address(serviceAccount), address(token), configId);

        vm.prank(address(serviceAccount));
        executor.enableCollection(configId);

        // Verify it's enabled
        (retrievedConfig,) = executor.getCollectionConfigById(configId);
        assertTrue(retrievedConfig.enabled);
    }

    function test_EnableDisable_RevertUnauthorized() public {
        // Setup config as service account
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        // Try to disable as stranger (should fail - module not initialized)
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAutoCollectExecutor.ModuleNotInitialized.selector, stranger));
        executor.disableCollection(configId);

        // Try to enable as stranger (should fail - module not initialized)
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAutoCollectExecutor.ModuleNotInitialized.selector, stranger));
        executor.enableCollection(configId);
    }

    // ============ Configuration By ID Tests ============

    function test_ConfigureCollectionById_Success() public {
        // Setup: Install module and create initial config
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        // Update config by ID
        address newTarget = makeAddr("newTarget");
        uint256 newThreshold = THRESHOLD * 2;
        IAutoCollectExecutor.CollectConfig memory newConfig = IAutoCollectExecutor.CollectConfig({
            target: newTarget, threshold: newThreshold, minimumRemaining: 0, enabled: true
        });

        vm.expectEmit(true, true, true, true);
        emit CollectionConfigured(address(serviceAccount), address(token), newTarget, configId, newConfig);

        vm.prank(address(serviceAccount));
        executor.configureCollectionById(configId, newConfig);

        // Verify config was updated
        (IAutoCollectExecutor.CollectConfig memory retrievedConfig,) = executor.getCollectionConfigById(configId);
        assertEq(retrievedConfig.target, newTarget);
        assertEq(retrievedConfig.threshold, newThreshold);
        assertTrue(retrievedConfig.enabled);
    }

    function test_ConfigureCollectionById_RevertConfigNotFound() public {
        // Install module but use non-existent configId
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        bytes32 nonExistentConfigId = keccak256("nonexistent");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        vm.expectRevert(abi.encodeWithSelector(IAutoCollectExecutor.ConfigNotFound.selector));
        executor.configureCollectionById(nonExistentConfigId, config);
    }

    function test_ConfigureCollectionById_RevertUnauthorized() public {
        // Setup: Service account creates a config
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        // Stranger tries to update service account's config
        IAutoCollectExecutor.CollectConfig memory newConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD * 2, minimumRemaining: 0, enabled: true
        });

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAutoCollectExecutor.ModuleNotInitialized.selector, stranger));
        executor.configureCollectionById(configId, newConfig);
    }

    // ============ Execution Tests ============

    function test_TriggerCollection_Success() public {
        // Setup: Install module and configure collection
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        // Service account has balance above threshold
        uint256 serviceBalanceBefore = token.balanceOf(address(serviceAccount));
        uint256 mainBalanceBefore = token.balanceOf(mainAccount);
        assertEq(serviceBalanceBefore, INITIAL_SERVICE_BALANCE);

        // Expect the CollectionExecuted event
        vm.expectEmit(true, true, true, true);
        emit CollectionExecuted(address(serviceAccount), address(token), mainAccount, configId, serviceBalanceBefore);

        // Trigger the collection
        executor.triggerCollection(address(serviceAccount), address(token));

        // Verify the collection was executed (full balance transferred)
        assertEq(token.balanceOf(address(serviceAccount)), 0);
        assertEq(token.balanceOf(mainAccount), mainBalanceBefore + serviceBalanceBefore);
    }

    function test_TriggerCollection_SkippedBelowThreshold() public {
        // Setup with high threshold
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        uint256 highThreshold = INITIAL_SERVICE_BALANCE + 1 ether;
        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: highThreshold, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        uint256 currentBalance = token.balanceOf(address(serviceAccount));

        // Expect CollectionSkipped event
        vm.expectEmit(true, true, true, true);
        emit CollectionSkipped(
            address(serviceAccount),
            address(token),
            configId,
            currentBalance,
            highThreshold,
            0, // minimumRemaining
            currentBalance // would collect
        );

        // Trigger collection - should be skipped
        executor.triggerCollection(address(serviceAccount), address(token));

        // Balance should not change
        assertEq(token.balanceOf(address(serviceAccount)), INITIAL_SERVICE_BALANCE);
    }

    function test_TriggerAllCollections_MultipleAssets() public {
        // Setup multiple configs for the same account
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        // Configure collections for both tokens
        IAutoCollectExecutor.CollectConfig memory tokenConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });
        IAutoCollectExecutor.CollectConfig memory usdtConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.startPrank(address(serviceAccount));
        executor.configureCollection(address(token), tokenConfig);
        executor.configureCollection(address(usdt), usdtConfig);
        vm.stopPrank();

        // Record balances before
        uint256 serviceTokenBefore = token.balanceOf(address(serviceAccount));
        uint256 serviceUsdtBefore = usdt.balanceOf(address(serviceAccount));
        uint256 mainTokenBefore = token.balanceOf(mainAccount);
        uint256 mainUsdtBefore = usdt.balanceOf(mainAccount);

        // Trigger all collections
        vm.prank(stranger);
        executor.triggerAllCollections(address(serviceAccount));

        // Should have executed 2 collections
        assertEq(token.balanceOf(address(serviceAccount)), 0);
        assertEq(usdt.balanceOf(address(serviceAccount)), 0);
        assertEq(token.balanceOf(mainAccount), mainTokenBefore + serviceTokenBefore);
        assertEq(usdt.balanceOf(mainAccount), mainUsdtBefore + serviceUsdtBefore);
    }

    // ============ Daily Limit Tests ============

    function test_DailyLimitReset() public {
        // Setup config
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        // First collection should work
        (bool canExecute, string memory reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertTrue(canExecute);
        assertEq(reason, "");

        // Actually execute the collection
        executor.triggerCollection(address(serviceAccount), address(token));

        // Add some tokens back to service account
        token.mint(address(serviceAccount), 50 ether);

        // Should not be able to collect again same day
        (canExecute, reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertFalse(canExecute);
        assertEq(reason, "Already collected today");

        // Move to next day
        vm.warp(block.timestamp + 1 days);

        // Now should be able to collect again
        (canExecute, reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertTrue(canExecute);
        assertEq(reason, "");
    }

    // ============ View Function Tests ============

    function test_CanExecuteCollection_Conditions() public {
        // Setup
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        executor.configureCollection(address(token), config);

        // Should be able to execute (service balance is above threshold)
        (bool canExecute, string memory reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertTrue(canExecute);
        assertEq(reason, "");

        // Test with disabled config
        bytes32 configId = executor.generateConfigId(address(serviceAccount), address(token));
        vm.prank(address(serviceAccount));
        executor.disableCollection(configId);

        (canExecute, reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertFalse(canExecute);
        assertEq(reason, "Collection disabled");
    }

    function test_GetCollectionConfig_Success() public {
        // Setup: Install module and create config
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        // Test getCollectionConfig function
        (
            IAutoCollectExecutor.CollectConfig memory retrievedConfig,
            IAutoCollectExecutor.CollectState memory retrievedState
        ) = executor.getCollectionConfig(address(serviceAccount), address(token));

        assertEq(retrievedConfig.target, mainAccount);
        assertEq(retrievedConfig.threshold, THRESHOLD);
        assertTrue(retrievedConfig.enabled);
        assertEq(retrievedState.asset, address(token));
        assertEq(retrievedState.lastCollectDate, 0);
    }

    function test_GetCollectionConfig_NonExistentConfig() public {
        // Test getCollectionConfig with non-existent config
        (IAutoCollectExecutor.CollectConfig memory config, IAutoCollectExecutor.CollectState memory state) =
            executor.getCollectionConfig(address(serviceAccount), address(token));

        // Should return zero values for non-existent config
        assertEq(config.target, address(0));
        assertEq(config.threshold, 0);
        assertEq(config.minimumRemaining, 0);
        assertFalse(config.enabled);
        assertEq(state.asset, address(0));
        assertEq(state.lastCollectDate, 0);
    }

    function test_CanExecuteCollection_ConfigNotFound() public {
        bytes32 configId = executor.generateConfigId(address(serviceAccount), address(token));

        (bool canExecute, string memory reason) = executor.canExecuteCollection(address(serviceAccount), address(token));

        assertFalse(canExecute);
        assertEq(reason, "Config not found");
    }

    function test_GetCollectionConfigs() public {
        // Install module and create multiple configs
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory tokenConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });
        IAutoCollectExecutor.CollectConfig memory usdtConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD * 2, minimumRemaining: 0, enabled: true
        });

        vm.startPrank(address(serviceAccount));
        executor.configureCollection(address(token), tokenConfig);
        executor.configureCollection(address(usdt), usdtConfig);
        vm.stopPrank();

        // Get all configs
        (IAutoCollectExecutor.CollectConfig[] memory configs, IAutoCollectExecutor.CollectState[] memory states) =
            executor.getCollectionConfigs(address(serviceAccount));

        assertEq(configs.length, 2);
        assertEq(states.length, 2);

        // Verify configs (order might vary due to EnumerableSet)
        bool foundToken = false;
        bool foundUsdt = false;

        for (uint256 i = 0; i < configs.length; i++) {
            if (states[i].asset == address(token)) {
                foundToken = true;
                assertEq(configs[i].target, mainAccount);
                assertEq(configs[i].threshold, THRESHOLD);
                assertTrue(configs[i].enabled);
            } else if (states[i].asset == address(usdt)) {
                foundUsdt = true;
                assertEq(configs[i].target, mainAccount);
                assertEq(configs[i].threshold, THRESHOLD * 2);
                assertTrue(configs[i].enabled);
            }
        }

        assertTrue(foundToken);
        assertTrue(foundUsdt);
    }

    // ============ Date Boundary Tests ============

    function test_YearTransition() public {
        // Setup config
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        executor.configureCollection(address(token), config);

        // Set time to Dec 31, 2023
        vm.warp(1704067199); // Dec 31, 2023 23:59:59 UTC

        // Execute collection on last day of year
        executor.triggerCollection(address(serviceAccount), address(token));

        // Add tokens back
        token.mint(address(serviceAccount), 50 ether);

        // Should not execute again same day
        (bool canExecute, string memory reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertFalse(canExecute);
        assertEq(reason, "Already collected today");

        // Move to Jan 1, 2024 (next year)
        vm.warp(1704067200); // Jan 1, 2024 00:00:00 UTC

        // Should be able to execute (new day and new year)
        (canExecute, reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertTrue(canExecute);
        assertEq(reason, "");
    }

    function test_LeapYearFebruary() public {
        // Setup config
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        executor.configureCollection(address(token), config);

        // Set time to Feb 28, 2024 (leap year)
        vm.warp(1709078400); // Feb 28, 2024 00:00:00 UTC

        // Execute collection on Feb 28
        executor.triggerCollection(address(serviceAccount), address(token));

        // Add tokens back
        token.mint(address(serviceAccount), 50 ether);

        // Move to Feb 29 (leap day)
        vm.warp(1709164800); // Feb 29, 2024 00:00:00 UTC

        // Should be able to execute on leap day
        (bool canExecute, string memory reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertTrue(canExecute);
        assertEq(reason, "");

        executor.triggerCollection(address(serviceAccount), address(token));

        // Add tokens back again
        token.mint(address(serviceAccount), 50 ether);

        // Move to March 1
        vm.warp(1709251200); // March 1, 2024 00:00:00 UTC

        // Should be able to execute on March 1
        (canExecute, reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertTrue(canExecute);
        assertEq(reason, "");
    }

    // ============ Fuzz Tests ============

    function testFuzz_DailyExecutionLimit(uint32 startTimestamp, uint32 timeDelta) public {
        // Test that daily execution limit is enforced across various start times and deltas
        // Bound start timestamp to reasonable range (year 2020-2030)
        uint256 startTime = bound(uint256(startTimestamp), 1577836800, 1893456000); // 2020-2030
        vm.warp(startTime);

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        executor.configureCollection(address(token), config);

        // Execute first collection
        executor.triggerCollection(address(serviceAccount), address(token));

        // Add tokens back
        token.mint(address(serviceAccount), 50 ether);

        // Calculate seconds remaining in current calendar day
        (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(block.timestamp);
        uint256 endOfDay = BokkyPooBahsDateTimeLibrary.timestampFromDate(year, month, day) + 86400 - 1;
        uint256 secondsLeftInDay = endOfDay - block.timestamp;

        // Bound time delta to stay within current calendar day
        uint256 deltaSeconds = bound(uint256(timeDelta), 0, secondsLeftInDay);
        vm.warp(block.timestamp + deltaSeconds);

        // Should not be able to execute again same calendar day
        (bool canExecute, string memory reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertFalse(canExecute);
        assertEq(reason, "Already collected today");

        // Move to next calendar day
        vm.warp(block.timestamp + (secondsLeftInDay - deltaSeconds) + 1);

        // Now should be able to execute
        (canExecute, reason) = executor.canExecuteCollection(address(serviceAccount), address(token));
        assertTrue(canExecute);
        assertEq(reason, "");
    }

    function testFuzz_ConfigurationThresholds(uint256 threshold) public {
        // Bound to reasonable values
        threshold = bound(threshold, 0, type(uint128).max);

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        // Should succeed with any threshold
        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: threshold, minimumRemaining: 0, enabled: true
        });

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(address(token), config);

        // Verify config was stored correctly
        (IAutoCollectExecutor.CollectConfig memory retrieved,) = executor.getCollectionConfigById(configId);
        assertEq(retrieved.target, mainAccount);
        assertEq(retrieved.threshold, threshold);
        assertTrue(retrieved.enabled);
    }

    // ============ Module Type Tests ============

    function test_IsModuleType() public {
        assertTrue(executor.isModuleType(MODULE_TYPE_EXECUTOR));
        assertFalse(executor.isModuleType(MODULE_TYPE_VALIDATOR));
        assertFalse(executor.isModuleType(MODULE_TYPE_FALLBACK));
        assertFalse(executor.isModuleType(MODULE_TYPE_HOOK));
    }

    // ============ Error Cases Tests ============

    function test_TriggerCollection_RevertModuleNotInitialized() public {
        // Don't install module - try to trigger
        vm.expectRevert(
            abi.encodeWithSelector(IAutoCollectExecutor.ModuleNotInitialized.selector, address(serviceAccount))
        );
        executor.triggerCollection(address(serviceAccount), address(token));
    }

    function test_TriggerCollection_RevertConfigNotFound() public {
        // Install module but don't create config
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        vm.expectRevert(abi.encodeWithSelector(IAutoCollectExecutor.ConfigNotFound.selector));
        executor.triggerCollection(address(serviceAccount), address(token));
    }

    // ============ MinimumRemaining Tests ============

    function test_CollectWithMinimumRemaining() public {
        // Setup: 100 USDC balance, threshold 50, minimumRemaining 20
        // Expected: Collect 80, leave 20
        uint256 minimumRemaining = 20 ether;
        uint256 threshold = 50 ether;

        // Install and configure
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(
            address(token),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: threshold, minimumRemaining: minimumRemaining, enabled: true
            })
        );

        // Verify initial balance
        assertEq(token.balanceOf(address(serviceAccount)), INITIAL_SERVICE_BALANCE);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE);

        // Trigger collection
        uint256 expectedCollectAmount = INITIAL_SERVICE_BALANCE - minimumRemaining;

        vm.expectEmit(true, true, true, true);
        emit CollectionExecuted(address(serviceAccount), address(token), mainAccount, configId, expectedCollectAmount);

        executor.triggerCollection(address(serviceAccount), address(token));

        // Verify balances
        assertEq(token.balanceOf(address(serviceAccount)), minimumRemaining);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE + expectedCollectAmount);
    }

    function test_CollectWithZeroThresholdAndMinimumRemaining() public {
        // Setup: 100 USDC balance, threshold 0, minimumRemaining 30
        // Expected: Collect 70, leave 30
        uint256 minimumRemaining = 30 ether;
        uint256 threshold = 0;

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(
            address(token),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: threshold, minimumRemaining: minimumRemaining, enabled: true
            })
        );

        // Trigger collection
        uint256 expectedCollectAmount = INITIAL_SERVICE_BALANCE - minimumRemaining;

        vm.expectEmit(true, true, true, true);
        emit CollectionExecuted(address(serviceAccount), address(token), mainAccount, configId, expectedCollectAmount);

        executor.triggerCollection(address(serviceAccount), address(token));

        // Verify balances
        assertEq(token.balanceOf(address(serviceAccount)), minimumRemaining);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE + expectedCollectAmount);
    }

    function test_SkipCollectionWhenMinimumRemainingEqualsBalance() public {
        // Setup: 50 USDC balance, threshold 20, minimumRemaining 50
        // Expected: Skip (collect amount = 0)
        uint256 balance = 50 ether;
        uint256 minimumRemaining = 50 ether;
        uint256 threshold = 20 ether;

        // Set service account balance to exactly minimumRemaining
        token.burn(address(serviceAccount), INITIAL_SERVICE_BALANCE - balance);

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(
            address(token),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: threshold, minimumRemaining: minimumRemaining, enabled: true
            })
        );

        // Expect CollectionSkipped event
        vm.expectEmit(true, true, true, true);
        emit CollectionSkipped(
            address(serviceAccount),
            address(token),
            configId,
            balance, // current balance
            threshold,
            minimumRemaining,
            0 // would collect amount
        );

        executor.triggerCollection(address(serviceAccount), address(token));

        // Verify balances unchanged
        assertEq(token.balanceOf(address(serviceAccount)), balance);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE);
    }

    function test_SkipCollectionWhenMinimumRemainingExceedsBalance() public {
        // Setup: 40 USDC balance, threshold 20, minimumRemaining 50
        // Expected: Skip (can't leave 50 when we only have 40)
        uint256 balance = 40 ether;
        uint256 minimumRemaining = 50 ether;
        uint256 threshold = 20 ether;

        // Set service account balance
        token.burn(address(serviceAccount), INITIAL_SERVICE_BALANCE - balance);

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(
            address(token),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: threshold, minimumRemaining: minimumRemaining, enabled: true
            })
        );

        // Expect CollectionSkipped event
        vm.expectEmit(true, true, true, true);
        emit CollectionSkipped(
            address(serviceAccount),
            address(token),
            configId,
            balance, // current balance
            threshold,
            minimumRemaining,
            0 // would collect amount (balance < minimumRemaining, so 0)
        );

        executor.triggerCollection(address(serviceAccount), address(token));

        // Verify balances unchanged
        assertEq(token.balanceOf(address(serviceAccount)), balance);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE);
    }

    function test_MinimumRemainingGreaterThanThreshold() public {
        // Setup: 100 USDC balance, threshold 10, minimumRemaining 80
        // Expected: Collect 20, leave 80 (triggers at 10 but keeps 80)
        uint256 minimumRemaining = 80 ether;
        uint256 threshold = 10 ether;

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(
            address(token),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: threshold, minimumRemaining: minimumRemaining, enabled: true
            })
        );

        // Trigger collection
        uint256 expectedCollectAmount = INITIAL_SERVICE_BALANCE - minimumRemaining;

        vm.expectEmit(true, true, true, true);
        emit CollectionExecuted(address(serviceAccount), address(token), mainAccount, configId, expectedCollectAmount);

        executor.triggerCollection(address(serviceAccount), address(token));

        // Verify balances
        assertEq(token.balanceOf(address(serviceAccount)), minimumRemaining);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE + expectedCollectAmount);
    }

    function test_MinimumRemainingEqualsThreshold() public {
        // Setup: 100 USDC balance, threshold 50, minimumRemaining 50
        // Expected: Collect 50, leave 50
        uint256 minimumRemaining = 50 ether;
        uint256 threshold = 50 ether;

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(
            address(token),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: threshold, minimumRemaining: minimumRemaining, enabled: true
            })
        );

        // Trigger collection
        uint256 expectedCollectAmount = INITIAL_SERVICE_BALANCE - minimumRemaining;

        vm.expectEmit(true, true, true, true);
        emit CollectionExecuted(address(serviceAccount), address(token), mainAccount, configId, expectedCollectAmount);

        executor.triggerCollection(address(serviceAccount), address(token));

        // Verify balances
        assertEq(token.balanceOf(address(serviceAccount)), minimumRemaining);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE + expectedCollectAmount);
    }

    function test_CollectionSkippedEventIncludesMinimumRemaining() public {
        // Verify new event parameters are emitted correctly when skipping
        uint256 threshold = 200 ether; // Higher than balance
        uint256 minimumRemaining = 10 ether;

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(
            address(token),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: threshold, minimumRemaining: minimumRemaining, enabled: true
            })
        );

        uint256 currentBalance = INITIAL_SERVICE_BALANCE;
        uint256 wouldCollect = currentBalance - minimumRemaining;

        // Expect CollectionSkipped with all parameters
        vm.expectEmit(true, true, true, true);
        emit CollectionSkipped(
            address(serviceAccount), address(token), configId, currentBalance, threshold, minimumRemaining, wouldCollect
        );

        executor.triggerCollection(address(serviceAccount), address(token));
    }

    // ============ Batch Failure Tests ============

    function test_TriggerAllCollections_PartialFailure() public {
        // Test that if one collection fails, others still succeed
        // This demonstrates resilience of batch operations with try-catch

        // Import the bad token mock
        MockTokenReturnsFalse badToken = new MockTokenReturnsFalse();
        badToken.mint(address(serviceAccount), INITIAL_SERVICE_BALANCE);

        // Install module
        vm.prank(address(serviceAccount));
        executor.onInstall("");

        // Configure 3 collections: good token, bad token, good USDT
        vm.prank(address(serviceAccount));
        bytes32 goodConfigId1 = executor.configureCollection(
            address(token),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
            })
        );

        vm.prank(address(serviceAccount));
        bytes32 badConfigId = executor.configureCollection(
            address(badToken),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
            })
        );

        vm.prank(address(serviceAccount));
        bytes32 goodConfigId2 = executor.configureCollection(
            address(usdt),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
            })
        );

        // Trigger all collections - should not revert despite badToken failure
        executor.triggerAllCollections(address(serviceAccount));

        // Verify: good tokens collected, bad token remained
        assertEq(token.balanceOf(address(serviceAccount)), 0);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE + INITIAL_SERVICE_BALANCE);

        assertEq(badToken.balanceOf(address(serviceAccount)), INITIAL_SERVICE_BALANCE); // Failed - balance unchanged
        assertEq(badToken.balanceOf(mainAccount), 0);

        assertEq(usdt.balanceOf(address(serviceAccount)), 0);
        assertEq(usdt.balanceOf(mainAccount), INITIAL_MAIN_BALANCE + INITIAL_SERVICE_BALANCE);
    }

    function test_CollectionFailed_EmitsCorrectReason() public {
        // Test that CollectionFailed event contains meaningful error message
        MockTokenReturnsFalse badToken = new MockTokenReturnsFalse();
        badToken.mint(address(serviceAccount), INITIAL_SERVICE_BALANCE);

        vm.prank(address(serviceAccount));
        executor.onInstall("");

        vm.prank(address(serviceAccount));
        bytes32 configId = executor.configureCollection(
            address(badToken),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
            })
        );

        // Should emit CollectionFailed with generic reason (custom errors fall to catch(bytes))
        vm.expectEmit(true, true, true, true);
        emit CollectionFailed(address(serviceAccount), address(badToken), configId, "Transfer failed");

        executor.triggerCollection(address(serviceAccount), address(badToken));

        // Verify state was NOT updated (no collection happened)
        (, IAutoCollectExecutor.CollectState memory state) = executor.getCollectionConfigById(configId);
        assertEq(state.lastCollectDate, 0); // Should remain 0 since transfer failed
    }
}
