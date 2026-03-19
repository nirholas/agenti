# Phase 12: SDK Type Definitions - Research

**Researched:** 2026-01-20
**Domain:** TypeScript discriminated unions for versioned payment payloads
**Confidence:** HIGH

## Summary

Phase 12 defines versioned PaymentPayload and PaymentRequirements TypeScript types using discriminated unions. The key technical requirement is using literal type discriminants (`x402Version: 1` and `x402Version: 2`) that enable TypeScript's type narrowing when checking the version field.

The current SDK already has a `PaymentPayload` interface with `x402Version: 1 | 2`, but it uses a flat structure that doesn't differentiate between v1 and v2 payload shapes. The task is to define separate `PaymentPayloadV1` and `PaymentPayloadV2` interfaces with literal discriminants, then create a union type.

**Primary recommendation:** Define interfaces with literal `x402Version: 1` and `x402Version: 2` discriminants, keeping the existing `PaymentPayload` as the union type to maintain backward compatibility.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.2 | Type definitions | Already in use, strict mode enabled |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsup | ^8.0.0 | Build tool | Already configured for SDK builds |
| vitest | ^1.0.0 | Testing | For type assertion tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Interface union | Type alias union | Interfaces allow extension; types don't - use interfaces |
| Numeric discriminant | String discriminant | x402 spec uses numbers; stick with spec |
| `@x402/core` re-export | Custom types | Custom types give more control over shape; recommended |

**Installation:**
No new dependencies required. This phase is purely type definitions.

## Architecture Patterns

### Recommended Project Structure
```
packages/sdk/src/
  types.ts        # Add PaymentPayloadV1, PaymentPayloadV2, union updates
  index.ts        # Export new types (unchanged until Phase 14)
```

### Pattern 1: Discriminated Union with Literal Types

**What:** A union where each member has a common property with a different literal type value.

**When to use:** When you need TypeScript to automatically narrow types based on a discriminant field.

**Example:**
```typescript
// Source: TypeScript Handbook, Discriminated Unions
interface PaymentPayloadV1 {
  x402Version: 1;  // Literal type, not `number`
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: PaymentAuthorization;
  };
}

interface PaymentPayloadV2 {
  x402Version: 2;  // Literal type, not `number`
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: PaymentAuthorization;
  };
  // v2-specific: future fields like `accepted`, `resource` can be added
}

type PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;

// TypeScript narrows automatically
function process(p: PaymentPayload) {
  if (p.x402Version === 1) {
    // TypeScript knows p is PaymentPayloadV1 here
  } else {
    // TypeScript knows p is PaymentPayloadV2 here
  }
}
```

### Pattern 2: Extending Common Fields

**What:** Extract common fields to a base interface, extend for each version.

**When to use:** When versions share most fields and differ in few.

**Example:**
```typescript
// Common payload fields
interface PaymentPayloadBase {
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: PaymentAuthorization;
  };
}

interface PaymentPayloadV1 extends PaymentPayloadBase {
  x402Version: 1;
}

interface PaymentPayloadV2 extends PaymentPayloadBase {
  x402Version: 2;
  // v2-specific additions here
}
```

### Anti-Patterns to Avoid

- **Non-literal discriminant:** Using `x402Version: number` instead of `x402Version: 1` breaks TypeScript narrowing completely
- **Optional discriminant:** Using `x402Version?: 1` prevents narrowing in undefined cases
- **String interpolation in discriminant:** Using template literals like `` `v${1}` `` instead of literal `1`
- **Generic number union:** Using `x402Version: 1 | 2 | 3 | ...` on individual interfaces instead of single literal per interface

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type narrowing | Custom narrowing logic | TypeScript discriminated unions | Built-in, compile-time, zero runtime cost |
| Version detection | if/else chains | Literal type checks | TypeScript handles exhaustiveness |
| Type extraction | Manual casting | `Extract<Union, { x402Version: 1 }>` | TypeScript utility type |

**Key insight:** TypeScript's discriminated union pattern does all the narrowing work at compile time. The runtime code is just standard property checks - TypeScript makes them type-safe.

## Common Pitfalls

### Pitfall 1: Using Non-Literal Types for Discriminant

**What goes wrong:** Defining `x402Version: number` instead of `x402Version: 1` completely breaks TypeScript's ability to narrow the union.

**Why it happens:** Developers type `number` out of habit, or copy from existing code that wasn't designed for discriminated unions.

**How to avoid:** Always use literal types for discriminant fields:
```typescript
// BAD
interface PaymentPayloadV1 {
  x402Version: number;  // Narrowing won't work
}

// GOOD
interface PaymentPayloadV1 {
  x402Version: 1;  // Literal type enables narrowing
}
```

**Warning signs:** TypeScript doesn't narrow after version check; need explicit type assertion.

### Pitfall 2: Breaking Backward Compatibility

**What goes wrong:** Existing code using `PaymentPayload` stops compiling because the union type has different properties.

**Why it happens:** Adding required fields to V2 that don't exist on V1 without proper union handling.

**How to avoid:**
1. Keep `PaymentPayload` as the union type (same name, new definition)
2. Ensure common operations work on both versions
3. Version-specific fields should be accessed only after narrowing

**Warning signs:** Existing SDK consumers report type errors after update.

### Pitfall 3: Inconsistent Field Structures

**What goes wrong:** V1 and V2 have same fields in different locations (e.g., `scheme` at top level vs inside `accepted`), making version-agnostic code impossible.

**Why it happens:** Protocol evolution moves fields to new locations.

**How to avoid:** For Phase 12 (type definitions only), keep both versions with `scheme` and `network` at top level. Structural differences like `accepted` nesting are deferred to Phase 13/14 where helpers extract values.

**Warning signs:** Can't write simple `payload.scheme` access without version check.

### Pitfall 4: Missing Exports

**What goes wrong:** Consumers can't import `PaymentPayloadV1` because it's not exported.

**Why it happens:** Types defined but not added to index.ts exports.

**How to avoid:** Add all new types to the export list in types.ts. (Export from index.ts is Phase 14 scope.)

**Warning signs:** Consumers use `Extract<PaymentPayload, { x402Version: 1 }>` workaround.

## Code Examples

Verified patterns for this phase:

### Defining PaymentPayloadV1

```typescript
// packages/sdk/src/types.ts
// Source: Existing SDK types + TypeScript discriminated union pattern

/**
 * Payment payload for x402 version 1
 * Uses flat structure with scheme/network at top level
 */
export interface PaymentPayloadV1 {
  /** x402 version 1 literal */
  x402Version: 1;
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier - v1 format: "base", "solana" */
  network: string;
  /** Payment details */
  payload: {
    /** Signature of the payment */
    signature: string;
    /** Payment authorization */
    authorization: PaymentAuthorization;
  };
}
```

### Defining PaymentPayloadV2

```typescript
// packages/sdk/src/types.ts
// Source: Existing SDK types + x402 v2 spec structure

/**
 * Payment payload for x402 version 2
 * Uses CAIP-2 network identifiers
 */
export interface PaymentPayloadV2 {
  /** x402 version 2 literal */
  x402Version: 2;
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier - v2 format: "eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" */
  network: string;
  /** Payment details */
  payload: {
    /** Signature of the payment */
    signature: string;
    /** Payment authorization */
    authorization: PaymentAuthorization;
  };
}
```

### Defining the Union Type

```typescript
// packages/sdk/src/types.ts

/**
 * Payment payload union - supports both x402 v1 and v2 formats
 * Use x402Version to discriminate between versions
 */
export type PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;
```

### Type Narrowing Example (for verification)

```typescript
// Usage pattern (not implementation in this phase)
function processPayload(payload: PaymentPayload) {
  if (payload.x402Version === 1) {
    // TypeScript narrows to PaymentPayloadV1
    console.log(payload.scheme);  // Works
  } else {
    // TypeScript narrows to PaymentPayloadV2
    console.log(payload.scheme);  // Works
  }
}
```

### PaymentRequirements Types

```typescript
// packages/sdk/src/types.ts

/**
 * Payment requirements for x402 version 1
 */
export interface PaymentRequirementsV1 {
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier - v1 format */
  network: string;
  /** Maximum amount required in base units */
  maxAmountRequired: string;
  /** Resource URL being paid for */
  resource?: string;
  /** Token/asset address */
  asset: string;
  /** Recipient address */
  payTo?: string;
  /** Human-readable description */
  description?: string;
  /** MIME type of resource */
  mimeType?: string;
  /** Maximum timeout in seconds */
  maxTimeoutSeconds?: number;
  /** Output schema for structured responses */
  outputSchema?: Record<string, unknown>;
  /** Extra data */
  extra?: Record<string, unknown>;
}

/**
 * Payment requirements for x402 version 2
 * Note: v2 uses 'amount' instead of 'maxAmountRequired'
 */
export interface PaymentRequirementsV2 {
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier - v2 CAIP-2 format */
  network: string;
  /** Amount required in base units */
  amount: string;
  /** Token/asset address */
  asset: string;
  /** Recipient address */
  payTo: string;
  /** Maximum timeout in seconds */
  maxTimeoutSeconds: number;
  /** Extra data */
  extra: Record<string, unknown>;
}

/**
 * Payment requirements union - supports both formats
 * Note: No version discriminant; infer from context or payload version
 */
export type PaymentRequirements = PaymentRequirementsV1 | PaymentRequirementsV2;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single PaymentPayload interface | Discriminated union | This phase | Enables compile-time version handling |
| `x402Version: 1 \| 2` on single type | Literal per version interface | This phase | TypeScript can narrow correctly |
| Implicit version handling | Explicit version types | This phase | Better DX, IDE autocomplete |

**Deprecated/outdated:**
- The current `PaymentPayload` interface with `x402Version: 1 | 2` will be replaced by the union. The name stays the same for backward compatibility.

## Open Questions

Things that couldn't be fully resolved:

1. **PaymentRequirements discriminant**
   - What we know: V1 uses `maxAmountRequired`, V2 uses `amount`
   - What's unclear: Should we add `x402Version` to requirements or rely on field presence?
   - Recommendation: No version field on requirements; use field presence or context from payload

2. **V2 nested `accepted` field**
   - What we know: x402 v2 spec has `accepted` containing PaymentRequirements
   - What's unclear: Should PaymentPayloadV2 have `accepted` field in Phase 12?
   - Recommendation: Keep v2 structure simple in Phase 12 (scheme/network at top level); `accepted` field handling is Phase 13/14 scope where helpers extract values

## Sources

### Primary (HIGH confidence)
- TypeScript Handbook: Narrowing - [typescriptlang.org/docs/handbook/2/narrowing.html](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- Existing SDK code: `/Users/rawgroundbeef/Projects/openfacilitator/packages/sdk/src/types.ts`
- Phase CONTEXT.md: User decisions on type naming, version literals

### Secondary (MEDIUM confidence)
- [Total TypeScript: Unions, Literals, and Narrowing](https://www.totaltypescript.com/books/total-typescript-essentials/unions-literals-and-narrowing)
- [TypeScript Deep Dive: Discriminated Unions](https://basarat.gitbook.io/typescript/type-system/discriminated-unions)
- Project research: `.planning/research/v1.1/PITFALLS.md`, `.planning/research/STACK.md`

### Tertiary (LOW confidence)
- x402 v2 specification for structural differences (verified against @x402/core but spec evolving)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TypeScript discriminated unions are well-documented standard pattern
- Architecture: HIGH - Simple type additions to existing file structure
- Pitfalls: HIGH - Verified against TypeScript issues and handbook

**Research date:** 2026-01-20
**Valid until:** 90 days (TypeScript patterns stable, SDK structure unlikely to change)
