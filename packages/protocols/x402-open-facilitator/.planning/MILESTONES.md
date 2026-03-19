# Project Milestones: OpenFacilitator

## v1.2 Subscription Wallet Overhaul (Shipped: 2026-01-23)

**Delivered:** Dedicated Subscriptions section with dual-chain (Base + Solana) recurring payments, chain preference toggle, and notification system.

**Phases completed:** 17-21 (13 plans total)

**Key accomplishments:**

- Replaced legacy embedded wallet with clean Subscriptions dashboard section
- Dual-chain wallet support (Base + Solana) with visible addresses for direct funding
- Chain preference toggle with intelligent defaults (payment history > balance > solana)
- Daily recurring payment engine with fallback logic and 7-day grace period
- Notification system: payment success/failure, low balance warnings, expiration reminders
- Built-in billing cron (node-cron, runs at midnight UTC)

**Stats:**

- 28 commits
- 5 phases, 13 plans
- 25 requirements shipped
- 2 days (2026-01-22 → 2026-01-23)
- Execution time: 43m 36s

**Git range:** `feat(17)` → `feat(21)`

**What's next:** TBD — run `/gsd:new-milestone` to define next milestone

---

## v1.1 SDK & Docs (Shipped: 2026-01-21)

**Delivered:** SDK x402 v2 type definitions with TypeScript narrowing, and comprehensive refund documentation for merchants.

**Phases completed:** 12-16 (5 plans total)

**Key accomplishments:**

- SDK x402 v2 type definitions with discriminated unions and literal version discriminants
- Runtime type guards (isPaymentPayloadV1/V2) and utilities (getSchemeNetwork, getVersion, assertNever)
- verify() and settle() methods updated with backward-compatible version validation
- Comprehensive refund documentation (331 lines) with reportFailure and withRefundProtection examples
- Whitelabel facilitator volume tracking fix with automatic enrollment markers

**Stats:**

- 44 files changed
- +2,990 / -589 lines
- 5 phases, 5 plans
- 2 days (2026-01-20 → 2026-01-21)

**Git range:** `feat(12)` → `feat(16)`

**What's next:** Dashboard polish, email notifications, Sybil detection dashboard

---

## v1.0 Rewards Program (Shipped: 2026-01-20)

**Delivered:** Complete token rewards program where users earn $OPEN tokens for payment volume processed through OpenFacilitator.

**Phases completed:** 1-11 (19 plans total)

**Key accomplishments:**

- Database foundation with rewards tables (addresses, campaigns, claims, volume_snapshots)
- Solana and EVM wallet verification with Ed25519/EIP-191 signatures
- Volume tracking engine with snapshot + live delta pattern for efficiency
- Campaign system with admin CRUD, audit logging, and status workflow
- Claims engine with proportional reward calculation and SPL token transfers
- Dashboard integration with tabbed UI, landing page, and claimable badge

**Stats:**

- 47 files created/modified
- ~5,675 lines added
- 11 phases, 19 plans
- 2 days from start to ship (2026-01-19 → 2026-01-20)

**Git range:** `docs(01)` → `docs(11)`

**What's next:** Dashboard polish, feature discoverability improvements

---
