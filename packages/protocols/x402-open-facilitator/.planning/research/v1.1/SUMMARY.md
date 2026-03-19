# Project Research Summary

**Project:** OpenFacilitator v1.1 SDK & Docs
**Domain:** Payment SDK versioning + developer documentation
**Researched:** 2026-01-20
**Confidence:** HIGH

## Executive Summary

The v1.1 milestone covers two independent deliverables: SDK type updates for x402 v2 compliance and a merchant refund guide. Research confirms both are low-risk, additive changes that can be completed independently with minimal coordination.

For SDK types, the @x402/core@2.2.0 package defines clear v1 and v2 PaymentPayload formats. The key structural difference is that v2 moves `scheme` and `network` inside an `accepted` object with new `resource` metadata, while v1 keeps them at the top level. The current SDK already handles both formats at runtime via string-typed `network` fields, so the changes are primarily about improving TypeScript DX with discriminated unions and version-specific type guards. This requires careful attention to TypeScript narrowing patterns to avoid breaking consumer code.

For refund documentation, the existing MDX documentation structure provides a clear pattern to follow. The refund functionality is already implemented in the SDK (`reportFailure`, `withRefundProtection`, middleware helpers) and dashboard UI. The documentation gap is straightforward to fill by extracting content from existing code examples and the dashboard integration guide.

## Key Findings

### Recommended Stack

The SDK already uses the correct stack. Updates involve type definitions only, no new dependencies required.

**Core technologies:**
- **@x402/core@2.2.0**: Source of truth for PaymentPayload types - re-export or align with these types
- **TypeScript discriminated unions**: Standard pattern for versioned types with literal discriminants
- **MDX documentation**: Dashboard already uses MDX for docs, continue same pattern

See [STACK.md](../STACK.md) for verified type definitions from @x402/core.

### Expected Features

**Must have (table stakes):**
- Type-safe version discrimination (consumers need TypeScript to narrow types correctly)
- Backward compatible `verify()` and `settle()` (existing v1 code must not break)
- Helper to extract scheme/network (version-agnostic utility function)
- Refund guide covering setup, integration, and claim lifecycle

**Should have (differentiators):**
- Type guards `isPaymentPayloadV1()` and `isPaymentPayloadV2()` (enable manual discrimination)
- Version-specific type exports (allow consumers to be explicit)
- Exhaustive checking utilities (`assertNever` helper for switch statements)
- Code examples for Hono, Express, and manual integration patterns

**Defer (v2+):**
- Auto-migration of payloads between versions (creates hidden complexity, signatures would be invalid)
- Deprecation warnings for v1 (v1 is still valid, support both equally)
- Video/screenshot documentation (code examples sufficient for v1.1)

See [FEATURES.md](../FEATURES.md) for feature analysis and recommended type patterns.

### Architecture Approach

The SDK is a standalone package (`packages/sdk/`) with clear boundaries. Type changes are isolated to `types.ts` and `utils.ts`. Documentation lives in `apps/dashboard/src/app/docs/` as MDX files with sidebar navigation managed in `Sidebar.tsx`.

**Major components affected:**
1. **types.ts** - Add PaymentPayloadV1, PaymentPayloadV2 interfaces with literal discriminants
2. **utils.ts** - Update isPaymentPayload, add version-specific guards
3. **docs/sdk/refunds/page.mdx** - New refund documentation page
4. **Sidebar.tsx** - Add navigation entry for refund guide

See [ARCHITECTURE.md](./ARCHITECTURE.md) for integration points and file locations.

### Critical Pitfalls

1. **Type guard becomes incorrect after union expansion** - The existing `isPaymentPayload()` may return true for partially valid objects. Create version-specific guards and compose them: `isPaymentPayload = isV1 || isV2`.

2. **Non-literal discriminant values prevent narrowing** - Using `x402Version: number` instead of `x402Version: 1` breaks TypeScript's ability to narrow the union. Always use literal types for discriminants.

3. **Destructuring breaks type narrowing** - Consumers who destructure before checking version lose narrowing capability. Document the "narrow first, then access properties" pattern prominently.

4. **Missing type exports** - Forgetting to export PaymentPayloadV1 and PaymentPayloadV2 forces consumers to use awkward `Extract<PaymentPayload, { x402Version: 1 }>` patterns. Export all union members explicitly.

5. **Omit/Pick break discriminated unions** - TypeScript's built-in utilities collapse unions. If needed, provide distributive versions.

See [PITFALLS.md](./PITFALLS.md) for comprehensive list with prevention strategies and TypeScript issue references.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: SDK Type Definitions

**Rationale:** Type definitions are foundational. Type guards and other utilities depend on correct interface definitions.

**Delivers:**
- PaymentPayloadV1 interface with `x402Version: 1` literal discriminant
- PaymentPayloadV2 interface with `x402Version: 2` literal and `accepted` structure
- PaymentPayload union type
- Aligned PaymentRequirements types for both versions

**Addresses:** Type-safe version discrimination, version-specific exports

**Avoids:** Pitfall #7 (non-literal discriminants) - use literal types from start

### Phase 2: SDK Type Guards & Utilities

**Rationale:** Depends on Phase 1 types. Guards enable consumers to properly narrow unions.

**Delivers:**
- `isPaymentPayloadV1()` and `isPaymentPayloadV2()` type guards
- Updated `isPaymentPayload()` that composes version-specific guards
- `getSchemeNetwork()` version-agnostic helper
- `assertNever` exhaustive checking utility

**Addresses:** Type guards, helper functions, exhaustive checking

**Avoids:** Pitfall #1 (incorrect guards) - version-specific guards composed correctly

### Phase 3: SDK Exports & Build

**Rationale:** Final SDK phase. Verify all exports, run build, update version.

**Delivers:**
- Updated `index.ts` with all new type exports
- Successful SDK build (`pnpm --filter=@openfacilitator/sdk build`)
- Updated package version (minor bump - additive changes only)

**Avoids:** Pitfall #8 (missing exports) - explicit export verification

### Phase 4: Refund Documentation

**Rationale:** Independent of SDK type changes. Can be done in parallel or after SDK phases.

**Delivers:**
- `docs/sdk/refunds/page.mdx` with full refund how-to guide
- Updated sidebar navigation
- Updated mobile navigation menu

**Addresses:** Complete refund integration guide with setup, code examples, claim lifecycle

**Avoids:** N/A - documentation phase, no pitfall risks

### Phase Ordering Rationale

- **Types before guards:** Type guards reference the types they narrow. Must define types first.
- **Guards before exports:** Need to implement guards before adding to exports.
- **SDK complete before version bump:** All SDK changes should be tested before bumping version.
- **Docs independent:** Documentation can proceed in parallel since it describes existing functionality.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1-3 (SDK):** TypeScript discriminated union patterns are well-documented. Research complete.
- **Phase 4 (Docs):** MDX documentation follows existing pattern in codebase. No research needed.

No phases require additional research. Both deliverables have clear implementation paths.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | @x402/core types verified from npm package source |
| Features | HIGH | Clear table stakes vs differentiators based on SDK consumer needs |
| Architecture | HIGH | Codebase grep found all integration points |
| Pitfalls | HIGH | TypeScript handbook + multiple GitHub issues verified patterns |

**Overall confidence:** HIGH

### Gaps to Address

- **v2 accepted field structure verification:** PRD shows accepted.scheme, but @x402/core shows PaymentRequirements as the `accepted` field type. Use @x402/core as source of truth since it's the official package.

- **Breaking change classification:** Adding discriminated union types is technically a breaking change per semver-ts.org if consumers relied on exact property types. Consider whether this warrants major version bump or if additive nature justifies minor bump. Recommendation: minor bump since existing code continues to work.

## Sources

### Primary (HIGH confidence)
- @x402/core@2.2.0 npm package (dist/cjs/mechanisms-CzuGzYsS.d.ts) - verified type definitions
- TypeScript Handbook: Narrowing - official documentation
- semver-ts.org: Breaking Changes - formal specification

### Secondary (MEDIUM confidence)
- x402 GitHub Repository (github.com/coinbase/x402) - protocol source
- Effective TypeScript: Type Guards - verified pattern guidance
- TkDodo: Omit for Discriminated Unions - utility type limitations

### Tertiary (verified via TypeScript issues)
- TypeScript #54745: Spreading widens discriminated unions
- TypeScript #48522: Non-literal discriminants don't narrow
- TypeScript #51197: Boolean discriminants unreliable

---
*Research completed: 2026-01-20*
*Ready for roadmap: yes*
