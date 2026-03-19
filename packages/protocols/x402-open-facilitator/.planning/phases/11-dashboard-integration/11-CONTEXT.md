# Phase 11: Dashboard Integration - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Seamlessly integrate the complete rewards program into the existing dashboard. This includes navigation placement, a landing page for non-enrolled users, and polished UI flows for the tabbed rewards interface (progress, addresses, history). Creating new reward features or modifying claim logic is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Navigation placement
- Rewards entry point lives in the **WalletDropdown menu** (research found no Settings submenu exists; WalletDropdown is natural location)
- Show **notification badge when claimable** — visual indicator on menu item
- Badge **persists until user actually claims** tokens (not dismissed on view)
- Menu label: **"Rewards"** (simple, direct)

### Landing page messaging
- **Professional/clean tone** — straightforward, business-like explanation
- **Loyalty-focused framing** — "Get rewarded for using OpenFacilitator" (not token-forward)
- **Progressive disclosure** — start simple, expandable section for calculation details
- Include **progress preview** — show sample progress bar to visualize the reward journey

### View organization
- **Tabbed interface** within rewards section: Progress, Addresses, History
- **Default tab: Progress** — always land on Progress tab
- **Claim button on Progress tab** when eligible (not separate claims tab)
- **Claim history in History tab** — combined with campaign history

### Enrolled vs new user flow
- Non-enrolled users see **landing page only** (no dashboard preview)
- Enrollment via **"Get Started" button** that opens enrollment modal
- After enrollment: **direct to dashboard** (no tour or success message delay)

### Claude's Discretion
- Whether landing page is accessible after enrollment (small link vs not accessible)
- Exact badge styling and animation
- Tab visual design and transitions
- Empty state messaging within tabs

</decisions>

<specifics>
## Specific Ideas

- Rewards should feel like a natural extension of settings, not a prominent upsell
- Landing page should preview the reward journey visually (sample progress bar)
- Keep it professional — this is a loyalty program, not a crypto promo

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-dashboard-integration*
*Context gathered: 2026-01-20*
