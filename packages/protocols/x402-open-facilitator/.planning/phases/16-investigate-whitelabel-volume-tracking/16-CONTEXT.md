# Phase 16: Investigate Whitelabel Volume Tracking - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Debug why users with white-labeled facilitators see no volume tracked on rewards page. Identify root cause and fix. This is investigation + fix, not new feature work.

</domain>

<decisions>
## Implementation Decisions

### Volume Attribution
- Volume tracked at BOTH facilitator level AND aggregated to owner for rewards
- White-labeled facilitator volume counts toward the owner's total rewards
- Each facilitator maintains its own volume record

### Rewards Page Display
- Show breakdown by facilitator with individual volumes, plus total
- Default facilitator shown ONLY if it has volume (alongside white-labeled ones)
- Show ALL facilitators user owns, even those with zero volume
- Combined view - no separation between default and white-labeled facilitators

### Investigation Scope
- Focus on the reported case (code analysis), assume it's representative
- No historical data backfill - fix applies going forward only
- Local testing: Claude decides if seed data needed based on findings
- Ship when confident in code fix, verify in production

### Verification Approach
- Code confidence - ship when analysis shows clear fix
- Unit tests: Claude decides based on complexity of fix
- If multiple issues found during investigation, fix all of them

### Edge Cases
- No facilitator transfer support - ownership is permanent
- Deleted facilitators: their volume is removed from user's total
- No limit on white-labeled facilitators per user

### Claude's Discretion
- Whether to create seed data scripts for local testing
- Whether to add unit tests as part of fix
- Implementation approach for the fix itself

</decisions>

<specifics>
## Specific Ideas

- "If you can locate the issue and you're confident you've fixed it, just fix it and we'll ship and test in production"
- Combined view for default + white-labeled facilitators (no sections)

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 16-investigate-whitelabel-volume-tracking*
*Context gathered: 2026-01-21*
