# Domain Pitfalls: SDK Version-Discriminated Union Types

**Domain:** TypeScript SDK type changes (PaymentPayload v1/v2 union)
**Researched:** 2026-01-20
**Confidence:** HIGH (verified with TypeScript handbook, semver-ts.org, community sources)

---

## Critical Pitfalls

Mistakes that cause breaking changes or require consumer code rewrites.

---

### Pitfall 1: Type Guard Becomes Incorrect After Union Expansion

**What goes wrong:** The existing `isPaymentPayload()` type guard returns `value is PaymentPayload`. When `PaymentPayload` changes from a single interface to `PaymentPayloadV1 | PaymentPayloadV2`, the type guard may still compile but return incorrect results for edge cases.

**Why it happens:** Type predicates in TypeScript receive minimal compiler validation. As noted in [Effective TypeScript](https://effectivetypescript.com/2024/02/27/type-guards/): "TypeScript does very little to check that [type guards] are valid."

**Current code at risk:**
```typescript
// packages/sdk/src/utils.ts
export function isPaymentPayload(value: unknown): value is PaymentPayload {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.x402Version === 1 || obj.x402Version === 2) &&
    typeof obj.scheme === 'string' &&
    typeof obj.network === 'string' &&
    obj.payload !== undefined
  );
}
```

**Consequences:**
- If V1 and V2 have different required fields, the guard may return `true` for invalid V2 payloads
- Consumers relying on the guard for narrowing get incorrect types
- Runtime errors occur in code that assumed proper narrowing

**Prevention:**
1. Create version-specific guards: `isPaymentPayloadV1()` and `isPaymentPayloadV2()`
2. Update the main guard to properly distinguish versions:
   ```typescript
   export function isPaymentPayload(value: unknown): value is PaymentPayload {
     return isPaymentPayloadV1(value) || isPaymentPayloadV2(value);
   }
   ```
3. Add runtime checks that mirror the type-level differences between V1 and V2

**Detection:**
- Review all type guards when union members change
- Write unit tests that verify guard correctly rejects invalid objects for each version
- Test that narrowing works correctly after guard returns true

---

### Pitfall 2: Breaking Change from Property Type Widening

**What goes wrong:** Changing a property from a specific type to a union (e.g., `network: string` to `network: NetworkV1 | NetworkV2`) is a breaking change for consumers who read that property.

**Why it happens:** According to [semver-ts.org](https://www.semver-ts.org/formal-spec/2-breaking-changes.html): "a readonly object property type becomes a less specific ('wider') type...since the user's existing handling of the property will be wrong in some cases."

**Consequences:**
- Consumer code that handled the narrow type now has unhandled cases
- TypeScript compilation fails for consumers (if strict)
- Runtime errors if consumers don't check for new type variants

**Prevention:**
1. For the `PaymentPayload` union itself, this is intentional - document clearly
2. Ensure internal properties maintain compatible types across V1 and V2
3. If property types must differ, use discriminated union properly so narrowing provides correct types
4. Bump major version per semver

**Detection:**
- Any property whose type changes from `T` to `T | U` or `T` to `U` is a breaking change
- Review all property types in both union members for compatibility

---

### Pitfall 3: Destructuring Breaks Type Narrowing

**What goes wrong:** Consumers who destructure the payload before checking the version field lose TypeScript's narrowing capability.

**Why it happens:** Per [TypeScript documentation](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) and [developer resources](https://www.developerway.com/posts/advanced-typescript-for-react-developers-discriminated-unions): "TypeScript loses the 'refinement' of the discrimination when we use object or array destructuring."

**Example of broken code:**
```typescript
// BAD: Destructuring breaks narrowing
function processPayment({ x402Version, payload, ...rest }: PaymentPayload) {
  if (x402Version === 1) {
    // TypeScript cannot narrow `payload` here - it's still PayloadV1 | PayloadV2
    payload.v1OnlyField; // Error: Property does not exist
  }
}
```

**Correct pattern:**
```typescript
// GOOD: Narrow first, then access properties
function processPayment(payment: PaymentPayload) {
  if (payment.x402Version === 1) {
    // TypeScript correctly narrows entire object
    payment.payload.v1OnlyField; // Works
  }
}
```

**Consequences:**
- Consumers must rewrite code that uses destructuring
- IDE autocomplete stops working correctly
- Potential runtime errors from accessing wrong version's properties

**Prevention:**
1. Document the "no destructuring before narrowing" pattern in SDK docs
2. Provide helper functions that return properly narrowed types:
   ```typescript
   function asV1(p: PaymentPayload): PaymentPayloadV1 | null {
     return p.x402Version === 1 ? p : null;
   }
   ```
3. Include code examples showing correct narrowing patterns

**Detection:**
- Search consumer code for destructuring patterns on PaymentPayload
- Review SDK middleware code that processes payments

---

### Pitfall 4: Exhaustive Checking Not Enforced

**What goes wrong:** Consumers using switch statements on `x402Version` don't get compile-time errors when V3 is added later.

**Why it happens:** TypeScript only enforces exhaustiveness when using the `never` type pattern, which many developers don't know about.

**Example without exhaustive checking:**
```typescript
// No error when V3 is added
switch (payment.x402Version) {
  case 1:
    return handleV1(payment);
  case 2:
    return handleV2(payment);
  // V3 silently falls through with undefined behavior
}
```

**Correct pattern:**
```typescript
function assertNever(x: never): never {
  throw new Error(`Unexpected version: ${x}`);
}

switch (payment.x402Version) {
  case 1:
    return handleV1(payment);
  case 2:
    return handleV2(payment);
  default:
    return assertNever(payment); // Compile error if cases missing
}
```

**Consequences:**
- Silent bugs when new versions are added
- Runtime errors instead of compile-time errors
- Harder to maintain over time

**Prevention:**
1. Export an `assertNever` utility from the SDK
2. Document the exhaustive checking pattern prominently
3. Consider exporting a `handlePaymentPayload` function that enforces exhaustiveness:
   ```typescript
   export function handlePaymentPayload<T>(
     payment: PaymentPayload,
     handlers: {
       v1: (p: PaymentPayloadV1) => T;
       v2: (p: PaymentPayloadV2) => T;
     }
   ): T {
     switch (payment.x402Version) {
       case 1: return handlers.v1(payment);
       case 2: return handlers.v2(payment);
       default: return assertNever(payment);
     }
   }
   ```

**Detection:**
- Grep for `switch` statements on `x402Version` without `default: assertNever`
- Review consumer code when adding new versions

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt but are recoverable.

---

### Pitfall 5: Omit/Pick Break Discriminated Unions

**What goes wrong:** Using TypeScript's built-in `Omit` or `Pick` on a discriminated union collapses it into a single type, losing discrimination.

**Why it happens:** As documented in [TkDodo's blog](https://tkdodo.eu/blog/omit-for-discriminated-unions-in-type-script): "TypeScript's built-in Omit breaks discriminated unions."

**Example:**
```typescript
type PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;

// BAD: This loses the union, becomes a single merged type
type WithoutNetwork = Omit<PaymentPayload, 'network'>;

// Consumer can no longer narrow:
function process(p: WithoutNetwork) {
  if (p.x402Version === 1) {
    // Narrowing doesn't work - WithoutNetwork is not a union
  }
}
```

**Prevention:**
1. Create distributive versions of utility types:
   ```typescript
   type DistributiveOmit<T, K extends keyof any> = T extends any
     ? Omit<T, K>
     : never;
   ```
2. Export these utilities from the SDK if consumers need them
3. Document this limitation in migration guide

**Detection:**
- Search SDK code for `Omit<PaymentPayload` or `Pick<PaymentPayload`
- Review PRs that add utility type usage on union types

---

### Pitfall 6: Spreading Widens Types Back

**What goes wrong:** When spreading a narrowed discriminated union into a new object, TypeScript widens the discriminant back to the full union.

**Why it happens:** This is a [known TypeScript issue](https://github.com/microsoft/TypeScript/issues/54745): "Spreading a discriminated union in a narrowing block widens it back."

**Example:**
```typescript
function copyPayment(payment: PaymentPayload) {
  if (payment.x402Version === 1) {
    const copy = { ...payment }; // copy.x402Version is 1 | 2, not 1
  }
}
```

**Consequences:**
- Copies of narrowed objects lose their narrowed type
- Must re-narrow after spreading
- Unexpected type errors in seemingly correct code

**Prevention:**
1. Document this limitation
2. When copying, explicitly type the result:
   ```typescript
   const copy: PaymentPayloadV1 = { ...payment };
   ```
3. Or access discriminant directly instead of spreading:
   ```typescript
   const copy = { ...payment, x402Version: payment.x402Version as const };
   ```

**Detection:**
- Review code that spreads PaymentPayload after narrowing

---

### Pitfall 7: Non-Literal Discriminant Values Don't Narrow

**What goes wrong:** If the discriminant property is not a literal type, TypeScript cannot narrow the union.

**Why it happens:** Per [TypeScript issues](https://github.com/microsoft/TypeScript/issues/48522): "Narrowing not works on discriminated unions when not using literal type as discriminator property."

**Example of broken pattern:**
```typescript
// BAD: Using number instead of literal
interface PaymentPayloadV1 {
  x402Version: number; // Not a literal!
  // ...
}
```

**Correct pattern:**
```typescript
// GOOD: Using literal type
interface PaymentPayloadV1 {
  x402Version: 1; // Literal 1, not number
  // ...
}
```

**Prevention:**
1. Always use literal types for discriminants: `x402Version: 1` not `x402Version: number`
2. Use `as const` assertions where needed
3. Add type tests that verify narrowing works

**Detection:**
- Review interface definitions for discriminant property types
- Verify discriminant is a literal in each union member

---

## Minor Pitfalls

Annoyances that are easily fixable.

---

### Pitfall 8: Missing Type Exports

**What goes wrong:** SDK exports `PaymentPayload` but not `PaymentPayloadV1` and `PaymentPayloadV2`, forcing consumers to use type extraction.

**Why it happens:** Oversight during refactoring - the union is exported but not its members.

**Consequences:**
- Consumers must use workarounds: `Extract<PaymentPayload, { x402Version: 1 }>`
- Less readable code
- More friction for adoption

**Prevention:**
1. Export all union member types explicitly:
   ```typescript
   export type { PaymentPayloadV1, PaymentPayloadV2, PaymentPayload };
   ```
2. Add to the index.ts exports file
3. Document which types are exported

**Detection:**
- Review index.ts exports after adding union types
- Check that consumers can import individual versions

---

### Pitfall 9: Version Field Name Inconsistency

**What goes wrong:** Using different discriminant field names across the codebase (`x402Version` vs `version` vs `v`).

**Why it happens:** Different developers or different parts of the codebase use different conventions.

**Consequences:**
- Confusion about which field to check
- Code that checks wrong field silently fails to narrow
- Documentation inconsistency

**Prevention:**
1. Standardize on `x402Version` (matches existing code)
2. Add linting rule or type test that enforces consistent naming
3. Document the standard clearly

**Detection:**
- Grep for version-like fields in type definitions
- Code review for consistency

---

### Pitfall 10: Boolean Discriminants Don't Work Reliably

**What goes wrong:** Using a boolean as discriminant sometimes fails to narrow correctly.

**Why it happens:** Per [TypeScript issues](https://github.com/microsoft/TypeScript/issues/51197): "Discriminated union type not narrowed using a discriminant boolean property."

**Example:**
```typescript
// PROBLEMATIC: Boolean discriminant
type Payment =
  | { isV2: false; legacyField: string }
  | { isV2: true; newField: string };
```

**Prevention:**
1. Use literal number or string discriminants instead: `x402Version: 1 | 2`
2. Avoid boolean discriminants for version fields
3. Stick with the numeric version pattern already in use

**Detection:**
- Review discriminant types - prefer numbers/strings over booleans

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Define V1/V2 interfaces | Non-literal discriminant (#7) | Use `x402Version: 1` literal, not `number` |
| Create union type | Breaking change classification (#2) | This is a major version bump |
| Update type guards | Guard becomes incorrect (#1) | Create version-specific guards |
| Update middleware | Destructuring breaks narrowing (#3) | Narrow before accessing properties |
| Export types | Missing exports (#8) | Export V1, V2, and union explicitly |
| Consumer migration | No exhaustive checking (#4) | Provide and document assertNever pattern |

---

## Migration Checklist

Before releasing the union type change:

- [ ] Define `PaymentPayloadV1` and `PaymentPayloadV2` with literal discriminants
- [ ] Create `PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2` union
- [ ] Update `isPaymentPayload()` to properly validate both versions
- [ ] Add `isPaymentPayloadV1()` and `isPaymentPayloadV2()` guards
- [ ] Export all three types from index.ts
- [ ] Review all middleware/client code for destructuring before narrowing
- [ ] Add exhaustive checking helper (`assertNever` or `handlePaymentPayload`)
- [ ] Update documentation with narrowing examples
- [ ] Verify no uses of `Omit`/`Pick` on the union type
- [ ] Bump major version number (this is a breaking change)

---

## Sources

### HIGH Confidence (Official Documentation)
- [TypeScript Handbook: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [semver-ts.org: Breaking Changes](https://www.semver-ts.org/formal-spec/2-breaking-changes.html)
- [TypeScript Handbook: Unions and Intersections](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html)

### MEDIUM Confidence (Verified Community Resources)
- [Effective TypeScript: Type Guards](https://effectivetypescript.com/2024/02/27/type-guards/)
- [TypeScript Deep Dive: Discriminated Unions](https://basarat.gitbook.io/typescript/type-system/discriminated-unions)
- [TkDodo: Omit for Discriminated Unions](https://tkdodo.eu/blog/omit-for-discriminated-unions-in-type-script)
- [Speakeasy: Forward Compatible Unions](https://www.speakeasy.com/blog/open-unions-typescript-type-theory)
- [Michael's Coding Spot: TypeScript API Changes](https://michaelscodingspot.com/typescript-api-change/)

### TypeScript GitHub Issues (Known Limitations)
- [#54745: Spreading widens discriminated unions](https://github.com/microsoft/TypeScript/issues/54745)
- [#48522: Non-literal discriminants don't narrow](https://github.com/microsoft/TypeScript/issues/48522)
- [#51197: Boolean discriminants unreliable](https://github.com/microsoft/TypeScript/issues/51197)
- [#56106: Narrowing fails with assignable types](https://github.com/microsoft/TypeScript/issues/56106)
