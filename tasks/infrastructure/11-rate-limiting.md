# Task: Implement Enterprise Rate Limiting

## Priority: HIGH

## Context
The MCP server has no rate limiting, making it vulnerable to abuse and resource exhaustion. Enterprise deployments need per-client, per-tool, and global rate limits.

## Requirements
1. Add a rate limiting middleware using a token bucket algorithm
2. Support multiple tiers:
   - **Global**: Max requests/second across all clients (e.g., 1000 rps)
   - **Per-client**: Max requests/second per API key or session (e.g., 100 rps)
   - **Per-tool**: Configurable limits per tool category (e.g., swap tools: 10 rps, read-only: 100 rps)
3. Use Redis as the rate limit store for multi-instance deployments
4. Fall back to in-memory store for single-instance mode
5. Return standard `429 Too Many Requests` with `Retry-After` header
6. Add rate limit headers to all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
7. Configuration via environment variables and/or config file
8. Exempt health check and metrics endpoints

## Acceptance Criteria
- [ ] Token bucket rate limiter implemented
- [ ] Per-client and per-tool limits configurable
- [ ] Redis and in-memory backends supported
- [ ] Standard rate limit headers on all responses
- [ ] Load test passing at configured limits
