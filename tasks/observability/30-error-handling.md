# Task: Standardize Error Handling and Error Responses

## Priority: MEDIUM

## Context
Error handling is inconsistent across modules. Some tools throw raw errors, others return error objects, and some swallow errors silently. Enterprise APIs need consistent, actionable error responses.

## Requirements
1. Create a standardized error hierarchy:
   ```typescript
   AgentiError (base)
   ├── ValidationError (400) — invalid input
   ├── AuthenticationError (401) — missing/invalid credentials
   ├── AuthorizationError (403) — insufficient permissions
   ├── NotFoundError (404) — resource not found
   ├── RateLimitError (429) — rate limit exceeded
   ├── ChainError (502) — blockchain/RPC error
   ├── ExternalAPIError (502) — third-party API error
   └── InternalError (500) — unexpected server error
   ```
2. Each error includes: `code`, `message`, `details`, `traceId`, `retryable`
3. Never expose stack traces or internal details in production responses
4. Add global error handler middleware
5. Map all blockchain errors to user-friendly messages (e.g., "insufficient funds", "nonce too low")
6. Add error codes catalog in documentation
7. Implement retry guidance: include `Retry-After` header for retryable errors

## Acceptance Criteria
- [ ] Error hierarchy implemented
- [ ] All tools use standardized errors
- [ ] No stack traces in production responses
- [ ] Blockchain errors mapped to friendly messages
- [ ] Error codes documented
