# Research Summary: Token Rewards Program

**Project:** OpenFacilitator Token Rewards
**Domain:** Crypto token rewards / volume-based loyalty program
**Researched:** 2026-01-19
**Confidence:** HIGH

## Executive Summary

Building a token rewards program for OpenFacilitator is well-supported by the existing stack. The project already has the key infrastructure: `@solana/web3.js`, `@solana/spl-token`, Better Auth for user management, and `better-sqlite3` for data. Only one new dependency is needed: `@noble/ed25519` for secure wallet signature verification. The architecture follows a modular pattern with five core components: Address Registry (verify wallet ownership), Volume Aggregator (track qualifying transactions), Campaign Manager (define reward rules), Rewards Account (track balances), and Claims Processor (distribute tokens).

The recommended approach is a phased build starting with address verification and volume tracking (users can see their progress), then adding the claims flow (users can receive tokens), and finally campaign management (admins can create promotional campaigns). This order respects dependencies and delivers incremental value. The v1 should focus on simplicity: one-click claiming, clear threshold display, and automatic 2x multiplier for facilitator owners.

Key risks are Sybil attacks (mitigate by collecting data for v2, not blocking in v1), rewards wallet security (use hardware multisig), and claim UX failures (extensive testing, simple flow). Securities law compliance requires framing as a loyalty program, not investment opportunity. Accept some gaming as customer acquisition cost for v1 while building detection capabilities for v2.

## Key Findings

### Recommended Stack

The existing OpenFacilitator stack handles 90% of requirements. One new library is needed for secure signature verification. See [STACK.md](./STACK.md) for detailed analysis.

**Core technologies:**
- **@noble/ed25519** (add): Wallet signature verification — SUF-CMA security, 3-5x faster than tweetnacl, audited
- **@solana/web3.js 1.98.4** (keep): Solana interactions — production stable, do NOT upgrade to 2.x yet
- **@solana/spl-token 0.4.14** (keep): Token transfers — use `createTransferCheckedInstruction` for claims
- **better-sqlite3 11.6.0** (keep): Volume aggregation — native SQL with prepared statements is sufficient

**Do NOT add:**
- tweetnacl (signature malleability vulnerability)
- Drizzle ORM (overkill for aggregation queries)
- External rewards platforms (unnecessary complexity for <10K users)

### Expected Features

See [FEATURES.md](./FEATURES.md) for full analysis with sources.

**Must have (table stakes):**
- Progress dashboard with real-time volume tracking
- Wallet ownership verification via signature
- Claim flow with on-chain SPL token transfer
- Claim history with transaction explorer links
- Clear threshold and campaign rules display
- 2x multiplier for facilitator owners (automatic)

**Should have (differentiators):**
- Multiple address support per user
- Proportional pool distribution (not fixed amounts)
- Soft anti-gaming metrics (track, don't block)
- Campaign-based time windows
- No expiration on unclaimed rewards

**Defer (v2+):**
- Leaderboards (explicit out-of-scope)
- Email notifications
- Complex tier systems
- Gamification features
- Automatic Sybil blocking

### Architecture Approach

The architecture follows an event-sourced points model where transactions drive accrual, combined with claim-based distribution. Components are decoupled: settling a payment does not depend on rewards processing. See [ARCHITECTURE.md](./ARCHITECTURE.md) for data models and flow diagrams.

**Major components:**
1. **Address Registry** — Links verified wallet addresses to user accounts
2. **Volume Aggregator** — Credits points from qualifying transactions
3. **Campaign Manager** — Defines reward rules, multipliers, time bounds
4. **Rewards Account Service** — Tracks earned/claimed/available points
5. **Claims Processor** — Validates claims, executes SPL transfers
6. **Rewards Wallet** — Holds tokens for distribution (multisig required)

**Key patterns:**
- Idempotent point crediting (transaction_id as unique key)
- Optimistic claim with rollback on transfer failure
- Event-driven accrual (decouple settlement from rewards)

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for comprehensive list with sources.

1. **Sybil/Multi-wallet gaming** — Track unique_payers metric, collect data for v2, accept as CAC for v1
2. **Wash trading for volume** — Exclude self-transfers (same from/to), track transaction diversity
3. **Securities law violations** — Frame as loyalty program, avoid price appreciation language, get legal review
4. **Rewards wallet breach** — Use 3-of-5 hardware multisig, transaction limits, time-locks for large transfers
5. **Claim UX failures** — One-click claim, clear SOL requirement display, extensive pre-launch testing

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Address Verification + Volume Tracking)

**Rationale:** Everything depends on knowing which addresses belong to which users. Cannot aggregate volume or process claims without this foundation.

**Delivers:**
- Users can link Solana wallets to their accounts
- Users can see their transaction volume and threshold progress
- Dashboard displays campaign rules and estimated rewards

**Addresses features:** Progress dashboard, address verification, campaign display, multiple address support

**Avoids pitfalls:** Data collection gaps (captures unique_payers from day 1)

**Uses stack:** @noble/ed25519 for signature verification, better-sqlite3 for storage

### Phase 2: Claims Flow (Token Distribution)

**Rationale:** Once users can see their progress, they need to be able to claim earned rewards. This is the core value delivery.

**Delivers:**
- Users can claim $OPEN tokens when eligible
- Transaction confirmation with explorer link
- Claim history display

**Addresses features:** Claim flow, claim history, 2x multiplier

**Avoids pitfalls:** Claim UX failures (one-click flow), wallet security (multisig setup)

**Uses stack:** @solana/spl-token for transfers, existing solana.ts infrastructure

**Critical pre-work:** Rewards wallet must be funded and multisig configured before this phase launches

### Phase 3: Campaign Management (Admin Tools)

**Rationale:** Core earn-and-claim works. Now add flexibility for marketing campaigns with multipliers and time-bound promotions.

**Delivers:**
- Admin UI to create/edit campaigns
- Multiplier campaigns (3x points during promo)
- Threshold campaigns (bonus at volume milestones)

**Addresses features:** Campaign-based time windows, proportional pool distribution

**Avoids pitfalls:** Campaign timing confusion (clear rules display)

### Phase 4: Anti-Gaming Analytics (Admin Dashboard)

**Rationale:** With real campaign data, analyze patterns and build enforcement rules for v2.

**Delivers:**
- Admin view of suspicious patterns
- Sybil cluster detection
- Volume diversity metrics

**Addresses features:** Soft anti-gaming metrics

**Avoids pitfalls:** Gaming (data-informed rules for future)

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Cannot claim rewards without verified addresses and tracked volume
- **Phase 2 before Phase 3:** Core functionality must work before adding campaign complexity
- **Phase 3 before Phase 4:** Need real campaign data to build meaningful analytics
- **2x multiplier in Phase 2:** Depends on existing facilitator ownership check (already in auth system)

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Claims):** SPL token transfer edge cases, ATA creation costs, error handling

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-documented ed25519 verification, standard SQLite patterns
- **Phase 3 (Campaigns):** Standard CRUD, existing admin patterns in codebase
- **Phase 4 (Analytics):** Query patterns, no new technology

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing libraries proven, @noble/ed25519 well-audited |
| Features | MEDIUM | Based on competitor analysis, some assumptions about user expectations |
| Architecture | HIGH | Matches existing codebase patterns, well-documented loyalty patterns |
| Pitfalls | HIGH | Extensive 2024-2025 data from token launches and security incidents |

**Overall confidence:** HIGH

### Gaps to Address

- **Token conversion rate:** Research did not determine $OPEN per point ratio. Define during campaign design.
- **Rewards pool size:** 20M $OPEN mentioned in features but not confirmed. Requires business decision.
- **Legal review:** Securities compliance flagged but not resolved. Engage crypto-specialized counsel before launch.
- **Fee subsidization:** Whether to pay for user ATA creation. Cost vs UX tradeoff for Phase 2 planning.

## Sources

### Primary (HIGH confidence)
- @noble/ed25519 npm and GitHub (security properties, benchmarks)
- @solana/web3.js and @solana/spl-token official documentation
- Solana Cookbook (sign message, token transfers)
- SEC crypto guidance and enforcement data

### Secondary (MEDIUM confidence)
- MetaMask Rewards, Trust Wallet Premium (competitor feature analysis)
- Drift Protocol FUEL (proportional distribution model)
- The Block, DeepStrike (2025 crypto security incidents)
- TokenTax, CoinLedger (tax reporting requirements)

### Tertiary (LOW confidence)
- @web3auth/sign-in-with-solana (low npm adoption, consider direct verification instead)

---
*Research completed: 2026-01-19*
*Ready for roadmap: yes*
