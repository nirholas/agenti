# Task: Implement Production CORS Allowlist

## Priority: HIGH

## Context
Both the HTTP server (`src/server/http.ts:53-58`) and SSE server (`src/server/sse.ts:30-34`) use `origin: "*"` which allows any website to make cross-origin requests.

## Requirements
1. Add a `CORS_ALLOWED_ORIGINS` environment variable (comma-separated list)
2. Default to `http://localhost:*` in development
3. In production, require explicit origin configuration — fail to start if not set
4. Implement origin validation function that supports exact matches and wildcard subdomains (e.g., `*.example.com`)
5. Apply the same CORS policy to the webhook server (`src/vendors/payments/webhook-server.ts`)
6. Add `Vary: Origin` header when using dynamic origins
7. Document the configuration in `.env.example`

## Acceptance Criteria
- [ ] No wildcard CORS in production mode
- [ ] Server refuses to start without CORS config in production
- [ ] Wildcard subdomain matching works correctly
- [ ] Tests for origin validation logic
