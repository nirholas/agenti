# Phase 20: Recurring Payment Engine - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Subscriptions auto-renew daily with graceful handling of insufficient funds. System processes payments at midnight UTC, tries preferred chain first then alternate, and enters 7-day grace period when both chains lack funds. Users see payment status and history.

</domain>

<decisions>
## Implementation Decisions

### Payment Timing
- Daily renewals process at midnight UTC (all users same time)
- Show explicit "Processing" state when payment is being processed
- User sees processing indicator until payment confirms or fails

### Fallback Behavior
- No split payments — require full subscription amount on one chain
- If preferred chain fails, alternate chain is attempted (exact logic at Claude's discretion)
- Preference stays with user's choice even when fallback succeeds

### Grace Period UX
- Display days remaining: "5 days left to fund wallet" style countdown
- Instant reactivation when user funds wallet during grace period (don't wait for next cycle)
- Soft suspend after grace period expires — access blocked but data preserved, can reactivate anytime

### Payment History
- Minimal display: date, amount, status (success/failed)
- Show all payment attempts including failures (full transparency)
- All-time history (no rolling window cutoff)
- CSV export available for users

### Claude's Discretion
- Batch vs sequential payment processing
- Same-day retry strategy (if any)
- Exact fallback timing (immediate vs balance-check first)
- Whether to note "fallback" in history or just show chain used
- Urgency escalation colors during grace period countdown

</decisions>

<specifics>
## Specific Ideas

- Grace period is 7 days (industry standard, per v1.2 decisions)
- Processing state should be brief — blockchain confirmations are fast
- Instant reactivation important for good UX — don't punish users who fund quickly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-recurring-payment-engine*
*Context gathered: 2026-01-22*
