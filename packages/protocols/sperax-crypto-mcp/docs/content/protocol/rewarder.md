# Rewarder System

## Overview

The Rewarder system handles **APR-based reward distribution** for Demeter farms. Each farm has an associated Rewarder contract that manages reward token distribution to stakers.

---

## Rewarder Factory

The factory deploys new Rewarder contracts for farms.

### Contract Address

| Contract | Address |
|----------|---------|
| Rewarder Factory | `0x926477bAF60C25857419CC9Bf52E914881E1bDD3` |

### Interface

```solidity
interface IRewarderFactory {
    // Deploy a new rewarder for a farm
    function createRewarder(
        address farm,
        address rewardToken,
        uint256 rewardAmount,
        uint256 duration
    ) external returns (address rewarder);
    
    // Get rewarder for a farm
    function getRewarder(address farm) external view returns (address);
    
    // Check if address is a valid rewarder
    function isRewarder(address addr) external view returns (bool);
}
```

---

## Rewarder Contract

### Core State

```solidity
contract Rewarder {
    // The farm this rewarder serves
    address public farm;
    
    // Reward token being distributed
    address public rewardToken;
    
    // Reward rate per second
    uint256 public rewardRate;
    
    // When rewards end
    uint256 public periodFinish;
    
    // Last update timestamp
    uint256 public lastUpdateTime;
    
    // Accumulated rewards per token
    uint256 public rewardPerTokenStored;
    
    // User reward tracking
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
}
```

### Key Functions

```solidity
interface IRewarder {
    // Calculate current reward per token
    function rewardPerToken() external view returns (uint256);
    
    // Calculate earned rewards for user
    function earned(address account) external view returns (uint256);
    
    // Notify new rewards added
    function notifyRewardAmount(uint256 reward) external;
    
    // Set reward duration
    function setRewardsDuration(uint256 duration) external;
    
    // Claim rewards (called by farm)
    function getReward(address user) external;
    
    // Update reward state (called on stake/withdraw)
    function updateReward(address account) external;
}
```

---

## Reward Calculation

### Reward Per Token

```solidity
function rewardPerToken() public view returns (uint256) {
    if (totalStaked == 0) {
        return rewardPerTokenStored;
    }
    
    return rewardPerTokenStored + (
        (lastTimeRewardApplicable() - lastUpdateTime) 
        * rewardRate 
        * 1e18 
        / totalStaked
    );
}

function lastTimeRewardApplicable() public view returns (uint256) {
    return block.timestamp < periodFinish 
        ? block.timestamp 
        : periodFinish;
}
```

### User Earnings

```solidity
function earned(address account) public view returns (uint256) {
    return (
        balanceOf(account) 
        * (rewardPerToken() - userRewardPerTokenPaid[account])
        / 1e18
    ) + rewards[account];
}
```

---

## Reward Flow

```
┌─────────────────┐
│  Farm Creator   │
│  deposits       │
│  reward tokens  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Rewarder      │
│   notifyReward  │
│   Amount()      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  rewardRate =   │
│  amount/duration│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         TIME PASSES...              │
│  rewardPerToken accumulates         │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   User stakes   │     │   User calls    │
│   or withdraws  │     │   getReward()   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  updateReward   │     │  Transfer       │
│  modifier runs  │     │  earned tokens  │
└─────────────────┘     └─────────────────┘
```

---

## Multi-Token Rewards

Farms can have multiple rewarders for different reward tokens.

```solidity
interface IMultiRewarder {
    // Add a new reward token
    function addRewardToken(
        address token,
        uint256 amount,
        uint256 duration
    ) external;
    
    // Get all reward tokens
    function rewardTokens() external view returns (address[] memory);
    
    // Get earned for specific token
    function earnedToken(
        address account,
        address token
    ) external view returns (uint256);
    
    // Claim all reward tokens
    function getRewards() external;
}
```

---

## Events

```solidity
event RewardAdded(uint256 reward);
event RewardPaid(address indexed user, uint256 reward);
event RewardsDurationUpdated(uint256 newDuration);
event Recovered(address token, uint256 amount);
```

---

## Security

### Access Control
- Only farm can call `updateReward`
- Only farm can call `getReward` on behalf of users
- Only owner can `notifyRewardAmount`
- Only owner can recover non-reward tokens

### Invariants
- `rewardRate * duration <= balance`
- Rewards only distribute during active period
- User rewards never exceed total distributed

---

## Integration Example

```typescript
// Get pending rewards across all farms
async function getAllPendingRewards(userAddress: string) {
  const farms = await getActiveFarms();
  
  const rewards = await Promise.all(
    farms.map(async (farm) => {
      const earned = await readContract({
        address: farm,
        abi: FarmABI,
        functionName: 'earned',
        args: [userAddress],
      });
      
      const rewardToken = await readContract({
        address: farm,
        abi: FarmABI,
        functionName: 'rewardsToken',
      });
      
      return {
        farm,
        rewardToken,
        earned: formatUnits(earned, 18),
      };
    })
  );
  
  return rewards.filter(r => parseFloat(r.earned) > 0);
}
```

---

## Related Documentation

- [demeter-farms.md](./demeter-farms.md) - Farm contracts and deployment
- [spa-staking.md](./spa-staking.md) - xSPA rewards
