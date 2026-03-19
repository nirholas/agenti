# Phase 5: Address UI - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage their portfolio of tracked addresses — view all addresses with verification status, remove addresses, and handle multiple addresses across both Solana and EVM chains. Adding new addresses uses the existing enrollment modal from Phase 3/4.

</domain>

<decisions>
## Implementation Decisions

### List layout & display
- Grouped by chain — Solana section, then EVM section with clear separation
- Card format — each address in its own card with visual breathing room
- Address display — truncated middle format (0x1234...abcd)
- Metadata per card — address, chain icon, status badge, plus activity info (last transaction date or volume hint if available)

### Status indicators
- Badge + icon combination — color-coded badge (Green "Verified", Yellow "Pending") with accompanying icon for maximum clarity
- Inline verify button — unverified/pending addresses show verify button directly on the card
- Unverified appearance — both visual dimming (faded cards) AND warning text explaining rewards won't track until verified
- No expiry — once verified, always verified

### Remove flow
- Three-dot menu — menu with "Remove" option among other actions (not exposed delete icon)
- Always confirm — modal dialog: "Remove this address? Volume history will be preserved."
- Last address warning — allow removal of last verified address, but warn they'll stop earning rewards
- Single removal only — no batch selection, remove one at a time

### Empty & edge states
- Empty state — friendly illustration with "Add your first address" CTA button
- Limit display — show address count "X/5 addresses" and disable add button when at 5
- Pending-only state — prominent verify prompt (banner/callout) when all addresses are unverified
- No activity — show "No activity yet" placeholder where activity data would normally appear

### Claude's Discretion
- Exact card styling and spacing
- Illustration choice for empty state
- Menu implementation details
- Loading states during removal

</decisions>

<specifics>
## Specific Ideas

No specific product references — open to standard dashboard patterns that match existing OpenFacilitator design.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-address-ui*
*Context gathered: 2026-01-19*
