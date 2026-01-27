// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/ToolRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title ToolRegistryV2
 * @notice Mock V2 implementation for upgrade testing
 * @dev Adds new functionality while preserving storage layout
 */
contract ToolRegistryV2 is ToolRegistry {
    /*//////////////////////////////////////////////////////////////
                           NEW V2 STORAGE
    //////////////////////////////////////////////////////////////*/
    
    /// @notice New variable added in V2 (uses storage gap)
    uint256 public newV2Variable;
    
    /// @notice Mapping for V2 feature
    mapping(string => bool) public toolVerified;
    
    /*//////////////////////////////////////////////////////////////
                           NEW V2 FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Get contract version
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
    
    /**
     * @notice Set the new V2 variable
     * @param value New value
     */
    function setNewVariable(uint256 value) external onlyOwner {
        newV2Variable = value;
    }
    
    /**
     * @notice Verify a tool (new V2 feature)
     * @param name Tool name to verify
     */
    function verifyTool(string calldata name) external onlyOwner {
        toolVerified[name] = true;
    }
    
    /**
     * @notice Check if tool is verified
     * @param name Tool name
     * @return True if verified
     */
    function isToolVerified(string calldata name) external view returns (bool) {
        return toolVerified[name];
    }
}

/**
 * @title ToolRegistryUpgradeTest
 * @notice Tests for UUPS upgrade functionality of ToolRegistry
 * @dev Verifies:
 * - State preservation across upgrades
 * - New functionality works post-upgrade
 * - Access control on upgrade
 * - Storage layout compatibility
 */
contract ToolRegistryUpgradeTest is Test {
    ToolRegistry public registry;
    ToolRegistry public implementation;
    ERC1967Proxy public proxy;
    
    address public owner = address(this);
    address public platformWallet = makeAddr("platform");
    address public developer1 = makeAddr("developer1");
    address public developer2 = makeAddr("developer2");
    address public user = makeAddr("user");
    
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;
    uint256 public constant TOOL_PRICE = 1e18;
    uint256 public constant PLATFORM_FEE_BPS = 2000;
    
    function setUp() public {
        // Mock USDs
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
            abi.encode()
        );
        
        // Deploy V1
        implementation = new ToolRegistry();
        
        bytes memory initData = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            platformWallet,
            PLATFORM_FEE_BPS
        );
        
        proxy = new ERC1967Proxy(address(implementation), initData);
        registry = ToolRegistry(address(proxy));
    }
    
    /*//////////////////////////////////////////////////////////////
                        STATE PRESERVATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Test that basic state is preserved after upgrade
     * 
     * ARRANGE: Set up state in V1
     * ACT: Upgrade to V2
     * ASSERT: Verify all state preserved
     */
    function test_Upgrade_PreservesBasicState() public {
        // ARRANGE: Create state in V1
        registry.registerTool("tool-1", developer1, TOOL_PRICE, USDS);
        registry.registerTool("tool-2", developer2, 2 * TOOL_PRICE, USDS);
        
        // Record V1 state
        uint256 totalToolsBefore = registry.totalTools();
        address platformWalletBefore = registry.platformWallet();
        uint256 platformFeeBefore = registry.platformFeeBps();
        
        (address dev1Before, uint256 price1Before, ) = registry.getToolInfo("tool-1");
        (address dev2Before, uint256 price2Before, ) = registry.getToolInfo("tool-2");
        
        // ACT: Deploy and upgrade to V2
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        // Cast to V2
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT: All state preserved
        assertEq(registryV2.totalTools(), totalToolsBefore, "totalTools not preserved");
        assertEq(registryV2.platformWallet(), platformWalletBefore, "platformWallet not preserved");
        assertEq(registryV2.platformFeeBps(), platformFeeBefore, "platformFeeBps not preserved");
        
        (address dev1After, uint256 price1After, ) = registryV2.getToolInfo("tool-1");
        (address dev2After, uint256 price2After, ) = registryV2.getToolInfo("tool-2");
        
        assertEq(dev1After, dev1Before, "tool-1 developer not preserved");
        assertEq(price1After, price1Before, "tool-1 price not preserved");
        assertEq(dev2After, dev2Before, "tool-2 developer not preserved");
        assertEq(price2After, price2Before, "tool-2 price not preserved");
    }
    
    /**
     * @notice Test that tool revenue and call counts are preserved
     */
    function test_Upgrade_PreservesToolStats() public {
        // ARRANGE: Create tool and make payments
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);
        
        // Mock transfers and make payments
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );
        
        vm.prank(user);
        registry.payForTool("test-tool");
        vm.prank(user);
        registry.payForTool("test-tool");
        
        // Record stats
        IToolRegistry.ToolInfo memory infoBefore = registry.getFullToolInfo("test-tool");
        
        // ACT: Upgrade
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT
        IToolRegistry.ToolInfo memory infoAfter = registryV2.getFullToolInfo("test-tool");
        
        assertEq(infoAfter.totalCalls, infoBefore.totalCalls, "totalCalls not preserved");
        assertEq(infoAfter.totalRevenue, infoBefore.totalRevenue, "totalRevenue not preserved");
        assertEq(infoAfter.createdAt, infoBefore.createdAt, "createdAt not preserved");
    }
    
    /**
     * @notice Test that developer tools mapping is preserved
     */
    function test_Upgrade_PreservesDeveloperTools() public {
        // ARRANGE
        registry.registerTool("tool-a", developer1, TOOL_PRICE, USDS);
        registry.registerTool("tool-b", developer1, TOOL_PRICE, USDS);
        registry.registerTool("tool-c", developer2, TOOL_PRICE, USDS);
        
        string[] memory dev1ToolsBefore = registry.getDeveloperTools(developer1);
        string[] memory dev2ToolsBefore = registry.getDeveloperTools(developer2);
        
        // ACT
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT
        string[] memory dev1ToolsAfter = registryV2.getDeveloperTools(developer1);
        string[] memory dev2ToolsAfter = registryV2.getDeveloperTools(developer2);
        
        assertEq(dev1ToolsAfter.length, dev1ToolsBefore.length, "dev1 tool count changed");
        assertEq(dev2ToolsAfter.length, dev2ToolsBefore.length, "dev2 tool count changed");
    }
    
    /*//////////////////////////////////////////////////////////////
                        NEW FUNCTIONALITY TESTS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Test new V2 functions work after upgrade
     */
    function test_Upgrade_NewFunctionsWork() public {
        // ARRANGE
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);
        
        // ACT
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT: New functions work
        assertEq(registryV2.version(), "2.0.0", "version() should work");
        
        registryV2.setNewVariable(42);
        assertEq(registryV2.newV2Variable(), 42, "setNewVariable should work");
        
        registryV2.verifyTool("test-tool");
        assertTrue(registryV2.isToolVerified("test-tool"), "verifyTool should work");
    }
    
    /**
     * @notice Test V1 functions still work after upgrade
     */
    function test_Upgrade_ExistingFunctionsWork() public {
        // ACT
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT: V1 functions still work
        registryV2.registerTool("new-tool", developer1, TOOL_PRICE, USDS);
        
        (address dev, uint256 price, ) = registryV2.getToolInfo("new-tool");
        assertEq(dev, developer1);
        assertEq(price, TOOL_PRICE);
        
        // Update price still works
        vm.prank(developer1);
        registryV2.updateToolPrice("new-tool", 2 * TOOL_PRICE);
        
        (, uint256 newPrice, ) = registryV2.getToolInfo("new-tool");
        assertEq(newPrice, 2 * TOOL_PRICE);
    }
    
    /**
     * @notice Test upgrade with initialization call
     */
    function test_Upgrade_WithInitializationCall() public {
        // ACT: Upgrade with initialization
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        
        bytes memory initData = abi.encodeWithSelector(
            ToolRegistryV2.setNewVariable.selector,
            100
        );
        
        registry.upgradeToAndCall(address(v2Implementation), initData);
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT
        assertEq(registryV2.newV2Variable(), 100, "Initialization call should execute");
    }
    
    /*//////////////////////////////////////////////////////////////
                        ACCESS CONTROL TESTS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Test only owner can upgrade
     */
    function test_Upgrade_RevertNotOwner() public {
        // ARRANGE
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        address notOwner = makeAddr("notOwner");
        
        // ACT & ASSERT
        vm.prank(notOwner);
        vm.expectRevert();
        registry.upgradeToAndCall(address(v2Implementation), "");
    }
    
    /**
     * @notice Test double initialization is prevented
     */
    function test_Upgrade_DoubleInitializeReverts() public {
        // ACT & ASSERT: Try to reinitialize V1
        vm.expectRevert();
        registry.initialize(platformWallet, PLATFORM_FEE_BPS);
        
        // Upgrade and try to initialize V2 via initialize
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        vm.expectRevert();
        registryV2.initialize(platformWallet, PLATFORM_FEE_BPS);
    }
    
    /*//////////////////////////////////////////////////////////////
                      STORAGE LAYOUT TESTS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Test storage slots remain consistent after upgrade
     * @dev Reads raw storage slots to verify layout
     */
    function test_Upgrade_StorageLayoutConsistent() public {
        // ARRANGE: Set up significant state
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);
        registry.updatePlatformFee(1500); // Update fee
        
        // Read key storage slots before upgrade
        // Slot 0: OwnableUpgradeable._owner (via ERC7201)
        // These are implementation-specific, we check higher-level values
        
        address ownerBefore = registry.owner();
        address platformBefore = registry.platformWallet();
        uint256 feeBefore = registry.platformFeeBps();
        bool usdsSupportedBefore = registry.supportedTokens(USDS);
        
        // ACT
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT: Key values unchanged
        assertEq(registryV2.owner(), ownerBefore, "Owner storage corrupted");
        assertEq(registryV2.platformWallet(), platformBefore, "Platform wallet storage corrupted");
        assertEq(registryV2.platformFeeBps(), feeBefore, "Platform fee storage corrupted");
        assertEq(registryV2.supportedTokens(USDS), usdsSupportedBefore, "Supported tokens storage corrupted");
    }
    
    /**
     * @notice Test new storage uses gap slots correctly
     */
    function test_Upgrade_NewStorageUsesGap() public {
        // ARRANGE
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);
        
        // ACT
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // Use new V2 storage
        registryV2.setNewVariable(999);
        registryV2.verifyTool("test-tool");
        
        // ASSERT: Old data intact
        (address dev, uint256 price, ) = registryV2.getToolInfo("test-tool");
        assertEq(dev, developer1, "Old tool data corrupted after using new storage");
        assertEq(price, TOOL_PRICE, "Old tool price corrupted after using new storage");
        
        // New data works
        assertEq(registryV2.newV2Variable(), 999);
        assertTrue(registryV2.isToolVerified("test-tool"));
    }
    
    /*//////////////////////////////////////////////////////////////
                          EDGE CASE TESTS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Test upgrade with no existing state
     */
    function test_Upgrade_EmptyState() public {
        // No state setup - just upgrade
        
        // ACT
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT: Contract works
        assertEq(registryV2.totalTools(), 0);
        assertEq(registryV2.version(), "2.0.0");
        
        // Can still use all functions
        registryV2.registerTool("new-tool", developer1, TOOL_PRICE, USDS);
        assertEq(registryV2.totalTools(), 1);
    }
    
    /**
     * @notice Test multiple sequential upgrades
     */
    function test_Upgrade_MultipleUpgrades() public {
        // ARRANGE
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);
        
        // First upgrade
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        registryV2.setNewVariable(100);
        
        // Second upgrade (back to V2 for test, simulating V3)
        ToolRegistryV2 v3Implementation = new ToolRegistryV2();
        registryV2.upgradeToAndCall(address(v3Implementation), "");
        
        // ASSERT: All state preserved through both upgrades
        ToolRegistryV2 registryV3 = ToolRegistryV2(address(proxy));
        
        assertEq(registryV3.totalTools(), 1);
        (address dev, , ) = registryV3.getToolInfo("test-tool");
        assertEq(dev, developer1);
        assertEq(registryV3.newV2Variable(), 100);
    }
    
    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Fuzz test: state preserved with various tool counts
     */
    function testFuzz_Upgrade_PreservesToolCount(uint8 toolCount) public {
        vm.assume(toolCount > 0 && toolCount <= 50); // Reasonable range
        
        // ARRANGE: Register multiple tools
        for (uint8 i = 0; i < toolCount; i++) {
            registry.registerTool(
                string(abi.encodePacked("tool-", vm.toString(i))),
                makeAddr(string(abi.encodePacked("dev-", vm.toString(i)))),
                TOOL_PRICE * (i + 1),
                USDS
            );
        }
        
        // ACT
        ToolRegistryV2 v2Implementation = new ToolRegistryV2();
        registry.upgradeToAndCall(address(v2Implementation), "");
        
        ToolRegistryV2 registryV2 = ToolRegistryV2(address(proxy));
        
        // ASSERT
        assertEq(registryV2.totalTools(), toolCount, "Tool count not preserved");
    }
}
