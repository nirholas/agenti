# 08 - SPA Buyback System

## Overview

The SPA Buyback system manages the 30% of yield allocated to buying and burning SPA tokens. This creates deflationary pressure on SPA, benefiting holders.

---

## YieldReserve

### Contract Overview

| Property | Value |
|----------|-------|
| **Address** | `0x0CB89A7A6a9e0d9E06EE0c52De040db0e2B079E6` |
| **Purpose** | Receives yield, mints USDs, splits 70/30 |
| **Inherits** | Ownable |

---

### State Variables

```solidity
address public vault;              // VaultCore address
address public dripper;            // Dripper contract (70% destination)
address public spaBuyback;         // SPABuyback contract (30% destination)
uint256 public buybackPercentage;  // Default: 3000 (30%)
uint256 public constant PERCENTAGE_BASE = 10000;

mapping(address => bool) public approvedTokens; // Tokens that can be swapped
```

---

### Core Functions

#### swap

```solidity
/// @notice Swap yield token to USDs and distribute
/// @param _token Yield token to swap (e.g., USDC from strategies)
/// @param _amount Amount to swap
/// @param _minUSDsOut Minimum USDs to receive (slippage protection)
/// @return usdsOut Amount of USDs minted
function swap(
    address _token,
    uint256 _amount,
    uint256 _minUSDsOut
) external returns (uint256 usdsOut) {
    require(approvedTokens[_token], "Token not approved");
    
    // Transfer token from caller
    IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    
    // Calculate USDs to mint based on oracle price
    usdsOut = getTokenBForTokenA(_token, _amount);
    require(usdsOut >= _minUSDsOut, "Slippage exceeded");
    
    // Mint USDs (YieldReserve is authorized minter)
    IVault(vault).mintUSDs(usdsOut);
    
    // Split 70/30
    uint256 buybackAmt = (usdsOut * buybackPercentage) / PERCENTAGE_BASE;
    uint256 dripperAmt = usdsOut - buybackAmt;
    
    // Send to Dripper (for rebase to holders)
    IERC20(usds).transfer(dripper, dripperAmt);
    IDripper(dripper).addUSDs(dripperAmt);
    
    // Send to SPABuyback
    IERC20(usds).transfer(spaBuyback, buybackAmt);
    
    emit YieldSwapped(_token, _amount, usdsOut);
    return usdsOut;
}
```

---

#### mintUSDs

```solidity
/// @notice Mint USDs directly using approved collateral
/// @param _collateral Collateral token
/// @param _amount Amount of collateral
/// @return usdsOut Amount of USDs minted
function mintUSDs(
    address _collateral,
    uint256 _amount
) external returns (uint256 usdsOut) {
    IERC20(_collateral).transferFrom(msg.sender, vault, _amount);
    usdsOut = IVault(vault).mint(_collateral, _amount, 0);
    
    // Full amount goes to caller (not split)
    IERC20(usds).transfer(msg.sender, usdsOut);
    
    return usdsOut;
}
```

---

#### getTokenBForTokenA

```solidity
/// @notice Calculate USDs output for input token
/// @param _tokenA Input token
/// @param _amountA Amount of input token
/// @return amountB USDs amount output
function getTokenBForTokenA(
    address _tokenA,
    uint256 _amountA
) public view returns (uint256 amountB) {
    (uint256 priceA, uint8 decimalsA) = IOracle(oracle).getPrice(_tokenA);
    
    // USDs is pegged to $1, 18 decimals
    // Formula: amountB = amountA * priceA / 1e8 * 1e18 / 10^decimalsA
    amountB = (_amountA * priceA * 1e18) / (1e8 * 10**decimalsA);
    
    return amountB;
}
```

---

### Admin Functions

```solidity
/// @notice Update buyback percentage
/// @param _newPercentage New percentage in basis points
function updateBuybackPercentage(uint256 _newPercentage) external onlyOwner;

/// @notice Approve token for swapping
function approveToken(address _token, bool _approved) external onlyOwner;

/// @notice Update Dripper address
function updateDripper(address _newDripper) external onlyOwner;

/// @notice Update SPABuyback address
function updateSpaBuyback(address _newSpaBuyback) external onlyOwner;

/// @notice Emergency withdraw
function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner;
```

---

### Events

```solidity
event YieldSwapped(address indexed token, uint256 amountIn, uint256 usdsOut);
event BuybackPercentageUpdated(uint256 newPercentage);
event TokenApprovalUpdated(address indexed token, bool approved);
event DripperUpdated(address indexed newDripper);
event SpaBuybackUpdated(address indexed newSpaBuyback);
```

---

### Errors

```solidity
error TokenNotApproved(address token);
error SlippageExceeded(uint256 expected, uint256 actual);
error InvalidPercentage(uint256 percentage);
error ZeroAddress();
```

---

## SPABuyback

### Contract Overview

| Property | Value |
|----------|-------|
| **Address** | `0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3` |
| **Purpose** | Buy SPA with USDs, burn SPA |
| **Inherits** | Ownable |

---

### State Variables

```solidity
address public spa;               // SPA token address
address public usds;              // USDs token address
address public uniRouter;         // Uniswap V3 swap router
uint256 public rewardPercentage;  // % to reward caller (default: 100 = 1%)
uint256 public slippageTolerance; // Max slippage (default: 100 = 1%)
uint256 public constant PERCENTAGE_BASE = 10000;
```

---

### Core Functions

#### buyUSDs

```solidity
/// @notice Sell SPA for USDs at oracle price
/// @param _spaAmount Amount of SPA to sell
/// @param _minUSDsOut Minimum USDs to receive
/// @return usdsOut Amount of USDs received
/// @dev User sells SPA to protocol, receives USDs from buyback pool
function buyUSDs(
    uint256 _spaAmount,
    uint256 _minUSDsOut
) external returns (uint256 usdsOut) {
    usdsOut = getUsdsOutForSpa(_spaAmount);
    require(usdsOut >= _minUSDsOut, "Slippage exceeded");
    
    // Take SPA from user
    IERC20(spa).transferFrom(msg.sender, address(this), _spaAmount);
    
    // Give USDs to user
    IERC20(usds).transfer(msg.sender, usdsOut);
    
    emit SPASold(msg.sender, _spaAmount, usdsOut);
    return usdsOut;
}
```

---

#### getUsdsOutForSpa

```solidity
/// @notice Calculate USDs output for SPA input
/// @param _spaAmount Amount of SPA
/// @return usdsOut Amount of USDs
function getUsdsOutForSpa(
    uint256 _spaAmount
) public view returns (uint256 usdsOut) {
    uint256 spaPrice = IOracle(oracle).getPrice(spa);
    // SPA has 18 decimals, USDs has 18 decimals
    // Oracle returns 8 decimals
    usdsOut = (_spaAmount * spaPrice) / 1e8;
    return usdsOut;
}
```

---

#### getSPAReqdForUSDs

```solidity
/// @notice Calculate SPA required for USDs amount
/// @param _usdsAmount Amount of USDs wanted
/// @return spaReqd Amount of SPA required
function getSPAReqdForUSDs(
    uint256 _usdsAmount
) public view returns (uint256 spaReqd) {
    uint256 spaPrice = IOracle(oracle).getPrice(spa);
    spaReqd = (_usdsAmount * 1e8) / spaPrice;
    return spaReqd;
}
```

---

#### distributeAndBurnSPA

```solidity
/// @notice Burn accumulated SPA, reward caller
/// @return spaBurned Amount of SPA burned
/// @dev Anyone can call, receives % of SPA as reward
function distributeAndBurnSPA() external returns (uint256 spaBurned) {
    uint256 balance = IERC20(spa).balanceOf(address(this));
    require(balance > 0, "No SPA to burn");
    
    // Reward caller
    uint256 reward = (balance * rewardPercentage) / PERCENTAGE_BASE;
    if (reward > 0) {
        IERC20(spa).transfer(msg.sender, reward);
    }
    
    // Burn the rest
    spaBurned = balance - reward;
    ISPAToken(spa).burn(spaBurned);
    
    emit SPABurned(spaBurned, msg.sender, reward);
    return spaBurned;
}
```

---

### View Functions

```solidity
/// @notice Get pending SPA to be burned
function pendingBurn() external view returns (uint256) {
    return IERC20(spa).balanceOf(address(this));
}

/// @notice Get USDs available for buyback
function availableUSDs() external view returns (uint256) {
    return IERC20(usds).balanceOf(address(this));
}

/// @notice Estimate reward for calling distributeAndBurnSPA
function estimateReward() external view returns (uint256) {
    uint256 balance = IERC20(spa).balanceOf(address(this));
    return (balance * rewardPercentage) / PERCENTAGE_BASE;
}
```

---

### Admin Functions

```solidity
/// @notice Update reward percentage for caller
function updateRewardPercentage(uint256 _newPercentage) external onlyOwner;

/// @notice Update slippage tolerance
function updateSlippageTolerance(uint256 _newSlippage) external onlyOwner;

/// @notice Emergency withdraw
function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner;
```

---

### Events

```solidity
event SPASold(address indexed seller, uint256 spaAmount, uint256 usdsOut);
event SPABurned(uint256 amount, address indexed caller, uint256 reward);
event RewardPercentageUpdated(uint256 newPercentage);
event SlippageToleranceUpdated(uint256 newSlippage);
```

---

### Errors

```solidity
error SlippageExceeded(uint256 expected, uint256 actual);
error NoSPAToBurn();
error InvalidPercentage(uint256 percentage);
error InsufficientUSDs(uint256 available, uint256 required);
```

---

## Buyback Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        YIELD GENERATION                         │
└─────────────────────────────────────────────────────────────────┘
                                │
        Strategy.collectInterest() returns USDC yield
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        YieldReserve                              │
│  1. swap(USDC, amount)                                          │
│  2. Mint USDs using Vault                                       │
│  3. Split: 70% → Dripper, 30% → SPABuyback                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
        ┌───────────────────┐   ┌───────────────────┐
        │     Dripper       │   │    SPABuyback     │
        │  (70% of yield)   │   │  (30% of yield)   │
        │                   │   │                   │
        │  Gradual drip     │   │  USDs pool for    │
        │  for rebase       │   │  SPA buybacks     │
        └─────────┬─────────┘   └─────────┬─────────┘
                  │                       │
                  ▼                       ▼
        ┌───────────────────┐   ┌───────────────────┐
        │   USDs Holders    │   │   SPA Holders     │
        │  +0.X% rebase     │   │  buyUSDs() sell   │
        │  per day          │   │  SPA for USDs     │
        └───────────────────┘   └─────────┬─────────┘
                                          │
                                          ▼
                                ┌───────────────────┐
                                │distributeAndBurn()│
                                │  Burns SPA tokens │
                                │  1% caller reward │
                                └───────────────────┘
                                          │
                                          ▼
                                ┌───────────────────┐
                                │    SPA Burned     │
                                │  (deflationary)   │
                                └───────────────────┘
```

---

## Buyback Economics

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| buybackPercentage | 3000 (30%) | Yield allocated to buyback |
| rewardPercentage | 100 (1%) | Caller reward for burning |
| slippageTolerance | 100 (1%) | Max swap slippage |

### Example Calculation

```
Yield Generated: 10,000 USDC
                    │
                    ▼
YieldReserve mints: 10,000 USDs
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
    7,000 USDs           3,000 USDs
    → Dripper            → SPABuyback
    → Rebase             (available for buyback)

User sells 10,000 SPA at $0.05 price:
  SPA Price: $0.05 (Oracle)
  USDs Out: 10,000 * 0.05 = 500 USDs

distributeAndBurnSPA():
  SPA Balance: 10,000 SPA
  Caller Reward: 10,000 * 1% = 100 SPA
  SPA Burned: 9,900 SPA
```

---

## Arbitrage Opportunity

When SPA price on DEX < SPABuyback oracle price:
1. Buy SPA cheap on DEX
2. Sell to SPABuyback at oracle price
3. Profit = (oracle price - DEX price) × amount

This arbitrage maintains SPA price floor equal to the oracle price in SPABuyback.
