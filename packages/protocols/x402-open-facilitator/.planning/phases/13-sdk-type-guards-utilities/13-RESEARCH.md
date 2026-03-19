# Phase 13: SDK Type Guards & Utilities - Research

**Researched:** 2026-01-20
**Domain:** TypeScript type guards and runtime utilities for versioned payment types
**Confidence:** HIGH

## Summary

Phase 13 creates runtime utilities for TypeScript consumers to safely handle versioned payment payloads and requirements. The core pattern is user-defined type guards with the `is` predicate syntax that narrow union types at compile time while performing runtime validation.

The existing SDK already has `isPaymentPayload()` in `utils.ts` that checks for any valid PaymentPayload. This phase adds version-specific guards (`isPaymentPayloadV1`, `isPaymentPayloadV2`, `isPaymentRequirementsV1`, `isPaymentRequirementsV2`), extraction utilities (`getSchemeNetwork`, `getVersion`), and an exhaustiveness helper (`assertNever`).

The types defined in Phase 12 use literal discriminants (`x402Version: 1` and `x402Version: 2`), enabling straightforward runtime checks. PaymentRequirements lacks a version discriminant, so type guards must check for unique fields (`maxAmountRequired` for v1, `amount` without `maxAmountRequired` for v2).

**Primary recommendation:** Implement type guards using `value is TypeName` return syntax with safe null/undefined handling (return `false`). Use the `in` operator for property existence checks on PaymentRequirements. Make `assertNever` throw at runtime with contextual error messages.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.2 | Type predicate syntax | Already in use, enables `value is Type` returns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^1.0.0 | Testing type guards | Verify runtime behavior and type narrowing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `assertNever` | `assert-never` npm package | Custom is simpler, no dependency, full control |
| `in` operator guards | Object.hasOwn checks | `in` integrates with TypeScript narrowing |
| Throwing on invalid | Returning undefined | Throwing makes bugs visible; decision: return `false` for guards |

**Installation:**
No new dependencies required. This phase uses pure TypeScript features.

## Architecture Patterns

### Recommended Project Structure
```
packages/sdk/src/
  types.ts        # Existing versioned types (from Phase 12)
  utils.ts        # ADD type guards and utilities here
  index.ts        # Export new utilities (Phase 14)
```

### Pattern 1: Type Predicate Guards with `is` Return Type

**What:** A function returning `value is Type` that narrows the input type when returning `true`.

**When to use:** When you need to validate unknown input and get type-safe access to properties.

**Example:**
```typescript
// Source: TypeScript Handbook, Type Predicates
import type { PaymentPayloadV1, PaymentPayload } from './types.js';

export function isPaymentPayloadV1(value: unknown): value is PaymentPayloadV1 {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return obj.x402Version === 1 &&
         typeof obj.scheme === 'string' &&
         typeof obj.network === 'string' &&
         obj.payload !== undefined;
}

// Usage - TypeScript narrows correctly
function process(payload: PaymentPayload) {
  if (isPaymentPayloadV1(payload)) {
    // payload is PaymentPayloadV1 here
    console.log(payload.x402Version); // TypeScript knows this is 1
  }
}
```

### Pattern 2: Property-Based Guards (for PaymentRequirements)

**What:** Use the `in` operator to check for unique properties when no version discriminant exists.

**When to use:** When discriminating types by presence of unique fields.

**Example:**
```typescript
// Source: TypeScript Handbook, in Operator Narrowing
import type { PaymentRequirementsV1, PaymentRequirements } from './types.js';

export function isPaymentRequirementsV1(
  value: unknown
): value is PaymentRequirementsV1 {
  if (!value || typeof value !== 'object') return false;
  // V1 has maxAmountRequired, V2 has amount
  return 'maxAmountRequired' in value;
}

export function isPaymentRequirementsV2(
  value: unknown
): value is PaymentRequirementsV2 {
  if (!value || typeof value !== 'object') return false;
  // V2 has amount but NOT maxAmountRequired
  return 'amount' in value && !('maxAmountRequired' in value);
}
```

### Pattern 3: Exhaustiveness Checking with assertNever

**What:** A function that accepts `never` and throws, catching unhandled union cases at compile time.

**When to use:** In switch/if-else chains over discriminated unions to ensure all cases are handled.

**Example:**
```typescript
// Source: TypeScript Handbook, Exhaustiveness Checking
export function assertNever(value: never, message?: string): never {
  throw new Error(
    message ?? `Unexpected value: ${JSON.stringify(value)}`
  );
}

// Usage - compile error if new version added
function getVersionLabel(payload: PaymentPayload): string {
  switch (payload.x402Version) {
    case 1: return 'Version 1';
    case 2: return 'Version 2';
    default: return assertNever(payload); // Compile error if case missing
  }
}
```

### Pattern 4: Extraction Utilities

**What:** Helper functions that extract common data from multiple type variants.

**When to use:** When consumers need version-agnostic access to shared fields.

**Example:**
```typescript
import type { PaymentPayload } from './types.js';

export function getSchemeNetwork(
  payload: PaymentPayload
): { scheme: string; network: string } {
  // Both v1 and v2 have scheme/network at top level
  return {
    scheme: payload.scheme,
    network: payload.network,
  };
}

export function getVersion(payload: PaymentPayload): 1 | 2 {
  return payload.x402Version;
}
```

### Anti-Patterns to Avoid

- **Unsafe narrowing:** Returning `true` without validating all required properties - the type system trusts your predicate
- **Combined conditions in guards:** Using `&&` for non-type conditions (like `value < 10`) breaks false-case narrowing
- **Truthiness as type guard:** Using `!!value` instead of explicit null/undefined checks - falsy values like `0` or `''` would be incorrectly rejected
- **Forgetting the false case:** Guards must be "if and only if" - false must mean "definitely NOT this type"
- **Missing `unknown` input type:** Type guards should accept `unknown`, not pre-narrowed types, for maximum safety

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version checking | Manual if/else chains | `getVersion()` utility | Centralizes logic, easier to maintain |
| Unknown version handling | Try-catch everywhere | Type guards returning false | Consistent, predictable behavior |
| Compile-time exhaustiveness | Runtime version validation | `assertNever` | Catches missing cases at compile time |
| Property extraction | Version-specific code paths | `getSchemeNetwork()` | Version-agnostic, single code path |

**Key insight:** Type guards create a contract between runtime validation and compile-time types. The guard must be correct in both directions - true means "is this type", false means "is NOT this type". TypeScript trusts your predicate, so incorrect guards cause runtime bugs that TypeScript cannot catch.

## Common Pitfalls

### Pitfall 1: Incorrect False Case Handling

**What goes wrong:** Type guard returns `false` for values that ARE the target type, or `true` for values that AREN'T.

**Why it happens:** Complex validation logic with combined conditions; TypeScript cannot verify type guard correctness.

**How to avoid:**
```typescript
// BAD - combined non-type condition
function isValidPayloadV1(v: unknown): v is PaymentPayloadV1 {
  return isPaymentPayloadV1(v) && v.scheme !== 'deprecated';
  // False case now includes valid PayloadV1 with deprecated scheme!
}

// GOOD - separate validation
function isPaymentPayloadV1(v: unknown): v is PaymentPayloadV1 {
  // Only type-related checks
}
function isValidPayloadV1(v: PaymentPayloadV1): boolean {
  return v.scheme !== 'deprecated'; // Separate business logic
}
```

**Warning signs:** Runtime errors with values that "should" be narrowed; tests pass but production fails.

### Pitfall 2: Forgetting Null/Undefined Input Handling

**What goes wrong:** Type guard throws when passed `null` or `undefined` instead of returning `false`.

**Why it happens:** Accessing properties on the value before checking it exists.

**How to avoid:**
```typescript
// BAD - throws on null/undefined
function isPaymentPayloadV1(value: unknown): value is PaymentPayloadV1 {
  return (value as any).x402Version === 1; // Throws if value is null
}

// GOOD - safe null check first
function isPaymentPayloadV1(value: unknown): value is PaymentPayloadV1 {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return obj.x402Version === 1 && /* ... */;
}
```

**Warning signs:** "Cannot read property of null/undefined" errors in production.

### Pitfall 3: PaymentRequirements Has No Version Discriminant

**What goes wrong:** Attempting to check `requirements.x402Version` which doesn't exist.

**Why it happens:** Assuming PaymentRequirements mirrors PaymentPayload structure.

**How to avoid:**
```typescript
// BAD - x402Version doesn't exist on PaymentRequirements
function isPaymentRequirementsV1(v: unknown): v is PaymentRequirementsV1 {
  return (v as any).x402Version === 1; // Always undefined
}

// GOOD - check for unique field
function isPaymentRequirementsV1(v: unknown): v is PaymentRequirementsV1 {
  if (!value || typeof value !== 'object') return false;
  return 'maxAmountRequired' in v;
}
```

**Warning signs:** Type guard always returns false; consumers can't narrow requirements.

### Pitfall 4: assertNever Not Actually Throwing

**What goes wrong:** `assertNever` returns instead of throwing, causing logic to continue with invalid state.

**Why it happens:** Forgetting to add `throw` or using a silent-fail pattern.

**How to avoid:**
```typescript
// BAD - doesn't actually fail
function assertNever(value: never): never {
  console.error('Unexpected value', value);
  return undefined as never; // Lies to TypeScript
}

// GOOD - always throws
function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`);
}
```

**Warning signs:** Code continues executing after what should be an unreachable path.

### Pitfall 5: Overloaded Input Types Reduce Safety

**What goes wrong:** Type guard accepts `PaymentPayload` instead of `unknown`, reducing utility.

**Why it happens:** Trying to be "more specific" with input types.

**How to avoid:**
```typescript
// LESS SAFE - only works with already-typed payloads
function isPaymentPayloadV1(value: PaymentPayload): value is PaymentPayloadV1 {
  return value.x402Version === 1;
}

// MORE SAFE - works with any input (API responses, JSON.parse, etc.)
function isPaymentPayloadV1(value: unknown): value is PaymentPayloadV1 {
  if (!value || typeof value !== 'object') return false;
  // Full validation
}
```

**Warning signs:** Can't use guard with `JSON.parse()` results or API responses without casting.

## Code Examples

Verified patterns from official sources:

### Type Guard: isPaymentPayloadV1

```typescript
// packages/sdk/src/utils.ts
// Source: TypeScript Handbook Type Predicates pattern
import type { PaymentPayloadV1 } from './types.js';

export function isPaymentPayloadV1(value: unknown): value is PaymentPayloadV1 {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.x402Version === 1 &&
    typeof obj.scheme === 'string' &&
    typeof obj.network === 'string' &&
    obj.payload !== undefined &&
    typeof obj.payload === 'object'
  );
}
```

### Type Guard: isPaymentPayloadV2

```typescript
// packages/sdk/src/utils.ts
import type { PaymentPayloadV2 } from './types.js';

export function isPaymentPayloadV2(value: unknown): value is PaymentPayloadV2 {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.x402Version === 2 &&
    typeof obj.scheme === 'string' &&
    typeof obj.network === 'string' &&
    obj.payload !== undefined &&
    typeof obj.payload === 'object'
  );
}
```

### Type Guard: isPaymentRequirementsV1

```typescript
// packages/sdk/src/utils.ts
import type { PaymentRequirementsV1 } from './types.js';

export function isPaymentRequirementsV1(
  value: unknown
): value is PaymentRequirementsV1 {
  if (!value || typeof value !== 'object') return false;
  // V1 has maxAmountRequired field
  return 'maxAmountRequired' in value;
}
```

### Type Guard: isPaymentRequirementsV2

```typescript
// packages/sdk/src/utils.ts
import type { PaymentRequirementsV2 } from './types.js';

export function isPaymentRequirementsV2(
  value: unknown
): value is PaymentRequirementsV2 {
  if (!value || typeof value !== 'object') return false;
  // V2 has amount but NOT maxAmountRequired
  return 'amount' in value && !('maxAmountRequired' in value);
}
```

### Utility: getSchemeNetwork

```typescript
// packages/sdk/src/utils.ts
import type { PaymentPayload } from './types.js';

export function getSchemeNetwork(
  payload: PaymentPayload
): { scheme: string; network: string } {
  return {
    scheme: payload.scheme,
    network: payload.network,
  };
}
```

### Utility: getVersion

```typescript
// packages/sdk/src/utils.ts
import type { PaymentPayload } from './types.js';

export function getVersion(payload: PaymentPayload): 1 | 2 {
  return payload.x402Version;
}
```

### Utility: assertNever

```typescript
// packages/sdk/src/utils.ts
// Source: TypeScript Handbook Exhaustiveness Checking

export function assertNever(value: never, message?: string): never {
  throw new Error(
    message ?? `Unhandled discriminated union member: ${JSON.stringify(value)}`
  );
}
```

### Complete Usage Example

```typescript
// Consumer code showing all utilities in action
import {
  isPaymentPayloadV1,
  isPaymentPayloadV2,
  getSchemeNetwork,
  getVersion,
  assertNever,
  type PaymentPayload,
} from '@openfacilitator/sdk';

function processPayment(payload: PaymentPayload) {
  // Extract version-agnostic fields
  const { scheme, network } = getSchemeNetwork(payload);
  console.log(`Processing ${scheme} payment on ${network}`);

  // Handle version-specific logic with exhaustiveness checking
  const version = getVersion(payload);
  switch (version) {
    case 1:
      console.log('Legacy v1 format');
      break;
    case 2:
      console.log('Modern v2 format');
      if (payload.accepted) {
        console.log('Has nested accepted requirements');
      }
      break;
    default:
      assertNever(version); // Compile error if new version added
  }
}

// Validate unknown input from API
function handleApiResponse(data: unknown) {
  if (isPaymentPayloadV1(data)) {
    // data is PaymentPayloadV1
    processPayment(data);
  } else if (isPaymentPayloadV2(data)) {
    // data is PaymentPayloadV2
    processPayment(data);
  } else {
    console.error('Invalid payment payload');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `typeof` checks only | `value is Type` predicates | TypeScript 1.6 (2015) | Compile-time narrowing in user code |
| Manual casting after validation | Type guards narrow automatically | Standard practice | No `as` casts needed after guard |
| Switch exhaustiveness via ESLint | `assertNever` function | ESLint optional, assertNever native | Works without ESLint, runtime safety |

**Deprecated/outdated:**
- None - type guards and assertNever are the current standard approach

## Open Questions

Things that couldn't be fully resolved:

1. **accepted field narrowing**
   - What we know: PaymentPayloadV2 has optional `accepted?: PaymentRequirementsV2`
   - What's unclear: Should type guards validate `accepted` field structure if present?
   - Recommendation: Keep guards simple - validate top-level discriminant only. Consumers who need `accepted` can check for it after narrowing.

2. **Strict validation depth**
   - What we know: Current guards check top-level structure
   - What's unclear: Should guards validate nested `payload.authorization` structure?
   - Recommendation: Match existing `isPaymentPayload` depth (shallow). Deep validation is consumer responsibility.

3. **Error messages for assertNever**
   - What we know: Context-aware messages help debugging
   - What's unclear: How specific should default messages be?
   - Recommendation: Include JSON-serialized value in message, allow custom message override.

## Sources

### Primary (HIGH confidence)
- TypeScript Handbook: Narrowing - [typescriptlang.org/docs/handbook/2/narrowing.html](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- TypeScript Handbook: Type Predicates - [typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- Existing SDK code: `/Users/rawgroundbeef/Projects/openfacilitator/packages/sdk/src/utils.ts` (existing `isPaymentPayload` pattern)
- Existing SDK code: `/Users/rawgroundbeef/Projects/openfacilitator/packages/sdk/src/types.ts` (Phase 12 types)

### Secondary (MEDIUM confidence)
- Effective TypeScript: Type Guard Safety - [effectivetypescript.com/2024/02/27/type-guards/](https://effectivetypescript.com/2024/02/27/type-guards/)
- Better Stack: Type Predicates in TypeScript - [betterstack.com/community/guides/scaling-nodejs/type-predicates/](https://betterstack.com/community/guides/scaling-nodejs/type-predicates/)
- assert-never package (pattern reference) - [github.com/aikoven/assert-never](https://github.com/aikoven/assert-never)

### Tertiary (LOW confidence)
- Various Medium/DEV.to articles on type guards - patterns verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pure TypeScript features, well-documented
- Architecture: HIGH - Adding to existing utils.ts, matching existing patterns
- Pitfalls: HIGH - Verified against TypeScript handbook and community resources

**Research date:** 2026-01-20
**Valid until:** 90 days (TypeScript patterns stable)
