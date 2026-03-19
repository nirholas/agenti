# Task: Implement API Key Authentication

## Priority: HIGH

## Context
The HTTP server at `src/server/http.ts:45` has a comment "No authentication (or OAuth)". Enterprise deployments require authenticated access.

## Requirements
1. Implement API key authentication middleware
2. Support multiple auth methods:
   - **API Key**: via `Authorization: Bearer <key>` header or `X-API-Key` header
   - **HMAC Signature**: for server-to-server communication (timestamp + body hash)
3. API key management:
   - Generate keys with configurable permissions (read-only, trade, admin)
   - Key rotation support (grace period for old keys)
   - Key revocation
4. Store keys hashed (SHA-256) — never store plaintext
5. Add auth bypass for health/metrics endpoints
6. Add `AUTH_REQUIRED` environment variable (default `true` in production, `false` in development)
7. Log all authentication attempts (success and failure) with IP address
8. Implement brute-force protection (lockout after 10 failed attempts)

## Acceptance Criteria
- [ ] API key auth middleware integrated
- [ ] HMAC signature verification for server-to-server
- [ ] Key management CLI commands
- [ ] Brute-force protection active
- [ ] Auth events logged
- [ ] Tests for all auth flows
