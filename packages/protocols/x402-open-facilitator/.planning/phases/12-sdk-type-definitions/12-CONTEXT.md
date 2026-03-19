# Phase 12: SDK Type Definitions - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Define versioned PaymentPayload and PaymentRequirements TypeScript types with discriminated unions. Types enable compile-time narrowing when checking x402Version field. Type guards and utility functions are Phase 13; method updates are Phase 14.

</domain>

<decisions>
## Implementation Decisions

### Type Naming
- Suffix version pattern: PaymentPayloadV1, PaymentPayloadV2
- Union type exists: PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2
- PascalCase only, no abbreviations

### Export Strategy
- Flat exports from package root: `import { PaymentPayloadV1 } from '@openfacilitator/sdk'`
- Public types only — don't export internal helpers
- Augment existing exports, don't replace

### Version Literal Values
- Numeric literal discriminant: `x402Version: 1` or `x402Version: 2`
- Explicit version required on v1 payloads — all payloads have x402Version field
- Strict literals only: `1 | 2`, not generic `number`

### Backward Compatibility
- Existing PaymentPayload becomes alias to union (non-breaking)
- Migration steps documented in CHANGELOG.md

### Claude's Discretion
- Requirements type naming (match pattern or single type based on structure differences)
- File organization (co-locate guards with types or separate)
- Unknown/future version handling at type level
- Semver decision (minor vs major bump based on breakage analysis)
- Deprecation timeline for any removed types

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-sdk-type-definitions*
*Context gathered: 2026-01-20*
