<!-- universal-crypto-mcp | n1ch0las | 1493 -->

# Trading Strategies

<!-- Maintained by nirholas/universal-crypto-mcp | ID: 0.4.14.3 -->

Pre-built trading strategies powered by the `indicatorts` library.

These strategies combine multiple indicators to generate buy/sell signals.

---

## Trend Strategies

Strategies for identifying and following market trends.

### MACD Strategy

Uses MACD crossovers to identify trend changes.

| Tool | Description |
|------|-------------|
| `strategy_macd` | MACD crossover strategy |

**Parameters:**
- `symbol`: Trading pair (e.g., "BTC/USDT")
- `timeframe`: Candle timeframe (e.g., "1h", "4h", "1d")
- `fastPeriod`: Fast EMA period (default: 12)
- `slowPeriod`: Slow EMA period (default: 26)
- `signalPeriod`: Signal line period (default: 9)

**Signals:**
- **BUY**: MACD line crosses above signal line
- **SELL**: MACD line crosses below signal line

### Awesome Oscillator Strategy

Uses the Awesome Oscillator for momentum-based entries.

| Tool | Description |
|------|-------------|
| `strategy_awesome_oscillator` | AO zero-cross strategy |

**Signals:**
- **BUY**: AO crosses above zero
- **SELL**: AO crosses below zero

### TRIX Strategy

Triple exponential average for trend following.

| Tool | Description |
|------|-------------|
| `strategy_trix` | TRIX crossover strategy |

### Vortex Strategy

Uses positive and negative vortex indicators.

| Tool | Description |
|------|-------------|
| `strategy_vortex` | Vortex indicator strategy |

**Signals:**
- **BUY**: +VI crosses above -VI
- **SELL**: -VI crosses above +VI

### KDJ Strategy

Korean DJ indicator for trend reversals.

| Tool | Description |
|------|-------------|
| `strategy_kdj` | KDJ crossover strategy |

### Aroon Strategy

Identifies trend strength and direction.

| Tool | Description |
|------|-------------|
| `strategy_aroon` | Aroon crossover strategy |

**Signals:**
- **BUY**: Aroon Up crosses above Aroon Down
- **SELL**: Aroon Down crosses above Aroon Up

### Parabolic SAR Strategy

Stop-and-reverse trailing stop system.

| Tool | Description |
|------|-------------|
| `strategy_parabolic_sar` | PSAR trend strategy |

**Signals:**
- **BUY**: Price crosses above SAR dots
- **SELL**: Price crosses below SAR dots

### Qstick Strategy

Measures buying vs selling pressure.

| Tool | Description |
|------|-------------|
| `strategy_qstick` | Qstick strategy |

### Triple Moving Average Strategy

Uses three MAs for confirmation.

| Tool | Description |
|------|-------------|
| `strategy_triple_ma` | Triple MA crossover |

**Parameters:**
- `shortPeriod`: Short MA period (default: 5)
- `mediumPeriod`: Medium MA period (default: 20)
- `longPeriod`: Long MA period (default: 50)

### Golden Cross Strategy

Classic 50/200 MA crossover.

| Tool | Description |
|------|-------------|
| `strategy_golden_cross` | Golden cross/death cross |

**Signals:**
- **BUY (Golden Cross)**: 50 MA crosses above 200 MA
- **SELL (Death Cross)**: 50 MA crosses below 200 MA

---

## Momentum Strategies

Strategies based on momentum oscillators.

### RSI Strategy (RSI 2)

Connors RSI2 mean-reversion strategy.

| Tool | Description |
|------|-------------|
| `strategy_rsi2` | RSI(2) mean reversion |

**Parameters:**
- `oversoldThreshold`: Buy threshold (default: 10)
- `overboughtThreshold`: Sell threshold (default: 90)

**Signals:**
- **BUY**: RSI(2) drops below oversold threshold
- **SELL**: RSI(2) rises above overbought threshold

### Stochastic RSI Strategy

Combines Stochastic and RSI.

| Tool | Description |
|------|-------------|
| `strategy_stochastic_rsi` | Stochastic RSI crossover |

### Williams %R Strategy

Williams %R overbought/oversold.

| Tool | Description |
|------|-------------|
| `strategy_williams_r` | Williams %R strategy |

**Signals:**
- **BUY**: Williams %R crosses above -80
- **SELL**: Williams %R crosses below -20

### Ichimoku Strategy

Full Ichimoku cloud analysis.

| Tool | Description |
|------|-------------|
| `strategy_ichimoku` | Ichimoku cloud strategy |

**Signals:**
- **BUY**: Price crosses above cloud, Tenkan > Kijun
- **SELL**: Price crosses below cloud, Tenkan < Kijun

### PPO Strategy

Percentage Price Oscillator.

| Tool | Description |
|------|-------------|
| `strategy_ppo` | PPO signal strategy |

### Chaikin Oscillator Strategy

Volume-based momentum.

| Tool | Description |
|------|-------------|
| `strategy_chaikin` | Chaikin oscillator strategy |

---

## Volatility Strategies

Strategies based on volatility indicators.

### Bollinger Bands Strategy

Classic Bollinger Band mean-reversion.

| Tool | Description |
|------|-------------|
| `strategy_bollinger_bands` | BB breakout/reversal |

**Parameters:**
- `period`: BB period (default: 20)
- `stdDev`: Standard deviation multiplier (default: 2)

**Signals:**
- **BUY**: Price touches lower band
- **SELL**: Price touches upper band

### Keltner Channel Strategy

ATR-based channel breakouts.

| Tool | Description |
|------|-------------|
| `strategy_keltner_channel` | Keltner breakout |

**Signals:**
- **BUY**: Price breaks above upper channel
- **SELL**: Price breaks below lower channel

### Donchian Channel Strategy

Turtle trading breakout system.

| Tool | Description |
|------|-------------|
| `strategy_donchian` | Donchian breakout |

**Signals:**
- **BUY**: Price breaks 20-day high
- **SELL**: Price breaks 20-day low

---

## Volume Strategies

Strategies incorporating volume analysis.

### OBV Strategy

On-Balance Volume trend confirmation.

| Tool | Description |
|------|-------------|
| `strategy_obv` | OBV trend strategy |

**Signals:**
- **BUY**: Price makes new low but OBV doesn't (bullish divergence)
- **SELL**: Price makes new high but OBV doesn't (bearish divergence)

### CMF Strategy

Chaikin Money Flow accumulation/distribution.

| Tool | Description |
|------|-------------|
| `strategy_cmf` | CMF strategy |

**Signals:**
- **BUY**: CMF crosses above +0.05
- **SELL**: CMF crosses below -0.05

### MFI Strategy

Money Flow Index overbought/oversold.

| Tool | Description |
|------|-------------|
| `strategy_mfi` | MFI strategy |

**Signals:**
- **BUY**: MFI crosses above 20
- **SELL**: MFI crosses below 80

### Force Index Strategy

Elder's Force Index.

| Tool | Description |
|------|-------------|
| `strategy_force_index` | Force Index strategy |

### EMV Strategy

Ease of Movement indicator.

| Tool | Description |
|------|-------------|
| `strategy_emv` | EMV strategy |

### VWAP Strategy

Volume Weighted Average Price intraday.

| Tool | Description |
|------|-------------|
| `strategy_vwap` | VWAP crossover |

**Signals:**
- **BUY**: Price crosses above VWAP
- **SELL**: Price crosses below VWAP

---

## Strategy Output Format

All strategies return signals in this format:

```json
{
  "symbol": "BTC/USDT",
  "timeframe": "4h",
  "strategy": "strategy_macd",
  "signal": "BUY",
  "confidence": 0.75,
  "price": 43250.50,
  "timestamp": "2026-01-22T12:00:00Z",
  "indicators": {
    "macd": 125.30,
    "signal": 98.45,
    "histogram": 26.85
  },
  "recommendation": "MACD bullish crossover detected. Consider entering long position."
}
```

### Signal Values

| Signal | Meaning |
|--------|---------|
| `BUY` | Entry signal for long position |
| `SELL` | Exit signal or short entry |
| `HOLD` | No clear signal, maintain position |

### Confidence Levels

| Confidence | Interpretation |
|------------|----------------|
| 0.9 - 1.0 | Very strong signal |
| 0.7 - 0.9 | Strong signal |
| 0.5 - 0.7 | Moderate signal |
| < 0.5 | Weak signal |

---

## Example Usage

### Single Strategy

```
Get MACD signal for Bitcoin
→ strategy_macd(symbol: "BTC/USDT", timeframe: "4h")
```

### Combined Strategies

For better accuracy, combine multiple strategies:

```
1. Check trend: strategy_golden_cross(symbol: "BTC/USDT", timeframe: "1d")
2. Time entry: strategy_rsi2(symbol: "BTC/USDT", timeframe: "4h")
3. Confirm volume: strategy_obv(symbol: "BTC/USDT", timeframe: "4h")
```

### Backtesting Approach

1. Get historical OHLCV data
2. Run strategy across historical data
3. Calculate win rate, profit factor, max drawdown
4. Optimize parameters
5. Forward test on paper trading

---

## Risk Disclaimer

⚠️ **Warning**: These strategies are for educational purposes only.

- Past performance does not guarantee future results
- Always use proper position sizing
- Set stop losses on every trade
- Never risk more than you can afford to lose
- Combine with fundamental analysis
- Test thoroughly before using real funds


<!-- EOF: n1ch0las | ucm:1493 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->