# 03 - VaultCore Contract

## Contract Overview

| Property | Value |
|----------|-------|
| **Address** | `0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca` |
| **Purpose** | Core mint/redeem logic for USDs |
| **Inherits** | OwnableUpgradeable, ReentrancyGuardUpgradeable |

---

## State Variables

```solidity
// Core addresses
address public collateralManager;   // CollateralManager contract
address public feeCalculator;       // FeeCalculator contract
address public oracle;              // MasterPriceOracle contract
address public rebaseManager;       // RebaseManager contract
address public feeVault;            // Where fees are sent (SPABuyback)

// Token
address public constant USDS = 0xD74f5255D557944cf7Dd0E45FF521520002D5748;
```

---

## Initialization

```solidity
constructor() {
    _disableInitializers();
}

function initialize() external initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
}
```

---

## Mint Functions

### mint

```solidity
/// @notice Mint USDs with collateral
/// @param _collateral Collateral token address
/// @param _collateralAmt Amount of collateral to deposit
/// @param _minUSDsAmt Minimum USDs to receive (slippage protection)
/// @param _deadline Transaction deadline timestamp
/// @return usdsMinted Amount of USDs minted
function mint(
    address _collateral,
    uint256 _collateralAmt,
    uint256 _minUSDsAmt,
    uint256 _deadline
) external nonReentrant returns (uint256 usdsMinted);
```

**Flow**:
1. Transfer collateral from user
2. Calculate USDs amount based on oracle price
3. Deduct mint fee
4. Mint USDs to user
5. Deploy collateral to default strategy

**Emits**: `Minted(address wallet, address collateral, uint256 usdsAmt, uint256 collateralAmt, uint256 feeAmt)`

### mintBySpecifyingCollateralAmt

```solidity
/// @notice Mint by specifying exact collateral amount
/// @param _collateral Collateral token address
/// @param _collateralAmt Exact collateral amount to use
/// @param _minUSDsAmt Minimum USDs to receive
/// @param _deadline Transaction deadline
/// @return usdsMinted Amount of USDs minted
function mintBySpecifyingCollateralAmt(
    address _collateral,
    uint256 _collateralAmt,
    uint256 _minUSDsAmt,
    uint256 _deadline
) external nonReentrant returns (uint256 usdsMinted);
```

### mintBySpecifyingUSDsAmt

```solidity
/// @notice Mint by specifying exact USDs amount desired
/// @param _collateral Collateral token address
/// @param _usdsAmt Exact USDs amount desired
/// @param _maxCollateralAmt Maximum collateral to spend
/// @param _deadline Transaction deadline
/// @return collateralUsed Amount of collateral used
function mintBySpecifyingUSDsAmt(
    address _collateral,
    uint256 _usdsAmt,
    uint256 _maxCollateralAmt,
    uint256 _deadline
) external nonReentrant returns (uint256 collateralUsed);
```

---

## Redeem Functions

### redeem

```solidity
/// @notice Redeem USDs for collateral
/// @param _collateral Collateral token to receive
/// @param _usdsAmt Amount of USDs to burn
/// @param _minCollateralAmt Minimum collateral to receive
/// @param _deadline Transaction deadline
/// @return collateralAmt Amount of collateral received
function redeem(
    address _collateral,
    uint256 _usdsAmt,
    uint256 _minCollateralAmt,
    uint256 _deadline
) external nonReentrant returns (uint256 collateralAmt);
```

**Flow**:
1. Burn USDs from user
2. Calculate collateral amount based on oracle price
3. Deduct redeem fee
4. Withdraw collateral from strategy
5. Transfer collateral to user

**Emits**: `Redeemed(address wallet, address collateral, uint256 usdsAmt, uint256 collateralAmt, uint256 feeAmt)`

### redeemBySpecifyingCollateralAmt

```solidity
/// @notice Redeem by specifying exact collateral to receive
/// @param _collateral Collateral token address
/// @param _collateralAmt Exact collateral amount desired
/// @param _maxUSDsAmt Maximum USDs to burn
/// @param _deadline Transaction deadline
/// @return usdsUsed Amount of USDs burned
function redeemBySpecifyingCollateralAmt(
    address _collateral,
    uint256 _collateralAmt,
    uint256 _maxUSDsAmt,
    uint256 _deadline
) external nonReentrant returns (uint256 usdsUsed);
```

---

## View Functions

### mintView

```solidity
/// @notice Preview mint output
/// @param _collateral Collateral token address
/// @param _collateralAmt Amount of collateral
/// @return usdsMinted USDs that would be minted
/// @return fee Fee amount in USDs
function mintView(
    address _collateral,
    uint256 _collateralAmt
) external view returns (uint256 usdsMinted, uint256 fee);
```

### redeemView

```solidity
/// @notice Preview redeem output
/// @param _collateral Collateral token address
/// @param _usdsAmt Amount of USDs to redeem
/// @param _strategyAddr Strategy to withdraw from
/// @return calculatedCollateralAmt Collateral that would be received
/// @return usdsBurnAmt USDs that would be burned
/// @return feeAmt Fee amount
/// @return vaultAmt Collateral from vault
/// @return strategyAmt Collateral from strategy
function redeemView(
    address _collateral,
    uint256 _usdsAmt,
    address _strategyAddr
) external view returns (
    uint256 calculatedCollateralAmt,
    uint256 usdsBurnAmt,
    uint256 feeAmt,
    uint256 vaultAmt,
    uint256 strategyAmt
);
```

---

## Rebase Function

### rebase

```solidity
/// @notice Trigger rebase to distribute yield to USDs holders
/// @dev Callable by anyone, but only executes if yield threshold met
function rebase() public {
    uint256 rebaseAmt = IRebaseManager(rebaseManager).fetchRebaseAmt();
    if (rebaseAmt > 0) {
        IUSDs(USDS).changeSupply(IUSDs(USDS).totalSupply() + rebaseAmt);
        emit RebasedUSDs(rebaseAmt);
    }
}
```

**Emits**: `RebasedUSDs(uint256 rebaseAmt)`

---

## Allocation Functions

### allocate

```solidity
/// @notice Allocate collateral to a strategy
/// @param _collateral Collateral token address
/// @param _strategy Strategy contract address
/// @param _amount Amount to allocate
/// @dev Only owner can call
function allocate(
    address _collateral,
    address _strategy,
    uint256 _amount
) external onlyOwner nonReentrant;
```

**Emits**: `Allocated(address collateral, address strategy, uint256 amount)`

---

## Admin Functions

### updateCollateralManager

```solidity
function updateCollateralManager(address _newCollateralManager) external onlyOwner;
```

### updateFeeCalculator

```solidity
function updateFeeCalculator(address _newFeeCalculator) external onlyOwner;
```

### updateOracle

```solidity
function updateOracle(address _newOracle) external onlyOwner;
```

### updateRebaseManager

```solidity
function updateRebaseManager(address _newRebaseManager) external onlyOwner;
```

### updateFeeVault

```solidity
function updateFeeVault(address _newFeeVault) external onlyOwner;
```

---

## Events

```solidity
event Minted(
    address indexed wallet,
    address indexed collateralAddr,
    uint256 usdsAmt,
    uint256 collateralAmt,
    uint256 feeAmt
);

event Redeemed(
    address indexed wallet,
    address indexed collateralAddr,
    uint256 usdsAmt,
    uint256 collateralAmt,
    uint256 feeAmt
);

event RebasedUSDs(uint256 rebaseAmt);

event Allocated(
    address indexed collateral,
    address indexed strategy,
    uint256 amount
);

event CollateralManagerUpdated(address newCollateralManager);
event FeeCalculatorUpdated(address newFeeCalculator);
event OracleUpdated(address newOracle);
event RebaseManagerUpdated(address newRebaseManager);
event FeeVaultUpdated(address newFeeVault);
```

---

## Errors

```solidity
error AllocationNotAllowed(address collateral, address strategy, uint256 amount);
error RedemptionPausedForCollateral(address collateral);
error InsufficientCollateral(address collateral, address strategy, uint256 amount, uint256 availableAmount);
error InvalidStrategy(address collateral, address strategyAddr);
error MintFailed();
error SlippageExceeded(uint256 actual, uint256 minimum);
error DeadlineExpired(uint256 deadline, uint256 currentTime);
error InvalidCollateral(address collateral);
```
