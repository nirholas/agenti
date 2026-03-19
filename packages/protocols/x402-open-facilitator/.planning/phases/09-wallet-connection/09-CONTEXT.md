# Phase 9: Wallet Connection - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users connect a Solana wallet to receive claimed $OPEN tokens. Claiming wallet is separate from tracked pay-to addresses — user connects any Solana wallet at claim time. The actual token transfer happens in Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Claiming wallet vs tracked addresses
- Claiming wallet is **separate** from tracked pay-to addresses
- Users can connect any Solana wallet at claim time — doesn't need to match tracked addresses
- No signature verification required — wallet connection proves ownership
- Tracked EVM/Solana addresses are for volume tracking; claiming wallet is for token receipt

### Wallet selection UX
- Claim button triggers wallet connection — no pre-setup required
- Flow: Click "Claim" → Wallet connect modal → Confirmation screen → Execute claim
- Confirmation screen shows: amount to receive, connected wallet address, "Confirm Claim" button
- User must explicitly confirm before claim executes

### Wallet change policy
- Users can connect a **different wallet each time** they claim — full flexibility
- No wallet is stored permanently to the account (ephemeral connection)
- Claim history shows receiving wallet address for each claim
- Each claim is independent — no restrictions based on previous claims

### Multi-chain claiming
- **Solana only** — $OPEN is SPL token, claiming requires Solana wallet
- Explicit messaging: "Connect Solana wallet to receive $OPEN"
- EVM-only users follow same flow — they just need to connect a Solana wallet
- No EVM claiming planned — Solana is permanent home for $OPEN

### Claude's Discretion
- Wallet persistence during claim session (ephemeral vs save for rare future claims)
- Pre-selecting already-connected wallet from Phases 3-4 vs fresh connect
- Wallet list display (all options vs auto-detect installed)
- Disconnect mid-flow handling
- Whether to show info notice when claiming wallet differs from tracked addresses

</decisions>

<specifics>
## Specific Ideas

- Claims are expected to be rare/one-time events — don't over-engineer for frequent claiming
- Connection should feel like standard DeFi claiming UX

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-wallet-connection*
*Context gathered: 2026-01-20*
