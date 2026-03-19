// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {SlotDerivation} from "@openzeppelin/contracts/utils/SlotDerivation.sol";

contract CalculateStorageSlot is Script {
    using SlotDerivation for string;

    function run() public {
        // AutoTopUpExecutor storage slot
        string memory topUpNamespace = "autotopup.storage.AutoTopUpExecutor";
        bytes32 topUpSlot = topUpNamespace.erc7201Slot();
        console.log("AutoTopUpExecutor Namespace:", topUpNamespace);
        console.log("AutoTopUpExecutor Storage slot:");
        console.logBytes32(topUpSlot);

        console.log("");

        // AutoCollectExecutor storage slot
        string memory collectNamespace = "autocollect.storage.AutoCollectExecutor";
        bytes32 collectSlot = collectNamespace.erc7201Slot();
        console.log("AutoCollectExecutor Namespace:", collectNamespace);
        console.log("AutoCollectExecutor Storage slot:");
        console.logBytes32(collectSlot);
    }
}
