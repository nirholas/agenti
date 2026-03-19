# Phase 21: Notifications & Edge Cases - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users receive timely notifications about payment status and subscription health. Covers payment success confirmations, low balance warnings, payment failure alerts, and subscription expiration reminders. Email notifications are out of scope (deferred).

</domain>

<decisions>
## Implementation Decisions

### Notification Delivery
- In-app notifications with a notification center (bell icon)
- Bell icon lives in header, next to user menu — visible on all pages
- Notifications persist until dismissed (no auto-cleanup)
- "Mark all as read" option available for bulk clearing
- Individual dismiss via X button on each notification

### Notification Timing
- Low balance warning triggers daily at billing time (not real-time)
- Low balance warnings repeat daily until resolved
- Payment success notifications appear silently in notification center (no toast)
- 3-day expiration reminder skipped if user already in grace period (grace period UI sufficient)

### Urgency & Styling
- Severity indicated by color + icon combination
  - Green check: payment success
  - Amber warning: low balance
  - Red alert: payment failure
- Unread count badge shown on bell icon (number, not just dot)
- Critical alerts (payment failure, grace period ending) have prominent styling — bolder colors, larger icons, possible background tint
- Pin critical notifications or visually distinguish from informational ones

### Edge Case Handling
- Multiple consecutive payment failures: new notification each day (shows escalating urgency)
- Billing cron failure: silent retry next day, no user notification
- Wallet funded during grace period: "Subscription restored" notification with green success styling
- Grace period expires: prominent "subscription expired" red alert explaining service suspension

### Claude's Discretion
- Exact notification component styling (spacing, shadows, animations)
- Toast implementation details if added later
- Notification database schema design
- Bell dropdown max height and scroll behavior
- Empty state when no notifications exist

</decisions>

<specifics>
## Specific Ideas

- Notifications should feel informative, not alarming — even failures should guide user to resolution
- Badge count pattern should match common conventions (red circle with white number)
- Critical alerts need to stand out but not feel like errors in the product itself

</specifics>

<deferred>
## Deferred Ideas

- Email notifications for critical alerts (payment failure, expiration) — future phase
- Push notifications / browser notifications — future phase
- Notification preferences / settings page — future phase

</deferred>

---

*Phase: 21-notifications-edge-cases*
*Context gathered: 2026-01-22*
