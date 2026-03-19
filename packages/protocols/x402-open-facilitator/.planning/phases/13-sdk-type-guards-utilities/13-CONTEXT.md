# Phase 13: SDK Type Guards & Utilities - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Runtime utilities for TypeScript consumers to safely handle versioned payment payloads. Includes type guards for PaymentPayload and PaymentRequirements (v1/v2), extraction utilities, and exhaustiveness checking. Does not include changes to verify/settle methods (Phase 14).

</domain>

<decisions>
## Implementation Decisions

### Type guard API
- Full naming convention: `isPaymentPayloadV1()`, `isPaymentPayloadV2()`
- Also include `isPaymentRequirementsV1()`, `isPaymentRequirementsV2()` for complete coverage
- Named exports from package (not namespaced)

### Utility scope
- `getSchemeNetwork(payload)` returns object `{ scheme, network }`
- `getVersion(payload)` returns `1 | 2` for switch statement convenience
- Minimal utilities — no full extraction suite for other fields

### Error handling
- Type guards return `false` for null/undefined input (safe, predictable)
- Unknown versions (e.g., x402Version: 3): guards return false, consumer decides
- No dedicated `isUnknownVersion()` guard

### Documentation
- No JSDoc comments — code is self-documenting
- Types provide all necessary information

### Claude's Discretion
- Whether type guards also narrow `accepted` field presence (based on TypeScript ergonomics)
- How utilities handle invalid/malformed input (throw vs return undefined)
- `assertNever` behavior (runtime throw vs compile-time only)
- Error message specificity (generic vs SDK-contextual)

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

*Phase: 13-sdk-type-guards-utilities*
*Context gathered: 2026-01-20*
