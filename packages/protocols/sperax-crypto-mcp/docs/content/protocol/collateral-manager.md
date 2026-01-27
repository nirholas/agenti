# 04 - Collateral Manager

## Contract Overview

| Property | Value |
|----------|-------|
| **Purpose** | Manages collateral configurations and strategies |
| **Inherits** | Ownable |

---

## Collateral Base Data Structure

```solidity
struct CollateralBaseData {
    bool mintAllowed;              // Can mint with this collateral
    bool redeemAllowed;            // Can redeem for this collateral
    bool allocationAllowed;        // Can allocate to strategies
    uint16 baseMintFee;            // Base mint fee in basis points
    uint16 baseRedeemFee;          // Base redeem fee in basis points
    uint16 downsidePeg;            // Min price (9800 = $0.98)
    uint16 desiredCollateralComposition; // Target % in basis points
}
```

### Example Configuration

```solidity
CollateralBaseData({
    mintAllowed: true,
    redeemAllowed: true,
    allocationAllowed: true,
    baseMintFee: 0,        // 0%
    baseRedeemFee: 10,     // 0.1%
    downsidePeg: 9800,     // $0.98 minimum
    desiredCollateralComposition: 1000  // 10% target
})
```

---

## Strategy Data Structure

```solidity
struct CollateralStrategy {
    uint16 allocationCap;    // Max allocation % in basis points
    bool isDefault;          // Is this the default strategy
    bool isActive;           // Is strategy active
}
```

---

## State Variables

```solidity
// Core
address public immutable vault;
address[] public collaterals;

// Mappings
mapping(address => CollateralBaseData) public collateralBaseData;
mapping(address => address[]) public collateralStrategies;
mapping(address => mapping(address => CollateralStrategy)) public collateralStrategyData;
mapping(address => address) public defaultStrategy;
```

---

## Collateral Management Functions

### addCollateral

```solidity
/// @notice Add a new collateral type
/// @param _collateral Collateral token address
/// @param _data Base configuration data
function addCollateral(
    address _collateral,
    CollateralBaseData calldata _data
) external onlyOwner;
```

**Emits**: `CollateralAdded(address collateral)`

### updateCollateralData

```solidity
/// @notice Update collateral configuration
/// @param _collateral Collateral token address
/// @param _data New configuration data
function updateCollateralData(
    address _collateral,
    CollateralBaseData calldata _data
) external onlyOwner;
```

**Emits**: `CollateralDataUpdated(address collateral, CollateralBaseData data)`

### removeCollateral

```solidity
/// @notice Remove a collateral type
/// @param _collateral Collateral token address
/// @dev Cannot remove if collateral has balance in vault/strategies
function removeCollateral(address _collateral) external onlyOwner;
```

**Emits**: `CollateralRemoved(address collateral)`

---

## Strategy Management Functions

### addCollateralStrategy

```solidity
/// @notice Add a strategy for a collateral
/// @param _collateral Collateral token address
/// @param _strategy Strategy contract address
/// @param _allocationCap Maximum allocation percentage (basis points)
function addCollateralStrategy(
    address _collateral,
    address _strategy,
    uint16 _allocationCap
) external onlyOwner;
```

**Emits**: `CollateralStrategyAdded(address collateral, address strategy)`

### updateCollateralStrategy

```solidity
/// @notice Update strategy configuration
/// @param _collateral Collateral token address
/// @param _strategy Strategy contract address
/// @param _allocationCap New allocation cap
function updateCollateralStrategy(
    address _collateral,
    address _strategy,
    uint16 _allocationCap
) external onlyOwner;
```

**Emits**: `CollateralStrategyUpdated(address collateral, address strategy, uint16 allocationCap)`

### removeCollateralStrategy

```solidity
/// @notice Remove a strategy from collateral
/// @param _collateral Collateral token address
/// @param _strategy Strategy contract address
function removeCollateralStrategy(
    address _collateral,
    address _strategy
) external onlyOwner;
```

**Emits**: `CollateralStrategyRemoved(address collateral, address strategy)`

### updateDefaultStrategy

```solidity
/// @notice Set the default strategy for a collateral
/// @param _collateral Collateral token address
/// @param _strategy Strategy contract address
function updateDefaultStrategy(
    address _collateral,
    address _strategy
) external onlyOwner;
```

---

## View Functions

### getCollateralData

```solidity
/// @notice Get full collateral configuration
/// @param _collateral Collateral token address
/// @return CollateralBaseData The collateral configuration
function getCollateralData(
    address _collateral
) external view returns (CollateralBaseData memory);
```

### getAllCollaterals

```solidity
/// @notice Get all registered collateral addresses
/// @return address[] Array of collateral addresses
function getAllCollaterals() external view returns (address[] memory);
```

### getCollateralStrategies

```solidity
/// @notice Get all strategies for a collateral
/// @param _collateral Collateral token address
/// @return address[] Array of strategy addresses
function getCollateralStrategies(
    address _collateral
) external view returns (address[] memory);
```

### getStrategyData

```solidity
/// @notice Get strategy configuration for a collateral
/// @param _collateral Collateral token address
/// @param _strategy Strategy contract address
/// @return CollateralStrategy The strategy configuration
function getStrategyData(
    address _collateral,
    address _strategy
) external view returns (CollateralStrategy memory);
```

### isValidCollateral

```solidity
/// @notice Check if collateral is valid
/// @param _collateral Collateral token address
/// @return bool True if valid
function isValidCollateral(address _collateral) external view returns (bool);
```

### isValidStrategy

```solidity
/// @notice Check if strategy is valid for collateral
/// @param _collateral Collateral token address
/// @param _strategy Strategy contract address
/// @return bool True if valid
function isValidStrategy(
    address _collateral,
    address _strategy
) external view returns (bool);
```

---

## Events

```solidity
event CollateralAdded(address indexed collateral);
event CollateralRemoved(address indexed collateral);
event CollateralDataUpdated(address indexed collateral, CollateralBaseData data);
event CollateralStrategyAdded(address indexed collateral, address indexed strategy);
event CollateralStrategyRemoved(address indexed collateral, address indexed strategy);
event CollateralStrategyUpdated(address indexed collateral, address indexed strategy, uint16 allocationCap);
event DefaultStrategyUpdated(address indexed collateral, address indexed strategy);
```

---

## Errors

```solidity
error InvalidCollateral(address collateral);
error CollateralAlreadyExists(address collateral);
error CollateralNotFound(address collateral);
error InvalidStrategy(address strategy);
error StrategyAlreadyExists(address strategy);
error StrategyNotFound(address strategy);
error CollateralHasBalance(address collateral);
error InvalidAllocationCap(uint16 cap);
```

---

## Supported Collaterals (Arbitrum)

| Token | Address | Default Strategy |
|-------|---------|------------------|
| USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Aave |
| USDC.e | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | Aave |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | Compound |
| DAI | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | Aave |
| FRAX | `0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F` | Stargate |
| LUSD | `0x93b346b6BC2548dA6A1E7d98E9a421B42541425b` | Aave |
