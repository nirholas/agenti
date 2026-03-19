# Stack Research: x402 v2 SDK Compliance

**Project:** OpenFacilitator SDK v1.1
**Researched:** 2026-01-20
**Overall Confidence:** HIGH
**Source:** @x402/core@2.2.0 npm package (verified against dist/cjs/mechanisms-CzuGzYsS.d.ts)

## Executive Summary

The @x402/core package v2.2.0 defines clear type definitions for both v1 and v2 PaymentPayload formats. The SDK update requires aligning OpenFacilitator's types with these official definitions. Key differences from the current SDK types have been identified and documented below.

---

## Verified Type Definitions from @x402/core@2.2.0

### Network Type

```typescript
type Network = `${string}:${string}`;  // CAIP-2 format, e.g., "eip155:8453", "solana:mainnet"
```

### PaymentPayloadV1 (x402 Version 1)

```typescript
type PaymentPayloadV1 = {
  x402Version: 1;
  scheme: string;
  network: Network;
  payload: Record<string, unknown>;
};
```

**Key characteristics:**
- `x402Version` is literal `1` (not generic number)
- `scheme` and `network` at top level (flat structure)
- `payload` is generic `Record<string, unknown>`

### PaymentPayload (x402 Version 2 - Current)

```typescript
type PaymentPayload = {
  x402Version: number;
  resource: ResourceInfo;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
};

interface ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}
```

**Key characteristics:**
- `x402Version` is generic `number` (not literal `2`)
- `resource` contains URL, description, mimeType (new in v2)
- `accepted` contains the selected PaymentRequirements (nested structure)
- `extensions` optional for protocol extensions
- NO top-level `scheme` or `network` - these are inside `accepted`

### PaymentRequirements (v2)

```typescript
type PaymentRequirements = {
  scheme: string;
  network: Network;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
};
```

### PaymentRequirementsV1

```typescript
type PaymentRequirementsV1 = {
  scheme: string;
  network: Network;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  outputSchema: Record<string, unknown>;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: Record<string, unknown>;
};
```

### PaymentRequired (402 Response - v2)

```typescript
type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
};
```

### PaymentRequiredV1 (402 Response - v1)

```typescript
type PaymentRequiredV1 = {
  x402Version: 1;
  error?: string;
  accepts: PaymentRequirementsV1[];
};
```

### VerifyRequest/Response

```typescript
type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
};
```

### SettleRequest/Response

```typescript
type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type SettleResponse = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
};
```

### SupportedResponse

```typescript
type SupportedKind = {
  x402Version: number;
  scheme: string;
  network: Network;
  extra?: Record<string, unknown>;
};

type SupportedResponse = {
  kinds: SupportedKind[];
  extensions: string[];
  signers: Record<string, string[]>;
};
```

---

## Comparison: Current SDK vs @x402/core

### PaymentPayload Discrepancies

| Field | Current SDK | @x402/core v2 | @x402/core v1 | Action |
|-------|-------------|---------------|---------------|--------|
| `x402Version` | `1 \| 2` | `number` | `1` (literal) | Keep union for SDK, matches both |
| `scheme` | top-level | in `accepted` | top-level | Move to union type |
| `network` | top-level | in `accepted` | top-level | Move to union type |
| `resource` | absent | `ResourceInfo` | absent | Add to v2 type |
| `accepted` | absent | `PaymentRequirements` | absent | Add to v2 type |
| `extensions` | absent | optional | absent | Add to v2 type |
| `payload.signature` | typed | `Record<string, unknown>` | generic | Keep generic |
| `payload.authorization` | typed | `Record<string, unknown>` | generic | Keep generic |

### PaymentRequirements Discrepancies

| Field | Current SDK | @x402/core v2 | Action |
|-------|-------------|---------------|--------|
| `maxAmountRequired` | present | absent (use `amount`) | v1 only |
| `amount` | absent | present | Add for v2 |
| `resource` | optional string | absent (in parent) | v1 only |
| `description` | optional | absent (in parent) | v1 only |
| `mimeType` | optional | absent (in parent) | v1 only |
| `outputSchema` | optional | absent | v1 only |
| `extra` | optional | required | Make required |

---

## Recommended SDK Type Definitions

### Union Type Approach

```typescript
import type {
  PaymentPayload as X402PaymentPayloadV2,
  PaymentPayloadV1 as X402PaymentPayloadV1,
  PaymentRequirements as X402PaymentRequirements,
  PaymentRequirementsV1 as X402PaymentRequirementsV1,
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
  SupportedResponse,
  Network,
} from '@x402/core/types';

// Re-export for SDK consumers
export type {
  VerifyResponse,
  SettleResponse,
  SupportedResponse,
  Network,
};

// Union types for methods that handle both versions
export type PaymentPayload = X402PaymentPayloadV1 | X402PaymentPayloadV2;
export type PaymentRequirements = X402PaymentRequirementsV1 | X402PaymentRequirements;

// Type guards for version discrimination
export function isV1Payload(payload: PaymentPayload): payload is X402PaymentPayloadV1 {
  return payload.x402Version === 1 && 'scheme' in payload;
}

export function isV2Payload(payload: PaymentPayload): payload is X402PaymentPayloadV2 {
  return payload.x402Version >= 2 && 'accepted' in payload;
}
```

### Alternative: Direct Re-export

```typescript
// Simply re-export from @x402/core
export {
  PaymentPayload,
  PaymentPayloadV1,
  PaymentRequirements,
  PaymentRequirementsV1,
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
  SupportedResponse,
  Network,
} from '@x402/core/types';

export { PaymentPayloadV1, PaymentRequirementsV1 } from '@x402/core/types/v1';
```

---

## Additional Types from @x402/core

### For Facilitator Implementation

```typescript
interface SchemeNetworkFacilitator {
  readonly scheme: string;
  readonly caipFamily: string;  // e.g., "eip155:*", "solana:*"
  getExtra(network: Network): Record<string, unknown> | undefined;
  getSigners(network: string): string[];
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}
```

### For Client Implementation

```typescript
interface SchemeNetworkClient {
  readonly scheme: string;
  createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements
  ): Promise<Pick<PaymentPayload, "x402Version" | "payload">>;
}
```

### Error Classes

```typescript
declare class VerifyError extends Error {
  readonly invalidReason?: string;
  readonly payer?: string;
  readonly statusCode: number;
  constructor(statusCode: number, response: VerifyResponse);
}

declare class SettleError extends Error {
  readonly errorReason?: string;
  readonly payer?: string;
  readonly transaction: string;
  readonly network: Network;
  readonly statusCode: number;
  constructor(statusCode: number, response: SettleResponse);
}
```

---

## Import Paths

From @x402/core v2.2.0:

```typescript
// Main exports (v2 types as default)
import {
  PaymentPayload,
  PaymentRequirements,
  PaymentRequired,
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
  SupportedResponse,
  Network,
  VerifyError,
  SettleError,
} from '@x402/core/types';

// V1 specific types
import {
  PaymentPayloadV1,
  PaymentRequirementsV1,
  PaymentRequiredV1,
  VerifyRequestV1,
  SettleRequestV1,
  SettleResponseV1,
  SupportedResponseV1,
} from '@x402/core/types/v1';

// Facilitator types
import { x402Facilitator } from '@x402/core/facilitator';

// Client types
import { x402Client, x402HTTPClient } from '@x402/core/client';

// Server types
import { x402ResourceServer, x402HTTPResourceServer } from '@x402/core/server';
```

---

## Package Installation

```bash
# Add or update @x402/core
pnpm add @x402/core@^2.2.0
```

---

## Implementation Recommendations

### 1. Use @x402/core Types Directly

Instead of maintaining separate type definitions, import directly from @x402/core. This ensures type compatibility and reduces maintenance burden.

### 2. Create Union Types for SDK Methods

The SDK's `verify()` and `settle()` methods should accept a union type that handles both v1 and v2 payloads:

```typescript
async verify(
  paymentPayload: PaymentPayloadV1 | PaymentPayload,
  paymentRequirements: PaymentRequirementsV1 | PaymentRequirements
): Promise<VerifyResponse>
```

### 3. Add Type Guards

Provide type guard functions for consumers who need to discriminate between versions:

```typescript
function isV1Payload(p: PaymentPayloadV1 | PaymentPayload): p is PaymentPayloadV1 {
  return p.x402Version === 1 && 'scheme' in p && !('accepted' in p);
}
```

### 4. Deprecate Custom PaymentAuthorization

The current SDK defines a custom `PaymentAuthorization` type. In @x402/core, the payload is `Record<string, unknown>`. Either:
- Keep as convenience type but mark as SDK-specific
- Remove and use generic payload typing

---

## Sources

- **@x402/core@2.2.0** - npm package, downloaded and extracted
  - dist/cjs/mechanisms-CzuGzYsS.d.ts (lines 1-270)
  - dist/cjs/types/index.d.ts
  - dist/cjs/types/v1/index.d.ts
  - dist/cjs/facilitator/index.d.ts
  - dist/cjs/client/index.d.ts
  - dist/cjs/server/index.d.ts
- npm registry: https://registry.npmjs.org/@x402/core
- Published: "a week ago" (circa 2026-01-13)
