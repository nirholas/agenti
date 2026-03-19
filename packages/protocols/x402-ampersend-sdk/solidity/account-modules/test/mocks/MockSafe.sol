// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ModeCode} from "modulekit/src/accounts/common/lib/ModeLib.sol";
import {ExecutionLib} from "modulekit/src/accounts/erc7579/lib/ExecutionLib.sol";

// Mock Safe contract for testing ERC-7579 module execution
contract MockSafe {
    mapping(address => bool) public isModuleEnabled;

    // Storage for execution results
    bool public lastExecutionSuccess;
    bytes public lastExecutionResult;

    // Mock owner for testing
    address public owner;

    constructor(address _owner) {
        owner = _owner;
    }

    function enableModule(address module) external {
        require(msg.sender == owner, "Only owner");
        isModuleEnabled[module] = true;
    }

    // ERC-7579 compatible execution function
    // This is called by the module's _execute function via ERC7579ExecutorBase
    function executeFromExecutor(
        ModeCode, // mode - we ignore this in the mock
        bytes calldata executionCalldata
    )
        external
        payable
        returns (bytes[] memory returnData)
    {
        require(isModuleEnabled[msg.sender], "Module not enabled");

        // Decode the execution calldata
        // For single execution mode, it's encoded as (target, value, callData)
        (address target, uint256 value, bytes memory data) = ExecutionLib.decodeSingle(executionCalldata);

        // Execute the call
        bool success;
        bytes memory result;
        (success, result) = target.call{value: value}(data);
        lastExecutionSuccess = success;
        lastExecutionResult = result;

        if (!success) {
            // Bubble up the revert reason
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        // Return as array (ERC-7579 expects array of results)
        returnData = new bytes[](1);
        returnData[0] = result;

        return returnData;
    }
}
