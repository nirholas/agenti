---
phase: 13-sdk-type-guards-utilities
plan: 01
subsystem: sdk
tags: [typescript, type-guards, type-narrowing, discriminated-unions]

# Dependency graph
requires:
  - phase: 12-sdk-type-definitions
    provides: PaymentPayloadV1, PaymentPayloadV2, PaymentRequirementsV1, PaymentRequirementsV2 union types
provides:
  - Runtime type guards for versioned payment types (isPaymentPayloadV1/V2, isPaymentRequirementsV1/V2)
  - Version-agnostic extraction utilities (getSchemeNetwork, getVersion)
  - Exhaustiveness checking helper (assertNever)
affects: [14-sdk-docs, future-sdk-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Type guard pattern with "value is Type" predicates for discriminated unions
    - Field presence discrimination for PaymentRequirements (no version field)
    - assertNever pattern for exhaustiveness checking in switch statements

key-files:
  created: []
  modified:
    - packages/sdk/src/utils.ts
    - packages/sdk/src/index.ts

key-decisions:
  - "PaymentPayload guards check x402Version discriminant (v1=1, v2=2)"
  - "PaymentRequirements guards use field presence (maxAmountRequired for V1, amount without maxAmountRequired for V2)"
  - "getVersion returns literal type 1 | 2 (not number) for switch exhaustiveness"
  - "All guards accept unknown type and safely handle null/undefined"

patterns-established:
  - "Type guards: Accept unknown, return 'value is Type', null-safe checks first"
  - "Extraction utilities: Accept union type, return version-agnostic data"
  - "assertNever: Parameter type never, return type never, throws Error with JSON.stringify"

# Metrics
duration: 1min 28s
completed: 2026-01-21
---

# Phase 13 Plan 01: SDK Type Guards & Utilities Summary

**Runtime type guards and extraction utilities enabling TypeScript narrowing for versioned x402 payment formats**

## Performance

- **Duration:** 1 min 28 sec
- **Started:** 2026-01-21T05:01:00Z
- **Completed:** 2026-01-21T05:02:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Type guards (isPaymentPayloadV1, isPaymentPayloadV2, isPaymentRequirementsV1, isPaymentRequirementsV2) enable compile-time type narrowing
- Version-agnostic utilities (getSchemeNetwork, getVersion) provide safe access to common fields
- Exhaustiveness checking with assertNever prevents unhandled union cases at compile time

## Task Commits

Each task was committed atomically:

1. **Task 1: Add type guards for versioned PaymentPayload and PaymentRequirements** - `9c4df82` (feat)
2. **Task 2: Add extraction utilities and exhaustiveness helper** - `15704a1` (feat)

## Files Created/Modified
- `packages/sdk/src/utils.ts` - Added 7 new exports: 4 type guards, 2 extraction utilities, 1 exhaustiveness helper
- `packages/sdk/src/index.ts` - Exported all new utilities and versioned types (PaymentPayloadV1, PaymentPayloadV2, PaymentRequirementsV1, PaymentRequirementsV2)

## Decisions Made

1. **Type guard implementation pattern:**
   - All guards accept `unknown` type (maximally permissive)
   - Null/undefined checks come first (safe early return)
   - PaymentPayload guards check `x402Version === 1` or `x402Version === 2` (discriminant)
   - PaymentRequirements guards use field presence (`'maxAmountRequired' in value`) since no version field exists

2. **getVersion returns literal type `1 | 2`:**
   - Not `number` - enables exhaustiveness checking in switch statements
   - TypeScript errors if case missing (e.g., only handles case 1, not case 2)

3. **assertNever pattern:**
   - Parameter type `never` (only reachable if not all union members handled)
   - Return type `never` (function throws, never returns)
   - Default message includes JSON.stringify for debugging

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

SDK type guards and utilities complete. Ready for documentation (Phase 14).

Key exports available:
- `isPaymentPayloadV1`, `isPaymentPayloadV2` - PaymentPayload narrowing
- `isPaymentRequirementsV1`, `isPaymentRequirementsV2` - PaymentRequirements narrowing
- `getSchemeNetwork` - Version-agnostic extraction
- `getVersion` - Literal 1 | 2 for switch statements
- `assertNever` - Exhaustiveness checking

All utilities handle edge cases (null/undefined) safely. TypeScript compilation passes with zero errors.

---
*Phase: 13-sdk-type-guards-utilities*
*Completed: 2026-01-21*
