// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AutoTopUpExecutor} from "../../src/AutoTopUpExecutor.sol";

// Malicious token that tries to re-enter during transfer
contract MaliciousToken is ERC20 {
    AutoTopUpExecutor public target;
    bytes32 public targetConfigId;

    constructor() ERC20("Malicious", "MAL") {}

    function setTarget(AutoTopUpExecutor _target, bytes32 _configId) external {
        target = _target;
        targetConfigId = _configId;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        // Try to re-enter during transfer
        if (address(target) != address(0)) {
            try target.triggerTopUp(address(this), targetConfigId) {} catch {}
        }
        return super.transfer(to, amount);
    }
}
