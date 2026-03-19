# Task: Comprehensive Input Sanitization Layer

## Priority: HIGH

## Context
While Zod validates input structure, additional sanitization is needed for string inputs that flow into external systems (RPC calls, API requests, log messages).

## Requirements
1. Create input sanitization middleware applied before Zod validation:
   - Strip null bytes from all string inputs
   - Normalize Unicode (NFC form)
   - Trim whitespace
   - Reject strings exceeding max length (configurable per field, default 10KB)
2. Add specific sanitizers for common types:
   - `sanitizeAddress`: normalize to checksummed, reject if invalid
   - `sanitizeAmount`: reject negative, NaN, Infinity; validate decimal precision
   - `sanitizeNetwork`: case-insensitive matching, reject unknown
   - `sanitizeUrl`: validate scheme (https only for production), reject private IPs
3. Replace `z.record(z.any())` with strict schemas in:
   - `src/modules/alerts/index.ts` — filter parameter
   - Any other tools using `z.any()` or `z.unknown()`
4. Add input size limits at the transport layer (max request body: 1MB)
5. Log sanitization actions for security monitoring

## Acceptance Criteria
- [ ] All string inputs sanitized before processing
- [ ] Type-specific sanitizers for addresses, amounts, networks
- [ ] No `z.any()` in production tool schemas
- [ ] Request body size limit enforced
- [ ] Sanitization logged for monitoring
