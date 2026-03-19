# Phase 14: SDK Method Updates - Research

**Researched:** 2026-01-21
**Domain:** TypeScript SDK versioning and backward compatibility
**Confidence:** HIGH

## Summary

This phase updates SDK methods (`verify()` and `settle()`) to handle both v1 and v2 x402 payment formats using discriminated union patterns. The existing codebase already has comprehensive versioning infrastructure from Phases 12-13: discriminated union types, type guards, extraction utilities, and exhaustiveness checking via `assertNever()`.

The standard approach for polymorphic versioned APIs in TypeScript is to use discriminated unions with early version detection at method entry points, then delegate to version-specific handlers. The SDK must maintain backward compatibility by treating missing `x402Version` fields as v1, which is the established pattern for gradual adoption scenarios.

**Primary recommendation:** Use single polymorphic methods with union return types rather than function overloads. Early version branching with `switch` statements provides best type safety and maintainability.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.0+ | Type system with discriminated unions | Native support for exhaustive switch checking with literal discriminants |
| tsup | 8.0+ | Build tool | Already in SDK package.json - generates CJS/ESM/types |
| vitest | 1.0+ | Testing framework | Already in SDK package.json - fast unit tests |

### Supporting
Not applicable - no additional libraries needed. The SDK has all infrastructure from Phases 12-13.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single polymorphic methods | Function overloads | Overloads preferred when return type differs by input type, but here both versions return same response types (VerifyResponse/SettleResponse) |
| Union return types | Discriminated return type narrowing | Could narrow return types by version, but unnecessary since VerifyResponse and SettleResponse already version-agnostic |
| Switch statements | Type guards with if/else | Switch statements provide better exhaustiveness checking via `assertNever()` |

**Installation:**
```bash
# All dependencies already present from previous phases
pnpm --filter=@openfacilitator/sdk install
```

## Architecture Patterns

### Recommended Method Structure
```
verify() / settle()
├── Input validation (optional - type system handles)
├── Version detection (getVersion or switch on x402Version)
├── Switch statement with exhaustive checking
│   ├── case 1: Handle v1 format
│   ├── case 2: Handle v2 format
│   └── default: assertNever(version)
└── Return unified response
```

### Pattern 1: Early Version Branching
**What:** Detect version at method entry, branch immediately, keep version-specific logic isolated
**When to use:** When v1 and v2 handling differs significantly
**Example:**
```typescript
// Source: Existing SDK pattern + TypeScript discriminated union best practices
async verify(
  payment: PaymentPayload,
  requirements: PaymentRequirements
): Promise<VerifyResponse> {
  const version = getVersion(payment);

  switch (version) {
    case 1:
      return this.verifyV1(payment, requirements);
    case 2:
      return this.verifyV2(payment, requirements);
    default:
      return assertNever(version);
  }
}
```

### Pattern 2: Unified Request Body Construction
**What:** Single request body format that works for both versions, pass x402Version explicitly
**When to use:** When facilitator expects same structure but version-aware
**Example:**
```typescript
// Source: Existing client.ts lines 54-57, 84-88
const body = {
  x402Version: payment.x402Version,
  paymentPayload: payment,
  paymentRequirements: requirements,
};
```

### Pattern 3: Backward Compatibility Default
**What:** Treat missing x402Version as v1 for pre-versioning payloads
**When to use:** Always - matches decision in CONTEXT.md
**Example:**
```typescript
// Source: Best practice for gradual API adoption
const version = payment.x402Version ?? 1; // Default to v1 if missing
```

### Pattern 4: Version-Agnostic Extraction
**What:** Use `getSchemeNetwork()` utility to extract common fields regardless of version
**When to use:** When you need scheme/network but don't care about version-specific structure
**Example:**
```typescript
// Source: utils.ts lines 100-108
const { scheme, network } = getSchemeNetwork(payment);
// Both v1 and v2 have these at top level
```

### Anti-Patterns to Avoid
- **Checking version multiple times:** Extract once at entry, don't re-check in helpers
- **Implicit version assumptions:** Always explicitly handle both versions in switch statements
- **Throwing generic errors:** Use specific error messages with version info when version unsupported
- **Skipping assertNever:** Always include default case with assertNever() for compile-time safety

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version detection | Custom field check logic | `getVersion(payment)` utility (utils.ts) | Already built, returns literal type 1 \| 2 for exhaustiveness checking |
| Scheme/network extraction | Manual property access | `getSchemeNetwork(payment)` utility | Version-agnostic, guaranteed to work for both formats |
| Exhaustiveness checking | Runtime version validation | `assertNever(version)` utility | Compile-time type safety, catches missing cases |
| Type narrowing | Manual type assertions | Type guards (`isPaymentPayloadV1`, `isPaymentPayloadV2`) | Already built, safe narrowing |
| Request body format | Version-specific constructors | Unified body with x402Version field | Existing pattern in client.ts |

**Key insight:** Phases 12-13 built complete versioning infrastructure. Phase 14 is about using it, not rebuilding it. The utilities are designed specifically for this use case.

## Common Pitfalls

### Pitfall 1: Forgetting Backward Compatibility Default
**What goes wrong:** Code throws error on payloads lacking x402Version field
**Why it happens:** Assuming all payloads have version field, but pre-versioning payloads don't
**How to avoid:** Always use `payment.x402Version ?? 1` pattern or explicitly handle undefined
**Warning signs:** Test failures with older payload fixtures, runtime errors from existing integrations

### Pitfall 2: Inconsistent Version Handling Between Methods
**What goes wrong:** `verify()` treats missing version as v1, `settle()` treats as v2 (or throws)
**Why it happens:** Copy-paste between methods without checking consistency
**How to avoid:** Extract version detection to shared helper or use same pattern verbatim
**Warning signs:** Integration tests pass for verify but fail for settle with same payload

### Pitfall 3: Type Guards Instead of Discriminant Access
**What goes wrong:** Using `isPaymentPayloadV1(payment)` in switch statement instead of `payment.x402Version`
**Why it happens:** Confusion between type narrowing and exhaustiveness checking
**How to avoid:** Use discriminant field directly in switch; type guards for conditional narrowing only
**Warning signs:** assertNever() not catching missing cases at compile time

### Pitfall 4: Mutating Payload Objects
**What goes wrong:** Adding or modifying x402Version field on input payloads
**Why it happens:** Trying to normalize payloads before processing
**How to avoid:** Treat all input as readonly, use const assertions, work with original structure
**Warning signs:** Unexpected behavior in calling code, type errors with readonly types

### Pitfall 5: Over-Engineering Request Body
**What goes wrong:** Creating separate request builders for v1 vs v2 with different structures
**Why it happens:** Assuming facilitator needs different formats per version
**How to avoid:** Check existing code - body structure is same for both versions (lines 54-57, 84-88 in client.ts)
**Warning signs:** Duplicate code, unnecessary branching in request construction

### Pitfall 6: Missing Export in Index
**What goes wrong:** New types/utilities added to modules but not exported from package index
**Why it happens:** Forgetting SDK-07 requirement to export all new types from Phases 12-13
**How to avoid:** Review index.ts exports, ensure all versioned types and utilities are public
**Warning signs:** Import errors in consumer code, types not showing in IDE autocomplete

## Code Examples

Verified patterns from official sources:

### Version Detection and Branching
```typescript
// Source: TypeScript discriminated union pattern + existing SDK structure
import { getVersion, assertNever } from './utils.js';

async verify(payment: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
  try {
    const version = getVersion(payment); // Returns literal type 1 | 2

    switch (version) {
      case 1:
        return await this.verifyV1(payment, requirements);
      case 2:
        return await this.verifyV2(payment, requirements);
      default:
        return assertNever(version); // Compile-time exhaustiveness check
    }
  } catch (error) {
    if (error instanceof FacilitatorError) throw error;
    throw new VerificationError(
      `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}
```

### Unified Request Body (No Changes Needed)
```typescript
// Source: Existing client.ts lines 54-62 (already correct)
// The existing body format works for both v1 and v2
const body = {
  x402Version: payment.x402Version,
  paymentPayload: payment,
  paymentRequirements: requirements,
};

const response = await this.request<VerifyResponse>('/verify', {
  method: 'POST',
  body: JSON.stringify(body),
});
```

### Backward Compatibility Check
```typescript
// Source: CONTEXT.md decision + TypeScript optional chaining
// If x402Version is undefined, treat as v1
const version = payment.x402Version ?? 1;

// OR: Explicit check with clear error for unknown versions
function getVersionSafe(payment: PaymentPayload): 1 | 2 {
  const version = payment.x402Version;
  if (version === undefined) return 1; // Backward compat
  if (version === 1 || version === 2) return version;
  throw new Error(`Unsupported x402 version: ${version}. SDK supports versions 1 and 2.`);
}
```

### Type-Safe Version-Specific Handlers
```typescript
// Source: TypeScript narrowing + existing SDK error patterns
private async verifyV1(
  payment: PaymentPayloadV1,
  requirements: PaymentRequirements
): Promise<VerifyResponse> {
  // TypeScript knows payment is V1 here
  // Access v1-specific fields safely
  const { scheme, network } = payment; // v1 format (non-CAIP-2)
  // ... v1-specific logic
}

private async verifyV2(
  payment: PaymentPayloadV2,
  requirements: PaymentRequirements
): Promise<VerifyResponse> {
  // TypeScript knows payment is V2 here
  // Access v2-specific fields safely
  const { scheme, network } = payment; // v2 format (CAIP-2)
  const accepted = payment.accepted; // Only exists on v2
  // ... v2-specific logic
}
```

### Export Organization (Alphabetical, Flat)
```typescript
// Source: Existing index.ts pattern + CONTEXT.md decision
export {
  assertNever,
  getSchemeNetwork,
  getVersion,
  isPaymentPayload,
  isPaymentPayloadV1,
  isPaymentPayloadV2,
  isPaymentRequirementsV1,
  isPaymentRequirementsV2,
} from './utils.js';

export type {
  PaymentPayload,
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentRequirements,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
} from './types.js';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Function overloads for version-specific returns | Union return types with single polymorphic function | TypeScript 4.4+ (2021) improved discriminated unions | Simpler API surface, better type inference, easier to maintain |
| Manual type narrowing with type guards | Direct discriminant access in switch statements | TypeScript 2.0 introduced discriminated unions (2016) | Compile-time exhaustiveness checking, fewer runtime checks |
| try/catch around version checks | assertNever() in default case | TypeScript 2.0 never type | Compile errors for missing cases instead of runtime errors |
| Separate v1/v2 client methods | Single polymorphic methods with internal branching | Modern SDK design (2023+) | Backward compatible, no breaking changes for consumers |

**Deprecated/outdated:**
- **Separate version-specific methods in public API:** Modern SDKs prefer single method with version auto-detection. Creates better upgrade path.
- **String discriminants for versions:** Use numeric literal types (1, 2) instead of strings ("v1", "v2") for better exhaustiveness checking
- **Optional version field without default:** Always provide backward-compatible default (missing = v1) for gradual adoption

## Open Questions

Things that couldn't be fully resolved:

1. **Do verify() and settle() need different v1 vs v2 logic?**
   - What we know: Both methods currently construct identical request bodies and pass to facilitator
   - What's unclear: Whether facilitator handles v1/v2 differently internally, or if it's transparent
   - Recommendation: Start with assumption that current body format works for both. If facilitator needs version-specific handling, it uses x402Version field in request. SDK just passes through.

2. **Should SDK validate version consistency between payload and requirements?**
   - What we know: PaymentRequirementsV1 has `maxAmountRequired`, V2 has `amount`. CONTEXT.md says "TypeScript catches version mismatches at compile time; no runtime validation for type consistency"
   - What's unclear: Can consumers pass V1 payload with V2 requirements? Should SDK prevent this?
   - Recommendation: Trust TypeScript type system. If both are unions, consumers can mix-and-match (type system allows it). Don't add runtime validation unless facilitator requires it.

3. **What if x402Version is present but not 1 or 2?**
   - What we know: CONTEXT.md specifies error message "Unsupported x402 version: X. SDK supports versions 1 and 2."
   - What's unclear: Where to throw this - at method entry or in assertNever default?
   - Recommendation: Throw at method entry if version check fails. assertNever() is for compile-time exhaustiveness, not runtime validation. Example in Code Examples section above.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/packages/sdk/src/client.ts` (lines 48-103) - Current verify/settle implementation
- Existing codebase: `/packages/sdk/src/utils.ts` (lines 100-137) - Versioning utilities from Phase 13
- Existing codebase: `/packages/sdk/src/types.ts` - PaymentPayload discriminated union from Phase 12
- Existing codebase: `/packages/sdk/src/index.ts` - Current export structure
- Phase 14 CONTEXT.md - User decisions on backward compatibility, error handling, exports, method signatures

### Secondary (MEDIUM confidence)
- [TypeScript Handbook - Unions and Intersection Types](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html) - Official TypeScript guidance
- [Discriminated Unions | TypeScript Deep Dive](https://basarat.gitbook.io/typescript/type-system/discriminated-unions) - assertNever pattern
- [When to Use Overloads and Unions | Total TypeScript](https://www.totaltypescript.com/workshops/typescript-generics/function-overloads/function-overloads-vs-union-types/solution) - Prefer union parameters over overloads
- [Exhaustiveness checking | TypeScript Book](https://gibbok.github.io/typescript-book/book/exhaustiveness-checking/) - Switch statement exhaustiveness with never type
- [8 API Versioning Best Practices for Developers in 2026](https://getlate.dev/blog/api-versioning-best-practices) - Don't break without necessity, version from start
- [TypeScript Guidelines: API Design | Azure SDKs](https://azure.github.io/azure-sdk/typescript_design.html) - Service version in constructor options

### Tertiary (LOW confidence)
- [Please Stop Using Barrel Files | TkDodo's blog](https://tkdodo.eu/blog/please-stop-using-barrel-files) - Performance concerns about barrel exports (not critical for SDK size)
- [Backward Compatibility in TypeScript with Design Patterns](https://codesignal.com/learn/courses/backward-compatibility-in-software-development-with-typescript/lessons/leveraging-facade-and-adapter-patterns-for-backward-compatibility-in-typescript) - Facade/Adapter patterns (not needed here - simpler solution works)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already in package.json, no new dependencies
- Architecture: HIGH - Discriminated unions well-established, existing codebase provides clear pattern
- Pitfalls: HIGH - Based on TypeScript discriminated union gotchas + SDK-specific concerns from codebase review

**Research date:** 2026-01-21
**Valid until:** 60 days (stable TypeScript patterns, no fast-moving dependencies)
