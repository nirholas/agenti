# Errors & Events Reference

Complete reference of all errors and events emitted by Sperax protocol contracts.

---

## USDs Token

### Events

```solidity
// Standard ERC20
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);

// Rebase
event TotalSupplyUpdatedHighres(
    uint256 totalSupply,
    uint256 rebasingCredits,
    uint256 rebasingCreditsPerToken
);

// Opt-in/out
event RebaseOptIn(address indexed account);
event RebaseOptOut(address indexed account);
```

### Errors

```solidity
error InvalidAddress();
error TransferAmountExceedsBalance();
error TransferAmountExceedsAllowance();
error BurnAmountExceedsBalance();
error InsufficientAllowance();
```

---

## Vault

### Events

```solidity
// Mint/Redeem
event Minted(
    address indexed user,
    address indexed collateral,
    uint256 collateralAmount,
    uint256 usdsAmount,
    uint256 fee
);

event Redeemed(
    address indexed user,
    address indexed collateral,
    uint256 usdsAmount,
    uint256 collateralAmount,
    uint256 fee
);

// Rebase
event Rebased(uint256 rebaseAmount);

// Strategy allocation
event CollateralAllocated(
    address indexed collateral,
    address indexed strategy,
    uint256 amount
);

event CollateralWithdrawn(
    address indexed collateral,
    address indexed strategy,
    uint256 amount
);

// Admin
event FeeVaultUpdated(address indexed oldVault, address indexed newVault);
event YieldReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
event CollateralManagerUpdated(address indexed oldManager, address indexed newManager);
event RebaseManagerUpdated(address indexed oldManager, address indexed newManager);
event OracleUpdated(address indexed oldOracle, address indexed newOracle);
```

### Errors

```solidity
error InvalidAddress();
error InvalidAmount();
error MintNotAllowed();
error RedeemNotAllowed();
error CollateralNotRegistered();
error InsufficientCollateral();
error SlippageExceeded();
error DeadlineExpired();
error PriceStale();
error CollateralDepegged();
error StrategyNotValid();
error InsufficientStrategyBalance();
```

---

## Collateral Manager

### Events

```solidity
event CollateralAdded(
    address indexed collateral,
    address indexed defaultStrategy,
    uint16 baseMintFee,
    uint16 baseRedeemFee
);

event CollateralUpdated(
    address indexed collateral,
    uint16 baseMintFee,
    uint16 baseRedeemFee,
    uint16 downsidePeg,
    uint16 desiredComposition
);

event CollateralRemoved(address indexed collateral);

event StrategyAdded(address indexed collateral, address indexed strategy);
event StrategyRemoved(address indexed collateral, address indexed strategy);
event DefaultStrategyUpdated(address indexed collateral, address indexed strategy);
```

### Errors

```solidity
error CollateralAlreadyExists();
error CollateralNotFound();
error InvalidStrategy();
error StrategyAlreadyExists();
error StrategyNotFound();
error InvalidFeeParameters();
error AllocationExceedsCap();
```

---

## Rebase Manager

### Events

```solidity
event RebaseTriggered(uint256 rebaseAmount, uint256 timestamp);
event GapUpdated(uint256 oldGap, uint256 newGap);
event APRCapUpdated(uint256 oldCap, uint256 newCap);
event APRBottomUpdated(uint256 oldBottom, uint256 newBottom);
```

### Errors

```solidity
error RebaseTooSoon();
error InsufficientRebaseAmount();
error RebaseAmountBelowMinimum();
error RebaseAmountExceedsMaximum();
```

---

## Dripper

### Events

```solidity
event Dripped(uint256 amount, uint256 timestamp);
event DripRateUpdated(uint256 oldRate, uint256 newRate);
event DripDurationUpdated(uint256 oldDuration, uint256 newDuration);
event FundsAdded(uint256 amount);
event FundsCollected(uint256 amount, address indexed collector);
```

### Errors

```solidity
error NoFundsToDrip();
error DripRateTooHigh();
error InvalidDuration();
```

---

## SPA Buyback

### Events

```solidity
event SPABoughtBack(uint256 usdsSpent, uint256 spaBought, uint256 timestamp);
event SPABurned(uint256 amount, uint256 timestamp);
event BuybackExecuted(address indexed executor, uint256 amount);
event MinBuybackAmountUpdated(uint256 oldAmount, uint256 newAmount);
```

### Errors

```solidity
error BuybackAmountTooLow();
error InsufficientUSDs();
error SlippageExceeded();
error SwapFailed();
```

---

## Yield Reserve

### Events

```solidity
event YieldCollected(address indexed token, uint256 amount);
event YieldDistributed(uint256 toRebase, uint256 toBuyback);
event TokenSwapped(
    address indexed srcToken,
    address indexed dstToken,
    uint256 amountIn,
    uint256 amountOut
);
event BuybackPercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
```

### Errors

```solidity
error TokenNotAllowed();
error SwapAmountTooLow();
error InsufficientBalance();
error InvalidPercentage();
```

---

## veSPA

### Events

```solidity
event Deposit(
    address indexed provider,
    uint256 value,
    uint256 indexed locktime,
    int128 depositType,
    uint256 ts
);

event Withdraw(address indexed provider, uint256 value, uint256 ts);

event Supply(uint256 prevSupply, uint256 supply);

event LockExtended(address indexed account, uint256 newUnlockTime);
event LockIncreased(address indexed account, uint256 additionalAmount);
```

### Errors

```solidity
error LockExpired();
error LockNotExpired();
error LockTooShort();
error LockTooLong();
error NoExistingLock();
error WithdrawOldTokensFirst();
error ZeroAmount();
```

---

## xSPA

### Events

```solidity
event Vested(address indexed user, uint256 xspaAmount, uint256 vestingDays);
event Redeemed(address indexed user, uint256 xspaAmount, uint256 spaReceived);
event VestingCancelled(address indexed user, uint256 xspaReturned);
```

### Errors

```solidity
error VestingTooShort();
error VestingTooLong();
error NoActiveVesting();
error VestingNotComplete();
error InsufficientXSPA();
```

---

## Demeter Farm Registry

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
event FarmReactivated(address indexed farm);
event DeployerAdded(address indexed deployer);
event DeployerRemoved(address indexed deployer);
```

### Errors

```solidity
error FarmAlreadyExists();
error FarmNotFound();
error InvalidDeployer();
error UnauthorizedDeployer();
error FarmStillActive();
```

---

## Farm Base

### Events

```solidity
event Staked(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);
event RewardPaid(address indexed user, address indexed token, uint256 reward);
event RewardAdded(address indexed token, uint256 reward, uint256 duration);
event RewardsDurationUpdated(address indexed token, uint256 newDuration);
```

### Errors

```solidity
error ZeroAmount();
error InsufficientBalance();
error RewardPeriodNotFinished();
error RewardTooHigh();
error TokenNotStaked();
```

---

## Rewarder

### Events

```solidity
event RewardAdded(uint256 reward);
event RewardPaid(address indexed user, uint256 reward);
event RewardsDurationUpdated(uint256 newDuration);
event Recovered(address token, uint256 amount);
```

### Errors

```solidity
error RewardTooHigh();
error CannotRecoverRewardToken();
error OnlyFarm();
```

---

## Strategy Base

### Events

```solidity
event Deposited(address indexed asset, uint256 amount);
event Withdrawn(address indexed asset, uint256 amount);
event RewardHarvested(address indexed token, uint256 amount);
event HarvestIncentivePaid(address indexed harvester, uint256 amount);
```

### Errors

```solidity
error AssetNotSupported();
error InsufficientBalance();
error WithdrawalFailed();
error DepositFailed();
error HarvestFailed();
```

---

## Oracle Errors

```solidity
// Master Price Oracle
error PriceNotAvailable();
error StalePrice();
error InvalidPrice();
error OracleNotSet();

// Chainlink
error SequencerDown();
error GracePeriodNotOver();
error RoundNotComplete();
error StaleRound();
```

---

## Common Errors

```solidity
// Access Control
error Unauthorized();
error OnlyOwner();
error OnlyVault();
error OnlyGovernance();

// Validation
error ZeroAddress();
error ZeroAmount();
error InvalidParameter();
error ArrayLengthMismatch();

// State
error Paused();
error NotPaused();
error AlreadyInitialized();
error NotInitialized();

// Reentrancy
error ReentrancyGuard();
```

---

## Listening to Events

```typescript
import { createPublicClient, http, parseAbiItem } from 'viem';
import { arbitrum } from 'viem/chains';

const client = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

// Watch for USDs mints
const unwatch = client.watchContractEvent({
  address: CONTRACTS.VAULT,
  abi: VaultABI,
  eventName: 'Minted',
  onLogs: (logs) => {
    for (const log of logs) {
      console.log('Mint:', {
        user: log.args.user,
        collateral: log.args.collateral,
        amount: formatUnits(log.args.usdsAmount, 18),
      });
    }
  },
});

// Watch for rebases
client.watchContractEvent({
  address: CONTRACTS.VAULT,
  abi: VaultABI,
  eventName: 'Rebased',
  onLogs: (logs) => {
    for (const log of logs) {
      console.log('Rebase:', formatUnits(log.args.rebaseAmount, 18), 'USDs');
    }
  },
});
```

---

## Related Documentation

- [vault-core.md](./vault-core.md) - Vault contract details
- [usds-token.md](./usds-token.md) - USDs token mechanics
- [addresses.md](./addresses.md) - Contract addresses
