# Contract ABIs

ABI references for Sperax Protocol contracts.

---

## USDs Token

### Read Functions

```solidity
function name() external view returns (string memory)
function symbol() external view returns (string memory)
function decimals() external view returns (uint8)
function totalSupply() external view returns (uint256)
function balanceOf(address account) external view returns (uint256)
function allowance(address owner, address spender) external view returns (uint256)

// Rebasing
function rebasingCreditsPerToken() external view returns (uint256)
function rebasingCredits() external view returns (uint256)
function nonRebasingSupply() external view returns (uint256)
function isRebasingAccount(address account) external view returns (bool)
```

### Write Functions

```solidity
function transfer(address to, uint256 amount) external returns (bool)
function approve(address spender, uint256 amount) external returns (bool)
function transferFrom(address from, address to, uint256 amount) external returns (bool)

// Rebasing
function rebaseOptIn() external
function rebaseOptOut() external
```

### Events

```solidity
event Transfer(address indexed from, address indexed to, uint256 value)
event Approval(address indexed owner, address indexed spender, uint256 value)
event TotalSupplyUpdated(uint256 totalSupply, uint256 rebasingCredits, uint256 rebasingCreditsPerToken)
```

---

## Vault

### Read Functions

```solidity
function getAllCollaterals() external view returns (address[] memory)
function getCollateralData(address collateral) external view returns (CollateralData memory)
function totalValueLocked() external view returns (uint256)
function mintFee() external view returns (uint256)
function redeemFee() external view returns (uint256)
function pricePerShare() external view returns (uint256)
function isPaused() external view returns (bool)
```

### Write Functions

```solidity
function mint(address collateral, uint256 amount, uint256 minOut) external returns (uint256)
function redeem(address collateral, uint256 usdsAmount, uint256 minOut) external returns (uint256)
function rebase() external
```

### Structs

```solidity
struct CollateralData {
    address token;
    address oracle;
    address strategy;
    uint256 deposited;
    uint256 weight;
    uint256 mintCap;
    bool enabled;
}
```

### Events

```solidity
event Mint(address indexed user, address indexed collateral, uint256 collateralAmount, uint256 usdsAmount)
event Redeem(address indexed user, address indexed collateral, uint256 usdsAmount, uint256 collateralAmount)
event Rebase(uint256 newTotalSupply)
```

---

## veSPA

### Read Functions

```solidity
function balanceOf(address account) external view returns (uint256)
function locked(address account) external view returns (LockedBalance memory)
function totalSupply() external view returns (uint256)
function epoch() external view returns (uint256)
function userPointEpoch(address account) external view returns (uint256)
function unlockTime(address account) external view returns (uint256)
```

### Write Functions

```solidity
function createLock(uint256 amount, uint256 unlockTime) external
function increaseLockAmount(uint256 amount) external
function increaseLockDuration(uint256 newUnlockTime) external
function withdraw() external
function delegate(address delegatee) external
```

### Structs

```solidity
struct LockedBalance {
    uint256 amount;
    uint256 end;
}

struct Point {
    int128 bias;
    int128 slope;
    uint256 ts;
    uint256 blk;
}
```

### Events

```solidity
event Deposit(address indexed provider, uint256 value, uint256 indexed locktime, uint256 type_, uint256 ts)
event Withdraw(address indexed provider, uint256 value, uint256 ts)
event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)
```

---

## Demeter Farm

### Read Functions

```solidity
function farmInfo() external view returns (FarmInfo memory)
function userInfo(address user) external view returns (UserInfo memory)
function pendingReward(address user) external view returns (uint256)
function totalDeposited() external view returns (uint256)
function rewardPerSecond() external view returns (uint256)
function startTime() external view returns (uint256)
function endTime() external view returns (uint256)
```

### Write Functions

```solidity
function deposit(uint256 amount) external
function withdraw(uint256 amount) external
function claim() external
function emergencyWithdraw() external
```

### Structs

```solidity
struct FarmInfo {
    address stakingToken;
    address rewardToken;
    uint256 totalDeposited;
    uint256 rewardPerSecond;
    uint256 startTime;
    uint256 endTime;
    uint256 lastRewardTime;
    uint256 accRewardPerShare;
}

struct UserInfo {
    uint256 amount;
    uint256 rewardDebt;
}
```

### Events

```solidity
event Deposit(address indexed user, uint256 amount)
event Withdraw(address indexed user, uint256 amount)
event Claim(address indexed user, uint256 amount)
event EmergencyWithdraw(address indexed user, uint256 amount)
```

---

## Dripper

### Read Functions

```solidity
function availableFunds() external view returns (uint256)
function dripRate() external view returns (uint256)
function lastDripTime() external view returns (uint256)
function dripDuration() external view returns (uint256)
function perSecond() external view returns (uint256)
```

### Write Functions

```solidity
function drip() external returns (uint256)
function setDripDuration(uint256 duration) external
function collect() external
```

### Events

```solidity
event Drip(uint256 amount, uint256 timestamp)
event DripDurationChanged(uint256 oldDuration, uint256 newDuration)
```

---

## Oracle

### Read Functions

```solidity
function getPrice(address asset) external view returns (uint256)
function getSources(address asset) external view returns (address[] memory)
function getLatestRound(address asset) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
function isStale(address asset) external view returns (bool)
function maxStaleness() external view returns (uint256)
```

### Events

```solidity
event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp)
event SourceAdded(address indexed asset, address source)
event SourceRemoved(address indexed asset, address source)
```

---

## Using ABIs

### With viem

```typescript
import { parseAbi } from 'viem';

const usdsAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function rebaseOptIn() external',
  'event Transfer(address indexed, address indexed, uint256)',
]);

const balance = await client.readContract({
  address: '0xD74f5255D557944cf7Dd0E45FF521520002D5748',
  abi: usdsAbi,
  functionName: 'balanceOf',
  args: [userAddress],
});
```

### With ethers.js

```typescript
import { Contract } from 'ethers';

const usds = new Contract(
  '0xD74f5255D557944cf7Dd0E45FF521520002D5748',
  ['function balanceOf(address) view returns (uint256)'],
  provider
);

const balance = await usds.balanceOf(userAddress);
```
