// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {SafeSingletonDeployer} from "safe-singleton-deployer/SafeSingletonDeployer.sol";
import {AutoTopUpExecutor} from "../src/AutoTopUpExecutor.sol";
import {AutoCollectExecutor} from "../src/AutoCollectExecutor.sol";

contract Deploy is Script {
    // Use meaningful salts for deterministic addresses across chains
    bytes32 constant AUTO_TOPUP_SALT = keccak256("AutoTopUpExecutor.v1");
    bytes32 constant AUTO_COLLECT_SALT = keccak256("AutoCollectExecutor.v1");

    function run() external returns (address autoTopUp, address autoCollect) {
        // Get deployer from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=== Deploying Account Modules ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy AutoTopUpExecutor using Safe Singleton Factory
        console.log("Deploying AutoTopUpExecutor...");
        autoTopUp = _deploySingleton(
            type(AutoTopUpExecutor).creationCode,
            "", // No constructor args
            AUTO_TOPUP_SALT,
            "AutoTopUpExecutor"
        );

        // Deploy AutoCollectExecutor using Safe Singleton Factory
        console.log("Deploying AutoCollectExecutor...");
        autoCollect = _deploySingleton(
            type(AutoCollectExecutor).creationCode,
            "", // No constructor args
            AUTO_COLLECT_SALT,
            "AutoCollectExecutor"
        );

        vm.stopBroadcast();

        // Log deployment summary
        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("AutoTopUpExecutor:", autoTopUp);
        console.log("AutoCollectExecutor:", autoCollect);
        console.log("");
        console.log("These addresses will be consistent across all chains!");
        console.log("=========================");
    }

    function _deploySingleton(
        bytes memory creationCode,
        bytes memory constructorArgs,
        bytes32 salt,
        string memory contractName
    ) internal returns (address deployed) {
        // Use SafeSingletonDeployer.deploy (not broadcastDeploy) since we're already broadcasting
        deployed = SafeSingletonDeployer.deploy(creationCode, constructorArgs, salt);

        console.log(string.concat(contractName, " deployed at:"), deployed);

        // Verify deployment
        require(deployed.code.length > 0, string.concat(contractName, " deployment failed"));
    }

    // Helper function to predict addresses without deploying
    function predict() external view {
        console.log("=== Predicted Addresses ===");

        // Predict AutoTopUpExecutor address
        address predictedAutoTopUp =
            SafeSingletonDeployer.computeAddress(type(AutoTopUpExecutor).creationCode, AUTO_TOPUP_SALT);
        console.log("AutoTopUpExecutor:", predictedAutoTopUp);

        // Predict AutoCollectExecutor address
        address predictedAutoCollect =
            SafeSingletonDeployer.computeAddress(type(AutoCollectExecutor).creationCode, AUTO_COLLECT_SALT);
        console.log("AutoCollectExecutor:", predictedAutoCollect);

        console.log("===========================");
    }
}
