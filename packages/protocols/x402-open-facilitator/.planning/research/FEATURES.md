# Feature Landscape: SDK v2 Compliance

**Domain:** Payment SDK versioning (x402 v1 to v2)
**Researched:** 2026-01-20
**Confidence:** MEDIUM (official spec found, but accepted field pattern from PRD needs verification)

## Executive Summary

The @openfacilitator/sdk needs to handle both x402 v1 and v2 PaymentPayload formats. The key difference is:
- **v1:** `scheme` and `network` at top level
- **v2:** `scheme` and `network` nested in `accepted` object

This requires discriminated union types and version-aware extraction helpers.

## Version Format Differences

### x402 v1 PaymentPayload Structure

```typescript
interface PaymentPayloadV1 {
  x402Version: 1;
  scheme: string;           // Top-level
  network: string;          // Top-level (e.g., "base", "solana")
  payload: {
    signature: string;
    authorization: Authorization;
  };
}
```

### x402 v2 PaymentPayload Structure

```typescript
interface PaymentPayloadV2 {
  x402Version: 2;
  accepted: {               // Nested in accepted object
    scheme: string;
    network: string;        // CAIP-2 format (e.g., "eip155:8453")
    amount: string;
    asset: string;
  };
  payload: {
    signature: string;
    authorization: Authorization;
  };
}
```

**Key Differences:**

| Field | v1 Location | v2 Location |
|-------|-------------|-------------|
| scheme | Top level | accepted.scheme |
| network | Top level | accepted.network |
| network format | Human-readable ("base") | CAIP-2 ("eip155:8453") |

## Table Stakes Features

Features SDK consumers expect. Missing = SDK feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Type-safe version discrimination | SDK users need TypeScript to narrow types correctly | Low | Use discriminated union on x402Version |
| Backward compatible verify() | Existing v1 code must not break | Low | Version check inside method |
| Backward compatible settle() | Existing v1 code must not break | Low | Version check inside method |
| Helper to extract scheme/network | Common operation, should be easy | Low | Single function |
| Both type exports | Consumers need to type their code | Low | Export PaymentPayloadV1, PaymentPayloadV2, PaymentPayload |

## Differentiators

Features that improve DX but aren't strictly required.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Type guards (isV1, isV2) | Enable consumers to discriminate manually | Low | Runtime + type narrowing |
| Network normalization helpers | Convert between "base" and "eip155:8453" | Low | Already exists in SDK |
| Version-specific type exports | Allow consumers to be explicit about version | Low | Export PaymentPayloadV1, PaymentPayloadV2 |
| Automatic version detection | SDK detects version from payload structure | Medium | Useful for middleware |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-migration of payloads | Creates hidden complexity, signatures would be invalid | Keep versions separate, extract data |
| Deprecation warnings for v1 | v1 is still valid, don't spam users | Support both equally |
| Breaking API changes | Would require major version bump | Keep verify()/settle() signatures identical |
| Version-specific methods | verify1(), verify2() fragments API | Single method handles both |

## Recommended Type Pattern

### Discriminated Union Approach

Use TypeScript discriminated unions for type-safe version handling:

```typescript
// Version-specific types
interface PaymentPayloadV1 {
  x402Version: 1;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: PaymentAuthorization;
  };
}

interface PaymentPayloadV2 {
  x402Version: 2;
  accepted: {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
  };
  payload: {
    signature: string;
    authorization: PaymentAuthorization;
  };
}

// Union type
type PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;
```

**Confidence:** HIGH - This is standard TypeScript discriminated union pattern

### Type Guards

Provide runtime type guards that also narrow TypeScript types:

```typescript
export function isPaymentPayloadV1(
  payload: PaymentPayload
): payload is PaymentPayloadV1 {
  return payload.x402Version === 1;
}

export function isPaymentPayloadV2(
  payload: PaymentPayload
): payload is PaymentPayloadV2 {
  return payload.x402Version === 2;
}
```

**Confidence:** HIGH - Standard TypeScript pattern

### Version-Agnostic Helper

Extract scheme/network regardless of version:

```typescript
interface SchemeNetwork {
  scheme: string;
  network: string;
}

export function getSchemeNetwork(payload: PaymentPayload): SchemeNetwork {
  if (payload.x402Version === 1) {
    return {
      scheme: payload.scheme,
      network: payload.network,
    };
  } else {
    return {
      scheme: payload.accepted.scheme,
      network: payload.accepted.network,
    };
  }
}
```

**Confidence:** MEDIUM - Pattern matches PRD helper, but v2 structure from PRD needs verification

## Export Recommendations

### Current Exports (Keep)

```typescript
export type { PaymentPayload } from './types.js';
export { isPaymentPayload } from './utils.js';
```

### New Exports (Add)

```typescript
// Version-specific types
export type { PaymentPayloadV1, PaymentPayloadV2 } from './types.js';

// Type guards
export { isPaymentPayloadV1, isPaymentPayloadV2 } from './utils.js';

// Helper
export { getSchemeNetwork, type SchemeNetwork } from './utils.js';
```

## Implementation Approach

### verify() Method Changes

```typescript
async verify(
  payment: PaymentPayload,  // Union type unchanged
  requirements: PaymentRequirements
): Promise<VerifyResponse> {
  // Extract version-agnostic fields
  const { scheme, network } = getSchemeNetwork(payment);

  // Rest of implementation uses scheme/network
  const body = {
    x402Version: payment.x402Version,
    paymentPayload: payment,
    paymentRequirements: requirements,
  };
  // ... existing logic
}
```

### settle() Method Changes

Same pattern as verify() - extract scheme/network at top of method.

### isPaymentPayload() Update

```typescript
export function isPaymentPayload(value: unknown): value is PaymentPayload {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  // Check x402Version is valid
  if (obj.x402Version !== 1 && obj.x402Version !== 2) return false;

  // Version-specific validation
  if (obj.x402Version === 1) {
    return (
      typeof obj.scheme === 'string' &&
      typeof obj.network === 'string' &&
      obj.payload !== undefined
    );
  } else {
    // v2 has scheme/network in accepted
    const accepted = obj.accepted as Record<string, unknown> | undefined;
    return (
      accepted !== undefined &&
      typeof accepted.scheme === 'string' &&
      typeof accepted.network === 'string' &&
      obj.payload !== undefined
    );
  }
}
```

## Feature Dependencies

```
PaymentPayload types (v1/v2)
    |
    +-- Type guards (isV1, isV2)
    |       |
    |       +-- isPaymentPayload (validator)
    |
    +-- getSchemeNetwork helper
            |
            +-- verify() uses helper
            +-- settle() uses helper
```

## Backward Compatibility

**Goal:** Zero breaking changes for existing SDK consumers.

| Current Usage | After Update |
|---------------|--------------|
| `verify(v1Payload, requirements)` | Works unchanged |
| `settle(v1Payload, requirements)` | Works unchanged |
| `isPaymentPayload(value)` | Works, now handles v2 too |
| `type PaymentPayload` | Now union type, still compatible |

**No Breaking Changes:**
- Existing v1 code continues to work
- PaymentPayload type is union (v1 | v2), which accepts v1
- verify() and settle() signatures unchanged

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Discriminated union pattern | HIGH | Standard TypeScript, verified in official docs |
| Type guard pattern | HIGH | Standard TypeScript pattern |
| v2 accepted field structure | MEDIUM | From PRD, needs verification against live x402 v2 |
| Export recommendations | HIGH | Non-breaking additions |
| verify/settle changes | MEDIUM | Logic is sound, but v2 payload parsing needs testing |

## Open Questions

1. **v2 accepted field structure:** PRD shows `payload.accepted.scheme`, but some x402 specs show `accepted` at top level. Need to verify actual v2 format.

2. **Network format handling:** v2 uses CAIP-2 format. Should SDK normalize networks or pass through? (Recommendation: pass through, existing network utilities handle conversion)

3. **PaymentRequirements for v2:** Does v2 change PaymentRequirements structure too, or only PaymentPayload?

## Sources

- [x402 GitHub Repository](https://github.com/coinbase/x402) - Official protocol source
- [x402 v2 Launch Announcement](https://www.x402.org/writing/x402-v2-launch) - v2 overview
- [x402 EVM Scheme Specification](https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md) - accepted field structure
- [TypeScript Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) - Pattern reference
- [Coinbase Developer Docs](https://docs.cdp.coinbase.com/x402/welcome) - CAIP-2 network identifiers
- Existing SDK code at `/Users/rawgroundbeef/Projects/openfacilitator/packages/sdk/src/types.ts`
