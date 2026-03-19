---
phase: 17-ui-cleanup-subscriptions-section
plan: 01
subsystem: ui
tags: [react, dropdown, radix-ui, lucide-icons, navigation]

# Dependency graph
requires:
  - phase: 11-rewards-frontend
    provides: WalletDropdown component patterns
provides:
  - UserMenu dropdown component for header
  - Archived WalletDropdown for Phase 18 reference
  - Clean header without wallet balance display
affects: [17-02-subscriptions-page, 18-multi-chain-wallets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - UserMenu for navigation instead of embedded wallet UI
    - Archive folder for preserved components

key-files:
  created:
    - apps/dashboard/src/components/user-menu.tsx
    - apps/dashboard/src/components/archive/wallet-dropdown.tsx
  modified:
    - apps/dashboard/src/components/navbar.tsx

key-decisions:
  - "User icon with chevron trigger - minimal header footprint"
  - "Subscriptions link added for wallet management"
  - "Preserved WalletDropdown in archive for Phase 18 reference"

patterns-established:
  - "Archive folder pattern: components/archive/ for preserved code"
  - "UserMenu pattern: simple icon trigger without data display"

# Metrics
duration: 3min
completed: 2026-01-22
---

# Phase 17 Plan 01: Header UserMenu Summary

**Clean UserMenu dropdown replacing WalletDropdown - user icon trigger with Dashboard/Subscriptions/Rewards links**

## Performance

- **Duration:** 2m 48s
- **Started:** 2026-01-22T15:46:34Z
- **Completed:** 2026-01-22T15:49:22Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Archived WalletDropdown to components/archive/ with preservation notes for Phase 18
- Created UserMenu component with clean dropdown (no wallet balance in header)
- Updated navbar to use UserMenu in both desktop and mobile views
- Added Subscriptions link for upcoming wallet management page

## Task Commits

Each task was committed atomically:

1. **Task 1: Archive WalletDropdown component** - `9ce7c6b` (chore) - completed in prior work
2. **Task 2: Create UserMenu component** - `3c50821` (feat)
3. **Task 3: Update navbar to use UserMenu** - `387094e` (feat)

_Note: Task 1 was already completed as part of 17-02 preparation work._

## Files Created/Modified
- `apps/dashboard/src/components/user-menu.tsx` - New UserMenu dropdown component
- `apps/dashboard/src/components/archive/wallet-dropdown.tsx` - Archived legacy component
- `apps/dashboard/src/components/navbar.tsx` - Updated to use UserMenu instead of WalletDropdown

## Decisions Made
- **User icon trigger:** Simple User icon + chevron instead of wallet balance display in header
- **Archive pattern:** Moved WalletDropdown to archive/ folder rather than deleting (users may have funds, Phase 18 needs reference)
- **Subscriptions link:** Added to UserMenu for upcoming dedicated wallet management page

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Task 1 was already completed in prior session as part of 17-02 preparation work (commit 9ce7c6b)
- No functional issues - build passes, lint passes

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Header cleanup complete
- UserMenu in place with Subscriptions link (page created in Plan 02)
- Ready for Plan 02: Subscriptions page implementation

---
*Phase: 17-ui-cleanup-subscriptions-section*
*Completed: 2026-01-22*
