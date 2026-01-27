// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IUSDs
 * @notice Interface for Sperax USDs - Auto-yield stablecoin on Arbitrum
 * @dev USDs is a rebasing token that auto-distributes yield to holders
 * 
 * Key Features:
 * - 18 decimals
 * - Rebasing token (balance increases automatically with yield)
 * - Smart contracts must opt-in for rebase via rebaseOptIn()
 * - Yield distributed approximately every 24 hours
 * 
 * Address on Arbitrum: 0xD74f5255D557944cf7Dd0E45FF521520002D5748
 */
interface IUSDs is IERC20 {
    /**
     * @notice Opt-in the caller's contract to receive auto-yield
     * @dev Must be called by the contract that wants to receive yield
     * Smart contracts are not eligible for rebase by default
     */
    function rebaseOptIn() external;

    /**
     * @notice Owner-only function to opt-in a specific account for rebase
     * @param _account The account to opt-in
     */
    function rebaseOptIn(address _account) external;

    /**
     * @notice Opt-out the caller's contract from receiving auto-yield
     */
    function rebaseOptOut() external;

    /**
     * @notice Check if an account is opted-in for rebase
     * @param _account The account to check
     * @return True if the account receives auto-yield
     */
    function isRebaseOptedIn(address _account) external view returns (bool);

    /**
     * @notice Get the credits balance of an account
     * @dev Internal credits are used to calculate actual balance
     * Balance = credits / creditsPerToken
     * @param _account The account to query
     * @return The credits balance
     */
    function creditsBalanceOf(address _account) external view returns (uint256);

    /**
     * @notice Get the current credits per token ratio
     * @return The global credits per token value
     */
    function creditsPerToken() external view returns (uint256);

    /**
     * @notice Trigger yield distribution (rebase)
     * @dev Can be called by anyone when yield >= 3% and 24 hours have passed
     */
    function rebase() external;

    /**
     * @notice Get the last rebase timestamp
     * @return The timestamp of the last rebase
     */
    function lastRebaseTimestamp() external view returns (uint256);

    /**
     * @notice Get the current yield rate in basis points
     * @return The annual yield rate in basis points
     */
    function getYieldRate() external view returns (uint256);
}
