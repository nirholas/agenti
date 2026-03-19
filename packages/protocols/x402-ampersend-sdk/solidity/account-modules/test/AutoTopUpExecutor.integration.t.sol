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
import {AutoTopUpExecutor} from "../src/AutoTopUpExecutor.sol";
import {IAutoTopUpExecutor} from "../src/IAutoTopUpExecutor.sol";
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
import {MaliciousToken} from "./mocks/MaliciousToken.sol";

// Integration tests using RhinestoneModuleKit for proper Safe interaction
contract AutoTopUpExecutorIntegrationTest is Test, RhinestoneModuleKit {
    using SafeERC20 for IERC20;
    using ModuleKitHelpers for AccountInstance;

    // Main contracts
    AutoTopUpExecutor public executor;
    MockERC20 public token;
    MockUSDT public usdt;

    // Test accounts
    AccountInstance public safeAccount;
    address public agent1;
    address public agent2;
    address public stranger;

    // Test constants
    uint256 constant DAILY_LIMIT = 100 ether;
    uint256 constant MONTHLY_LIMIT = 1000 ether;
    uint256 constant INITIAL_SAFE_BALANCE = 10000 ether;
    uint256 constant INITIAL_AGENT_BALANCE = 50 ether;

    // Events from the module
    event ModuleInstalled(address indexed account, uint256 initialConfigs);
    event ModuleUninstalled(address indexed account, uint256 removedConfigs);
    event TopUpConfigured(
        address indexed account,
        address indexed agent,
        address asset,
        bytes32 indexed configId,
        IAutoTopUpExecutor.TopUpConfig config
    );
    event TopUpExecuted(
        address indexed account, address indexed agent, address asset, bytes32 indexed configId, uint256 amount
    );
    event TopUpFailed(
        address indexed account, address indexed agent, address asset, bytes32 indexed configId, string reason
    );

    function setUp() public {
        // Initialize ModuleKit with Safe account type
        super.init();

        // Create test addresses
        agent1 = makeAddr("agent1");
        agent2 = makeAddr("agent2");
        stranger = makeAddr("stranger");

        // Deploy tokens
        token = new MockERC20("Test Token", "TEST");
        usdt = new MockUSDT();

        // Deploy AutoTopUpExecutor module as singleton
        executor = new AutoTopUpExecutor();

        // Create a Safe account instance
        safeAccount = makeAccountInstance("safe-account");

        // Fund Safe account with tokens
        token.mint(safeAccount.account, INITIAL_SAFE_BALANCE);
        usdt.mint(safeAccount.account, INITIAL_SAFE_BALANCE);

        // Give agents some initial balance (below daily limit)
        token.mint(agent1, INITIAL_AGENT_BALANCE);
        token.mint(agent2, INITIAL_AGENT_BALANCE);
        usdt.mint(agent1, INITIAL_AGENT_BALANCE);
        usdt.mint(agent2, INITIAL_AGENT_BALANCE);
    }

    // ============ Module Installation with Safe ============

    function test_Integration_InstallModule() public {
        // Install the module on the Safe account using ModuleKit
        // Note: Event emissions during UserOp execution cannot be tested with expectEmit
        // due to ModuleKit's internal use of recordLogs(). Events are tested in unit tests.
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Verify module is properly installed and initialized
        assertTrue(executor.isInitialized(safeAccount.account));
        assertTrue(safeAccount.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor)));
    }

    function test_Integration_InstallWithInitialConfigs() public {
        // Prepare installation data with initial configurations
        address[] memory agents = new address[](2);
        address[] memory assets = new address[](2);
        IAutoTopUpExecutor.TopUpConfig[] memory configs = new IAutoTopUpExecutor.TopUpConfig[](2);

        agents[0] = agent1;
        agents[1] = agent2;
        assets[0] = address(token);
        assets[1] = address(token);

        configs[0] =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        configs[1] = IAutoTopUpExecutor.TopUpConfig({
            dailyLimit: DAILY_LIMIT / 2, monthlyLimit: MONTHLY_LIMIT / 2, enabled: false
        });

        bytes memory installData = abi.encode(agents, assets, configs);

        // Install with initial configs using ModuleKit
        // Events during UserOp execution are tested in unit tests
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), installData);

        // Verify configs were created
        (IAutoTopUpExecutor.TopUpConfig[] memory retrievedConfigs,) = executor.getTopUpConfigs(safeAccount.account);
        assertEq(retrievedConfigs.length, 2);
        assertTrue(safeAccount.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor)));
    }

    // ============ Execution Tests with Safe ============

    function test_Integration_TriggerTopUp_Success() public {
        // Install module using ModuleKit
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(safeAccount.account);
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Check agent balance before
        uint256 agentBalanceBefore = token.balanceOf(agent1);
        assertEq(agentBalanceBefore, INITIAL_AGENT_BALANCE);

        // Calculate expected top-up amount
        uint256 expectedTopUp = DAILY_LIMIT - agentBalanceBefore;

        // Expect the TopUpExecuted event
        vm.expectEmit(true, true, true, true);
        emit TopUpExecuted(safeAccount.account, agent1, address(token), configId, expectedTopUp);

        // Anyone can trigger the top-up (permissionless)
        vm.prank(stranger);
        executor.triggerTopUp(safeAccount.account, configId);

        // Check agent balance after
        uint256 agentBalanceAfter = token.balanceOf(agent1);
        assertEq(agentBalanceAfter, DAILY_LIMIT);

        // Check Safe balance decreased
        assertEq(token.balanceOf(safeAccount.account), INITIAL_SAFE_BALANCE - expectedTopUp);
    }

    function test_Integration_TriggerTopUp_NonStandardToken() public {
        // Test with USDT-style token that has non-standard transfer
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(safeAccount.account);
        bytes32 configId = executor.configureTopUp(agent1, address(usdt), config);

        // Check initial state
        uint256 agentBalanceBefore = usdt.balanceOf(agent1);
        uint256 expectedTopUp = DAILY_LIMIT - agentBalanceBefore;

        // Trigger top-up with non-standard token
        vm.prank(stranger);
        executor.triggerTopUp(safeAccount.account, configId);

        // Verify transfer succeeded despite non-standard return
        assertEq(usdt.balanceOf(agent1), DAILY_LIMIT);
        assertEq(usdt.balanceOf(safeAccount.account), INITIAL_SAFE_BALANCE - expectedTopUp);
    }

    function test_Integration_TriggerTopUps_BatchExecution() public {
        // Setup multiple configs for the same account
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        // Configure multiple agents with different tokens
        vm.startPrank(safeAccount.account);
        executor.configureTopUp(agent1, address(token), config);
        executor.configureTopUp(agent2, address(token), config);
        executor.configureTopUp(agent1, address(usdt), config);
        vm.stopPrank();

        // Record balances before
        uint256 agent1TokenBefore = token.balanceOf(agent1);
        uint256 agent2TokenBefore = token.balanceOf(agent2);
        uint256 agent1UsdtBefore = usdt.balanceOf(agent1);

        // Trigger all top-ups for the Safe account
        vm.prank(stranger);
        executor.triggerTopUps(safeAccount.account);

        // Should have executed 3 top-ups (verify by checking balances)

        // Verify all balances were topped up
        assertEq(token.balanceOf(agent1), DAILY_LIMIT);
        assertEq(token.balanceOf(agent2), DAILY_LIMIT);
        assertEq(usdt.balanceOf(agent1), DAILY_LIMIT);
    }

    // ============ Daily/Monthly Limit Tests ============

    function test_Integration_DailyLimitReset() public {
        // Setup config with low daily limit
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: 60 ether, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(safeAccount.account);
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // First top-up (agent1 has 50 ether, needs 10 ether to reach 60)
        vm.prank(stranger);
        executor.triggerTopUp(safeAccount.account, configId);
        assertEq(token.balanceOf(agent1), 60 ether);

        // Spend some tokens
        vm.prank(agent1);
        token.transfer(agent2, 20 ether);
        assertEq(token.balanceOf(agent1), 40 ether);

        // Try to top-up again same day - should fail (already topped up today)
        (bool canExecute, string memory reason) = executor.canExecuteTopUp(safeAccount.account, configId);
        assertFalse(canExecute);
        assertEq(reason, "Already topped up today");

        // Move to next day
        vm.warp(block.timestamp + 1 days);

        // Now can execute again (new day, agent balance is 40, needs 20 to reach 60)
        (canExecute, reason) = executor.canExecuteTopUp(safeAccount.account, configId);
        assertTrue(canExecute);
        assertEq(reason, "");

        // Execute the top-up
        vm.prank(stranger);
        executor.triggerTopUp(safeAccount.account, configId);
        assertEq(token.balanceOf(agent1), 60 ether);
    }

    function test_Integration_MonthlyLimitEnforcement() public {
        // Setup config with low monthly limit
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoTopUpExecutor.TopUpConfig memory config = IAutoTopUpExecutor.TopUpConfig({
            dailyLimit: 100 ether,
            monthlyLimit: 120 ether, // Just above one top-up (50 ether needed initially)
            enabled: true
        });

        vm.prank(safeAccount.account);
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // First top-up should work (agent has 50 ether, needs 50 ether to reach 100)
        vm.prank(stranger);
        executor.triggerTopUp(safeAccount.account, configId);
        assertEq(token.balanceOf(agent1), 100 ether);

        // Spend most tokens
        vm.prank(agent1);
        token.transfer(agent2, 90 ether);
        assertEq(token.balanceOf(agent1), 10 ether);

        // Move to next day to allow another top-up
        vm.warp(block.timestamp + 1 days);

        // Second top-up should be partial (would need 90 ether, but only 70 left in monthly limit)
        // Monthly spent: 50 ether, limit: 120 ether, remaining: 70 ether
        vm.prank(stranger);
        executor.triggerTopUp(safeAccount.account, configId);

        // Balance should be: 10 (current) + 70 (remaining monthly limit) = 80 ether
        assertEq(token.balanceOf(agent1), 80 ether);

        // Move to next day and try again - should fail (monthly limit reached)
        vm.warp(block.timestamp + 1 days);
        vm.prank(agent1);
        token.transfer(agent2, 10 ether); // Spend some to be below daily limit

        (bool canExecute, string memory reason) = executor.canExecuteTopUp(safeAccount.account, configId);
        assertFalse(canExecute);
        assertEq(reason, "Monthly limit reached");
    }

    // ============ Module Uninstall Tests ============

    function test_Integration_UninstallModule_CleansState()
        public
        withModuleStorageClearValidation(safeAccount, address(executor))
    {
        // Install and configure using ModuleKit
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.startPrank(safeAccount.account);
        executor.configureTopUp(agent1, address(token), config);
        executor.configureTopUp(agent2, address(usdt), config);
        vm.stopPrank();

        // Verify configs exist
        (IAutoTopUpExecutor.TopUpConfig[] memory configs,) = executor.getTopUpConfigs(safeAccount.account);
        assertEq(configs.length, 2);

        // Uninstall module using ModuleKit
        // Events during UserOp execution are tested in unit tests
        safeAccount.uninstallModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Verify state is cleaned
        assertFalse(executor.isInitialized(safeAccount.account));
        assertFalse(safeAccount.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor)));
        (configs,) = executor.getTopUpConfigs(safeAccount.account);
        assertEq(configs.length, 0);
    }

    // ============ Reentrancy Protection Tests ============

    function test_Integration_ReentrancyProtection() public {
        // Deploy malicious token
        MaliciousToken malToken = new MaliciousToken();

        // Setup module with malicious token using ModuleKit
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(safeAccount.account);
        bytes32 configId = executor.configureTopUp(agent1, address(malToken), config);

        // Set reentrancy target
        malToken.setTarget(executor, configId);

        // Fund Safe with malicious tokens
        malToken.mint(safeAccount.account, INITIAL_SAFE_BALANCE);

        // Try to trigger - reentrancy guard should prevent issues
        vm.prank(stranger);
        executor.triggerTopUp(safeAccount.account, configId);

        // Should have completed successfully despite reentrancy attempt
        assertEq(malToken.balanceOf(agent1), DAILY_LIMIT);
    }

    // ============ Access Control Tests ============

    function test_Integration_ModuleNotInitialized() public {
        // Don't install module - test that uninitialised accounts can't configure
        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        // Stranger cannot configure without module being installed for their account
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.ModuleNotInitialized.selector, stranger));
        executor.configureTopUp(agent1, address(token), config);
    }

    function test_Integration_CrossAccountConfigurationBlocked() public {
        // Install module for safeAccount only
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        // Safe account can configure for itself
        vm.prank(safeAccount.account);
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Stranger cannot modify safe account's configs (module not initialized for stranger)
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.ModuleNotInitialized.selector, stranger));
        executor.disableTopUp(configId);
    }

    // ============ Edge Case Tests ============

    function test_Integration_InsufficientSafeBalance() public {
        // Setup module using ModuleKit
        safeAccount.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(safeAccount.account);
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Drain Safe balance
        vm.prank(safeAccount.account);
        token.transfer(agent2, INITIAL_SAFE_BALANCE);

        // Try to trigger - should fail due to insufficient balance
        vm.expectEmit(true, true, true, true);
        emit TopUpFailed(safeAccount.account, agent1, address(token), configId, "Insufficient account balance");

        vm.prank(stranger);
        executor.triggerTopUp(safeAccount.account, configId);

        // Agent balance should not change
        assertEq(token.balanceOf(agent1), INITIAL_AGENT_BALANCE);
    }

    function test_Integration_ModuleType() public {
        // Verify module type - should only be true for EXECUTOR type
        assertTrue(executor.isModuleType(MODULE_TYPE_EXECUTOR));
        assertFalse(executor.isModuleType(MODULE_TYPE_VALIDATOR));
        assertFalse(executor.isModuleType(MODULE_TYPE_FALLBACK));
        assertFalse(executor.isModuleType(MODULE_TYPE_HOOK));
    }
}
