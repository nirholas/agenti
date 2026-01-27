// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUSDs
 * @notice Interface for Sperax USDs token on Arbitrum
 * @dev Includes ERC20, EIP-3009, and rebasing functions
 */
interface IUSDs {
    // ============================================
    // ERC20 Standard
    // ============================================
    
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // ============================================
    // EIP-3009: Transfer With Authorization
    // ============================================
    
    /**
     * @notice Execute a transfer with a signed authorization
     * @param from Payer's address (Authorizer)
     * @param to Payee's address
     * @param value Amount to be transferred
     * @param validAfter The time after which this is valid (unix time)
     * @param validBefore The time before which this is valid (unix time)
     * @param nonce Unique nonce
     * @param v v of the signature
     * @param r r of the signature
     * @param s s of the signature
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Receive a transfer with a signed authorization from the payer
     * @dev This has an additional check that the caller must be the payee
     * @param from Payer's address (Authorizer)
     * @param to Payee's address
     * @param value Amount to be transferred
     * @param validAfter The time after which this is valid (unix time)
     * @param validBefore The time before which this is valid (unix time)
     * @param nonce Unique nonce
     * @param v v of the signature
     * @param r r of the signature
     * @param s s of the signature
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Attempt to cancel an authorization
     * @param authorizer Authorizer's address
     * @param nonce Nonce of the authorization
     * @param v v of the signature
     * @param r r of the signature
     * @param s s of the signature
     */
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Returns the state of an authorization
     * @param authorizer Authorizer's address
     * @param nonce Nonce of the authorization
     * @return True if the nonce has been used
     */
    function authorizationState(
        address authorizer,
        bytes32 nonce
    ) external view returns (bool);

    // ============================================
    // USDs Rebasing Functions
    // ============================================

    /**
     * @notice Get the rebasing credits balance for an account
     * @param account The address to query
     * @return creditBalance The credit balance
     * @return creditsPerToken The credits per token ratio
     */
    function creditBalanceOf(
        address account
    ) external view returns (uint256 creditBalance, uint256 creditsPerToken);

    /**
     * @notice Get the high resolution credits per token
     * @return The rebasing credits per token (high resolution)
     */
    function rebasingCreditsPerTokenHighres() external view returns (uint256);

    /**
     * @notice Get the rebasing credits per token
     * @return The rebasing credits per token
     */
    function rebasingCreditsPerToken() external view returns (uint256);

    /**
     * @notice Get the total rebasing credits
     * @return The total credits in the system
     */
    function rebasingCredits() external view returns (uint256);

    /**
     * @notice Check if an account is in rebasing mode
     * @param account The address to check
     * @return True if the account participates in rebasing
     */
    function isRebasingAccount(address account) external view returns (bool);

    /**
     * @notice Opt in to rebasing
     */
    function rebaseOptIn() external;

    /**
     * @notice Opt out of rebasing
     */
    function rebaseOptOut() external;

    // ============================================
    // EIP-2612: Permit
    // ============================================

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
