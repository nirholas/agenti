# Task: Implement Structured Logging

## Priority: HIGH

## Context
The codebase uses `console.log` for logging, including sensitive trade parameters (`packages/exchanges/binance-mcp/src/tools/binanceTimeWeightedAveragePriceFutureAlgo.ts:18`). Enterprise systems need structured, leveled, redacted logging.

## Requirements
1. Integrate a structured logging library (pino or winston)
2. Log format: JSON with fields: `timestamp`, `level`, `message`, `traceId`, `module`, `data`
3. Log levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
4. Default level: `info` in production, `debug` in development
5. Implement sensitive data redaction:
   - Private keys: replace with `[REDACTED]`
   - API secrets: replace with `[REDACTED]`
   - Full addresses: show only first 6 and last 4 chars
6. Replace ALL `console.log/warn/error` calls with logger
7. Add request/response logging middleware (with body size limits)
8. Support log output destinations: stdout, file, remote (configurable)
9. Add log rotation for file output (max 100MB per file, 7 day retention)
10. Remove the production `console.log` in Binance TWAP tool

## Acceptance Criteria
- [ ] Zero `console.log` calls in production code
- [ ] All logs are structured JSON
- [ ] Sensitive data redacted in all log output
- [ ] Log levels configurable per module
- [ ] Log rotation configured
