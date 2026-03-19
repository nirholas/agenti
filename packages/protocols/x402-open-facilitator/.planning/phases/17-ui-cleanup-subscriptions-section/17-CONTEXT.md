# Phase 17: UI Cleanup & Subscriptions Section - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove legacy embedded wallet UI from header; create new Subscriptions section in dashboard showing subscription status, billing info, and payment history. The existing Solana wallet remains functional (users may have funds there) — this phase focuses on UI reorganization, not wallet replacement.

</domain>

<decisions>
## Implementation Decisions

### Subscriptions page layout
- Multiple cards layout (separate cards for Status, Billing Info, Payment History)
- Card arrangement: Claude's discretion based on content hierarchy
- Visual style: Use existing dashboard card styles (standard components)
- Page header: Title + description ("Subscriptions" + brief explainer text)

### Status display
- Four distinct status states with visual treatment:
  - Active (green)
  - Pending (yellow) — awaiting payment or in grace period
  - Inactive/Expired (red) — subscription lapsed
  - Never subscribed (neutral)
- No tier name shown (single tier product)
- Daily subscription cost shown in billing card, not status card
- "Never subscribed" users see Subscribe CTA
- Status prominence, CTAs for inactive/pending, and next billing date placement: Claude's discretion

### Payment history presentation
- Include ALL payment attempts (both successful and failed)
- Failed payments shown with clear "Failed" status
- Transaction hashes: Truncated display (0x1234...abcd) that links to block explorer
- Display format and default history length: Claude's discretion

### Header redesign (legacy wallet removal)
- Remove embedded wallet button from header entirely
- Replace with user icon + dropdown menu
- Dropdown contains:
  - Profile/Settings link
  - Subscriptions link
  - Logout option
- No transition notice for users about the change

### Claude's Discretion
- Card arrangement within the page
- Status badge prominence/sizing
- Appropriate CTAs for inactive/pending states
- Next billing date placement (status vs billing card)
- Payment history format (table vs cards)
- Default history length and pagination

</decisions>

<specifics>
## Specific Ideas

- Keep existing Solana embedded wallet functional — users may have funds there
- Header should have a "plain user menu" feel — just user icon + dropdown
- Phase 18 will add Base wallet alongside existing Solana wallet

</specifics>

<deferred>
## Deferred Ideas

- **Private key export for wallets** — Add to Phase 18 (Multi-Chain Wallet Infrastructure)
- Base wallet implementation — Phase 18

</deferred>

---

*Phase: 17-ui-cleanup-subscriptions-section*
*Context gathered: 2026-01-22*
