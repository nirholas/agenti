# Phase 15: Refund Documentation - Research

**Researched:** 2026-01-21
**Domain:** SDK Documentation (MDX)
**Confidence:** HIGH

## Summary

This phase creates a comprehensive refund guide for merchants. The documentation infrastructure is already well-established with MDX support, custom components (`Callout`, `PageHeader`), and a clear sidebar structure. The SDK already exports all required refund-related functions (`reportFailure`, `withRefundProtection`, `createPaymentContext`) and types.

The primary work is authoring a single MDX page that follows existing documentation patterns (flow: PageHeader -> concept -> usage examples -> parameter tables -> errors -> tips).

**Primary recommendation:** Create `/docs/sdk/refunds/page.mdx` following the established pattern in `settle/page.mdx` and `verify/page.mdx`, with emphasis on the two usage patterns: direct `reportFailure` calls and the `withRefundProtection` wrapper.

## Docs Structure

### Location and Naming
- **Directory:** `apps/dashboard/src/app/docs/sdk/refunds/`
- **File:** `page.mdx` (Next.js App Router convention)
- **Route:** `/docs/sdk/refunds`

### Existing SDK Docs Structure
```
apps/dashboard/src/app/docs/
├── sdk/
│   ├── page.mdx           # SDK overview with method table
│   ├── installation/page.mdx
│   ├── verify/page.mdx
│   ├── settle/page.mdx
│   ├── supported/page.mdx
│   ├── fee-payer/page.mdx
│   ├── networks/page.mdx
│   └── errors/page.mdx
│   └── refunds/page.mdx   # <-- NEW (to be created)
```

### Sidebar Configuration
- **File:** `apps/dashboard/src/components/docs/Sidebar.tsx`
- **Pattern:** Static `navigation` array with `NavItem` objects
- **SDK children:** Listed under `{ title: 'SDK', href: '/docs/sdk', children: [...] }`
- **Action required:** Add `{ title: 'Refunds', href: '/docs/sdk/refunds' }` to SDK children array

### MDX Components Available
- `<PageHeader title="..." description="..." />` - Required at top of every page
- `<Callout type="info|warning|tip|danger">` - For callouts/admonitions
- Standard markdown: code blocks, tables, lists, links

## reportFailure API

### Function Signature
```typescript
// Source: packages/sdk/src/claims.ts (lines 55-103)
export async function reportFailure(params: ReportFailureParams): Promise<ReportFailureResponse>
```

### Parameters (ReportFailureParams)
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `facilitatorUrl` | `string` | Yes | The facilitator URL (e.g., `https://api.openfacilitator.io`) |
| `apiKey` | `string` | Yes | The API key from server registration |
| `originalTxHash` | `string` | Yes | The original transaction hash that failed |
| `userWallet` | `string` | Yes | The user's wallet address to receive the refund |
| `amount` | `string` | Yes | The amount to refund (in atomic units, e.g., "1000000" for $1 USDC) |
| `asset` | `string` | Yes | The asset address (token contract) |
| `network` | `string` | Yes | The network (e.g., "base", "solana", or CAIP-2 format) |
| `reason` | `string` | No | Optional reason for the failure |

### Response (ReportFailureResponse)
```typescript
interface ReportFailureResponse {
  success: boolean;
  claimId?: string;  // Present if success: true
  error?: string;    // Present if success: false
}
```

### Import Path
```typescript
// Primary import
import { reportFailure } from '@openfacilitator/sdk';

// Types
import type { ReportFailureParams, ReportFailureResponse } from '@openfacilitator/sdk';
```

### Error Scenarios
| Scenario | Error Message |
|----------|---------------|
| Invalid/missing API key | "Invalid API key" |
| Inactive server | "Server is not active" |
| Refunds disabled | "Refunds are not enabled for this facilitator" |
| Duplicate claim | "Claim already exists for this transaction" |
| No refund wallet | "No refund wallet configured for network: {network}" |

**Note:** `reportFailure` does NOT throw exceptions - it returns `{ success: false, error: "..." }` on failure.

## withRefundProtection Middleware

### Function Signature
```typescript
// Source: packages/sdk/src/middleware.ts (lines 70-115)
export function withRefundProtection<T>(
  config: RefundProtectionConfig,
  handler: (context: PaymentContext) => Promise<T>
): (context: PaymentContext) => Promise<T>
```

### RefundProtectionConfig
```typescript
interface RefundProtectionConfig {
  /** The API key from server registration (required) */
  apiKey: string;
  /** The facilitator URL (required) */
  facilitatorUrl: string;
  /** Optional: Custom error filter - return false to skip reporting */
  shouldReport?: (error: Error) => boolean;
  /** Optional: Called when a failure is reported */
  onReport?: (claimId: string | undefined, error: Error) => void;
  /** Optional: Called when reporting fails */
  onReportError?: (reportError: Error, originalError: Error) => void;
}
```

### PaymentContext
```typescript
interface PaymentContext {
  /** Transaction hash from settlement */
  transactionHash: string;
  /** User's wallet address (payer) */
  userWallet: string;
  /** Payment amount in atomic units */
  amount: string;
  /** Asset/token address */
  asset: string;
  /** Network identifier (e.g., "base", "solana") */
  network: string;
}
```

### Behavior
1. Wraps an async handler function
2. If handler throws, automatically calls `reportFailure` with error details
3. Always re-throws the original error after reporting
4. Optional callbacks for reporting success/failure

### Helper: createPaymentContext
```typescript
// Source: packages/sdk/src/middleware.ts (lines 302-332)
export function createPaymentContext(
  settleResponse: { transaction: string; payer: string; network: string },
  paymentPayload: Record<string, unknown>,
  requirements?: { maxAmountRequired?: string; amount?: string; asset?: string }
): PaymentContext
```

This helper extracts `PaymentContext` from settle response and payment payload.

## Code Example Patterns

### Existing Pattern (from verify/page.mdx, settle/page.mdx)

1. **Page header**
```mdx
<PageHeader title="Title" description="Brief description." />
```

2. **Usage section** - minimal snippet
```mdx
## Usage

\`\`\`typescript
const result = await facilitator.method(args);
\`\`\`
```

3. **Parameters table**
```mdx
## Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `param` | `Type` | Description |
```

4. **Response interface**
```mdx
## Response

\`\`\`typescript
interface ResponseType {
  // fields
}
\`\`\`
```

5. **Full example**
```mdx
## Example

\`\`\`typescript
// Complete working example
\`\`\`
```

6. **Error handling**
```mdx
## Errors

Description of errors, with code example of handling.
```

7. **Callouts for tips/warnings**
```mdx
<Callout type="tip">
Tip content here.
</Callout>
```

### Code Style
- TypeScript with full type annotations
- Import statements at top of examples
- Comments for clarity where needed
- Real addresses (Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

## Relevant Types

### From SDK exports (packages/sdk/src/index.ts)
```typescript
// Core types needed for refund docs
export type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
} from './types.js';

// Claims types
export type {
  ReportFailureParams,
  ReportFailureResponse,
} from './claims.js';

// Middleware types
export type {
  RefundProtectionConfig,
  PaymentContext,
} from './middleware.js';
```

### Type Definitions to Show in Docs
1. **ReportFailureParams** - already documented above
2. **ReportFailureResponse** - already documented above
3. **RefundProtectionConfig** - already documented above
4. **PaymentContext** - already documented above

These should be shown inline in the docs (following verify/page.mdx pattern).

## Error Handling

### reportFailure Error Pattern
`reportFailure` does NOT throw - returns error in response:
```typescript
const result = await reportFailure({...});

if (!result.success) {
  console.error('Failed to report:', result.error);
  // Handle error - the original operation already failed
}
```

### withRefundProtection Error Pattern
The wrapper catches errors, reports them, then re-throws:
```typescript
const protectedHandler = withRefundProtection(config, async (ctx) => {
  // If this throws, failure is auto-reported
  throw new Error('Service unavailable');
});

try {
  await protectedHandler(paymentContext);
} catch (error) {
  // Original error is re-thrown after reporting
  // Claim was already created (if reporting succeeded)
}
```

### Partial Failure Warning
Critical scenario to document: Payment succeeded but service failed:
- User paid via x402
- Payment was settled successfully (funds transferred)
- Then your service logic fails
- User should get a refund

This is THE use case for refund protection.

## Planning Implications

### Files to Create
1. `apps/dashboard/src/app/docs/sdk/refunds/page.mdx` - main documentation page

### Files to Modify
1. `apps/dashboard/src/components/docs/Sidebar.tsx` - add navigation entry

### Page Structure (Recommended Flow)
1. PageHeader - "Refund Protection"
2. Brief intro paragraph (why refunds matter in x402)
3. **Setup** - prerequisites (API key registration, refund wallet)
4. **Using reportFailure** - direct API usage
   - Function signature
   - Parameters table
   - Response type
   - Complete example
5. **Using withRefundProtection** - wrapper pattern
   - Function signature
   - Config options table
   - PaymentContext type
   - Complete example with createPaymentContext
6. **Error Handling** - what can go wrong
7. **Troubleshooting** - common issues and solutions

### Key Points to Cover
1. **When to use which approach:**
   - `reportFailure`: Direct control, custom error handling
   - `withRefundProtection`: Automatic reporting on any thrown error

2. **Prerequisites:**
   - Registered server with API key
   - Funded refund wallet on the network(s) you use
   - Refunds enabled for your facilitator

3. **Critical warning:** Partial failure scenario

4. **Network formats:** Both simple ("base", "solana") and CAIP-2 ("eip155:8453") are accepted

---

## RESEARCH COMPLETE

**Phase:** 15 - Refund Documentation
**Confidence:** HIGH

### Key Findings

- Documentation infrastructure exists and is mature (MDX, components, sidebar)
- All refund SDK exports are already in place (`reportFailure`, `withRefundProtection`, `createPaymentContext`)
- Pattern to follow is clear from existing SDK docs (verify, settle, errors pages)
- Sidebar is a static array - simple modification required
- No new components needed - use existing `PageHeader` and `Callout`

### Files Created

`/Users/rawgroundbeef/Projects/openfacilitator/.planning/phases/15-refund-documentation/15-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Docs Structure | HIGH | Verified by reading existing files |
| reportFailure API | HIGH | Directly read SDK source code |
| withRefundProtection API | HIGH | Directly read SDK source code |
| Example Patterns | HIGH | Verified from multiple existing docs |
| Error Handling | HIGH | Read both client and server implementations |

### Open Questions

None - all research questions were answered by examining the codebase directly.

### Ready for Planning

Research complete. Planner can now create PLAN.md files.
