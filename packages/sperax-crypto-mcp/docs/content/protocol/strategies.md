# 05 - Yield Strategies

## Strategy Architecture

All strategies inherit from `BaseStrategy`:

```solidity
abstract contract BaseStrategy is IStrategy, OwnableUpgradeable {
    address public vault;           // VaultCore address
    address public collateral;      // Collateral token
    address public pToken;          // Protocol token (aToken, cToken, etc.)
    
    function deposit(uint256 _amount) external virtual;
    function withdraw(uint256 _amount) external virtual;
    function withdrawAll() external virtual;
    function checkBalance() external view virtual returns (uint256);
    function collectReward() external virtual;
}
```

---

## BaseStrategy Interface

### deposit

```solidity
/// @notice Deposit collateral into the yield protocol
/// @param _amount Amount of collateral to deposit
/// @dev Only callable by Vault
function deposit(uint256 _amount) external onlyVault;
```

### withdraw

```solidity
/// @notice Withdraw collateral from the yield protocol
/// @param _amount Amount of collateral to withdraw
/// @dev Only callable by Vault
function withdraw(uint256 _amount) external onlyVault;
```

### withdrawAll

```solidity
/// @notice Withdraw all collateral from the yield protocol
/// @dev Only callable by Vault
function withdrawAll() external onlyVault;
```

### checkBalance

```solidity
/// @notice Check current balance in the yield protocol
/// @return Current balance of collateral
function checkBalance() external view returns (uint256);
```

### collectReward

```solidity
/// @notice Collect reward tokens (AAVE, COMP, STG, etc.)
/// @dev Rewards sent to YieldReserve for conversion to USDs
function collectReward() external;
```

### collectInterest

```solidity
/// @notice Collect accrued interest
/// @dev Interest sent to YieldReserve
function collectInterest() external;
```

---

## AaveStrategy

| Property | Value |
|----------|-------|
| **Protocol** | Aave V3 |
| **Yield Token** | aToken (rebasing) |
| **Reward Token** | None (interest only) |

### State Variables

```solidity
address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
address public aToken;        // e.g., aUSDC
address public yieldReceiver; // YieldReserve
```

### Key Functions

```solidity
/// @notice Deposit to Aave lending pool
function deposit(uint256 _amount) external override onlyVault {
    IERC20(collateral).approve(AAVE_POOL, _amount);
    IPool(AAVE_POOL).supply(collateral, _amount, address(this), 0);
}

/// @notice Withdraw from Aave lending pool
function withdraw(uint256 _amount) external override onlyVault {
    IPool(AAVE_POOL).withdraw(collateral, _amount, vault);
}

/// @notice Get current balance (includes accrued interest)
function checkBalance() public view override returns (uint256) {
    return IERC20(aToken).balanceOf(address(this));
}

/// @notice Collect interest (aToken balance - principal)
function collectInterest() external override {
    uint256 balance = checkBalance();
    uint256 interest = balance - depositedBalance;
    if (interest > 0) {
        IPool(AAVE_POOL).withdraw(collateral, interest, yieldReceiver);
    }
}
```

### Events

```solidity
event Deposited(address indexed collateral, uint256 amount);
event Withdrawn(address indexed collateral, uint256 amount);
event InterestCollected(uint256 amount);
event YieldReceiverUpdated(address newYieldReceiver);
```

---

## CompoundStrategy

| Property | Value |
|----------|-------|
| **Protocol** | Compound V3 |
| **Yield Token** | cToken |
| **Reward Token** | COMP |

### State Variables

```solidity
address public cToken;           // Compound cToken
address public comptroller;      // Compound Comptroller
address public compToken;        // COMP token
address public yieldReceiver;    // YieldReserve
```

### Key Functions

```solidity
/// @notice Deposit to Compound
function deposit(uint256 _amount) external override onlyVault {
    IERC20(collateral).approve(cToken, _amount);
    ICToken(cToken).mint(_amount);
}

/// @notice Withdraw from Compound
function withdraw(uint256 _amount) external override onlyVault {
    ICToken(cToken).redeemUnderlying(_amount);
    IERC20(collateral).transfer(vault, _amount);
}

/// @notice Get current balance (cTokens converted to underlying)
function checkBalance() public view override returns (uint256) {
    uint256 cTokenBalance = IERC20(cToken).balanceOf(address(this));
    uint256 exchangeRate = ICToken(cToken).exchangeRateStored();
    return (cTokenBalance * exchangeRate) / 1e18;
}

/// @notice Collect COMP rewards
function collectReward() external override {
    IComptroller(comptroller).claimComp(address(this));
    uint256 compBalance = IERC20(compToken).balanceOf(address(this));
    if (compBalance > 0) {
        IERC20(compToken).transfer(yieldReceiver, compBalance);
    }
}
```

---

## StargateStrategy

| Property | Value |
|----------|-------|
| **Protocol** | Stargate Finance |
| **Yield Token** | S*Token |
| **Reward Token** | STG |

### State Variables

```solidity
address public stargateRouter;   // Stargate Router
address public lpStaking;        // LP staking contract
address public stgToken;         // STG reward token
uint256 public poolId;           // Stargate pool ID
address public yieldReceiver;    // YieldReserve
```

### Key Functions

```solidity
/// @notice Deposit to Stargate pool
function deposit(uint256 _amount) external override onlyVault {
    IERC20(collateral).approve(stargateRouter, _amount);
    IStargateRouter(stargateRouter).addLiquidity(poolId, _amount, address(this));
    // Stake LP tokens for STG rewards
    uint256 lpBalance = IERC20(lpToken).balanceOf(address(this));
    IERC20(lpToken).approve(lpStaking, lpBalance);
    ILPStaking(lpStaking).deposit(poolId, lpBalance);
}

/// @notice Withdraw from Stargate pool
function withdraw(uint256 _amount) external override onlyVault {
    ILPStaking(lpStaking).withdraw(poolId, _amount);
    IStargateRouter(stargateRouter).instantRedeemLocal(poolId, _amount, vault);
}

/// @notice Collect STG rewards
function collectReward() external override {
    ILPStaking(lpStaking).deposit(poolId, 0); // Triggers reward claim
    uint256 stgBalance = IERC20(stgToken).balanceOf(address(this));
    if (stgBalance > 0) {
        IERC20(stgToken).transfer(yieldReceiver, stgBalance);
    }
}
```

---

## Strategy Events (Common)

```solidity
event Deposited(address indexed collateral, uint256 amount);
event Withdrawn(address indexed collateral, uint256 amount);
event RewardCollected(address indexed rewardToken, uint256 amount);
event InterestCollected(uint256 amount);
event PTokenUpdated(address indexed newPToken);
event YieldReceiverUpdated(address indexed newYieldReceiver);
```

---

## Strategy Errors (Common)

```solidity
error OnlyVault();
error InsufficientBalance(uint256 requested, uint256 available);
error DepositFailed();
error WithdrawFailed();
error InvalidAmount();
```

---

## Strategy Allocation Flow

```
VaultCore.allocate()
       │
       ▼
CollateralManager.isValidStrategy()
       │
       ▼
Strategy.deposit()
       │
       ├── Aave: supply() → receive aToken
       ├── Compound: mint() → receive cToken
       └── Stargate: addLiquidity() → stake LP
       
VaultCore.redeem()
       │
       ▼
Strategy.withdraw()
       │
       └── Collateral → User
```

---

## Yield Collection Flow

```
Strategy.collectInterest() / collectReward()
       │
       ▼
YieldReserve (receives tokens)
       │
       ▼
YieldReserve.mintUSDs()
       │
       ├── 70% USDs → Dripper → Rebase (holders)
       │
       └── 30% USDs → SPABuyback → Burn SPA
```
