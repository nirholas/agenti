# Phase 10: Claims Engine - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can claim earned $OPEN tokens when eligible. This includes eligibility calculation (threshold met + campaign ended), proportional share calculation, SPL token transfer execution, and claim history tracking. Wallet connection was handled in Phase 9. Dashboard integration polish is Phase 11.

</domain>

<decisions>
## Implementation Decisions

### Claim Flow UX
- Two-step confirmation: Click claim → review summary → confirm → wallet signs
- Review step shows: amount being claimed + destination wallet address
- Claim button disabled (not hidden) when threshold unmet, with reason shown (e.g., "500 USDC more needed")
- When eligible after campaign ends: hero banner with celebratory claim CTA at top of rewards page

### Transaction Feedback
- Modal stays open with spinner during transfer (don't close until complete/failed)
- Success state: celebratory with confetti animation, claimed amount, Solana explorer link
- Twitter/X share button on success: pre-filled message about claiming $OPEN
- Success modal requires manual close (no auto-dismiss)

### Claim History Display
- Claims are private only — users see only their own history
- Claude's discretion on: detail level per entry, organization (list vs grouped), UI placement

### Claim Expiry
- 30-day window after campaign ends to claim rewards
- After 30 days, unclaimed rewards are forfeited

### Claude's Discretion
- Insufficient funds handling (error vs queue)
- Network failure retry behavior
- Interrupted claim handling (wallet disconnect, browser close)
- Claim history detail level and organization
- Claim history UI placement (dedicated tab vs section vs panel)

</decisions>

<specifics>
## Specific Ideas

- Hero banner should feel celebratory — user accomplished something, reward them visually
- Confetti on success makes the claim feel like an achievement
- Twitter share helps with organic marketing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-claims-engine*
*Context gathered: 2026-01-20*
