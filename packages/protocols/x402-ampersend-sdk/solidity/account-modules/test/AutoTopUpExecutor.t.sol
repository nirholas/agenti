// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {AutoTopUpExecutor} from "../src/AutoTopUpExecutor.sol";
import {IAutoTopUpExecutor} from "../src/IAutoTopUpExecutor.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BokkyPooBahsDateTimeLibrary} from "BokkyPooBahsDateTimeLibrary/contracts/BokkyPooBahsDateTimeLibrary.sol";

// Import mocks
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";
import {MockSafe} from "./mocks/MockSafe.sol";
import {MockTokenBadReturn} from "./mocks/MockTokenBadReturn.sol";
import {MockTokenReturnsFalse} from "./mocks/MockTokenReturnsFalse.sol";

// Test contract with proper inheritance for module testing
contract AutoTopUpExecutorTest is Test {
    // Main contracts
    AutoTopUpExecutor public executor;
    MockERC20 public token;
    MockUSDT public usdt;
    MockSafe public safe;

    // Test addresses
    address public owner;
    address public agent1;
    address public agent2;
    address public stranger;

    // Test constants
    uint256 constant DAILY_LIMIT = 100 ether;
    uint256 constant MONTHLY_LIMIT = 1000 ether;
    uint256 constant INITIAL_SAFE_BALANCE = 10000 ether;
    uint256 constant INITIAL_AGENT_BALANCE = 50 ether; // Below daily limit

    // Events to test
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
    event TopUpEnabled(address indexed account, address indexed agent, address asset, bytes32 indexed configId);
    event TopUpDisabled(address indexed account, address indexed agent, address asset, bytes32 indexed configId);

    function setUp() public {
        // Set up test accounts
        owner = makeAddr("owner");
        stranger = makeAddr("stranger");
        agent1 = makeAddr("agent1");
        agent2 = makeAddr("agent2");

        // Deploy test tokens
        token = new MockERC20("Test Token", "TEST");
        usdt = new MockUSDT();

        // Deploy mock Safe
        safe = new MockSafe(owner);

        // Deploy AutoTopUpExecutor as singleton
        executor = new AutoTopUpExecutor();

        // Enable executor as module on Safe
        vm.prank(owner);
        safe.enableModule(address(executor));

        // Fund Safe with tokens
        token.mint(address(safe), INITIAL_SAFE_BALANCE);
        usdt.mint(address(safe), INITIAL_SAFE_BALANCE);

        // Give agents some initial balance (below daily limit)
        token.mint(agent1, INITIAL_AGENT_BALANCE);
        token.mint(agent2, INITIAL_AGENT_BALANCE);
        usdt.mint(agent1, INITIAL_AGENT_BALANCE);
        usdt.mint(agent2, INITIAL_AGENT_BALANCE);
    }

    // ============ Module Installation Tests ============

    function test_OnInstall_EmptyData() public {
        // Install module without initial configs
        vm.expectEmit(true, false, false, true);
        emit ModuleInstalled(address(safe), 0);

        vm.prank(address(safe));
        executor.onInstall("");

        assertTrue(executor.isInitialized(address(safe)));
    }

    function test_OnInstall_WithSingleConfig() public {
        // Prepare installation data
        address[] memory agents = new address[](1);
        address[] memory assets = new address[](1);
        IAutoTopUpExecutor.TopUpConfig[] memory configs = new IAutoTopUpExecutor.TopUpConfig[](1);

        agents[0] = agent1;
        assets[0] = address(token);
        configs[0] =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        bytes memory installData = abi.encode(agents, assets, configs);

        // Calculate expected config ID
        bytes32 configId = executor.generateConfigId(address(safe), agent1, address(token));

        // Expect events
        vm.expectEmit(true, true, true, true);
        emit TopUpConfigured(address(safe), agent1, address(token), configId, configs[0]);

        vm.expectEmit(true, true, true, true);
        emit TopUpEnabled(address(safe), agent1, address(token), configId);

        vm.expectEmit(true, false, false, true);
        emit ModuleInstalled(address(safe), 1);

        vm.prank(address(safe));
        executor.onInstall(installData);

        assertTrue(executor.isInitialized(address(safe)));

        // Verify config was created
        (IAutoTopUpExecutor.TopUpConfig memory config,) = executor.getTopUpById(configId);
        assertEq(config.dailyLimit, DAILY_LIMIT);
        assertEq(config.monthlyLimit, MONTHLY_LIMIT);
        assertTrue(config.enabled);
    }

    function test_OnInstall_RevertInvalidAgent() public {
        // Try to install with zero address agent
        address[] memory agents = new address[](1);
        address[] memory assets = new address[](1);
        IAutoTopUpExecutor.TopUpConfig[] memory configs = new IAutoTopUpExecutor.TopUpConfig[](1);

        agents[0] = address(0); // Invalid
        assets[0] = address(token);
        configs[0] =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        bytes memory installData = abi.encode(agents, assets, configs);

        vm.prank(address(safe));
        vm.expectRevert(IAutoTopUpExecutor.InvalidAgent.selector);
        executor.onInstall(installData);
    }

    // ============ Module Uninstallation Tests ============

    function test_OnUninstall_CleansUpAllState() public {
        // First install with configs
        address[] memory agents = new address[](2);
        address[] memory assets = new address[](2);
        IAutoTopUpExecutor.TopUpConfig[] memory configs = new IAutoTopUpExecutor.TopUpConfig[](2);

        agents[0] = agent1;
        agents[1] = agent2;
        assets[0] = address(token);
        assets[1] = address(token);

        for (uint256 i = 0; i < 2; i++) {
            configs[i] =
                IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});
        }

        vm.prank(address(safe));
        executor.onInstall(abi.encode(agents, assets, configs));

        // Verify installation
        assertTrue(executor.isInitialized(address(safe)));
        (IAutoTopUpExecutor.TopUpConfig[] memory retrievedConfigs,) = executor.getTopUpConfigs(address(safe));
        assertEq(retrievedConfigs.length, 2);

        // Now uninstall
        vm.expectEmit(true, false, false, true);
        emit ModuleUninstalled(address(safe), 2);

        vm.prank(address(safe));
        executor.onUninstall("");

        // Verify all state is cleaned
        assertFalse(executor.isInitialized(address(safe)));
        (retrievedConfigs,) = executor.getTopUpConfigs(address(safe));
        assertEq(retrievedConfigs.length, 0);
    }

    // ============ Configuration Management Tests ============

    function test_ConfigureTopUp_NewConfig() public {
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        bytes32 expectedConfigId = executor.generateConfigId(address(safe), agent1, address(token));

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        assertEq(configId, expectedConfigId);

        // Verify config was created
        (IAutoTopUpExecutor.TopUpConfig memory retrievedConfig, IAutoTopUpExecutor.TopUpState memory state) =
            executor.getTopUpById(configId);
        assertEq(retrievedConfig.dailyLimit, DAILY_LIMIT);
        assertEq(retrievedConfig.monthlyLimit, MONTHLY_LIMIT);
        assertTrue(retrievedConfig.enabled);
        assertEq(state.agent, agent1);
        assertEq(state.asset, address(token));
    }

    function test_ConfigureTopUp_RevertInvalidAgent_ZeroAddress() public {
        // Setup: Install module
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        // Try to configure with zero address agent
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.InvalidAgent.selector));
        executor.configureTopUp(address(0), address(token), config);
    }

    function test_ConfigureTopUp_RevertInvalidAgent_SameAsAccount() public {
        // Setup: Install module
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        // Try to configure with agent same as account (msg.sender)
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.InvalidAgent.selector));
        executor.configureTopUp(address(safe), address(token), config);
    }

    function test_ConfigureTopUp_RevertInvalidAsset() public {
        // Setup: Install module
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        // Try to configure with zero address asset
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.InvalidAsset.selector));
        executor.configureTopUp(agent1, address(0), config);
    }

    function test_ConfigureTopUp_MaxValues() public {
        // Setup: Install module
        vm.prank(address(safe));
        executor.onInstall("");

        // Test with maximum uint256 values
        IAutoTopUpExecutor.TopUpConfig memory config = IAutoTopUpExecutor.TopUpConfig({
            dailyLimit: type(uint256).max, monthlyLimit: type(uint256).max, enabled: true
        });

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Verify config was created successfully
        (IAutoTopUpExecutor.TopUpConfig memory retrievedConfig,) = executor.getTopUpById(configId);
        assertEq(retrievedConfig.dailyLimit, type(uint256).max);
        assertEq(retrievedConfig.monthlyLimit, type(uint256).max);
        assertTrue(retrievedConfig.enabled);
    }

    function test_ConfigureTopUp_RevertInvalidConfiguration() public {
        vm.prank(address(safe));
        executor.onInstall("");

        // Zero daily limit
        IAutoTopUpExecutor.TopUpConfig memory config1 =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: 0, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        vm.expectRevert(IAutoTopUpExecutor.InvalidConfiguration.selector);
        executor.configureTopUp(agent1, address(token), config1);

        // Zero monthly limit
        IAutoTopUpExecutor.TopUpConfig memory config2 =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: 0, enabled: true});

        vm.prank(address(safe));
        vm.expectRevert(IAutoTopUpExecutor.InvalidConfiguration.selector);
        executor.configureTopUp(agent1, address(token), config2);
    }

    // ============ Enable/Disable Tests ============

    function test_EnableDisableTopUp() public {
        // Setup disabled config
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: false});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Enable it
        vm.expectEmit(true, true, true, true);
        emit TopUpEnabled(address(safe), agent1, address(token), configId);

        vm.prank(address(safe));
        executor.enableTopUp(configId);

        // Verify it's enabled
        (IAutoTopUpExecutor.TopUpConfig memory retrievedConfig,) = executor.getTopUpById(configId);
        assertTrue(retrievedConfig.enabled);

        // Disable it
        vm.expectEmit(true, true, true, true);
        emit TopUpDisabled(address(safe), agent1, address(token), configId);

        vm.prank(address(safe));
        executor.disableTopUp(configId);

        // Verify it's disabled
        (retrievedConfig,) = executor.getTopUpById(configId);
        assertFalse(retrievedConfig.enabled);
    }

    function test_EnableDisable_RevertUnauthorized() public {
        // Setup config as safe account
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: false});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Try to enable as stranger (should fail - module not initialized)
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.ModuleNotInitialized.selector, stranger));
        executor.enableTopUp(configId);

        // Try to disable as stranger (should fail - module not initialized)
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.ModuleNotInitialized.selector, stranger));
        executor.disableTopUp(configId);

        // Now test with an initialized but unauthorized account
        address otherAccount = makeAddr("otherAccount");
        vm.prank(otherAccount);
        executor.onInstall("");

        // Try to enable config owned by safe account (should fail - unauthorized)
        vm.prank(otherAccount);
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.Unauthorized.selector, configId, otherAccount));
        executor.enableTopUp(configId);
    }

    // ============ View Function Tests ============

    function test_ConfigureTopUpById_Success() public {
        // Setup: Install module and create initial config
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory initialConfig =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: false});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), initialConfig);

        // Update config by ID
        IAutoTopUpExecutor.TopUpConfig memory newConfig = IAutoTopUpExecutor.TopUpConfig({
            dailyLimit: DAILY_LIMIT * 2, monthlyLimit: MONTHLY_LIMIT * 3, enabled: true
        });

        vm.expectEmit(true, true, true, true);
        emit TopUpConfigured(address(safe), agent1, address(token), configId, newConfig);
        vm.expectEmit(true, true, true, true);
        emit TopUpEnabled(address(safe), agent1, address(token), configId);

        vm.prank(address(safe));
        executor.configureTopUpById(configId, newConfig);

        // Verify config was updated
        (IAutoTopUpExecutor.TopUpConfig memory retrievedConfig,) = executor.getTopUpById(configId);
        assertEq(retrievedConfig.dailyLimit, DAILY_LIMIT * 2);
        assertEq(retrievedConfig.monthlyLimit, MONTHLY_LIMIT * 3);
        assertTrue(retrievedConfig.enabled);
    }

    function test_ConfigureTopUpById_RevertModuleNotInitialized() public {
        // Don't install module for safe
        bytes32 configId = keccak256("dummy");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.ModuleNotInitialized.selector, address(safe)));
        executor.configureTopUpById(configId, config);
    }

    function test_ConfigureTopUpById_RevertConfigNotFound() public {
        // Install module but use non-existent configId
        vm.prank(address(safe));
        executor.onInstall("");

        bytes32 nonExistentConfigId = keccak256("nonexistent");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.ConfigNotFound.selector));
        executor.configureTopUpById(nonExistentConfigId, config);
    }

    function test_ConfigureTopUpById_RevertUnauthorized() public {
        // Setup: Safe creates a config
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Stranger tries to update safe's config
        IAutoTopUpExecutor.TopUpConfig memory newConfig = IAutoTopUpExecutor.TopUpConfig({
            dailyLimit: DAILY_LIMIT * 2, monthlyLimit: MONTHLY_LIMIT * 2, enabled: false
        });

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.ModuleNotInitialized.selector, stranger));
        executor.configureTopUpById(configId, newConfig);
    }

    function test_ConfigureTopUpById_RevertInvalidConfiguration() public {
        // Setup: Install module and create initial config
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory initialConfig =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), initialConfig);

        // Try to update with invalid config (zero daily limit)
        IAutoTopUpExecutor.TopUpConfig memory invalidConfig =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: 0, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAutoTopUpExecutor.InvalidConfiguration.selector));
        executor.configureTopUpById(configId, invalidConfig);
    }

    function test_TriggerTopUp_EmitsEvent() public {
        // Setup: Install module and configure top-up
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Agent has low balance, needs top-up
        uint256 agentBalanceBefore = token.balanceOf(agent1);
        uint256 expectedTopUp = DAILY_LIMIT - agentBalanceBefore;

        // Expect the TopUpExecuted event
        vm.expectEmit(true, true, true, true);
        emit TopUpExecuted(address(safe), agent1, address(token), configId, expectedTopUp);

        // Trigger the top-up
        executor.triggerTopUp(address(safe), configId);

        // Verify the top-up was executed
        assertEq(token.balanceOf(agent1), DAILY_LIMIT);
    }

    function test_CanExecuteTopUp_Conditions() public {
        // Setup
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Should be able to execute (agent balance is below daily limit)
        (bool canExecute, string memory reason) = executor.canExecuteTopUp(address(safe), configId);
        assertTrue(canExecute);
        assertEq(reason, "");

        // Fund agent to be above daily limit
        token.mint(agent1, DAILY_LIMIT);

        // Should not be able to execute now
        (canExecute, reason) = executor.canExecuteTopUp(address(safe), configId);
        assertFalse(canExecute);
        assertEq(reason, "Agent balance sufficient");

        // Test with disabled config
        vm.prank(address(safe));
        executor.disableTopUp(configId);

        (canExecute, reason) = executor.canExecuteTopUp(address(safe), configId);
        assertFalse(canExecute);
        assertEq(reason, "Top-up disabled");
    }

    function test_TransferValidation_InvalidReturn() public {
        // Setup: Install module and configure top-up
        vm.prank(address(safe));
        executor.onInstall("");

        // Create a token that returns malformed data
        MockTokenBadReturn badToken = new MockTokenBadReturn();
        badToken.mint(address(safe), INITIAL_SAFE_BALANCE);

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(badToken), config);

        // Should emit TopUpFailed when transfer returns malformed data (now caught by try-catch)
        vm.prank(stranger);
        vm.expectEmit(true, true, true, true);
        emit TopUpFailed(address(safe), agent1, address(badToken), configId, "Transfer failed");
        executor.triggerTopUp(address(safe), configId);

        // Verify state was NOT updated (no top-up happened)
        (, IAutoTopUpExecutor.TopUpState memory state) = executor.getTopUpById(configId);
        assertEq(state.lastTopUpDay, 0); // Should remain 0 since transfer failed
        assertEq(state.monthlySpent, 0); // Should remain 0 since transfer failed
    }

    function test_TransferValidation_ReturnsFalse() public {
        // Setup: Install module and configure top-up
        vm.prank(address(safe));
        executor.onInstall("");

        // Create a token that returns false on transfer
        MockTokenReturnsFalse falseToken = new MockTokenReturnsFalse();
        falseToken.mint(address(safe), INITIAL_SAFE_BALANCE);

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(falseToken), config);

        // Should emit TopUpFailed when transfer returns false (now caught by try-catch)
        vm.prank(stranger);
        vm.expectEmit(true, true, true, true);
        emit TopUpFailed(address(safe), agent1, address(falseToken), configId, "Transfer failed");
        executor.triggerTopUp(address(safe), configId);

        // Verify state was NOT updated (no top-up happened)
        (, IAutoTopUpExecutor.TopUpState memory state) = executor.getTopUpById(configId);
        assertEq(state.lastTopUpDay, 0); // Should remain 0 since transfer failed
        assertEq(state.monthlySpent, 0); // Should remain 0 since transfer failed
    }

    function test_GetTopUp_Success() public {
        // Setup: Install module and create config
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Test getTopUp function
        (IAutoTopUpExecutor.TopUpConfig memory retrievedConfig, IAutoTopUpExecutor.TopUpState memory retrievedState) =
            executor.getTopUp(address(safe), agent1, address(token));

        assertEq(retrievedConfig.dailyLimit, DAILY_LIMIT);
        assertEq(retrievedConfig.monthlyLimit, MONTHLY_LIMIT);
        assertTrue(retrievedConfig.enabled);
        assertEq(retrievedState.agent, agent1);
        assertEq(retrievedState.asset, address(token));
    }

    function test_GetTopUp_NonExistentConfig() public {
        // Test getTopUp with non-existent config
        (IAutoTopUpExecutor.TopUpConfig memory config, IAutoTopUpExecutor.TopUpState memory state) =
            executor.getTopUp(address(safe), agent1, address(token));

        // Should return zero values for non-existent config
        assertEq(config.dailyLimit, 0);
        assertEq(config.monthlyLimit, 0);
        assertFalse(config.enabled);
        assertEq(state.agent, address(0));
        assertEq(state.asset, address(0));
    }

    function test_CanExecuteTopUp_ConfigNotFound() public {
        bytes32 nonExistentConfigId = keccak256("nonexistent");

        (bool canExecute, string memory reason) = executor.canExecuteTopUp(address(safe), nonExistentConfigId);

        assertFalse(canExecute);
        assertEq(reason, "Config not found");
    }

    function test_CanExecuteTopUp_AccountDoesntOwnConfig() public {
        // Setup: Safe creates a config
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Try to check canExecute with different account (stranger)
        (bool canExecute, string memory reason) = executor.canExecuteTopUp(stranger, configId);

        assertFalse(canExecute);
        assertEq(reason, "Account doesn't own config");
    }

    function test_GetTopUpConfigs() public {
        // Install module and create multiple configs
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config1 =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        IAutoTopUpExecutor.TopUpConfig memory config2 = IAutoTopUpExecutor.TopUpConfig({
            dailyLimit: DAILY_LIMIT / 2, monthlyLimit: MONTHLY_LIMIT / 2, enabled: false
        });

        vm.startPrank(address(safe));
        executor.configureTopUp(agent1, address(token), config1);
        executor.configureTopUp(agent2, address(usdt), config2);
        vm.stopPrank();

        // Get all configs
        (IAutoTopUpExecutor.TopUpConfig[] memory configs, IAutoTopUpExecutor.TopUpState[] memory states) =
            executor.getTopUpConfigs(address(safe));

        assertEq(configs.length, 2);
        assertEq(states.length, 2);

        // Verify first config
        assertEq(configs[0].dailyLimit, DAILY_LIMIT);
        assertEq(configs[0].monthlyLimit, MONTHLY_LIMIT);
        assertTrue(configs[0].enabled);

        // Verify second config
        assertEq(configs[1].dailyLimit, DAILY_LIMIT / 2);
        assertEq(configs[1].monthlyLimit, MONTHLY_LIMIT / 2);
        assertFalse(configs[1].enabled);
    }

    // ============ Date Boundary Tests ============

    function test_DailyLimitReset() public {
        // Setup config with daily limit
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // First execution should work
        (bool canExecute, string memory reason) = executor.canExecuteTopUp(address(safe), configId);
        assertTrue(canExecute);
        assertEq(reason, "");

        // Actually execute the top-up
        vm.prank(address(safe));
        executor.triggerTopUp(address(safe), configId);

        // Should not be able to execute again same day (daily limit enforced)
        (canExecute, reason) = executor.canExecuteTopUp(address(safe), configId);
        assertFalse(canExecute);
        assertEq(reason, "Already topped up today");

        // Move to next day
        vm.warp(block.timestamp + 1 days);

        // Now check - should not execute because agent balance is sufficient
        (canExecute, reason) = executor.canExecuteTopUp(address(safe), configId);
        assertFalse(canExecute);
        assertEq(reason, "Agent balance sufficient");

        // Reduce agent balance to need another top-up
        vm.prank(agent1);
        token.transfer(agent2, 60 ether);

        // Now should be able to execute
        (canExecute, reason) = executor.canExecuteTopUp(address(safe), configId);
        assertTrue(canExecute);
        assertEq(reason, "");
    }

    function test_MonthlyLimitReset() public {
        // Setup config with low monthly limit (just enough for 2 top-ups)
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config = IAutoTopUpExecutor.TopUpConfig({
            dailyLimit: DAILY_LIMIT,
            monthlyLimit: 110 ether, // Allows ~2 top-ups of 50 ether each
            enabled: true
        });

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // First top-up should work
        vm.prank(address(safe));
        executor.triggerTopUp(address(safe), configId);
        assertEq(token.balanceOf(agent1), DAILY_LIMIT);

        // Spend tokens and move to next day
        vm.prank(agent1);
        token.transfer(agent2, 90 ether);
        vm.warp(block.timestamp + 1 days);

        // Second top-up should work (still within monthly limit)
        vm.prank(address(safe));
        executor.triggerTopUp(address(safe), configId);

        // After second top-up, agent should have less than daily limit due to monthly limit
        // Monthly limit is 110 ether, already spent 50 ether, so can only top up 60 ether more
        // Agent had 10 ether, topped up by 60 ether to reach 70 ether
        assertEq(token.balanceOf(agent1), 70 ether);

        // Spend tokens and move to next day (transfer less than balance)
        vm.prank(agent1);
        token.transfer(agent2, 60 ether);
        vm.warp(block.timestamp + 1 days);

        // Third top-up should fail (monthly limit reached)
        (bool canExecute, string memory reason) = executor.canExecuteTopUp(address(safe), configId);
        assertFalse(canExecute);
        assertEq(reason, "Monthly limit reached");

        // Move to next month (30 days forward to ensure month change)
        vm.warp(block.timestamp + 30 days);

        // Should be able to execute again (new month)
        (canExecute, reason) = executor.canExecuteTopUp(address(safe), configId);
        assertTrue(canExecute);
        assertEq(reason, "");

        // Execute to verify it actually works
        vm.prank(address(safe));
        executor.triggerTopUp(address(safe), configId);
        assertEq(token.balanceOf(agent1), DAILY_LIMIT);
    }

    function test_YearTransition() public {
        // Setup config
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Set time to Dec 31, 2023
        vm.warp(1704067199); // Dec 31, 2023 23:59:59 UTC

        // Execute top-up on last day of year
        vm.prank(address(safe));
        executor.triggerTopUp(address(safe), configId);

        // Reduce balance to need another top-up
        vm.prank(agent1);
        token.transfer(agent2, 60 ether);

        // Should not execute again same day
        (bool canExecute, string memory reason) = executor.canExecuteTopUp(address(safe), configId);
        assertFalse(canExecute);
        assertEq(reason, "Already topped up today");

        // Move to Jan 1, 2024 (next year)
        vm.warp(1704067200); // Jan 1, 2024 00:00:00 UTC

        // Should be able to execute (new day and new year)
        (canExecute, reason) = executor.canExecuteTopUp(address(safe), configId);
        assertTrue(canExecute);
        assertEq(reason, "");

        // Verify execution works
        vm.prank(address(safe));
        executor.triggerTopUp(address(safe), configId);
        assertEq(token.balanceOf(agent1), DAILY_LIMIT);
    }

    function test_LeapYearFebruary() public {
        // Setup config
        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Set time to Feb 28, 2024 (leap year)
        vm.warp(1709078400); // Feb 28, 2024 00:00:00 UTC

        // Execute top-up on Feb 28
        vm.prank(address(safe));
        executor.triggerTopUp(address(safe), configId);

        // Reduce balance
        vm.prank(agent1);
        token.transfer(agent2, 60 ether);

        // Move to Feb 29 (leap day)
        vm.warp(1709164800); // Feb 29, 2024 00:00:00 UTC

        // Should be able to execute on leap day
        (bool canExecute, string memory reason) = executor.canExecuteTopUp(address(safe), configId);
        assertTrue(canExecute);
        assertEq(reason, "");

        vm.prank(address(safe));
        executor.triggerTopUp(address(safe), configId);

        // Reduce balance again
        vm.prank(agent1);
        token.transfer(agent2, 60 ether);

        // Move to March 1
        vm.warp(1709251200); // March 1, 2024 00:00:00 UTC

        // Should be able to execute on March 1
        (canExecute, reason) = executor.canExecuteTopUp(address(safe), configId);
        assertTrue(canExecute);
        assertEq(reason, "");
    }

    // ============ Fuzz Tests ============

    function testFuzz_DailyExecutionLimit(uint32 startTimestamp, uint32 timeDelta) public {
        // Test that daily execution limit is enforced across various start times and deltas
        // Bound start timestamp to reasonable range (year 2020-2030)
        uint256 startTime = bound(uint256(startTimestamp), 1577836800, 1893456000); // 2020-2030
        vm.warp(startTime);

        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, enabled: true});

        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Execute first top-up
        vm.prank(address(safe));
        executor.triggerTopUp(address(safe), configId);

        // Reduce balance to need another top-up
        vm.prank(agent1);
        token.transfer(agent2, 60 ether);

        // Calculate seconds remaining in current calendar day
        (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(block.timestamp);
        uint256 endOfDay = BokkyPooBahsDateTimeLibrary.timestampFromDate(year, month, day) + 86400 - 1;
        uint256 secondsLeftInDay = endOfDay - block.timestamp;

        // Bound time delta to stay within current calendar day
        uint256 deltaSeconds = bound(uint256(timeDelta), 0, secondsLeftInDay);
        vm.warp(block.timestamp + deltaSeconds);

        // Should not be able to execute again same calendar day
        (bool canExecute, string memory reason) = executor.canExecuteTopUp(address(safe), configId);
        assertFalse(canExecute);
        assertEq(reason, "Already topped up today");

        // Move to next calendar day
        vm.warp(block.timestamp + (secondsLeftInDay - deltaSeconds) + 1);

        // Now should be able to execute
        (canExecute, reason) = executor.canExecuteTopUp(address(safe), configId);
        assertTrue(canExecute);
        assertEq(reason, "");
    }

    function testFuzz_ConfigurationLimits(uint256 dailyLimit, uint256 monthlyLimit) public {
        // Bound to reasonable values
        dailyLimit = bound(dailyLimit, 1, type(uint128).max);
        monthlyLimit = bound(monthlyLimit, 1, type(uint128).max);

        vm.prank(address(safe));
        executor.onInstall("");

        IAutoTopUpExecutor.TopUpConfig memory config =
            IAutoTopUpExecutor.TopUpConfig({dailyLimit: dailyLimit, monthlyLimit: monthlyLimit, enabled: true});

        // Should succeed with valid limits
        vm.prank(address(safe));
        bytes32 configId = executor.configureTopUp(agent1, address(token), config);

        // Verify config was stored correctly
        (IAutoTopUpExecutor.TopUpConfig memory retrieved,) = executor.getTopUpById(configId);
        assertEq(retrieved.dailyLimit, dailyLimit);
        assertEq(retrieved.monthlyLimit, monthlyLimit);
    }
}
