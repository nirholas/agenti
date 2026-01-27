// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/marketplace/ToolRegistry.sol";
import "../../contracts/marketplace/RevenueRouter.sol";
import "../../contracts/marketplace/ToolStaking.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title ToolRegistryTest
 * @author nirholas
 * @notice Comprehensive tests for the ToolRegistry contract
 * 
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nichxbt
 *  ID: 0x4E494348
 * ═══════════════════════════════════════════════════════════════
 */

// Mock USDs Token
contract MockUSDs is ERC20 {
    constructor() ERC20("Mock USDs", "USDs") {
        _mint(msg.sender, 1_000_000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ToolRegistryTest is Test {
    ToolRegistry public registry;
    ToolRegistry public registryImpl;
    RevenueRouter public router;
    RevenueRouter public routerImpl;
    ToolStaking public staking;
    ToolStaking public stakingImpl;
    MockUSDs public usds;
    
    address public admin = address(1);
    address public creator = address(2);
    address public user = address(3);
    address public treasury = address(4);
    
    uint256 public constant MINIMUM_STAKE = 10 * 10**18; // 10 USDs
    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%
    uint256 public constant MINIMUM_PAYOUT = 1 * 10**18; // 1 USDs
    
    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy mock USDs
        usds = new MockUSDs();
        
        // Deploy implementations
        stakingImpl = new ToolStaking();
        registryImpl = new ToolRegistry();
        routerImpl = new RevenueRouter();
        
        // Deploy proxies
        bytes memory stakingInit = abi.encodeWithSelector(
            ToolStaking.initialize.selector,
            admin,
            address(usds),
            MINIMUM_STAKE,
            treasury,
            7 days,
            100 * 10**18 // quorum
        );
        ERC1967Proxy stakingProxy = new ERC1967Proxy(address(stakingImpl), stakingInit);
        staking = ToolStaking(address(stakingProxy));
        
        bytes memory registryInit = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            admin,
            address(staking),
            MINIMUM_STAKE
        );
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryInit);
        registry = ToolRegistry(address(registryProxy));
        
        bytes memory routerInit = abi.encodeWithSelector(
            RevenueRouter.initialize.selector,
            admin,
            address(usds),
            address(registry),
            treasury,
            PLATFORM_FEE_BPS,
            MINIMUM_PAYOUT
        );
        ERC1967Proxy routerProxy = new ERC1967Proxy(address(routerImpl), routerInit);
        router = RevenueRouter(address(routerProxy));
        
        // Grant roles
        registry.grantRole(registry.REVENUE_ROUTER_ROLE(), address(router));
        
        // Fund accounts
        usds.mint(creator, 1000 * 10**18);
        usds.mint(user, 1000 * 10**18);
        
        vm.stopPrank();
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  Registration Tests
    // ═══════════════════════════════════════════════════════════════
    
    function test_RegisterTool() public {
        // Stake first
        _stakeAsCreator();
        
        vm.startPrank(creator);
        
        address[] memory recipients = new address[](1);
        recipients[0] = creator;
        
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000; // 100%
        
        bytes32 toolId = registry.registerTool(
            "test-tool",
            "https://api.example.com/tool",
            "ipfs://QmTest",
            0.01 * 10**18, // 0.01 USDs per call
            recipients,
            shares
        );
        
        vm.stopPrank();
        
        // Verify registration
        IToolRegistry.Tool memory tool = registry.getTool(toolId);
        assertEq(tool.owner, creator);
        assertEq(tool.name, "test-tool");
        assertEq(tool.endpoint, "https://api.example.com/tool");
        assertEq(tool.metadataURI, "ipfs://QmTest");
        assertEq(tool.pricePerCall, 0.01 * 10**18);
        assertTrue(tool.active);
        assertFalse(tool.verified);
        assertEq(tool.totalCalls, 0);
        assertEq(tool.totalRevenue, 0);
    }
    
    function test_RegisterTool_WithMultipleSplits() public {
        _stakeAsCreator();
        
        vm.startPrank(creator);
        
        address[] memory recipients = new address[](3);
        recipients[0] = creator;
        recipients[1] = address(5);
        recipients[2] = address(6);
        
        uint256[] memory shares = new uint256[](3);
        shares[0] = 7000; // 70%
        shares[1] = 2000; // 20%
        shares[2] = 1000; // 10%
        
        bytes32 toolId = registry.registerTool(
            "multi-split-tool",
            "https://api.example.com",
            "",
            0.1 * 10**18,
            recipients,
            shares
        );
        
        vm.stopPrank();
        
        // Verify splits
        (address[] memory r, uint256[] memory s) = registry.getRevenueSplit(toolId);
        assertEq(r.length, 3);
        assertEq(r[0], creator);
        assertEq(s[0], 7000);
        assertEq(s[1], 2000);
        assertEq(s[2], 1000);
    }
    
    function test_RevertWhen_InvalidSplits() public {
        _stakeAsCreator();
        
        vm.startPrank(creator);
        
        address[] memory recipients = new address[](2);
        recipients[0] = creator;
        recipients[1] = address(5);
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 5000;
        shares[1] = 4000; // Only 90%, should fail
        
        vm.expectRevert(ToolRegistry.InvalidRevenueSplit.selector);
        registry.registerTool(
            "bad-split-tool",
            "https://api.example.com",
            "",
            0.1 * 10**18,
            recipients,
            shares
        );
        
        vm.stopPrank();
    }
    
    function test_RevertWhen_InsufficientStake() public {
        // Don't stake
        
        vm.startPrank(creator);
        
        address[] memory recipients = new address[](1);
        recipients[0] = creator;
        
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;
        
        vm.expectRevert(abi.encodeWithSelector(
            ToolRegistry.InsufficientStake.selector,
            MINIMUM_STAKE,
            0
        ));
        registry.registerTool(
            "no-stake-tool",
            "https://api.example.com",
            "",
            0.1 * 10**18,
            recipients,
            shares
        );
        
        vm.stopPrank();
    }
    
    function test_RevertWhen_DuplicateTool() public {
        _stakeAsCreator();
        _registerTestTool();
        
        vm.startPrank(creator);
        
        address[] memory recipients = new address[](1);
        recipients[0] = creator;
        
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;
        
        bytes32 expectedId = registry.getToolId("test-tool", creator);
        vm.expectRevert(abi.encodeWithSelector(
            ToolRegistry.ToolAlreadyExists.selector,
            expectedId
        ));
        registry.registerTool(
            "test-tool", // Same name
            "https://different.com",
            "",
            0.1 * 10**18,
            recipients,
            shares
        );
        
        vm.stopPrank();
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  Update Tests
    // ═══════════════════════════════════════════════════════════════
    
    function test_UpdateTool() public {
        _stakeAsCreator();
        bytes32 toolId = _registerTestTool();
        
        vm.prank(creator);
        registry.updateTool(toolId, "ipfs://QmNewMetadata", 0.02 * 10**18);
        
        IToolRegistry.Tool memory tool = registry.getTool(toolId);
        assertEq(tool.metadataURI, "ipfs://QmNewMetadata");
        assertEq(tool.pricePerCall, 0.02 * 10**18);
    }
    
    function test_UpdateEndpoint() public {
        _stakeAsCreator();
        bytes32 toolId = _registerTestTool();
        
        vm.prank(creator);
        registry.updateEndpoint(toolId, "https://new-endpoint.com/api");
        
        IToolRegistry.Tool memory tool = registry.getTool(toolId);
        assertEq(tool.endpoint, "https://new-endpoint.com/api");
    }
    
    function test_RevertWhen_NotOwner() public {
        _stakeAsCreator();
        bytes32 toolId = _registerTestTool();
        
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(
            ToolRegistry.NotToolOwner.selector,
            toolId,
            user
        ));
        registry.updateTool(toolId, "ipfs://unauthorized", 0);
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  Pause/Activate Tests
    // ═══════════════════════════════════════════════════════════════
    
    function test_PauseTool() public {
        _stakeAsCreator();
        bytes32 toolId = _registerTestTool();
        
        vm.prank(creator);
        registry.pauseTool(toolId);
        
        IToolRegistry.Tool memory tool = registry.getTool(toolId);
        assertFalse(tool.active);
    }
    
    function test_ActivateTool() public {
        _stakeAsCreator();
        bytes32 toolId = _registerTestTool();
        
        vm.prank(creator);
        registry.pauseTool(toolId);
        
        vm.prank(creator);
        registry.activateTool(toolId);
        
        IToolRegistry.Tool memory tool = registry.getTool(toolId);
        assertTrue(tool.active);
    }
    
    function test_RevertWhen_PauseInactiveTool() public {
        _stakeAsCreator();
        bytes32 toolId = _registerTestTool();
        
        vm.prank(creator);
        registry.pauseTool(toolId);
        
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(
            ToolRegistry.ToolNotActive.selector,
            toolId
        ));
        registry.pauseTool(toolId);
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  Ownership Transfer Tests
    // ═══════════════════════════════════════════════════════════════
    
    function test_TransferOwnership() public {
        _stakeAsCreator();
        bytes32 toolId = _registerTestTool();
        
        vm.prank(creator);
        registry.transferOwnership(toolId, user);
        
        IToolRegistry.Tool memory tool = registry.getTool(toolId);
        assertEq(tool.owner, user);
        
        // Verify owner arrays updated
        bytes32[] memory creatorTools = registry.getToolsByOwner(creator);
        assertEq(creatorTools.length, 0);
        
        bytes32[] memory userTools = registry.getToolsByOwner(user);
        assertEq(userTools.length, 1);
        assertEq(userTools[0], toolId);
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  Admin Tests
    // ═══════════════════════════════════════════════════════════════
    
    function test_VerifyTool() public {
        _stakeAsCreator();
        bytes32 toolId = _registerTestTool();
        
        vm.prank(admin);
        registry.verifyTool(toolId);
        
        IToolRegistry.Tool memory tool = registry.getTool(toolId);
        assertTrue(tool.verified);
    }
    
    function test_UnverifyTool() public {
        _stakeAsCreator();
        bytes32 toolId = _registerTestTool();
        
        vm.prank(admin);
        registry.verifyTool(toolId);
        
        vm.prank(admin);
        registry.unverifyTool(toolId);
        
        IToolRegistry.Tool memory tool = registry.getTool(toolId);
        assertFalse(tool.verified);
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  View Function Tests
    // ═══════════════════════════════════════════════════════════════
    
    function test_GetToolId() public view {
        bytes32 toolId = registry.getToolId("test-tool", creator);
        bytes32 expected = keccak256(abi.encodePacked("test-tool", creator));
        assertEq(toolId, expected);
    }
    
    function test_TotalTools() public {
        _stakeAsCreator();
        
        assertEq(registry.totalTools(), 0);
        
        _registerTestTool();
        assertEq(registry.totalTools(), 1);
        
        vm.startPrank(creator);
        address[] memory recipients = new address[](1);
        recipients[0] = creator;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;
        registry.registerTool("tool-2", "https://api.com", "", 0.01 * 10**18, recipients, shares);
        vm.stopPrank();
        
        assertEq(registry.totalTools(), 2);
    }
    
    function test_GetAllTools_Paginated() public {
        _stakeAsCreator();
        
        // Register 5 tools
        vm.startPrank(creator);
        address[] memory recipients = new address[](1);
        recipients[0] = creator;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;
        
        for (uint256 i = 0; i < 5; i++) {
            registry.registerTool(
                string(abi.encodePacked("tool-", vm.toString(i))),
                "https://api.com",
                "",
                0.01 * 10**18,
                recipients,
                shares
            );
        }
        vm.stopPrank();
        
        // Test pagination
        bytes32[] memory page1 = registry.getAllTools(0, 3);
        assertEq(page1.length, 3);
        
        bytes32[] memory page2 = registry.getAllTools(3, 3);
        assertEq(page2.length, 2);
        
        bytes32[] memory page3 = registry.getAllTools(10, 3);
        assertEq(page3.length, 0);
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  Helper Functions
    // ═══════════════════════════════════════════════════════════════
    
    function _stakeAsCreator() internal {
        vm.startPrank(creator);
        usds.approve(address(staking), MINIMUM_STAKE);
        staking.stake(MINIMUM_STAKE);
        vm.stopPrank();
    }
    
    function _registerTestTool() internal returns (bytes32) {
        vm.startPrank(creator);
        
        address[] memory recipients = new address[](1);
        recipients[0] = creator;
        
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;
        
        bytes32 toolId = registry.registerTool(
            "test-tool",
            "https://api.example.com/tool",
            "ipfs://QmTest",
            0.01 * 10**18,
            recipients,
            shares
        );
        
        vm.stopPrank();
        
        return toolId;
    }
}

// EOF - nirholas | ucm:n1ch-test
