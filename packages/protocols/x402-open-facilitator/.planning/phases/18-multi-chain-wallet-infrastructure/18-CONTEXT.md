# Phase 18: Multi-Chain Wallet Infrastructure - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users have both Base and Solana wallets available for subscription payments with visible addresses for funding. Each wallet displays current balance with chain identifier, users can copy addresses for external funding, and see balance updates after funding.

</domain>

<decisions>
## Implementation Decisions

### Wallet Layout
- Side by side cards — two equal cards next to each other, one per chain
- Equal visual treatment — both wallets look identical, same size and prominence
- Rich card content — balance, address, copy button, chain logo/name, plus funding guidance
- Position below subscription status — status card first, then wallet cards underneath

### Balance & Chain Display
- Token amount only — e.g., '125.50 USDC' without USD equivalent
- USDC on both chains — Base wallet shows USDC, Solana wallet shows USDC
- Chain logo + name — Base logo with 'Base' text, Solana logo with 'Solana' text
- Zero balance emphasis — when balance is zero, emphasize 'Fund wallet' action prominently

### Address Copying UX
- Truncated addresses always — e.g., '0x1234...abcd', click to copy full address
- Toast notification on copy — 'Address copied!' toast appears briefly
- Inline copy button — icon sits immediately right of the truncated address
- Explorer link included — small link icon to view address on Basescan/Solscan

### Real-time Updates
- Manual refresh only — no auto-polling, user clicks refresh to check balance
- Per-card refresh icons — each wallet card has its own small refresh icon
- Balance shimmer during refresh — loading shimmer on balance area while fetching
- Subtle highlight on change — new balance briefly highlights to show it changed

### Claude's Discretion
- Exact shimmer/skeleton implementation
- Specific highlight animation (color, duration)
- Funding guidance copy and placement within card
- Error handling for failed balance fetches

</decisions>

<specifics>
## Specific Ideas

- Power-user friendly: addresses are copyable and link to explorers
- Zero-balance state should clearly guide users toward funding action
- Consistent with existing dashboard card patterns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-multi-chain-wallet-infrastructure*
*Context gathered: 2026-01-22*
