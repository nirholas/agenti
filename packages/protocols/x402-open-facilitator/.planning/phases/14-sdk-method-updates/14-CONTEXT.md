# Phase 14: SDK Method Updates - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Update verify/settle methods to handle both v1 and v2 payloads; export all new types from package index. Methods auto-detect version and process accordingly. All types from Phases 12-13 become part of the public API.

</domain>

<decisions>
## Implementation Decisions

### Backward compatibility
- Silent upgrade path — existing v1 code continues working unchanged
- SDK auto-detects payload version via x402Version field; consumers don't need to know
- TypeScript catches version mismatches at compile time; no runtime validation for type consistency
- Maintain old type names as aliases to union types (PaymentPayload = V1 | V2)

### Error handling
- Missing x402Version field treated as v1 (backward compat with pre-versioning payloads)
- Unrecognized version throws clear error: "Unsupported x402 version: X. SDK supports versions 1 and 2."
- verify() and settle() have consistent error behavior — same error types, same throw patterns
- Type guards return false on malformed input (never throw)

### Export organization
- Flat exports from package index — all types, guards, and methods from single import path
- Internal helpers stay private; only export what consumers need
- Exports organized alphabetically (mixed types/guards/methods)
- Minimal JSDoc — let type definitions speak for themselves, docs live separately

### Method signatures
- Single polymorphic verify() and settle() functions (no version-specific variants)
- Unified options object for both versions; version-specific options ignored if not applicable
- Early version branching internally — detect at entry, delegate to version-specific handlers

### Claude's Discretion
- Return type strategy: union vs discriminated overloads (choose most ergonomic)
- Internal code structure based on actual differences between v1 and v2

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing SDK patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-sdk-method-updates*
*Context gathered: 2026-01-21*
