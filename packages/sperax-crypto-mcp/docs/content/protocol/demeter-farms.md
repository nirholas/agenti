# 10 - Demeter Yield Farms

## Overview

Demeter is Sperax's **permissionless yield farming protocol**. Anyone can deploy farms for any token pair without coding or special permissions.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **No-Code Deployment** | Create farms through UI, no Solidity required |
| **Flexible Rewards** | Any ERC20 token as reward |
| **Custom Duration** | Set your own reward schedule |
| **Multiple Farm Types** | UniV3, CamelotV2/V3, BalancerV2 supported |

---

## Contract Addresses (Arbitrum)

| Contract | Address |
|----------|---------|
| Farm Registry | `0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0` |
| Rewarder Factory | `0x926477bAF60C25857419CC9Bf52E914881E1bDD3` |
| UniV3 Farm Deployer | `0x0d9EFD8f11c0a09DB8C2CCBfF4cC6c26Ad98b956` |
| CamelotV3 Farm Deployer | `0xc6EcFBAE9e30E2B8D58AE0BBa29e0D0B3e8a8F8b` |

---

## Farm Types

### UniV3 (Uniswap V3)
```solidity
// Concentrated liquidity positions
// Users stake NFT LP positions
// Rewards based on liquidity and time in range
```

### CamelotV2
```solidity
// Standard AMM LP tokens
// Dynamic fees
// Compatible with spNFT positions
```

### CamelotV3
```solidity
// Concentrated liquidity on Camelot
// Arbitrum-native DEX
// Higher capital efficiency
```

### BalancerV2
```solidity
// Weighted pool LP tokens
// Multi-asset pools
// Flash swap support
```

---

## Farm Registry

The central registry tracks all deployed farms.

### Interface

```solidity
interface IFarmRegistry {
    // Get all farms ever deployed
    function getAllFarms() external view returns (address[] memory);
    
    // Get currently active farms
    function getActiveFarms() external view returns (address[] memory);
    
    // Get farm info
    function farmInfo(address farm) external view returns (
        address lpToken,
        address rewarder,
        uint256 startTime,
        uint256 endTime,
        bool isActive
    );
    
    // Total farm count
    function farmCount() external view returns (uint256);
}
```

### Events

```solidity
event FarmRegistered(
    address indexed farm,
    address indexed lpToken,
    address indexed deployer,
    uint256 startTime,
    uint256 endTime
);

event FarmDeactivated(address indexed farm);
```

---

## Farm Base Contract

All farm types inherit from a common base.

### Core Functions

```solidity
interface IFarmBase {
    // Staking token (LP or NFT)
    function stakingToken() external view returns (address);
    
    // Primary reward token
    function rewardsToken() external view returns (address);
    
    // Total staked in farm
    function totalStaked() external view returns (uint256);
    
    // Reward emission rate (per second)
    function rewardRate() external view returns (uint256);
    
    // When rewards end
    function periodFinish() external view returns (uint256);
    
    // User's staked balance
    function balanceOf(address account) external view returns (uint256);
    
    // User's pending rewards
    function earned(address account) external view returns (uint256);
    
    // Stake tokens
    function stake(uint256 amount) external;
    
    // Withdraw tokens
    function withdraw(uint256 amount) external;
    
    // Claim rewards
    function getReward() external;
    
    // Withdraw all and claim
    function exit() external;
}
```

---

## Creating a Farm

### Requirements

1. **100 USDs** - Creation fee (burned)
2. **LP Token** - Token users will stake
3. **Reward Token(s)** - Up to 4 reward tokens
4. **Duration** - Minimum 7 days
5. **Reward Amount** - Tokens to distribute

### Process

```
┌─────────────┐
│  Connect    │
│   Wallet    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Select LP  │
│   Token     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Configure  │
│   Rewards   │
│ (token,amt) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Set Farm   │
│  Duration   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Pay 100    │
│  USDs Fee   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Farm is   │
│    LIVE!    │
└─────────────┘
```

---

## APR Calculation

```solidity
// Annual Percentage Rate calculation
APR = (rewardRate × secondsPerYear × rewardPrice) 
      / (totalStaked × stakingTokenPrice) × 100

// Example:
// rewardRate = 0.1 SPA/second
// secondsPerYear = 31,536,000
// SPA price = $0.05
// totalStaked = 100,000 LP
// LP price = $2

APR = (0.1 × 31,536,000 × 0.05) / (100,000 × 2) × 100
APR = 157,680 / 200,000 × 100
APR = 78.84%
```

---

## Multi-Reward Farms

Farms can distribute up to 4 different reward tokens simultaneously.

```solidity
interface IMultiRewardFarm {
    // Add additional reward token
    function addRewardToken(
        address token,
        uint256 amount,
        uint256 duration
    ) external;
    
    // Get all reward tokens
    function getRewardTokens() external view returns (address[] memory);
    
    // Earned for specific reward token
    function earnedToken(
        address account, 
        address rewardToken
    ) external view returns (uint256);
    
    // Claim all rewards
    function getRewards() external;
}
```

---

## Security Considerations

### For Farm Creators
- Reward tokens must be standard ERC20
- Duration cannot be less than 7 days
- Rewards are locked once farm starts
- Cannot rug-pull staked user funds

### For Farmers
- Verify LP token legitimacy before staking
- Check reward token contract
- Monitor farm duration/end time
- Consider impermanent loss for AMM LP

---

## Integration Example

```typescript
import { CONTRACTS } from './config';
import { readContract, multicall } from './blockchain';

// Get all active farms
async function getActiveFarms() {
  const farms = await readContract({
    address: CONTRACTS.FARM_REGISTRY,
    abi: FarmRegistryABI,
    functionName: 'getActiveFarms',
  });
  
  return farms;
}

// Get farm details
async function getFarmDetails(farmAddress: string) {
  const [stakingToken, rewardsToken, totalStaked, rewardRate, periodFinish] = 
    await multicall([
      { address: farmAddress, abi: FarmABI, functionName: 'stakingToken' },
      { address: farmAddress, abi: FarmABI, functionName: 'rewardsToken' },
      { address: farmAddress, abi: FarmABI, functionName: 'totalStaked' },
      { address: farmAddress, abi: FarmABI, functionName: 'rewardRate' },
      { address: farmAddress, abi: FarmABI, functionName: 'periodFinish' },
    ]);
    
  const now = Math.floor(Date.now() / 1000);
  const isActive = periodFinish > now;
  
  return {
    stakingToken,
    rewardsToken,
    totalStaked,
    rewardRate,
    periodFinish,
    isActive,
    daysRemaining: isActive ? (periodFinish - now) / 86400 : 0,
  };
}

// Get user position across all farms
async function getUserFarmPositions(userAddress: string) {
  const farms = await getActiveFarms();
  
  const positions = await Promise.all(
    farms.map(async (farm) => {
      const [balance, earned] = await multicall([
        { address: farm, abi: FarmABI, functionName: 'balanceOf', args: [userAddress] },
        { address: farm, abi: FarmABI, functionName: 'earned', args: [userAddress] },
      ]);
      
      return { farm, balance, earned };
    })
  );
  
  return positions.filter(p => p.balance > 0n || p.earned > 0n);
}
```

---

## Related Documentation

- [rewarder.md](./rewarder.md) - APR-based reward distribution
- [spa-staking.md](./spa-staking.md) - SPA/veSPA/xSPA mechanics
- [addresses.md](./addresses.md) - All contract addresses
