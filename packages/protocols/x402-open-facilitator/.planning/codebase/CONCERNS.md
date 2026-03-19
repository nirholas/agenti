# Codebase Concerns

**Analysis Date:** 2026-01-19

## Tech Debt

**Debug Endpoints Left in Production:**
- Issue: Temporary admin endpoints marked with TODO comments remain in codebase
- Files: `packages/server/src/routes/admin.ts` (lines 1211, 1241, 1275)
- Impact: Exposes raw facilitator data and direct domain manipulation without proper access control
- Fix approach: Remove `/facilitators/:id/raw`, `/facilitators/:id/domains`, and `/subscriptions/clear` endpoints after debugging is complete

**Missing Transaction Confirmation Monitoring:**
- Issue: Transaction status is immediately marked "success" without waiting for blockchain confirmation
- Files: `packages/server/src/routes/facilitator.ts` (line 588)
- Impact: Payment could be recorded as successful but fail on-chain; no retry mechanism
- Fix approach: Implement async confirmation monitoring service; queue transactions and poll for confirmation

**Deprecated Type Aliases and Functions:**
- Issue: Multiple deprecated aliases maintained for backward compatibility
- Files:
  - `packages/server/src/db/types.ts` (lines 187-191): `PaymentLinkRecord`, `PaymentLinkPaymentRecord`
  - `packages/server/src/db/products.ts` (lines 447-478): All `*PaymentLink*` functions
  - `packages/server/src/db/refund-wallets.ts` (line 73): `getClaimsWalletsByUser`
  - `packages/server/src/db/registered-servers.ts` (line 181): `getResourceServersByUser`
  - `packages/server/src/db/claims.ts` (line 264): `getClaimsByUser`
  - `packages/sdk/src/client.ts` (line 259): `createFacilitatorClient`
- Impact: Code bloat; confusion about which functions to use
- Fix approach: Set deprecation deadline; remove after migration window

**Inline Webhook URL Support (Legacy):**
- Issue: Products support both webhook_id (first-class) and inline webhook_url (deprecated)
- Files:
  - `packages/server/src/routes/facilitator.ts` (lines 198-241)
  - `packages/server/src/routes/admin.ts` (lines 1905, 1925)
  - `packages/server/src/db/types.ts` (lines 138-139)
- Impact: Dual code paths for webhook delivery; confusion about which to use
- Fix approach: Migrate all inline webhooks to webhook_id; remove legacy support

**Database Migration Logic in initializeDatabase:**
- Issue: Ad-hoc ALTER TABLE statements scattered throughout `initializeDatabase()`
- Files: `packages/server/src/db/index.ts` (lines 36-150)
- Impact: Hard to track schema changes; no proper migration versioning; silent errors caught and ignored
- Fix approach: Move all migrations to `packages/server/src/db/migrations/` with proper versioning

**Any Type Usage:**
- Issue: Database typed as `any` to avoid export type issues
- Files: `packages/server/src/auth/config.ts` (line 16)
- Impact: Loss of type safety for auth database operations
- Fix approach: Properly type the better-sqlite3 Database instance

## Known Bugs

**Wallet Signature Verification Not Implemented:**
- Symptoms: Claim payouts can be executed without proving wallet ownership
- Files: `packages/server/src/routes/public.ts` (lines 702-706)
- Trigger: Any authenticated user could potentially claim payouts for wallets they don't own
- Workaround: Currently relies on authentication; signature verification code is commented out

## Security Considerations

**No Rate Limiting:**
- Risk: API endpoints vulnerable to brute force attacks, DoS, and abuse
- Files: All route files under `packages/server/src/routes/`
- Current mitigation: None detected
- Recommendations: Add express-rate-limit middleware; implement per-IP and per-user limits for sensitive endpoints (auth, settle, verify)

**Debug Endpoints Without Authorization:**
- Risk: `/facilitators/:id/raw` and `/facilitators/:id/domains` endpoints have no requireAuth middleware
- Files: `packages/server/src/routes/admin.ts` (lines 1213, 1243)
- Current mitigation: None - endpoints are publicly accessible
- Recommendations: Add requireAuth middleware; remove endpoints entirely if debug is complete

**Access Token Fallback Secret:**
- Risk: ACCESS_TOKEN_SECRET falls back to derived key from ENCRYPTION_KEY or hardcoded default
- Files: `packages/server/src/routes/facilitator.ts` (lines 31-32)
- Current mitigation: Uses sha256 hash of fallback
- Recommendations: Require ACCESS_TOKEN_SECRET in production; fail startup if not set

**Console Logging of Sensitive Data:**
- Risk: Private keys, signatures, and transaction details logged to console
- Files:
  - `packages/core/src/erc3009.ts` (lines 339, 372, 387-390, 435-436)
  - `packages/core/src/facilitator.ts` (lines 435-436)
  - `packages/core/src/solana.ts` (lines 75, 90, 142-160)
- Current mitigation: None
- Recommendations: Remove sensitive data from logs; use structured logging with redaction

**Public RPC Endpoints:**
- Risk: Public RPC URLs used as defaults (rate limited, potentially unreliable)
- Files:
  - `packages/core/src/erc3009.ts` (lines 290-304)
  - `packages/core/src/chains.ts` (lines 15-153)
  - `packages/core/src/solana.ts` (lines 34, 37)
- Current mitigation: Environment variables can override
- Recommendations: Document requirement for production RPC URLs; add health checks

## Performance Bottlenecks

**Large Route Files:**
- Problem: Route handlers are monolithic files with 3000+ lines
- Files:
  - `packages/server/src/routes/facilitator.ts` (3390 lines)
  - `packages/server/src/routes/admin.ts` (3146 lines)
  - `packages/server/src/routes/public.ts` (1361 lines)
- Cause: All endpoints for a domain in single file; complex inline HTML generation
- Improvement path: Split into smaller route modules by feature; extract HTML templates

**Synchronous Database Operations:**
- Problem: better-sqlite3 operations are synchronous, blocking event loop
- Files: All files under `packages/server/src/db/`
- Cause: Library design; Express route handlers call DB synchronously
- Improvement path: Consider async alternatives for high-throughput scenarios; use worker threads for heavy queries

**No Connection Pooling:**
- Problem: Single SQLite connection shared across all requests
- Files: `packages/server/src/db/index.ts` (line 6)
- Cause: SQLite design limitation
- Improvement path: WAL mode already enabled; consider read replicas for scale

## Fragile Areas

**ERC-3009 Nonce Management:**
- Files: `packages/core/src/erc3009.ts` (lines 20-60, 80-190)
- Why fragile: In-memory nonce tracking with processing map; race conditions possible; nonce sync relies on on-chain queries
- Safe modification: Add comprehensive logging; implement distributed locking for multi-instance deployments
- Test coverage: No unit tests for NonceManager class

**Multi-Network Payment Processing:**
- Files:
  - `packages/server/src/routes/facilitator.ts` (isSolanaNetwork helper at line 189)
  - `packages/core/src/facilitator.ts` (settle method)
- Why fragile: Network detection by string matching; dual code paths for EVM vs Solana
- Safe modification: Centralize network detection; add exhaustive tests for all supported networks
- Test coverage: Only integration tests with real networks

**Cookie-Based Access Tokens:**
- Files: `packages/server/src/routes/facilitator.ts` (lines 37-66, 919-922, 2021)
- Why fragile: Custom token implementation; manual cookie parsing; token format changed (linkId -> productId)
- Safe modification: Document token format; add migration for old tokens
- Test coverage: Minimal - only route-level tests

## Scaling Limits

**In-Memory Nonce Processing Map:**
- Current capacity: Unbounded Map in memory
- Limit: Memory exhaustion under high transaction volume; lost on server restart
- Scaling path: Move to Redis or database-backed deduplication; implement TTL cleanup

**Single SQLite Database:**
- Current capacity: Single writer, multiple readers with WAL
- Limit: Write throughput limited; file-based storage limits scale
- Scaling path: Consider PostgreSQL for production; implement read replicas

## Dependencies at Risk

**better-auth (Auth Library):**
- Risk: Relatively new library; may have undiscovered security issues
- Impact: Authentication/authorization across entire application
- Migration plan: Monitor for CVEs; ensure session handling is properly tested

**viem (Ethereum Library):**
- Risk: Complex dependency for EVM interactions
- Impact: All EVM transaction signing and verification
- Migration plan: Pin versions; test thoroughly on upgrades

## Missing Critical Features

**Transaction Confirmation Webhook:**
- Problem: No async notification when transaction is confirmed on-chain
- Blocks: Reliable payment flow; customers may see "success" before funds arrive

**Retry Logic for Failed Settlements:**
- Problem: No automatic retry for transient failures
- Blocks: Reliability under network issues; manual intervention required

**Audit Logging:**
- Problem: No structured audit log for admin actions, settlements, or access
- Blocks: Compliance requirements; security incident investigation

## Test Coverage Gaps

**Unit Tests:**
- What's not tested: Core business logic, NonceManager, database operations
- Files: Most of `packages/core/src/`, `packages/server/src/db/`, `packages/server/src/services/`
- Risk: Regressions in critical payment logic
- Priority: High

**Auth Flow Testing:**
- What's not tested: Sign up, sign in, session management
- Files: `packages/server/src/server.test.ts` only tests route existence (not 404)
- Risk: Auth bugs could allow unauthorized access
- Priority: High

**Settlement Edge Cases:**
- What's not tested: Nonce conflicts, gas estimation failures, RPC timeouts
- Files: `packages/core/src/erc3009.ts`, `packages/core/src/solana.ts`
- Risk: Money-handling code has minimal test coverage
- Priority: Critical

**Webhook Delivery:**
- What's not tested: Retry logic, signature verification, timeout handling
- Files: `packages/server/src/services/webhook.ts`
- Risk: Failed webhook delivery could leave merchants unaware of payments
- Priority: Medium

---

*Concerns audit: 2026-01-19*
