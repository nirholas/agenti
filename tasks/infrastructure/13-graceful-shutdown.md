# Task: Implement Graceful Shutdown

## Priority: HIGH

## Context
Enterprise services must handle SIGTERM/SIGINT gracefully — drain in-flight requests, close WebSocket connections, and flush state before exiting.

## Requirements
1. Intercept `SIGTERM` and `SIGINT` signals
2. Stop accepting new connections immediately
3. Wait for in-flight requests to complete (with a configurable timeout, default 30s)
4. Close all WebSocket connections with proper close frames
5. Flush payment state to persistent storage (see task 09)
6. Close database/Redis connections cleanly
7. Cancel any pending blockchain transactions with a warning log
8. Exit with code 0 on clean shutdown, code 1 on timeout
9. Add a `/health` endpoint state transition: `healthy` -> `draining` -> `shutdown`
10. Kubernetes-compatible: respond to readiness probe with 503 during drain

## Acceptance Criteria
- [ ] SIGTERM triggers graceful drain
- [ ] In-flight requests complete within timeout
- [ ] WebSocket connections closed cleanly
- [ ] Health endpoint reflects shutdown state
- [ ] Integration test for shutdown sequence
