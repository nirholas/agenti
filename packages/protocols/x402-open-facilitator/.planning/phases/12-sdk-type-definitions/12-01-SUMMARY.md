---
phase: 12-sdk-type-definitions
plan: 01
subsystem: sdk
tags: [typescript, discriminated-unions, x402, versioning]

# Dependency graph
requires:
  - phase: 11-rewards-claim-api
    provides: SDK package and type definitions
provides:
  - Versioned PaymentPayload and PaymentRequirements types with discriminated unions
  - TypeScript narrowing support for x402 v1 and v2 formats
affects: [13-sdk-examples, 14-architecture-docs, 15-quickstart-guide]

# Tech tracking
tech-stack:
  added: []
  patterns: [discriminated-union-versioning, literal-type-narrowing]

key-files:
  created: []
  modified: [packages/sdk/src/types.ts, packages/sdk/src/middleware.ts]

key-decisions:
  - "Use literal types (1, 2) instead of number for x402Version to enable TypeScript narrowing"
  - "PaymentRequirements discriminated by field presence (maxAmountRequired vs amount) not version field"
  - "Middleware uses 'in' operator to check field presence for type narrowing"

patterns-established:
  - "Version suffix pattern: PaymentPayloadV1, PaymentPayloadV2"
  - "Union type exports maintain backward compatibility: PaymentPayload = V1 | V2"
  - "Type narrowing via literal discriminants enables compile-time safety"

# Metrics
duration: 2m 21s
completed: 2026-01-21
---

# Phase 12 Plan 01: SDK Type Definitions Summary

**Discriminated union types with literal version discriminants enable TypeScript consumers to narrow x402 v1 and v2 payment formats at compile-time**

## Performance

- **Duration:** 2m 21s
- **Started:** 2026-01-21T04:31:35Z
- **Completed:** 2026-01-21T04:33:56Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- PaymentPayloadV1 and PaymentPayloadV2 interfaces with literal x402Version discriminants (1 and 2)
- PaymentRequirementsV1 (maxAmountRequired) and PaymentRequirementsV2 (amount) interfaces
- Union types (PaymentPayload, PaymentRequirements) maintain backward compatibility
- Middleware updated to handle both v1 and v2 requirement formats with type narrowing

## Task Commits

Each task was committed atomically:

1. **Task 1 & 2: Define versioned interfaces** - `d5b550f` (feat)
2. **Middleware union support** - `92ca939` (fix)

## Files Created/Modified
- `packages/sdk/src/types.ts` - Added versioned PaymentPayload and PaymentRequirements interfaces with discriminated unions
- `packages/sdk/src/middleware.ts` - Updated 402 response handlers and createPaymentContext to support both v1 and v2 formats

## Decisions Made

**1. Literal types for version discriminants**
- Used `x402Version: 1` and `x402Version: 2` (literal types) instead of `x402Version: number`
- Enables TypeScript to narrow union types when checking `if (payload.x402Version === 1)`

**2. Field-based discrimination for PaymentRequirements**
- PaymentRequirements union doesn't have x402Version field
- Discriminated by checking field presence: `'maxAmountRequired' in requirements` (v1) vs `'amount' in requirements` (v2)
- Alternative would be adding version field, but kept it minimal per plan

**3. Backward-compatible union exports**
- Kept PaymentPayload and PaymentRequirements as main export names (now type aliases to unions)
- Existing code using these types continues to compile without changes
- Consumers can opt into versioned types (PaymentPayloadV1, etc.) when needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated middleware to handle PaymentRequirements union**
- **Found during:** Task 2 verification (build step)
- **Issue:** Middleware was accessing v1-only fields (maxAmountRequired, resource, description) on PaymentRequirements union, causing TypeScript errors
- **Fix:** Added type narrowing using `'maxAmountRequired' in requirements` to check version and build appropriate 402 response structure. Updated in two locations (Express and Hono middleware).
- **Files modified:** packages/sdk/src/middleware.ts
- **Verification:** SDK builds successfully with `pnpm --filter=@openfacilitator/sdk build`
- **Committed in:** 92ca939 (separate fix commit)

**2. [Rule 3 - Blocking] Updated createPaymentContext signature**
- **Found during:** Task 2 verification
- **Issue:** createPaymentContext accepted requirements parameter with only v1 fields (maxAmountRequired)
- **Fix:** Updated parameter type to accept both `maxAmountRequired` and `amount` fields, added fallback logic to check both
- **Files modified:** packages/sdk/src/middleware.ts
- **Verification:** TypeScript compilation succeeds
- **Committed in:** 92ca939 (same fix commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes essential for TypeScript compilation. No scope creep - just necessary adjustments to support union types in existing code.

## Issues Encountered

None. Plan executed smoothly with expected type system adjustments for union types.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TypeScript type definitions ready for SDK examples (Phase 13)
- Discriminated unions enable type-safe example code showing v1/v2 differences
- Architecture docs (Phase 14) can reference these patterns for version handling
- Quickstart guide (Phase 15) can use versioned types in code samples

**Ready for:** Phase 13 (SDK Examples) - can now show type narrowing in action

---
*Phase: 12-sdk-type-definitions*
*Completed: 2026-01-21*
