# Phase 2: Auth Integration - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Link rewards functionality to existing Better Auth accounts. New users register with email and can optionally add Solana wallet. Existing users link their accounts to the rewards program. Admin users are identified via ADMIN_USER_IDS config.

</domain>

<decisions>
## Implementation Decisions

### Registration Flow
- Email-first registration (email + password, then optionally add Solana address later)
- Solana address is optional at signup — can be added from dashboard
- Email verification required before account is active (verify-first)
- Post-registration lands on main dashboard with CTA to rewards (not dedicated rewards landing)

### Account Linking
- Two user types with different flows:
  - **Free users**: See prompt/banner on dashboard inviting them to join rewards; must add and verify pay-to addresses
  - **Facilitator owners**: Identified via existing database flag; volume under their domain auto-counts toward rewards
- Facilitator owner enrollment approach: Claude's discretion (auto-enroll vs one-click)
- Discovery via dashboard prompt/banner for existing Better Auth users

### Admin Experience
- Same UI with elevated controls — admins see extra tabs/buttons regular users don't see
- Admin identification via ADMIN_USER_IDS environment variable (comma-separated user IDs)
- Subtle "Admin" badge visible in header or profile area
- Admin API protection: Claude's discretion (rate limiting, audit logging, etc.)

### Error States
- Duplicate email at registration: Generic error message (doesn't reveal email exists for privacy)
- Already enrolled in rewards: Friendly message "You're already enrolled!" then show dashboard
- Expired/invalid verification link: Claude's discretion (follow Better Auth patterns)
- Error message tone: User-friendly, plain language, no technical codes

### Claude's Discretion
- Facilitator owner auto-enrollment vs explicit one-click join
- Expired verification link handling (follow Better Auth patterns)
- Admin API protection level (rate limits, audit logging)
- Badge styling and placement to match existing dashboard

</decisions>

<specifics>
## Specific Ideas

- Volume from white-labeled facilitators auto-counts without address verification — the domain association is the proof
- Main dashboard should feel like the natural home, with rewards as an integrated feature not a separate app

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-auth-integration*
*Context gathered: 2026-01-19*
