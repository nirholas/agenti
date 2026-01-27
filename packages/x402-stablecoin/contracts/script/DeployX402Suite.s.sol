// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ToolRegistry.sol";
import "../src/X402PaymentChannel.sol";
import "../src/X402Subscription.sol";
import "../src/X402CreditSystem.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployX402Suite
 * @notice Deployment script for all X402 contracts
 * @dev Run with: forge script script/DeployX402Suite.s.sol --rpc-url $ARBITRUM_RPC_URL --broadcast
 */
contract DeployX402Suite is Script {
    // USDs address on Arbitrum
    address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;

    // Platform configuration
    address public platformWallet;
    uint256 public platformFeeBps = 2000; // 20%

    // Deployed contracts
    ToolRegistry public toolRegistry;
    X402PaymentChannel public paymentChannel;
    X402Subscription public subscription;
    X402CreditSystem public creditSystem;

    function run() external {
        // Load configuration from environment
        platformWallet = vm.envAddress("PLATFORM_WALLET");
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ToolRegistry
        console.log("Deploying ToolRegistry...");
        ToolRegistry toolRegistryImpl = new ToolRegistry();
        bytes memory toolRegistryData = abi.encodeWithSelector(
            ToolRegistry.initialize.selector,
            platformWallet,
            platformFeeBps
        );
        ERC1967Proxy toolRegistryProxy = new ERC1967Proxy(
            address(toolRegistryImpl),
            toolRegistryData
        );
        toolRegistry = ToolRegistry(address(toolRegistryProxy));
        console.log("ToolRegistry deployed at:", address(toolRegistry));

        // 2. Deploy PaymentChannel
        console.log("Deploying X402PaymentChannel...");
        X402PaymentChannel paymentChannelImpl = new X402PaymentChannel();
        bytes memory paymentChannelData = abi.encodeWithSelector(
            X402PaymentChannel.initialize.selector
        );
        ERC1967Proxy paymentChannelProxy = new ERC1967Proxy(
            address(paymentChannelImpl),
            paymentChannelData
        );
        paymentChannel = X402PaymentChannel(address(paymentChannelProxy));
        console.log("X402PaymentChannel deployed at:", address(paymentChannel));

        // 3. Deploy Subscription
        console.log("Deploying X402Subscription...");
        X402Subscription subscriptionImpl = new X402Subscription();
        bytes memory subscriptionData = abi.encodeWithSelector(
            X402Subscription.initialize.selector
        );
        ERC1967Proxy subscriptionProxy = new ERC1967Proxy(
            address(subscriptionImpl),
            subscriptionData
        );
        subscription = X402Subscription(address(subscriptionProxy));
        console.log("X402Subscription deployed at:", address(subscription));

        // 4. Deploy CreditSystem
        console.log("Deploying X402CreditSystem...");
        X402CreditSystem creditSystemImpl = new X402CreditSystem();
        bytes memory creditSystemData = abi.encodeWithSelector(
            X402CreditSystem.initialize.selector,
            address(toolRegistry),
            platformWallet,
            500 // 5% platform fee for credits
        );
        ERC1967Proxy creditSystemProxy = new ERC1967Proxy(
            address(creditSystemImpl),
            creditSystemData
        );
        creditSystem = X402CreditSystem(address(creditSystemProxy));
        console.log("X402CreditSystem deployed at:", address(creditSystem));

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Arbitrum");
        console.log("Platform Wallet:", platformWallet);
        console.log("Platform Fee:", platformFeeBps, "bps");
        console.log("\nContract Addresses:");
        console.log("- ToolRegistry:", address(toolRegistry));
        console.log("- X402PaymentChannel:", address(paymentChannel));
        console.log("- X402Subscription:", address(subscription));
        console.log("- X402CreditSystem:", address(creditSystem));
        console.log("\nUSDs Address:", USDS);
    }
}

/**
 * @title UpgradeX402Suite
 * @notice Upgrade script for X402 contracts
 */
contract UpgradeX402Suite is Script {
    function upgradeToolRegistry(
        address proxyAddress,
        address newImplementation
    ) external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        ToolRegistry proxy = ToolRegistry(proxyAddress);
        proxy.upgradeToAndCall(newImplementation, "");

        vm.stopBroadcast();

        console.log("ToolRegistry upgraded to:", newImplementation);
    }

    function upgradePaymentChannel(
        address proxyAddress,
        address newImplementation
    ) external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        X402PaymentChannel proxy = X402PaymentChannel(proxyAddress);
        proxy.upgradeToAndCall(newImplementation, "");

        vm.stopBroadcast();

        console.log("X402PaymentChannel upgraded to:", newImplementation);
    }

    function upgradeSubscription(
        address proxyAddress,
        address newImplementation
    ) external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        X402Subscription proxy = X402Subscription(proxyAddress);
        proxy.upgradeToAndCall(newImplementation, "");

        vm.stopBroadcast();

        console.log("X402Subscription upgraded to:", newImplementation);
    }

    function upgradeCreditSystem(
        address proxyAddress,
        address newImplementation
    ) external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        X402CreditSystem proxy = X402CreditSystem(proxyAddress);
        proxy.upgradeToAndCall(newImplementation, "");

        vm.stopBroadcast();

        console.log("X402CreditSystem upgraded to:", newImplementation);
    }
}

/**
 * @title RegisterTools
 * @notice Script to register initial tools in the registry
 */
contract RegisterToolsScript is Script {
    function run() external {
        address toolRegistryAddress = vm.envAddress("TOOL_REGISTRY");
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        ToolRegistry registry = ToolRegistry(toolRegistryAddress);
        address usds = registry.USDS();

        vm.startBroadcast(deployerPrivateKey);

        // Register example tools
        registry.registerTool(
            "weather-api",
            vm.envAddress("DEVELOPER_WALLET"),
            0.01e18, // 0.01 USDs per call
            usds
        );

        registry.registerTool(
            "image-generation",
            vm.envAddress("DEVELOPER_WALLET"),
            0.05e18, // 0.05 USDs per call
            usds
        );

        registry.registerTool(
            "code-analysis",
            vm.envAddress("DEVELOPER_WALLET"),
            0.02e18, // 0.02 USDs per call
            usds
        );

        registry.registerTool(
            "text-to-speech",
            vm.envAddress("DEVELOPER_WALLET"),
            0.03e18, // 0.03 USDs per call
            usds
        );

        registry.registerTool(
            "document-ocr",
            vm.envAddress("DEVELOPER_WALLET"),
            0.04e18, // 0.04 USDs per call
            usds
        );

        vm.stopBroadcast();

        console.log("Tools registered successfully!");
        console.log("Registry address:", toolRegistryAddress);
    }
}
