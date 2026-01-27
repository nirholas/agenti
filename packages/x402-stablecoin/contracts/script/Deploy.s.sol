// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {X402RevenueSplitter} from "../src/X402RevenueSplitter.sol";

/**
 * @title Deploy X402 Revenue Splitter
 * @notice Deploys the revenue splitter contract to Arbitrum
 * 
 * Usage:
 *   forge script script/Deploy.s.sol:DeployScript --rpc-url $ARBITRUM_RPC_URL --broadcast
 */
contract DeployScript is Script {
    // Arbitrum Mainnet USDs
    address constant USDS_MAINNET = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;
    
    // Arbitrum Sepolia USDs (update with testnet address)
    address constant USDS_SEPOLIA = address(0);
    
    function run() external {
        // Get deployment parameters from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address platformWallet = vm.envAddress("PLATFORM_WALLET_ADDRESS");
        uint256 platformFeeBps = vm.envOr("DEFAULT_PLATFORM_FEE_BPS", uint256(2000)); // 20% default
        
        // Determine network and USDs address
        uint256 chainId = block.chainid;
        address usdsAddress;
        
        if (chainId == 42161) {
            // Arbitrum Mainnet
            usdsAddress = USDS_MAINNET;
            console.log("Deploying to Arbitrum Mainnet");
        } else if (chainId == 421614) {
            // Arbitrum Sepolia
            usdsAddress = USDS_SEPOLIA;
            console.log("Deploying to Arbitrum Sepolia");
            require(usdsAddress != address(0), "Sepolia USDs address not set");
        } else {
            revert("Unsupported chain");
        }
        
        console.log("Platform wallet:", platformWallet);
        console.log("Platform fee (bps):", platformFeeBps);
        console.log("USDs address:", usdsAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the revenue splitter
        X402RevenueSplitter splitter = new X402RevenueSplitter(
            usdsAddress,
            platformWallet,
            platformFeeBps
        );
        
        console.log("X402RevenueSplitter deployed to:", address(splitter));
        
        vm.stopBroadcast();
        
        // Log verification command
        console.log("\nVerify with:");
        console.log(
            string.concat(
                "forge verify-contract ",
                vm.toString(address(splitter)),
                " X402RevenueSplitter --chain-id ",
                vm.toString(chainId),
                " --constructor-args $(cast abi-encode 'constructor(address,address,uint256)' ",
                vm.toString(usdsAddress),
                " ",
                vm.toString(platformWallet),
                " ",
                vm.toString(platformFeeBps),
                ")"
            )
        );
    }
}

/**
 * @title Deploy All Contracts
 * @notice Deploys all X402 contracts to Arbitrum
 */
contract DeployAllScript is Script {
    function run() external {
        // This will be expanded as more contracts are added
        DeployScript deployRevenueSplitter = new DeployScript();
        deployRevenueSplitter.run();
    }
}
