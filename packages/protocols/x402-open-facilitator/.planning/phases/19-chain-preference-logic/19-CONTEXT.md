# Phase 19: Chain Preference Logic - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can set their preferred payment chain (Base or Solana) with intelligent defaults and fallback behavior when preferred chain has insufficient balance. This phase covers preference UI, default logic, and fallback mechanics — not the recurring payment engine itself (Phase 20).

</domain>

<decisions>
## Implementation Decisions

### Toggle UI & Placement
- Toggle lives between the two wallet cards (centered, visually connects them)
- iOS-style sliding switch — Base on left, Solana on right
- Text labels only ("Base" and "Solana"), no logos on the toggle
- "Preferred Chain" label above the toggle

### Default Chain Logic
- Initial preference determined by first payment chain
- If no payment history: use highest balance wallet
- If both wallets empty: default to Solana
- If user paid on both chains: most recent payment chain becomes default

### Fallback Behavior
- Automatic fallback — system silently tries alternate chain if preferred has insufficient funds
- Preference stays on original chain after fallback (one-time fallback, not preference change)
- Payment history shows which chain was used, no special "fallback" indicator
- If both chains fail: enter 7-day grace period

### Preference Persistence
- Preference change takes effect immediately (next payment uses new preference)
- No confirmation dialog — toggle flips instantly
- Users can change preference anytime, including during grace period

### Claude's Discretion
- Where else (if anywhere) to display current preference beyond the toggle
- Exact toggle component styling/animation
- Any additional helper text or tooltips

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-chain-preference-logic*
*Context gathered: 2026-01-22*
