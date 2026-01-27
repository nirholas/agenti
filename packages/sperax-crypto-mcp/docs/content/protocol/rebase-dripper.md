# 06 - Rebase Manager & Dripper

## RebaseManager

### Contract Overview

| Property | Value |
|----------|-------|
| **Purpose** | Controls rebase timing and amount |
| **Inherits** | Ownable |

### State Variables

```solidity
address public vault;          // VaultCore address
address public dripper;        // Dripper contract
uint256 public gap;            // Minimum time between rebases (default: 1 day)
uint256 public aprCap;         // Maximum APR in basis points (default: 2500 = 25%)
uint256 public aprBottom;      // Minimum APR threshold (default: 300 = 3%)
uint256 public lastRebaseTime; // Timestamp of last rebase
```

### Constructor

```solidity
constructor(
    address _vault,
    address _dripper,
    uint256 _gap,
    uint256 _aprCap,
    uint256 _aprBottom
) {
    vault = _vault;
    dripper = _dripper;
    gap = _gap;
    aprCap = _aprCap;
    aprBottom = _aprBottom;
}
```

---

### fetchRebaseAmt

```solidity
/// @notice Calculate the amount to rebase
/// @return rebaseAmt Amount of USDs to add via rebase (0 if not time yet)
/// @dev Called by VaultCore.rebase()
function fetchRebaseAmt() external returns (uint256 rebaseAmt) {
    // Check if enough time has passed
    if (block.timestamp < lastRebaseTime + gap) {
        return 0;
    }
    
    // Get available yield from Dripper
    uint256 availableYield = IDripper(dripper).collect();
    
    // Calculate APR and cap if needed
    uint256 totalSupply = IUSDs(usds).totalSupply();
    uint256 annualizedYield = (availableYield * 365 days) / gap;
    uint256 projectedAPR = (annualizedYield * 10000) / totalSupply;
    
    if (projectedAPR > aprCap) {
        // Cap the yield
        rebaseAmt = (totalSupply * aprCap * gap) / (365 days * 10000);
    } else if (projectedAPR < aprBottom) {
        // Too small, skip rebase
        return 0;
    } else {
        rebaseAmt = availableYield;
    }
    
    lastRebaseTime = block.timestamp;
    return rebaseAmt;
}
```

---

### Admin Functions

```solidity
/// @notice Update minimum gap between rebases
function updateGap(uint256 _newGap) external onlyOwner;

/// @notice Update APR cap
function updateAPRCap(uint256 _newAPRCap) external onlyOwner;

/// @notice Update APR bottom threshold
function updateAPRBottom(uint256 _newAPRBottom) external onlyOwner;

/// @notice Update Dripper address
function updateDripper(address _newDripper) external onlyOwner;
```

---

### Events

```solidity
event GapUpdated(uint256 newGap);
event APRCapUpdated(uint256 newAPRCap);
event APRBottomUpdated(uint256 newAPRBottom);
event DripperUpdated(address newDripper);
event RebaseTriggered(uint256 rebaseAmt, uint256 timestamp);
```

---

### Errors

```solidity
error InvalidGap(uint256 gap);
error InvalidAPR(uint256 apr);
error RebaseTooSoon(uint256 lastRebase, uint256 gap);
```

---

## Dripper

### Contract Overview

| Property | Value |
|----------|-------|
| **Purpose** | Smoothly drips yield over time to prevent manipulation |
| **Inherits** | Ownable |

The Dripper prevents yield manipulation by releasing collected yield gradually over a drip period (default: 7 days).

---

### State Variables

```solidity
address public vault;          // VaultCore address
uint256 public dripPeriod;     // Duration over which yield is released (default: 7 days)
uint256 public lastCollectTime;// Last collection timestamp
uint256 public dripRate;       // USDs per second
uint256 public totalDripped;   // Total USDs dripped so far
```

---

### Constructor

```solidity
constructor(address _vault, uint256 _dripPeriod) {
    vault = _vault;
    dripPeriod = _dripPeriod;
}
```

---

### addUSDs

```solidity
/// @notice Add USDs to the drip pool
/// @param _amount Amount of USDs to add
/// @dev Called by YieldReserve after converting yield to USDs
function addUSDs(uint256 _amount) external {
    IERC20(usds).transferFrom(msg.sender, address(this), _amount);
    
    // Recalculate drip rate
    uint256 remaining = _calculateRemaining();
    uint256 newTotal = remaining + _amount;
    dripRate = newTotal / dripPeriod;
    lastCollectTime = block.timestamp;
    
    emit USDsAdded(_amount);
}
```

---

### collect

```solidity
/// @notice Collect dripped USDs for rebase
/// @return amount Amount of USDs available for rebase
/// @dev Called by RebaseManager
function collect() external returns (uint256 amount) {
    uint256 elapsed = block.timestamp - lastCollectTime;
    amount = dripRate * elapsed;
    
    uint256 balance = IERC20(usds).balanceOf(address(this));
    if (amount > balance) {
        amount = balance;
    }
    
    if (amount > 0) {
        IERC20(usds).transfer(msg.sender, amount);
        totalDripped += amount;
        lastCollectTime = block.timestamp;
    }
    
    emit USDsCollected(amount);
    return amount;
}
```

---

### View Functions

```solidity
/// @notice Get available USDs for collection
/// @return Available USDs based on drip rate and elapsed time
function availableYield() external view returns (uint256) {
    uint256 elapsed = block.timestamp - lastCollectTime;
    uint256 amount = dripRate * elapsed;
    uint256 balance = IERC20(usds).balanceOf(address(this));
    return amount > balance ? balance : amount;
}

/// @notice Get current drip rate
/// @return USDs per second
function getDripRate() external view returns (uint256) {
    return dripRate;
}
```

---

### Admin Functions

```solidity
/// @notice Update drip period
/// @param _newDripPeriod New drip period in seconds
function updateDripPeriod(uint256 _newDripPeriod) external onlyOwner;
```

---

### Events

```solidity
event USDsAdded(uint256 amount);
event USDsCollected(uint256 amount);
event DripPeriodUpdated(uint256 newDripPeriod);
```

---

### Errors

```solidity
error InvalidDripPeriod(uint256 period);
error NothingToCollect();
```

---

## Yield Flow Diagram

```
Strategy.collectInterest()
         │
         ▼
┌─────────────────────────┐
│     YieldReserve        │
│  - Receives USDC/tokens │
│  - Mints USDs           │
│  - Splits 70/30         │
└──────────┬──────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
70% USDs      30% USDs
    │             │
    ▼             ▼
┌────────┐   ┌──────────┐
│ Dripper│   │SPABuyback│
└────┬───┘   └──────────┘
     │
     ▼ (gradual drip over 7 days)
┌──────────────┐
│RebaseManager │
│  - Checks gap│
│  - Caps APR  │
│  - Returns   │
│    rebaseAmt │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  VaultCore   │
│  .rebase()   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    USDs      │
│.changeSupply │
│  (holders    │
│   get yield) │
└──────────────┘
```

---

## Rebase Parameters (Default)

| Parameter | Value | Description |
|-----------|-------|-------------|
| gap | 86400 (1 day) | Minimum seconds between rebases |
| aprCap | 2500 (25%) | Maximum APR to distribute |
| aprBottom | 300 (3%) | Minimum APR threshold |
| dripPeriod | 604800 (7 days) | Yield release period |
