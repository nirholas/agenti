# Phase 3: Solana Address Management - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can register and prove ownership of Solana pay-to addresses. Adding a verified address enrolls the user in the rewards program. This phase covers Solana only — EVM addresses are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Verification flow
- In-app wallet connection for signing (no external/CLI signing option)
- Connect pay-to wallet → sign verification message → address saved
- If signature verification fails: clear error message, retry immediately (stay in flow)
- No unverified state — connect + sign is atomic; address only saved after successful verification

### Address input UX
- Flow: "Connect wallet to register" button → wallet adapter modal → sign → done
- After adding, show "Add another" button for registering multiple addresses
- Cannot add same address twice (unique per user)
- One address per user globally — if already registered by another user, block with error
- Reasonable limit on addresses per user (Claude decides specific number)
- When limit reached: "You've reached the maximum number of addresses"

### Address list display
- Show list of registered addresses in this phase (not deferred to Phase 5)
- Each address shows: address (truncated), chain icon, verification status, date added, volume tracked
- Allow removal of addresses from this view

### Success states
- After successful add: success modal ("Address added! Your volume will now be tracked.")
- Then returns to list view showing all registered addresses

### Enrollment entry point
- Clicking existing rewards info banner opens enrollment modal
- Modal triggers wallet connection flow

### Claude's Discretion
- Verification message format and content
- Wallet adapter configuration (which wallets to support)
- Address validation approach (format check, on-chain existence, etc.)
- Exact address limit number
- Enrollment modal copy and layout
- CTA button text
- Post-enrollment banner behavior

</decisions>

<specifics>
## Specific Ideas

- Flow should feel like "connect with your pay-to wallet to register" — clear that this is for pay-to addresses, not personal wallets
- Success modal is important — users should feel they've accomplished something

</specifics>

<deferred>
## Deferred Ideas

- EVM address support — Phase 4 (will follow same patterns)
- External/CLI signing for addresses not in browser wallets — potential future enhancement

</deferred>

---

*Phase: 03-solana-address-management*
*Context gathered: 2026-01-19*
