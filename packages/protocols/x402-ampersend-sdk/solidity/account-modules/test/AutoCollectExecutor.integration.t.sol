// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, Vm, console2} from "forge-std/Test.sol";
import {
    RhinestoneModuleKit,
    AccountType,
    AccountInstance,
    UserOpData
} from "modulekit/src/test/RhinestoneModuleKit.sol";
import {ModuleKitHelpers} from "modulekit/src/test/ModuleKitHelpers.sol";
import {AutoCollectExecutor} from "../src/AutoCollectExecutor.sol";
import {IAutoCollectExecutor} from "../src/IAutoCollectExecutor.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    IModule,
    MODULE_TYPE_VALIDATOR,
    MODULE_TYPE_EXECUTOR,
    MODULE_TYPE_FALLBACK,
    MODULE_TYPE_HOOK
} from "modulekit/src/accounts/common/interfaces/IERC7579Module.sol";
import {BokkyPooBahsDateTimeLibrary} from "BokkyPooBahsDateTimeLibrary/contracts/BokkyPooBahsDateTimeLibrary.sol";

// Import mocks
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";
import {MaliciousCollectToken} from "./mocks/MaliciousCollectToken.sol";

// Integration tests using RhinestoneModuleKit for proper Safe interaction
contract AutoCollectExecutorIntegrationTest is Test, RhinestoneModuleKit {
    using SafeERC20 for IERC20;
    using ModuleKitHelpers for AccountInstance;

    // Main contracts
    AutoCollectExecutor public executor;
    MockERC20 public token;
    MockUSDT public usdt;

    // Test accounts
    AccountInstance public serviceAccount;
    address public mainAccount;
    address public stranger;

    // Test constants
    uint256 constant THRESHOLD = 10 ether;
    uint256 constant INITIAL_SERVICE_BALANCE = 100 ether;
    uint256 constant INITIAL_MAIN_BALANCE = 1000 ether;

    // Events from the module
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

    function setUp() public {
        // Initialize ModuleKit with Safe account type
        super.init();

        // Create test addresses
        mainAccount = makeAddr("mainAccount");
        stranger = makeAddr("stranger");

        // Deploy tokens
        token = new MockERC20("Test Token", "TEST");
        usdt = new MockUSDT();

        // Deploy AutoCollectExecutor module as singleton
        executor = new AutoCollectExecutor();

        // Create a Safe service account instance
        serviceAccount = makeAccountInstance("service-account");

        // Fund service account with tokens
        token.mint(serviceAccount.account, INITIAL_SERVICE_BALANCE);
        usdt.mint(serviceAccount.account, INITIAL_SERVICE_BALANCE);

        // Give main account some initial balance
        token.mint(mainAccount, INITIAL_MAIN_BALANCE);
        usdt.mint(mainAccount, INITIAL_MAIN_BALANCE);
    }

    // ============ Module Installation with Safe ============

    function test_Integration_InstallModule() public {
        // Install the module on the service account using ModuleKit
        // Note: Event emissions during UserOp execution cannot be tested with expectEmit
        // due to ModuleKit's internal use of recordLogs(). Events are tested in unit tests.
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Verify module is properly installed and initialized
        assertTrue(executor.isInitialized(serviceAccount.account));
        assertTrue(serviceAccount.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor)));
    }

    function test_Integration_InstallWithInitialConfigs() public {
        // Prepare installation data with initial configurations
        address[] memory assets = new address[](2);
        IAutoCollectExecutor.CollectConfig[] memory configs = new IAutoCollectExecutor.CollectConfig[](2);

        assets[0] = address(token);
        assets[1] = address(usdt);
        configs[0] = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });
        configs[1] = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD * 2, minimumRemaining: 0, enabled: true
        });

        bytes memory installData = abi.encode(assets, configs);

        // Install with initial configs using ModuleKit
        // Events during UserOp execution are tested in unit tests
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), installData);

        // Verify configs were created
        (IAutoCollectExecutor.CollectConfig[] memory retrievedConfigs,) =
            executor.getCollectionConfigs(serviceAccount.account);
        assertEq(retrievedConfigs.length, 2);
        assertTrue(serviceAccount.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor)));
    }

    // ============ Execution Tests with Safe ============

    function test_Integration_TriggerCollection_Success() public {
        // Install module using ModuleKit
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(address(token), config);

        // Check balances before
        uint256 serviceBalanceBefore = token.balanceOf(serviceAccount.account);
        uint256 mainBalanceBefore = token.balanceOf(mainAccount);
        assertEq(serviceBalanceBefore, INITIAL_SERVICE_BALANCE);

        // Expect the CollectionExecuted event
        vm.expectEmit(true, true, true, true);
        emit CollectionExecuted(serviceAccount.account, address(token), mainAccount, configId, serviceBalanceBefore);

        // Anyone can trigger the collection (permissionless)
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));

        // Check balances after
        assertEq(token.balanceOf(serviceAccount.account), 0); // All collected
        assertEq(token.balanceOf(mainAccount), mainBalanceBefore + serviceBalanceBefore);
    }

    function test_Integration_TriggerCollection_NonStandardToken() public {
        // Test with USDT-style token that has non-standard transfer
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(address(usdt), config);

        // Check initial state
        uint256 serviceBalanceBefore = usdt.balanceOf(serviceAccount.account);
        uint256 mainBalanceBefore = usdt.balanceOf(mainAccount);

        // Trigger collection with non-standard token
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(usdt));

        // Verify transfer succeeded despite non-standard return
        assertEq(usdt.balanceOf(serviceAccount.account), 0);
        assertEq(usdt.balanceOf(mainAccount), mainBalanceBefore + serviceBalanceBefore);
    }

    function test_Integration_TriggerAllCollections_BatchExecution() public {
        // Setup multiple configs for the same account
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Configure collections for different tokens
        vm.startPrank(serviceAccount.account);
        IAutoCollectExecutor.CollectConfig memory tokenConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });
        IAutoCollectExecutor.CollectConfig memory usdtConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });
        executor.configureCollection(address(token), tokenConfig);
        executor.configureCollection(address(usdt), usdtConfig);
        vm.stopPrank();

        // Record balances before
        uint256 serviceTokenBefore = token.balanceOf(serviceAccount.account);
        uint256 serviceUsdtBefore = usdt.balanceOf(serviceAccount.account);
        uint256 mainTokenBefore = token.balanceOf(mainAccount);
        uint256 mainUsdtBefore = usdt.balanceOf(mainAccount);

        // Trigger all collections for the service account
        vm.prank(stranger);
        executor.triggerAllCollections(serviceAccount.account);

        // Should have executed 2 collections (verify by checking balances)
        assertEq(token.balanceOf(serviceAccount.account), 0);
        assertEq(usdt.balanceOf(serviceAccount.account), 0);
        assertEq(token.balanceOf(mainAccount), mainTokenBefore + serviceTokenBefore);
        assertEq(usdt.balanceOf(mainAccount), mainUsdtBefore + serviceUsdtBefore);
    }

    // ============ Daily Limit Tests ============

    function test_Integration_DailyLimitReset() public {
        // Setup config
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(address(token), config);

        // First collection (service has 100 ether, above threshold)
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));
        assertEq(token.balanceOf(serviceAccount.account), 0);

        // Add some tokens back
        token.mint(serviceAccount.account, 50 ether);

        // Try to collect again same day - should fail (already collected today)
        (bool canExecute, string memory reason) = executor.canExecuteCollection(serviceAccount.account, address(token));
        assertFalse(canExecute);
        assertEq(reason, "Already collected today");

        // Move to next day
        vm.warp(block.timestamp + 1 days);

        // Now can execute again (new day, service has 50 ether above threshold)
        (canExecute, reason) = executor.canExecuteCollection(serviceAccount.account, address(token));
        assertTrue(canExecute);
        assertEq(reason, "");

        // Execute the collection
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));
        assertEq(token.balanceOf(serviceAccount.account), 0);
    }

    function test_Integration_ThresholdEnforcement() public {
        // Setup config with high threshold
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        uint256 highThreshold = INITIAL_SERVICE_BALANCE + 50 ether;
        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: highThreshold, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(address(token), config);

        uint256 currentBalance = token.balanceOf(serviceAccount.account);

        // Should not collect - balance below threshold
        vm.expectEmit(true, true, true, true);
        emit CollectionSkipped(
            serviceAccount.account,
            address(token),
            configId,
            currentBalance,
            highThreshold,
            0, // minimumRemaining
            currentBalance // would collect (balance - 0)
        );

        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));

        // Balance should not change
        assertEq(token.balanceOf(serviceAccount.account), INITIAL_SERVICE_BALANCE);

        // Add more tokens to exceed threshold
        token.mint(serviceAccount.account, 60 ether);

        // Now should be able to collect
        (bool canExecute, string memory reason) = executor.canExecuteCollection(serviceAccount.account, address(token));
        assertTrue(canExecute);
        assertEq(reason, "");
    }

    // ============ Module Uninstall Tests ============

    function test_Integration_UninstallModule_CleansState()
        public
        withModuleStorageClearValidation(serviceAccount, address(executor))
    {
        // Install and configure using ModuleKit
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        vm.startPrank(serviceAccount.account);
        IAutoCollectExecutor.CollectConfig memory tokenConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });
        IAutoCollectExecutor.CollectConfig memory usdtConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD * 2, minimumRemaining: 0, enabled: true
        });
        executor.configureCollection(address(token), tokenConfig);
        executor.configureCollection(address(usdt), usdtConfig);
        vm.stopPrank();

        // Verify configs exist
        (IAutoCollectExecutor.CollectConfig[] memory configs,) = executor.getCollectionConfigs(serviceAccount.account);
        assertEq(configs.length, 2);

        // Uninstall module using ModuleKit
        // Events during UserOp execution are tested in unit tests
        serviceAccount.uninstallModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Verify state is cleaned
        assertFalse(executor.isInitialized(serviceAccount.account));
        assertFalse(serviceAccount.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor)));
        (configs,) = executor.getCollectionConfigs(serviceAccount.account);
        assertEq(configs.length, 0);
    }

    // ============ Reentrancy Protection Tests ============

    function test_Integration_ReentrancyProtection() public {
        // Deploy malicious token
        MaliciousCollectToken malToken = new MaliciousCollectToken();

        // Setup module with malicious token using ModuleKit
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        executor.configureCollection(address(malToken), config);

        // Set reentrancy target - malicious token will try to call back
        malToken.setTarget(executor, serviceAccount.account, address(malToken));

        // Fund service account with malicious tokens
        malToken.mint(serviceAccount.account, INITIAL_SERVICE_BALANCE);

        // Try to trigger - reentrancy guard should prevent issues
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(malToken));

        // Should have completed successfully despite reentrancy attempt
        // Full balance should be collected
        assertEq(malToken.balanceOf(serviceAccount.account), 0);
        assertEq(malToken.balanceOf(mainAccount), INITIAL_SERVICE_BALANCE);
    }

    // ============ Access Control Tests ============

    function test_Integration_ModuleNotInitialized() public {
        // Don't install module - test that uninitialized accounts can't configure
        // Stranger cannot configure without module being installed for their account
        vm.prank(stranger);
        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.expectRevert(abi.encodeWithSelector(IAutoCollectExecutor.ModuleNotInitialized.selector, stranger));
        executor.configureCollection(address(token), config);
    }

    function test_Integration_CrossAccountConfigurationBlocked() public {
        // Install module for serviceAccount only
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Service account can configure for itself
        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(address(token), config);

        // Stranger cannot modify service account's configs (module not initialized for stranger)
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAutoCollectExecutor.ModuleNotInitialized.selector, stranger));
        executor.disableCollection(configId);
    }

    // ============ Edge Case Tests ============

    function test_Integration_ZeroBalanceSkipped() public {
        // Setup module using ModuleKit
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount,
            threshold: 0, // Zero threshold
            minimumRemaining: 0,
            enabled: true
        });

        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(address(token), config);

        // Drain service account balance
        vm.prank(serviceAccount.account);
        token.transfer(mainAccount, INITIAL_SERVICE_BALANCE);

        uint256 currentBalance = token.balanceOf(serviceAccount.account);
        assertEq(currentBalance, 0);

        // Try to trigger - should skip due to zero balance
        vm.expectEmit(true, true, true, true);
        emit CollectionSkipped(
            serviceAccount.account,
            address(token),
            configId,
            0, // balance
            0, // threshold
            0, // minimumRemaining
            0 // would collect
        );

        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));

        // Balance should remain zero
        assertEq(token.balanceOf(serviceAccount.account), 0);
    }

    function test_Integration_DisabledConfigSkipped() public {
        // Setup module using ModuleKit
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(address(token), config);

        // Disable the configuration
        vm.prank(serviceAccount.account);
        executor.disableCollection(configId);

        uint256 serviceBalanceBefore = token.balanceOf(serviceAccount.account);
        uint256 mainBalanceBefore = token.balanceOf(mainAccount);

        // Try to trigger - should not execute (disabled)
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));

        // Balances should not change
        assertEq(token.balanceOf(serviceAccount.account), serviceBalanceBefore);
        assertEq(token.balanceOf(mainAccount), mainBalanceBefore);
    }

    function test_Integration_PartialCollectionAfterThresholdChange() public {
        // Setup with low threshold initially
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(address(token), config);

        // First collection should work (100 ether > 10 ether threshold)
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));
        assertEq(token.balanceOf(serviceAccount.account), 0);

        // Add some tokens back
        token.mint(serviceAccount.account, 5 ether);

        // Update threshold to be higher than current balance
        vm.prank(serviceAccount.account);
        IAutoCollectExecutor.CollectConfig memory newConfig = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: 20 ether, minimumRemaining: 0, enabled: true
        });
        executor.configureCollectionById(configId, newConfig);

        // Move to next day
        vm.warp(block.timestamp + 1 days);

        // Should not collect due to threshold (5 ether < 20 ether)
        (bool canExecute, string memory reason) = executor.canExecuteCollection(serviceAccount.account, address(token));
        assertFalse(canExecute);
        assertEq(reason, "Balance below threshold");
    }

    // ============ Multi-Day Collection Tests ============

    function test_Integration_CollectionAcrossDays() public {
        // Setup config with zero threshold (collect any amount)
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        vm.prank(serviceAccount.account);
        IAutoCollectExecutor.CollectConfig memory config =
            IAutoCollectExecutor.CollectConfig({target: mainAccount, threshold: 0, minimumRemaining: 0, enabled: true});
        executor.configureCollection(address(token), config);

        // Day 1: Collect all balance
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));
        assertEq(token.balanceOf(serviceAccount.account), 0);

        // Add some tokens back same day
        token.mint(serviceAccount.account, 30 ether);

        // Should not collect again same day
        (bool canExecute, string memory reason) = executor.canExecuteCollection(serviceAccount.account, address(token));
        assertFalse(canExecute);
        assertEq(reason, "Already collected today");

        // Move to next day
        vm.warp(block.timestamp + 1 days);

        // Day 2: Should be able to collect again
        uint256 mainBalanceBeforeDay2 = token.balanceOf(mainAccount);

        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));

        // Should have collected the 30 ether
        assertEq(token.balanceOf(serviceAccount.account), 0);
        assertEq(token.balanceOf(mainAccount), mainBalanceBeforeDay2 + 30 ether);
    }

    // ============ Module Type Tests ============

    function test_Integration_ModuleType() public {
        // Verify module type - should only be true for EXECUTOR type
        assertTrue(executor.isModuleType(MODULE_TYPE_EXECUTOR));
        assertFalse(executor.isModuleType(MODULE_TYPE_VALIDATOR));
        assertFalse(executor.isModuleType(MODULE_TYPE_FALLBACK));
        assertFalse(executor.isModuleType(MODULE_TYPE_HOOK));
    }

    // ============ Complex Scenarios ============

    function test_Integration_MultipleServiceAccounts() public {
        // Create second service account
        AccountInstance memory serviceAccount2 = makeAccountInstance("service-account-2");

        // Fund second service account
        token.mint(serviceAccount2.account, INITIAL_SERVICE_BALANCE);

        // Install module on both accounts
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");
        serviceAccount2.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Configure collections on both accounts to same main account
        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        executor.configureCollection(address(token), config);

        vm.prank(serviceAccount2.account);
        executor.configureCollection(address(token), config);

        uint256 mainBalanceBefore = token.balanceOf(mainAccount);

        // Trigger collections from both accounts
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));

        vm.prank(stranger);
        executor.triggerCollection(serviceAccount2.account, address(token));

        // Both service accounts should be drained, main should receive both balances
        assertEq(token.balanceOf(serviceAccount.account), 0);
        assertEq(token.balanceOf(serviceAccount2.account), 0);
        assertEq(token.balanceOf(mainAccount), mainBalanceBefore + (INITIAL_SERVICE_BALANCE * 2));
    }

    function test_Integration_ConfigurationUpdatesAfterExecution() public {
        // Setup and execute first collection
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoCollectExecutor.CollectConfig memory config = IAutoCollectExecutor.CollectConfig({
            target: mainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });

        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(address(token), config);

        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));

        // Add tokens back
        token.mint(serviceAccount.account, 40 ether);

        // Update configuration to new target
        address newMainAccount = makeAddr("newMainAccount");
        vm.prank(serviceAccount.account);
        IAutoCollectExecutor.CollectConfig memory newConfig = IAutoCollectExecutor.CollectConfig({
            target: newMainAccount, threshold: THRESHOLD, minimumRemaining: 0, enabled: true
        });
        executor.configureCollectionById(configId, newConfig);

        // Move to next day and collect again
        vm.warp(block.timestamp + 1 days);

        uint256 newMainBalanceBefore = token.balanceOf(newMainAccount);

        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));

        // Should collect to new target
        assertEq(token.balanceOf(serviceAccount.account), 0);
        assertEq(token.balanceOf(newMainAccount), newMainBalanceBefore + 40 ether);
    }

    // ============ Integration Tests for MinimumRemaining ============

    function test_Integration_PartialCollectionWithMinimumRemaining() public {
        // Setup: Service account with 100 tokens, collect with 30 minimumRemaining
        // Expected: Collect 70, leave 30
        uint256 minimumRemaining = 30 ether;
        uint256 threshold = 50 ether;

        // Install module
        serviceAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Configure collection with minimumRemaining
        vm.prank(serviceAccount.account);
        bytes32 configId = executor.configureCollection(
            address(token),
            IAutoCollectExecutor.CollectConfig({
                target: mainAccount, threshold: threshold, minimumRemaining: minimumRemaining, enabled: true
            })
        );

        // Verify initial balances
        assertEq(token.balanceOf(serviceAccount.account), INITIAL_SERVICE_BALANCE);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE);

        // Trigger collection
        vm.prank(stranger);
        executor.triggerCollection(serviceAccount.account, address(token));

        // Verify partial collection - should leave minimumRemaining
        uint256 expectedCollected = INITIAL_SERVICE_BALANCE - minimumRemaining;
        assertEq(token.balanceOf(serviceAccount.account), minimumRemaining);
        assertEq(token.balanceOf(mainAccount), INITIAL_MAIN_BALANCE + expectedCollected);

        // Verify config state persists
        (IAutoCollectExecutor.CollectConfig memory config,) = executor.getCollectionConfigById(configId);
        assertEq(config.minimumRemaining, minimumRemaining);
    }
}
