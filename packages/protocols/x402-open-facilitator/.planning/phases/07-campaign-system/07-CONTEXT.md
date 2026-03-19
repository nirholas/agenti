# Phase 7: Campaign System - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin CRUD for reward campaigns with configurable rules (pool amount, threshold, dates, multiplier). Users can view campaign rules and past campaign history. Single active campaign at a time. Claims engine is Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Admin Interface
- Admin can fully edit campaigns anytime (even after start) — audit changes
- Must end current campaign before creating a new one (no overlaps)
- Admin can end campaign early with confirmation — users keep earned rewards
- UI location: Claude's discretion (dedicated page, settings tab, or modal)

### Campaign Rules Display
- Show rules with worked examples ("If you process $50K of $500K total...")
- Show live total qualifying volume — users see current pool competition
- Prominent callout for 2x facilitator owner multiplier — drives adoption
- Both inline summary on dashboard AND detailed breakdown on dedicated page

### History View
- Detailed breakdown per campaign: name, dates, volume, rank, threshold status, multiplier, reward
- Show all past campaigns including ones user didn't participate in (marked accordingly)
- Most recent first (chronological)
- Lifetime stats summary at top: total rewards earned, total volume, campaigns participated

### Status Transitions
- Draft → Published workflow: admin creates draft, reviews, then publishes to make visible
- Claims auto-enable when campaign ends (no manual trigger needed)
- In-app notifications only: banner/toast for campaign start, end, claims open
- Pool rolls over: unused tokens from no-qualifier campaigns add to next campaign's pool

### Claude's Discretion
- Admin UI location and layout
- Exact notification styling and timing
- Audit log implementation details

</decisions>

<specifics>
## Specific Ideas

- Rules explanation should include a worked example so users understand their earning potential
- 2x multiplier should be highlighted as a key benefit to encourage facilitator ownership
- History should show "what you missed" for campaigns user didn't participate in

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-campaign-system*
*Context gathered: 2026-01-20*
