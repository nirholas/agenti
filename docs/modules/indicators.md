# Technical Indicators Module

The indicators module provides 50+ technical analysis indicators for cryptocurrency price data, powered by the `indicatorts` library.

## Indicator Categories

### Trend Indicators
| Indicator | Tool Name | Description |
|-----------|-----------|-------------|
| SMA | `indicator_sma` | Simple Moving Average |
| EMA | `indicator_ema` | Exponential Moving Average |
| WMA | `indicator_wma` | Weighted Moving Average |
| DEMA | `indicator_dema` | Double Exponential Moving Average |
| TEMA | `indicator_tema` | Triple Exponential Moving Average |
| MACD | `indicator_macd` | Moving Average Convergence Divergence |
| ADX | `indicator_adx` | Average Directional Index |
| Ichimoku | `indicator_ichimoku` | Ichimoku Cloud |
| Parabolic SAR | `indicator_psar` | Parabolic Stop and Reverse |
| SuperTrend | `indicator_supertrend` | SuperTrend indicator |

### Momentum Indicators
| Indicator | Tool Name | Description |
|-----------|-----------|-------------|
| RSI | `indicator_rsi` | Relative Strength Index |
| Stochastic | `indicator_stochastic` | Stochastic Oscillator |
| CCI | `indicator_cci` | Commodity Channel Index |
| Williams %R | `indicator_williams_r` | Williams Percent Range |
| MFI | `indicator_mfi` | Money Flow Index |
| ROC | `indicator_roc` | Rate of Change |
| Momentum | `indicator_momentum` | Price Momentum |
| TSI | `indicator_tsi` | True Strength Index |

### Volatility Indicators
| Indicator | Tool Name | Description |
|-----------|-----------|-------------|
| Bollinger Bands | `indicator_bbands` | Bollinger Bands |
| ATR | `indicator_atr` | Average True Range |
| Keltner Channel | `indicator_keltner` | Keltner Channel |
| Donchian Channel | `indicator_donchian` | Donchian Channel |
| Standard Deviation | `indicator_stddev` | Price Standard Deviation |

### Volume Indicators
| Indicator | Tool Name | Description |
|-----------|-----------|-------------|
| OBV | `indicator_obv` | On-Balance Volume |
| VWAP | `indicator_vwap` | Volume Weighted Average Price |
| AD Line | `indicator_ad` | Accumulation/Distribution |
| CMF | `indicator_cmf` | Chaikin Money Flow |
| Volume Profile | `indicator_vol_profile` | Volume Profile |

## Input Schema

### Common Parameters

```typescript
z.object({
  coinId: z.string().describe('CoinGecko coin ID'),
  days: z.number().min(7).max(365).describe('Days of price history'),
  interval: z.enum(['hourly', 'daily']).default('daily'),
  period: z.number().default(14).describe('Indicator period'),
})
```

### MACD Specific

```typescript
z.object({
  coinId: z.string(),
  days: z.number(),
  fastPeriod: z.number().default(12),
  slowPeriod: z.number().default(26),
  signalPeriod: z.number().default(9),
})
```

## Response Format

### RSI Response
```json
{
  "success": true,
  "data": {
    "indicator": "RSI",
    "period": 14,
    "current": 65.4,
    "signal": "neutral",
    "values": [58.2, 61.5, 63.1, 65.4],
    "interpretation": "RSI at 65.4 indicates moderate bullish momentum. Not yet overbought (>70)."
  }
}
```

## Signal Interpretation

| Indicator | Bullish Signal | Bearish Signal |
|-----------|---------------|----------------|
| RSI | Crosses above 30 (oversold exit) | Crosses below 70 (overbought exit) |
| MACD | MACD crosses above signal | MACD crosses below signal |
| Bollinger | Price touches lower band | Price touches upper band |
| Stochastic | %K crosses above %D below 20 | %K crosses below %D above 80 |
| ADX | DI+ > DI- with ADX > 25 | DI- > DI+ with ADX > 25 |

## Common Workflows

### Multi-Indicator Analysis
1. Calculate RSI for momentum context
2. Check MACD for trend direction
3. Overlay Bollinger Bands for volatility
4. Confirm with volume indicators (OBV, VWAP)
5. Synthesize signals for trading decision
