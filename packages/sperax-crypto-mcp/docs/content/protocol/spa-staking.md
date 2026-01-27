# 09 - SPA Staking (veSPA & xSPA)

## Overview

Sperax uses a vote-escrow model for governance (veSPA) and a vesting reward token (xSPA). This incentivizes long-term alignment.

---

## veSPA (Vote-Escrowed SPA)

### Contract Overview

| Property | Value |
|----------|-------|
| **Address** | `0x2e2071180682Ce6C247B1eF93d382D509F5F6A17` |
| **Purpose** | Time-locked SPA for governance voting power |
| **Model** | ve(3,3) - inspired by Curve veCRV |
| **Lock Range** | 7 days to 4 years |

---

### Lock Mechanics

**veSPA Balance Formula:**
```
veSPA = SPA_locked × (lock_days / 365)

Maximum multiplier: 4x (4-year lock)
Minimum lock: 7 days
```

**Examples:**
| SPA Locked | Lock Duration | veSPA Received |
|------------|---------------|----------------|
| 1,000 | 1 year | 1,000 veSPA |
| 1,000 | 2 years | 2,000 veSPA |
| 1,000 | 4 years | 4,000 veSPA |
| 1,000 | 6 months | 500 veSPA |

**Decay:**
veSPA balance decays linearly as lock time decreases:
```
veSPA_now = SPA_locked × (remaining_days / 365)
```

---

### State Variables

```solidity
struct LockedBalance {
    uint256 amount;      // SPA locked
    uint256 end;         // Lock end timestamp
}

mapping(address => LockedBalance) public locked;
mapping(address => uint256) public userPointEpoch;

uint256 public totalSupply;       // Total veSPA
uint256 public constant MAXTIME = 4 * 365 * 86400; // 4 years
uint256 public constant MINTIME = 7 * 86400;       // 7 days
```

---

### Core Functions

#### create_lock

```solidity
/// @notice Lock SPA to receive veSPA
/// @param _value Amount of SPA to lock
/// @param _unlock_time Lock end timestamp
/// @dev Lock time must be >= 7 days and <= 4 years
function create_lock(
    uint256 _value,
    uint256 _unlock_time
) external nonReentrant {
    require(_value > 0, "Need non-zero value");
    require(locked[msg.sender].amount == 0, "Withdraw old tokens first");
    
    uint256 unlock_time = (_unlock_time / WEEK) * WEEK; // Round to week
    require(unlock_time > block.timestamp + MINTIME, "Lock too short");
    require(unlock_time <= block.timestamp + MAXTIME, "Lock too long");
    
    _deposit_for(msg.sender, _value, unlock_time, locked[msg.sender], CREATE_LOCK_TYPE);
}
```

---

#### increase_amount

```solidity
/// @notice Add more SPA to existing lock
/// @param _value Amount of SPA to add
/// @dev Extends the lock value, not duration
function increase_amount(uint256 _value) external nonReentrant {
    LockedBalance storage _locked = locked[msg.sender];
    require(_value > 0, "Need non-zero value");
    require(_locked.amount > 0, "No existing lock found");
    require(_locked.end > block.timestamp, "Lock expired");
    
    _deposit_for(msg.sender, _value, 0, _locked, INCREASE_LOCK_AMOUNT);
}
```

---

#### increase_unlock_time / extend_lockup

```solidity
/// @notice Extend lock duration
/// @param _unlock_time New unlock timestamp
function increase_unlock_time(uint256 _unlock_time) external nonReentrant {
    LockedBalance storage _locked = locked[msg.sender];
    uint256 unlock_time = (_unlock_time / WEEK) * WEEK;
    
    require(_locked.amount > 0, "No existing lock found");
    require(_locked.end > block.timestamp, "Lock expired");
    require(unlock_time > _locked.end, "Can only increase lock time");
    require(unlock_time <= block.timestamp + MAXTIME, "Lock too long");
    
    _deposit_for(msg.sender, 0, unlock_time, _locked, INCREASE_UNLOCK_TIME);
}
```

---

#### withdraw

```solidity
/// @notice Withdraw SPA after lock expires
/// @dev Only callable after unlock time
function withdraw() external nonReentrant {
    LockedBalance storage _locked = locked[msg.sender];
    require(block.timestamp >= _locked.end, "Lock not expired");
    
    uint256 value = _locked.amount;
    _locked.amount = 0;
    _locked.end = 0;
    
    IERC20(spa).transfer(msg.sender, value);
    
    emit Withdraw(msg.sender, value, block.timestamp);
}
```

---

### View Functions

```solidity
/// @notice Get current veSPA balance (decaying)
function balanceOf(address _addr) external view returns (uint256);

/// @notice Get veSPA balance at specific timestamp
function balanceOfAt(address _addr, uint256 _t) external view returns (uint256);

/// @notice Get total veSPA supply
function totalSupply() external view returns (uint256);

/// @notice Get locked SPA amount and unlock time
function locked(address _addr) external view returns (uint256 amount, uint256 end);
```

---

### Events

```solidity
event Deposit(
    address indexed provider,
    uint256 value,
    uint256 indexed locktime,
    uint256 type_,
    uint256 ts
);

event Withdraw(
    address indexed provider,
    uint256 value,
    uint256 ts
);

event Supply(uint256 prevSupply, uint256 supply);
```

---

### Errors

```solidity
error LockTooShort(uint256 minTime);
error LockTooLong(uint256 maxTime);
error NoLockFound();
error LockNotExpired(uint256 unlockTime);
error AlreadyLocked();
error ZeroValue();
```

---

## xSPA (Vesting SPA Rewards)

### Contract Overview

| Property | Value |
|----------|-------|
| **Address** | `0x0966E72256d6055145902F72F9D3B6a194B9cCc3` |
| **Purpose** | Vesting reward token redeemable for SPA |
| **Vesting Range** | 15-180 days |
| **Redemption Ratio** | 50-100% based on vesting period |

---

### Redemption Mechanics

**Redemption Formula:**
```
SPA_out = xSPA_redeemed × (vesting_days + 150) / 330

At 15 days:  xSPA × (15 + 150) / 330  = 50%
At 180 days: xSPA × (180 + 150) / 330 = 100%
```

**Redemption Table:**
| Vesting Period | SPA per xSPA |
|----------------|--------------|
| 15 days | 50.0% |
| 30 days | 54.5% |
| 60 days | 63.6% |
| 90 days | 72.7% |
| 120 days | 81.8% |
| 150 days | 90.9% |
| 180 days | 100.0% |

---

### State Variables

```solidity
struct VestingPosition {
    uint256 xSpaAmount;   // xSPA being vested
    uint256 vestingStart; // Start timestamp
    uint256 vestingEnd;   // End timestamp
}

mapping(address => VestingPosition[]) public vestingPositions;
uint256 public constant MIN_VESTING = 15 days;
uint256 public constant MAX_VESTING = 180 days;
uint256 public constant RATIO_NUMERATOR = 150;
uint256 public constant RATIO_DENOMINATOR = 330;
```

---

### Core Functions

#### redeem

```solidity
/// @notice Instantly redeem xSPA for SPA (50% ratio)
/// @param _amount Amount of xSPA to redeem
/// @return spaOut Amount of SPA received
function redeem(uint256 _amount) external returns (uint256 spaOut) {
    require(_amount > 0, "Zero amount");
    require(balanceOf(msg.sender) >= _amount, "Insufficient balance");
    
    // Burn xSPA
    _burn(msg.sender, _amount);
    
    // Calculate SPA out (minimum ratio = 50%)
    spaOut = (_amount * (MIN_VESTING + RATIO_NUMERATOR)) / RATIO_DENOMINATOR;
    
    // Transfer SPA
    IERC20(spa).transfer(msg.sender, spaOut);
    
    emit Redeemed(msg.sender, _amount, spaOut, 0);
    return spaOut;
}
```

---

#### vest

```solidity
/// @notice Start vesting xSPA for better SPA ratio
/// @param _amount Amount of xSPA to vest
/// @param _vestingDays Vesting duration (15-180 days)
function vest(
    uint256 _amount,
    uint256 _vestingDays
) external {
    require(_amount > 0, "Zero amount");
    require(_vestingDays >= MIN_VESTING && _vestingDays <= MAX_VESTING, "Invalid duration");
    require(balanceOf(msg.sender) >= _amount, "Insufficient balance");
    
    // Lock xSPA
    _transfer(msg.sender, address(this), _amount);
    
    vestingPositions[msg.sender].push(VestingPosition({
        xSpaAmount: _amount,
        vestingStart: block.timestamp,
        vestingEnd: block.timestamp + (_vestingDays * 1 days)
    }));
    
    emit VestingStarted(msg.sender, _amount, _vestingDays);
}
```

---

#### claim

```solidity
/// @notice Claim SPA from completed vesting position
/// @param _index Index of vesting position
/// @return spaOut Amount of SPA received
function claim(uint256 _index) external returns (uint256 spaOut) {
    VestingPosition[] storage positions = vestingPositions[msg.sender];
    require(_index < positions.length, "Invalid index");
    
    VestingPosition storage position = positions[_index];
    require(block.timestamp >= position.vestingEnd, "Still vesting");
    
    uint256 xSpaAmount = position.xSpaAmount;
    uint256 vestingDays = (position.vestingEnd - position.vestingStart) / 1 days;
    
    // Calculate SPA out based on vesting duration
    spaOut = (xSpaAmount * (vestingDays + RATIO_NUMERATOR)) / RATIO_DENOMINATOR;
    
    // Burn xSPA
    _burn(address(this), xSpaAmount);
    
    // Remove position
    _removePosition(msg.sender, _index);
    
    // Transfer SPA
    IERC20(spa).transfer(msg.sender, spaOut);
    
    emit Claimed(msg.sender, xSpaAmount, spaOut, vestingDays);
    return spaOut;
}
```

---

#### cancelVesting

```solidity
/// @notice Cancel vesting and get xSPA back
/// @param _index Index of vesting position
/// @dev Returns xSPA to user, no SPA
function cancelVesting(uint256 _index) external {
    VestingPosition[] storage positions = vestingPositions[msg.sender];
    require(_index < positions.length, "Invalid index");
    
    VestingPosition storage position = positions[_index];
    uint256 xSpaAmount = position.xSpaAmount;
    
    // Return xSPA
    _transfer(address(this), msg.sender, xSpaAmount);
    
    // Remove position
    _removePosition(msg.sender, _index);
    
    emit VestingCancelled(msg.sender, xSpaAmount, _index);
}
```

---

### View Functions

```solidity
/// @notice Get all vesting positions for user
function getVestingPositions(
    address _user
) external view returns (VestingPosition[] memory);

/// @notice Calculate SPA output for given xSPA and vesting period
function calculateSpaOut(
    uint256 _xSpaAmount,
    uint256 _vestingDays
) external pure returns (uint256 spaOut);

/// @notice Get claimable SPA from completed vestings
function getClaimable(address _user) external view returns (uint256 total);
```

---

### Events

```solidity
event Redeemed(address indexed user, uint256 xSpaIn, uint256 spaOut, uint256 vestingDays);
event VestingStarted(address indexed user, uint256 amount, uint256 vestingDays);
event Claimed(address indexed user, uint256 xSpaIn, uint256 spaOut, uint256 vestingDays);
event VestingCancelled(address indexed user, uint256 amount, uint256 index);
```

---

### Errors

```solidity
error ZeroAmount();
error InsufficientBalance(uint256 available, uint256 required);
error InvalidVestingDuration(uint256 duration);
error InvalidPositionIndex(uint256 index);
error StillVesting(uint256 endsAt);
```

---

## Staking Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           SPA TOKEN                             │
└────────────────────────────────┬────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│         veSPA           │           │         xSPA            │
│   (Governance Power)    │           │   (Reward Vesting)      │
├─────────────────────────┤           ├─────────────────────────┤
│ Lock: 7 days - 4 years  │           │ Vest: 15-180 days       │
│ Ratio: days/365 (max 4x)│           │ Ratio: 50-100%          │
│ Decays linearly         │           │ Instant redeem = 50%    │
└────────────┬────────────┘           └────────────┬────────────┘
             │                                     │
             ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│  Benefits:              │           │  Sources:               │
│  • Voting power         │           │  • Farm rewards         │
│  • Fee sharing          │           │  • Gauge emissions      │
│  • Boosted rewards      │           │  • Protocol incentives  │
└─────────────────────────┘           └─────────────────────────┘
```

---

## Comparison Table

| Feature | veSPA | xSPA |
|---------|-------|------|
| **Purpose** | Governance | Reward distribution |
| **Lock Period** | 7 days - 4 years | 15 - 180 days (optional) |
| **Transferable** | No | Yes |
| **Decays** | Yes (linear) | No |
| **Exit** | Wait for unlock | Vest or instant 50% |
| **Max Multiplier** | 4x (4-year lock) | 1x (180-day vest) |
| **Voting Power** | Yes | No |

---

## Protocol Addresses

| Contract | Address |
|----------|---------|
| SPA | `0x5575552988A3A80504bBaeB1311674fCFd40aD4B` |
| veSPA | `0x2e2071180682Ce6C247B1eF93d382D509F5F6A17` |
| xSPA | `0x0966E72256d6055145902F72F9D3B6a194B9cCc3` |
