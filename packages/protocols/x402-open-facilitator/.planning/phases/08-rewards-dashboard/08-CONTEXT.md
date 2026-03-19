# Phase 8: Rewards Dashboard - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Display user progress toward earning rewards — volume tracking against threshold, estimated token rewards, and campaign timing. Users can see their standing and what they'll earn. Claiming tokens and wallet connection are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Progress visualization
- Simple horizontal progress bar that fills left to right
- Default brand color until threshold met, then turns green to celebrate
- Display format: "$12,450.00 / $50,000 (24.9%)" — amount plus percentage
- Encouraging/motivational tone when below threshold: "Keep going! $37,550 more to qualify for rewards"

### Reward estimates display
- Single number with label: "Est. Reward: ~1,234 $OPEN"
- Small inline note: "*based on current volume" to acknowledge approximate nature
- 2x multiplier shown as badge/tag next to estimate when it applies
- Show projected reward even if threshold not met: "If you qualify: ~1,234 $OPEN" to motivate

### Campaign timing
- Simple "14 days remaining" countdown format
- No urgency styling — consistent display regardless of time remaining
- When no active campaign: show historical stats only, hide timing section
- When campaign ended but claims not open: show final stats with "Rewards being calculated..." status

### Dashboard layout
- Progress bar is the hero element — most prominent on the page
- Campaign name not displayed prominently — users care about progress, not campaign naming
- Show tracked addresses with their individual volume contribution

### Claude's Discretion
- Card layout structure (single card vs multiple cards)
- Exact spacing and typography
- Animation/transition effects
- Responsive breakpoints

</decisions>

<specifics>
## Specific Ideas

- Progress bar should feel rewarding — the green celebration when hitting threshold is important
- Motivational messaging should feel helpful, not pushy or gamified
- Address breakdown helps users understand where their volume comes from

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-rewards-dashboard*
*Context gathered: 2026-01-20*
