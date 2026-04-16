---
name: ticks
description: "Query historical tick, OHLC, and orderbook spread data from TimescaleDB. Use when analyzing price history, building candle charts, checking spread dynamics, or verifying tick recorder health for prediction market and trading data."
emoji: "📊"
---

# Tick Data

Query historical tick, OHLC, and orderbook data from TimescaleDB.

## Prerequisites

TimescaleDB tick recorder must be enabled in `clodds.config.yaml`:

```yaml
tickRecorder:
  enabled: true
  connectionString: postgres://user:pass@localhost:5432/clodds
```

Verify with `/ticks stats` — check that database connection shows "connected" and active platforms are listed.

## Commands

| Command | Description |
|---------|-------------|
| `/ticks <platform> <marketId>` | Get recent ticks (last 24h) |
| `/ticks ohlc <platform> <marketId> --outcome <id>` | Get OHLC candles |
| `/ticks spread <platform> <marketId>` | Get spread history |
| `/ticks stats` | Get tick recorder stats |

### Options

| Option | Values | Default |
|--------|--------|---------|
| `--outcome <id>` | Outcome token ID | All outcomes |
| `--interval` | `1m`, `5m`, `15m`, `1h`, `4h`, `1d` | `1h` |
| `--limit <n>` | Number of results | 100 |

## Workflow: Analyze Market Price Action

1. Check recorder is running: `/ticks stats`
2. Pull recent ticks: `/ticks polymarket 0x1234abcd`
3. Get OHLC for charting: `/ticks ohlc polymarket 0x1234 --outcome 0x5678 --interval 1h`
4. Check spread dynamics: `/ticks spread polymarket 0x1234 --limit 50`

## Output Formats

- **Ticks**: Timestamped price history with price change deltas
- **OHLC**: Candlestick data (open, high, low, close, tick count) with period change summary
- **Spread**: Orderbook spread history with mid price, depth, and statistics (avg/min/max spread)
- **Stats**: Recorder status — DB connection, total ticks recorded, buffer pending counts, last flush time, active platforms

## Error Recovery

| Issue | Fix |
|-------|-----|
| No data returned | Verify tick recorder is enabled and platform is active via `/ticks stats` |
| Connection errors | Check `connectionString` in `clodds.config.yaml` and ensure TimescaleDB is running |
| Stale data | Check "last flush time" in `/ticks stats` — if stale, recorder may need restart |
