// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ToolRegistry.sol";
import "../src/interfaces/IUSDs.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title ToolRegistryTest
 * @notice Comprehensive tests for the ToolRegistry contract
 */
contract ToolRegistryTest is Test {
    ToolRegistry public registry;
    ToolRegistry public registryImpl;

    address public owner = address(this);
    address public platformWallet = makeAddr("platform");
    address public developer1 = makeAddr("developer1");
    address public developer2 = makeAddr("developer2");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    // USDs address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    // Platform fee: 20%
    uint256 public constant PLATFORM_FEE_BPS = 2000;

    // Tool prices
    uint256 public constant TOOL_PRICE = 1e18; // 1 USDs

    // Events
    event ToolRegistered(
        string indexed name,
        address indexed developer,
        address paymentToken,
        uint256 pricePerCall
    );
    event ToolPriceUpdated(string indexed name, uint256 oldPrice, uint256 newPrice);
    event ToolCalled(string indexed name, address indexed caller, uint256 amount);

    function setUp() public {
        // Fork Arbitrum mainnet for USDs integration
        // Uncomment for integration tests:
        // vm.createSelectFork(vm.envString("ARBITRUM_RPC_URL"));

        // Mock USDs for unit tests - must happen before proxy deployment
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(bytes4(keccak256("rebaseOptIn()"))),
            abi.encode()
        );

        // Deploy implementation
        registryImpl = new ToolRegistry();

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            platformWallet,
            PLATFORM_FEE_BPS
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(registryImpl), initData);
        registry = ToolRegistry(address(proxy));
    }

    /*//////////////////////////////////////////////////////////////
                          INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Initialize() public view {
        assertEq(registry.owner(), owner);
        assertEq(registry.platformWallet(), platformWallet);
        assertEq(registry.platformFeeBps(), PLATFORM_FEE_BPS);
        assertTrue(registry.supportedTokens(USDS));
    }

    function test_Initialize_RevertInvalidPlatformWallet() public {
        ToolRegistry impl = new ToolRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            address(0),
            PLATFORM_FEE_BPS
        );

        vm.expectRevert();
        new ERC1967Proxy(address(impl), initData);
    }

    function test_Initialize_RevertInvalidFee() public {
        ToolRegistry impl = new ToolRegistry();
        
        // Fee too low
        bytes memory initData = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            platformWallet,
            50 // 0.5% - below minimum
        );

        vm.expectRevert();
        new ERC1967Proxy(address(impl), initData);

        // Fee too high
        initData = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            platformWallet,
            6000 // 60% - above maximum
        );

        vm.expectRevert();
        new ERC1967Proxy(address(impl), initData);
    }

    /*//////////////////////////////////////////////////////////////
                        TOOL REGISTRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RegisterTool() public {
        vm.expectEmit(true, true, true, true);
        emit ToolRegistered("test-tool", developer1, USDS, TOOL_PRICE);

        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        (address dev, uint256 price, uint256 calls) = registry.getToolInfo("test-tool");
        assertEq(dev, developer1);
        assertEq(price, TOOL_PRICE);
        assertEq(calls, 0);
        assertEq(registry.totalTools(), 1);
    }

    function test_RegisterTool_RevertInvalidDeveloper() public {
        vm.expectRevert(IX402Common.InvalidAddress.selector);
        registry.registerTool("test-tool", address(0), TOOL_PRICE, USDS);
    }

    function test_RegisterTool_RevertInvalidPrice() public {
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        registry.registerTool("test-tool", developer1, 0, USDS);
    }

    function test_RegisterTool_RevertUnsupportedToken() public {
        address fakeToken = makeAddr("fakeToken");
        vm.expectRevert(IX402Common.NotAllowed.selector);
        registry.registerTool("test-tool", developer1, TOOL_PRICE, fakeToken);
    }

    function test_RegisterTool_RevertDuplicateName() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        vm.expectRevert(IX402Common.NotAllowed.selector);
        registry.registerTool("test-tool", developer2, TOOL_PRICE, USDS);
    }

    function test_RegisterMultipleTools() public {
        registry.registerTool("tool-1", developer1, TOOL_PRICE, USDS);
        registry.registerTool("tool-2", developer1, 2 * TOOL_PRICE, USDS);
        registry.registerTool("tool-3", developer2, 3 * TOOL_PRICE, USDS);

        assertEq(registry.totalTools(), 3);

        string[] memory dev1Tools = registry.getDeveloperTools(developer1);
        assertEq(dev1Tools.length, 2);

        string[] memory dev2Tools = registry.getDeveloperTools(developer2);
        assertEq(dev2Tools.length, 1);
    }

    /*//////////////////////////////////////////////////////////////
                         TOOL UPDATE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_UpdateToolPrice() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        uint256 newPrice = 2 * TOOL_PRICE;

        vm.prank(developer1);
        vm.expectEmit(true, true, true, true);
        emit ToolPriceUpdated("test-tool", TOOL_PRICE, newPrice);
        registry.updateToolPrice("test-tool", newPrice);

        (, uint256 price, ) = registry.getToolInfo("test-tool");
        assertEq(price, newPrice);
    }

    function test_UpdateToolPrice_RevertNotDeveloper() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        vm.prank(user1);
        vm.expectRevert(IX402Common.Unauthorized.selector);
        registry.updateToolPrice("test-tool", 2 * TOOL_PRICE);
    }

    function test_UpdateToolPrice_RevertInvalidPrice() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        vm.prank(developer1);
        vm.expectRevert(IX402Common.InvalidAmount.selector);
        registry.updateToolPrice("test-tool", 0);
    }

    function test_UpdateToolDeveloper() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        vm.prank(developer1);
        registry.updateToolDeveloper("test-tool", developer2);

        (address dev, , ) = registry.getToolInfo("test-tool");
        assertEq(dev, developer2);

        // New developer can update price
        vm.prank(developer2);
        registry.updateToolPrice("test-tool", 2 * TOOL_PRICE);

        // Old developer cannot
        vm.prank(developer1);
        vm.expectRevert(IX402Common.Unauthorized.selector);
        registry.updateToolPrice("test-tool", 3 * TOOL_PRICE);
    }

    function test_DeactivateTool() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        assertTrue(registry.isToolActive("test-tool"));

        vm.prank(developer1);
        registry.deactivateTool("test-tool");

        assertFalse(registry.isToolActive("test-tool"));
    }

    function test_ReactivateTool() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        vm.prank(developer1);
        registry.deactivateTool("test-tool");
        assertFalse(registry.isToolActive("test-tool"));

        vm.prank(developer1);
        registry.reactivateTool("test-tool");
        assertTrue(registry.isToolActive("test-tool"));
    }

    /*//////////////////////////////////////////////////////////////
                         PAYMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_PayForTool() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        // Mock token transfers
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector, user1, address(registry), TOOL_PRICE),
            abi.encode(true)
        );
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        vm.prank(user1);
        registry.payForTool("test-tool");

        (, , uint256 calls) = registry.getToolInfo("test-tool");
        assertEq(calls, 1);
    }

    function test_PayForTool_RevertInactiveTool() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        vm.prank(developer1);
        registry.deactivateTool("test-tool");

        vm.prank(user1);
        vm.expectRevert(IX402Common.NotAllowed.selector);
        registry.payForTool("test-tool");
    }

    function test_PayForToolWithAmount() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        uint256 customAmount = 5 * TOOL_PRICE;

        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transferFrom.selector, user1, address(registry), customAmount),
            abi.encode(true)
        );
        vm.mockCall(
            USDS,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(true)
        );

        vm.prank(user1);
        registry.payForToolWithAmount("test-tool", customAmount);

        IToolRegistry.ToolInfo memory info = registry.getFullToolInfo("test-tool");
        assertEq(info.totalRevenue, customAmount);
    }

    function test_BatchPayForTools() public {
        registry.registerTool("tool-1", developer1, TOOL_PRICE, USDS);
        registry.registerTool("tool-2", developer2, 2 * TOOL_PRICE, USDS);

        string[] memory names = new string[](2);
        names[0] = "tool-1";
        names[1] = "tool-2";

        // Mock all transfers
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

        vm.prank(user1);
        registry.batchPayForTools(names);

        (, , uint256 calls1) = registry.getToolInfo("tool-1");
        (, , uint256 calls2) = registry.getToolInfo("tool-2");
        assertEq(calls1, 1);
        assertEq(calls2, 1);
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AddSupportedToken() public {
        address newToken = makeAddr("newToken");

        registry.addSupportedToken(newToken);
        assertTrue(registry.supportedTokens(newToken));
    }

    function test_RemoveSupportedToken() public {
        address newToken = makeAddr("newToken");
        registry.addSupportedToken(newToken);

        registry.removeSupportedToken(newToken);
        assertFalse(registry.supportedTokens(newToken));
    }

    function test_UpdatePlatformWallet() public {
        address newWallet = makeAddr("newPlatform");

        registry.updatePlatformWallet(newWallet);
        assertEq(registry.platformWallet(), newWallet);
    }

    function test_UpdatePlatformFee() public {
        uint256 newFee = 1500; // 15%

        registry.updatePlatformFee(newFee);
        assertEq(registry.platformFeeBps(), newFee);
    }

    function test_ForceDeactivateTool() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        registry.forceDeactivateTool("test-tool");
        assertFalse(registry.isToolActive("test-tool"));
    }

    function test_Pause() public {
        registry.pause();
        assertTrue(registry.paused());

        vm.expectRevert();
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        registry.unpause();
        assertFalse(registry.paused());

        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);
    }

    function test_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        registry.updatePlatformWallet(user1);

        vm.prank(user1);
        vm.expectRevert();
        registry.updatePlatformFee(1000);

        vm.prank(user1);
        vm.expectRevert();
        registry.pause();
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetFullToolInfo() public {
        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        IToolRegistry.ToolInfo memory info = registry.getFullToolInfo("test-tool");

        assertEq(info.developer, developer1);
        assertEq(info.paymentToken, USDS);
        assertEq(info.pricePerCall, TOOL_PRICE);
        assertEq(info.totalCalls, 0);
        assertEq(info.totalRevenue, 0);
        assertTrue(info.active);
        assertGt(info.createdAt, 0);
    }

    function test_IsToolActive() public {
        assertFalse(registry.isToolActive("nonexistent"));

        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);
        assertTrue(registry.isToolActive("test-tool"));
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_RegisterTool(
        string calldata name,
        address developer,
        uint256 price
    ) public {
        vm.assume(developer != address(0));
        vm.assume(price > 0);
        vm.assume(bytes(name).length > 0);

        registry.registerTool(name, developer, price, USDS);

        (address dev, uint256 p, ) = registry.getToolInfo(name);
        assertEq(dev, developer);
        assertEq(p, price);
    }

    function testFuzz_UpdatePrice(uint256 newPrice) public {
        vm.assume(newPrice > 0);

        registry.registerTool("test-tool", developer1, TOOL_PRICE, USDS);

        vm.prank(developer1);
        registry.updateToolPrice("test-tool", newPrice);

        (, uint256 price, ) = registry.getToolInfo("test-tool");
        assertEq(price, newPrice);
    }
}
