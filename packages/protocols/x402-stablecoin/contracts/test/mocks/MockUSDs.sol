// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDs
 * @notice Mock implementation of Sperax USDs for testing
 * @dev Simulates the rebasing behavior of USDs without requiring mainnet fork
 * 
 * Key USDs features mocked:
 * - rebaseOptIn(): Contracts must opt in to receive yield
 * - creditsPerToken(): Internal credits tracking for rebasing
 * - Standard ERC20 functionality
 */
contract MockUSDs is ERC20 {
    /*//////////////////////////////////////////////////////////////
                               STATE
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Internal credits per token (for yield calculation)
    /// @dev In real USDs: balance = credits / creditsPerToken
    /// @dev Lower creditsPerToken = higher balance (positive rebase)
    uint256 private _creditsPerToken = 1e18;
    
    /// @notice Track which addresses have opted into rebasing
    mapping(address => bool) private _rebaseOptedIn;
    
    /// @notice Internal credits balance (for rebasing simulation)
    mapping(address => uint256) private _creditBalances;
    
    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor() ERC20("Mock USDs", "mUSDs") {}
    
    /*//////////////////////////////////////////////////////////////
                           PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Mint tokens for testing
     * @param to Recipient address
     * @param amount Amount to mint (in token units)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
        // Also track internal credits
        _creditBalances[to] += amount * _creditsPerToken;
    }
    
    /**
     * @notice Burn tokens (for testing withdrawals)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
        // Also reduce internal credits
        uint256 creditsToRemove = amount * _creditsPerToken;
        if (creditsToRemove > _creditBalances[from]) {
            _creditBalances[from] = 0;
        } else {
            _creditBalances[from] -= creditsToRemove;
        }
    }
    
    /**
     * @notice Opt into rebasing (required for X402 contracts)
     * @dev Real USDs requires this to receive auto-yield
     */
    function rebaseOptIn() external {
        _rebaseOptedIn[msg.sender] = true;
    }
    
    /**
     * @notice Check if address has opted into rebasing
     * @param account Address to check
     */
    function isRebaseOptedIn(address account) external view returns (bool) {
        return _rebaseOptedIn[account];
    }
    
    /**
     * @notice Get credits per token (for yield calculations)
     * @return Current credits per token rate
     * @dev Real USDs uses this for internal balance tracking
     */
    function creditsPerToken() external view returns (uint256) {
        return _creditsPerToken;
    }
    
    /**
     * @notice Get internal credits balance for an address
     * @param account Address to check
     * @return Credits balance
     */
    function creditBalanceOf(address account) external view returns (uint256) {
        return _creditBalances[account];
    }
    
    /*//////////////////////////////////////////////////////////////
                        REBASE SIMULATION
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Simulate a positive rebase (yield distribution)
     * @param basisPoints Yield in basis points (100 = 1%)
     * @dev Decreases creditsPerToken, which increases effective balance
     * 
     * Example: 
     *   - User has 100 tokens, creditsPerToken = 1e18
     *   - After 1% rebase: creditsPerToken = 0.99e18
     *   - User balance becomes: credits / 0.99e18 = ~101 tokens
     */
    function simulatePositiveRebase(uint256 basisPoints) external {
        require(basisPoints > 0 && basisPoints <= 10000, "Invalid basis points");
        
        // Decrease creditsPerToken to simulate positive yield
        // newRate = oldRate * (10000 - bps) / 10000
        _creditsPerToken = (_creditsPerToken * (10000 - basisPoints)) / 10000;
    }
    
    /**
     * @notice Simulate a negative rebase (for testing edge cases)
     * @param basisPoints Reduction in basis points
     */
    function simulateNegativeRebase(uint256 basisPoints) external {
        require(basisPoints > 0 && basisPoints <= 10000, "Invalid basis points");
        
        // Increase creditsPerToken to simulate negative yield
        _creditsPerToken = (_creditsPerToken * (10000 + basisPoints)) / 10000;
    }
    
    /**
     * @notice Set exact creditsPerToken (for precise testing)
     * @param newRate New credits per token rate
     */
    function setCreditsPerToken(uint256 newRate) external {
        require(newRate > 0, "Rate must be positive");
        _creditsPerToken = newRate;
    }
    
    /**
     * @notice Get the rebased balance for an address
     * @param account Address to check
     * @return Effective balance after rebase
     * @dev balance = credits / creditsPerToken
     */
    function rebasedBalanceOf(address account) external view returns (uint256) {
        if (_creditBalances[account] == 0) return 0;
        return _creditBalances[account] / _creditsPerToken;
    }
    
    /*//////////////////////////////////////////////////////////////
                         TESTING HELPERS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Reset the mock to initial state
     */
    function reset() external {
        _creditsPerToken = 1e18;
    }
    
    /**
     * @notice Set up a user with tokens and credits for testing
     * @param user User address
     * @param tokenAmount Amount of tokens
     */
    function setupUser(address user, uint256 tokenAmount) external {
        _mint(user, tokenAmount);
        _creditBalances[user] = tokenAmount * _creditsPerToken;
        _rebaseOptedIn[user] = true;
    }
}
