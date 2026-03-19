// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AutoCollectExecutor} from "../../src/AutoCollectExecutor.sol";

// Malicious token that tries to re-enter during transfer for collection tests
contract MaliciousCollectToken is ERC20 {
    AutoCollectExecutor public target;
    address public targetAccount;
    address public targetAsset;

    constructor() ERC20("MaliciousCollect", "MALCOL") {}

    function setTarget(AutoCollectExecutor _target, address _account, address _asset) external {
        target = _target;
        targetAccount = _account;
        targetAsset = _asset;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        // Try to re-enter during transfer
        if (address(target) != address(0)) {
            try target.triggerCollection(targetAccount, targetAsset) {} catch {}
        }
        return super.transfer(to, amount);
    }
}
