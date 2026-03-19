// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal IERC20 interface for USDC
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}