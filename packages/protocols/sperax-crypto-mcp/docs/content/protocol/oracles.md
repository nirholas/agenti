# 07 - Oracle System

## Overview

The Sperax Oracle system provides reliable price feeds for collateral assets, SPA, and USDs. It uses multiple oracle sources with fallback mechanisms.

---

## MasterPriceOracle

### Contract Overview

| Property | Value |
|----------|-------|
| **Address** | `0x14D99412dAB1878dC01Fe7a1664cdE85896e8E50` |
| **Purpose** | Unified price oracle interface |
| **Inherits** | Ownable |

### State Variables

```solidity
mapping(address => address) public tokenPriceFeeds; // Token => Oracle
uint256 public constant PRICE_PRECISION = 1e8;      // 8 decimals
```

---

### Core Functions

#### getPrice

```solidity
/// @notice Get the price of a token in USD
/// @param _token Token address
/// @return price Price in 8 decimal precision
/// @return decimals Token decimals
function getPrice(
    address _token
) external view returns (uint256 price, uint8 decimals);
```

**Returns:**
- `price`: USD price with 8 decimals (e.g., `100000000` = $1.00)
- `decimals`: Token's decimal places

---

#### updateTokenPriceFeed

```solidity
/// @notice Update the oracle for a token
/// @param _token Token address
/// @param _priceFeed New price feed address
function updateTokenPriceFeed(
    address _token,
    address _priceFeed
) external onlyOwner;
```

---

### PriceData Struct

```solidity
struct PriceData {
    uint256 price;          // Price in 8 decimals
    uint256 lastUpdate;     // Timestamp of last update
    uint8 decimals;         // Price precision
    bool isValid;           // Whether price is fresh
}
```

---

### Events

```solidity
event PriceFeedUpdated(address indexed token, address indexed priceFeed);
event PriceRequested(address indexed token, uint256 price);
```

---

### Errors

```solidity
error PriceFeedNotSet(address token);
error StalePrice(address token, uint256 lastUpdate);
error InvalidPrice(address token, int256 price);
```

---

## ChainlinkOracle

### Contract Overview

| Property | Value |
|----------|-------|
| **Purpose** | Chainlink price feed wrapper with safety checks |
| **Inherits** | IOracle |

---

### State Variables

```solidity
/// @notice Token price feed configuration
struct TokenData {
    address priceFeed;      // Chainlink aggregator address
    uint256 maxAge;         // Maximum age for price freshness
    uint8 decimals;         // Token decimals
}

mapping(address => TokenData) public tokens;

address public sequencerUptimeFeed; // L2 sequencer uptime oracle
uint256 public constant GRACE_PERIOD = 3600; // 1 hour after sequencer restarts
```

---

### getTokenPrice

```solidity
/// @notice Get price with sequencer uptime check (for L2)
/// @param _token Token to get price for
/// @return price Price in 8 decimal precision
function getTokenPrice(
    address _token
) external view returns (uint256 price) {
    // Check L2 sequencer uptime (Arbitrum)
    if (sequencerUptimeFeed != address(0)) {
        (, int256 answer, uint256 startedAt,,) = 
            AggregatorV3Interface(sequencerUptimeFeed).latestRoundData();
        
        // Sequencer is down
        if (answer != 0) revert SequencerDown();
        
        // Grace period after restart
        if (block.timestamp < startedAt + GRACE_PERIOD) {
            revert GracePeriodNotOver();
        }
    }
    
    TokenData memory tokenData = tokens[_token];
    if (tokenData.priceFeed == address(0)) revert PriceFeedNotSet(_token);
    
    (
        uint80 roundId,
        int256 answer,
        ,
        uint256 updatedAt,
        uint80 answeredInRound
    ) = AggregatorV3Interface(tokenData.priceFeed).latestRoundData();
    
    // Validation checks
    if (answer <= 0) revert InvalidPrice(_token, answer);
    if (updatedAt == 0) revert StalePrice(_token, updatedAt);
    if (answeredInRound < roundId) revert StaleRound();
    if (block.timestamp - updatedAt > tokenData.maxAge) {
        revert PriceTooOld(_token, block.timestamp - updatedAt);
    }
    
    return uint256(answer);
}
```

---

### Chainlink Price Feeds (Arbitrum)

| Token | Price Feed Address | Heartbeat |
|-------|-------------------|-----------|
| USDC | `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` | 24h |
| USDT | `0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7` | 24h |
| DAI | `0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB` | 24h |
| FRAX | `0x0809E3d38d1B4214958faf06D8b1B1a2b73f2ab8` | 24h |
| ETH | `0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612` | 1h |
| ARB | `0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6` | 1h |
| L2 Sequencer | `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` | - |

---

### Events

```solidity
event TokenDataUpdated(address indexed token, address priceFeed, uint256 maxAge);
event SequencerUptimeFeedUpdated(address indexed newFeed);
```

---

### Errors

```solidity
error SequencerDown();
error GracePeriodNotOver();
error PriceFeedNotSet(address token);
error InvalidPrice(address token, int256 price);
error StalePrice(address token, uint256 updatedAt);
error PriceTooOld(address token, uint256 age);
error StaleRound();
```

---

## SPAOracle

### Contract Overview

| Property | Value |
|----------|-------|
| **Purpose** | SPA price from DIA + Uniswap V3 TWAP |
| **Strategy** | Weighted average of two sources |

---

### Price Sources

1. **DIA Oracle** (50% weight)
   - External oracle provider
   - Updates every 4 hours or 0.5% deviation

2. **Uniswap V3 TWAP** (50% weight)
   - On-chain TWAP from SPA/ETH pool
   - 30-minute observation window

---

### getPrice

```solidity
/// @notice Get SPA price using weighted average
/// @return price SPA price in USD (8 decimals)
function getPrice() external view returns (uint256 price) {
    // Get DIA price
    (uint256 diaPrice, ) = IDIAOracle(diaOracle).getValue("SPA/USD");
    
    // Get Uniswap V3 TWAP
    uint256 twapPrice = _getUniswapTWAP();
    
    // Weighted average (50/50)
    price = (diaPrice + twapPrice) / 2;
    
    return price;
}
```

---

### Internal TWAP Calculation

```solidity
/// @notice Calculate Uniswap V3 TWAP
/// @return price TWAP price in 8 decimals
function _getUniswapTWAP() internal view returns (uint256 price) {
    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = TWAP_PERIOD; // 1800 seconds (30 min)
    secondsAgos[1] = 0;
    
    (int56[] memory tickCumulatives, ) = 
        IUniswapV3Pool(spaEthPool).observe(secondsAgos);
    
    int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
    int24 avgTick = int24(tickDelta / int56(int32(TWAP_PERIOD)));
    
    uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(avgTick);
    
    // Convert to USD price using ETH price
    uint256 ethPrice = IOracle(masterOracle).getPrice(WETH);
    price = _calculateUSDPrice(sqrtPriceX96, ethPrice);
    
    return price;
}
```

---

### State Variables

```solidity
address public diaOracle;       // DIA oracle address
address public spaEthPool;      // Uniswap V3 SPA/ETH pool
address public masterOracle;    // For ETH price
uint32 public constant TWAP_PERIOD = 1800; // 30 minutes
```

---

## USDsOracle

### Contract Overview

| Property | Value |
|----------|-------|
| **Purpose** | USDs price from Uniswap V3 |
| **Pool** | USDs/USDC on Uniswap V3 |

---

### getPrice

```solidity
/// @notice Get USDs price from Uniswap V3 TWAP
/// @return price USDs price in USD (8 decimals)
function getPrice() external view returns (uint256 price) {
    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = TWAP_PERIOD;
    secondsAgos[1] = 0;
    
    (int56[] memory tickCumulatives, ) = 
        IUniswapV3Pool(usdsUsdcPool).observe(secondsAgos);
    
    int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
    int24 avgTick = int24(tickDelta / int56(int32(TWAP_PERIOD)));
    
    uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(avgTick);
    
    // USDs/USDC, USDC = $1, so price is direct
    price = _sqrtPriceToPrice(sqrtPriceX96);
    
    return price;
}
```

---

### State Variables

```solidity
address public usdsUsdcPool;    // Uniswap V3 USDs/USDC pool
uint32 public constant TWAP_PERIOD = 1800; // 30 minutes
uint256 public constant PRICE_PRECISION = 1e8;
```

---

## BaseUniOracle

### Contract Overview

| Property | Value |
|----------|-------|
| **Purpose** | Base class for Uniswap V3 TWAP oracles |
| **Used By** | SPAOracle, USDsOracle |

---

### Utility Functions

```solidity
/// @notice Convert sqrtPriceX96 to regular price
function _sqrtPriceToPrice(
    uint160 sqrtPriceX96
) internal pure returns (uint256 price);

/// @notice Get tick from pool observation
function _getTick(
    address pool,
    uint32 period
) internal view returns (int24 tick);

/// @notice Calculate price from tick
function _getPriceFromTick(
    int24 tick,
    uint8 token0Decimals,
    uint8 token1Decimals
) internal pure returns (uint256 price);
```

---

## Oracle Integration Diagram

```
                    ┌─────────────────────┐
                    │  MasterPriceOracle  │
                    │  getPrice(_token)   │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
   │ChainlinkOracle│   │   SPAOracle   │   │   USDsOracle  │
   │               │   │               │   │               │
   │  Collaterals  │   │  DIA + TWAP   │   │    V3 TWAP    │
   │  USDC, DAI    │   │   50/50 avg   │   │  USDs/USDC    │
   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
           │                   │                   │
           ▼                   ▼                   ▼
   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
   │   Chainlink   │   │  DIA Oracle   │   │  Uniswap V3   │
   │  Aggregators  │   │ + Uni V3 Pool │   │     Pool      │
   └───────────────┘   └───────────────┘   └───────────────┘
```

---

## Price Precision Reference

| Source | Decimals | Example ($1.00) |
|--------|----------|-----------------|
| Chainlink | 8 | `100000000` |
| DIA | 8 | `100000000` |
| Uniswap V3 | varies | Converted to 8 |
| MasterPriceOracle | 8 | `100000000` |
