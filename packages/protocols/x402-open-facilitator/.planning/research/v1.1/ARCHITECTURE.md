# Architecture Research: SDK v2 + Refund Docs

**Milestone:** v1.1 SDK & Docs
**Research Date:** 2026-01-20
**Overall Confidence:** HIGH

## Executive Summary

This research identifies the integration points for two deliverables: SDK type updates for x402 v2 compliance and a merchant refund guide. The SDK is well-contained within `packages/sdk/` with clear boundaries. Documentation lives in `apps/dashboard/src/app/docs/` as MDX files. Both changes are low-risk, additive modifications.

---

## Part 1: SDK Type Changes Integration

### Current SDK Architecture

The SDK (`packages/sdk/`) is a standalone package with no server dependencies:

```
packages/sdk/src/
  client.ts       - OpenFacilitator class (verify, settle, supported, getFeePayer)
  types.ts        - Type definitions (PaymentPayload, PaymentRequirements, etc.)
  errors.ts       - Error classes (FacilitatorError, VerificationError, etc.)
  networks.ts     - Network utilities (NETWORKS, toV2NetworkId, etc.)
  claims.ts       - Claims API (reportFailure, getClaimable, executeClaim)
  middleware.ts   - Express/Hono middleware helpers
  utils.ts        - Internal utilities (isPaymentPayload, buildUrl)
  index.ts        - Public exports
```

### Files Requiring SDK Type Updates

| File | Changes Needed | Confidence |
|------|----------------|------------|
| `packages/sdk/src/types.ts` | Add v2-specific payload types | HIGH |
| `packages/sdk/src/client.ts` | No changes (already handles both) | HIGH |
| `packages/sdk/src/utils.ts` | Update `isPaymentPayload` type guard | HIGH |

### Current PaymentPayload Type

```typescript
// packages/sdk/src/types.ts (lines 14-51)
export interface PaymentPayload {
  /** x402 version (1 or 2) */
  x402Version: 1 | 2;
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier - v1: "base", v2: "eip155:8453" */
  network: string;
  /** Payment details */
  payload: {
    signature: string;
    authorization: PaymentAuthorization;
  };
}

export interface PaymentAuthorization {
  from: string;
  to: string;
  amount: string;
  asset: string;
  chainId?: number;
  nonce?: string;
  validUntil?: number;
  [key: string]: unknown;
}
```

### x402 v1 vs v2 Differences

| Aspect | v1 | v2 |
|--------|----|----|
| Network ID | Simple string ("base", "solana") | CAIP-2 ("eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp") |
| Top-level scheme | Yes (`scheme: "exact"`) | Yes (unchanged) |
| Top-level network | Yes (`network: "base"`) | Yes (`network: "eip155:8453"`) |
| Payload structure | `payload.signature`, `payload.authorization` | Same structure |

**Key Finding:** The current SDK types already support both v1 and v2. The `network` field accepts any string, and the SDK's `networks.ts` has mapping utilities (`toV2NetworkId`, `toV1NetworkId`). No structural changes needed.

### SDK Type Guard

```typescript
// packages/sdk/src/utils.ts
export function isPaymentPayload(obj: unknown): obj is PaymentPayload {
  // Current implementation checks basic structure
  // May need update for stricter v2 validation
}
```

### Recommendation: Type Refinements (Optional)

For better DX, consider adding discriminated union types:

```typescript
export interface PaymentPayloadV1 {
  x402Version: 1;
  scheme: string;
  network: string; // v1 format: "base", "solana"
  payload: { signature: string; authorization: PaymentAuthorization };
}

export interface PaymentPayloadV2 {
  x402Version: 2;
  scheme: string;
  network: string; // v2 format: "eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
  payload: { signature: string; authorization: PaymentAuthorization };
}

export type PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;
```

This is **additive** and backward compatible.

### SDK Usage Points in Codebase

The SDK is imported in these locations:

| Location | Usage | Impact of Changes |
|----------|-------|-------------------|
| `packages/server/src/routes/public.ts` | Payment middleware | None (types compatible) |
| `packages/server/src/routes/stats.ts` | Payment middleware | None (types compatible) |
| `packages/integration-tests/src/*.ts` | Test fixtures | Update fixtures if types change |
| `apps/dashboard/src/app/claims/setup/page.tsx` | Code examples in UI | Update example code strings |
| `apps/dashboard/src/components/resource-owner/sdk-integration.tsx` | Code examples | Update example code strings |
| `apps/dashboard/src/app/docs/**/*.mdx` | Documentation examples | Update examples |

### Build Order

1. Update `packages/sdk/src/types.ts` (type definitions)
2. Update `packages/sdk/src/utils.ts` (type guard if needed)
3. Run `pnpm --filter=@openfacilitator/sdk build`
4. Update integration tests if needed
5. Update documentation examples

---

## Part 2: Refund Documentation Structure

### Current Documentation Architecture

Documentation lives in the dashboard app as MDX files:

```
apps/dashboard/src/app/docs/
  page.tsx                    - Overview page (not MDX)
  layout.tsx                  - Layout with sidebar navigation
  quickstart/page.mdx         - Getting started guide
  api/page.mdx                - HTTP API reference
  networks/page.mdx           - Supported networks
  dns-setup/page.mdx          - Custom domain setup
  self-hosting/page.mdx       - Self-hosting guide
  sdk/
    page.mdx                  - SDK overview
    installation/page.mdx     - Installation guide
    verify/page.mdx           - verify() method
    settle/page.mdx           - settle() method
    supported/page.mdx        - supported() method
    fee-payer/page.mdx        - Fee payer guide
    networks/page.mdx         - Network utilities
    errors/page.mdx           - Error handling
```

### Navigation Structure

```typescript
// apps/dashboard/src/components/docs/Sidebar.tsx
const navigation: NavItem[] = [
  { title: 'Overview', href: '/docs' },
  { title: 'Quickstart', href: '/docs/quickstart' },
  {
    title: 'SDK',
    href: '/docs/sdk',
    children: [
      { title: 'Installation', href: '/docs/sdk/installation' },
      { title: 'verify()', href: '/docs/sdk/verify' },
      { title: 'settle()', href: '/docs/sdk/settle' },
      { title: 'supported()', href: '/docs/sdk/supported' },
      { title: 'Fee Payer', href: '/docs/sdk/fee-payer' },
      { title: 'Networks', href: '/docs/sdk/networks' },
      { title: 'Errors', href: '/docs/sdk/errors' },
    ],
  },
  { title: 'HTTP API', href: '/docs/api' },
  { title: 'Networks', href: '/docs/networks' },
  { title: 'DNS Setup', href: '/docs/dns-setup' },
  { title: 'Self-Hosting', href: '/docs/self-hosting' },
];
```

### Mobile Navigation

```typescript
// apps/dashboard/src/app/docs/layout.tsx
const bottomNavItems = [
  { href: '/docs', label: 'Overview', icon: Book },
  { href: '/docs/quickstart', label: 'Start', icon: Rocket },
  { href: '/docs/sdk', label: 'SDK', icon: Code },
  { href: '/docs/networks', label: 'Networks', icon: Globe },
  { href: '#more', label: 'More', icon: MoreHorizontal, isMenu: true },
];

const moreMenuItems = [
  { href: '/docs/api', label: 'HTTP API' },
  { href: '/docs/dns-setup', label: 'DNS Setup' },
  { href: '/docs/self-hosting', label: 'Self-Hosting' },
  { href: '/docs/sdk/errors', label: 'Error Handling' },
];
```

### Recommended Refund Guide Location

**Option A: Top-level guide**
- Path: `/docs/refunds/page.mdx`
- Pro: Visible at top navigation level
- Con: Not grouped with SDK

**Option B: SDK sub-page** (RECOMMENDED)
- Path: `/docs/sdk/refunds/page.mdx`
- Pro: Grouped with SDK methods, logical location for integration guide
- Con: Requires clicking into SDK section

**Recommendation:** Option B. The refund functionality is an SDK feature (`reportFailure`, `withRefundProtection`, middleware). Group it with other SDK docs.

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/dashboard/src/app/docs/sdk/refunds/page.mdx` | CREATE | Refund how-to guide |
| `apps/dashboard/src/components/docs/Sidebar.tsx` | MODIFY | Add "Refunds" nav item |
| `apps/dashboard/src/app/docs/layout.tsx` | MODIFY | Add to mobile "More" menu |

### Refund Guide Structure Recommendation

Based on existing SDK documentation patterns and the claims/middleware implementation:

```markdown
# Refund Protection

<PageHeader title="Refund Protection" description="..." />

## Overview
- What refund protection is
- When to use it (API failures after payment)

## Quick Start
- Register as resource owner (dashboard UI)
- Generate refund wallet
- Register server + get API key
- Integrate SDK

## Integration Options
### Option 1: Automatic (Recommended)
- honoPaymentMiddleware with refundProtection config
- createPaymentMiddleware with refundProtection config

### Option 2: Manual
- withRefundProtection wrapper
- reportFailure direct API

## Code Examples
- Hono example
- Express example
- Manual example

## How Payouts Work
- Claim lifecycle (pending -> approved -> paid)
- Auto-approval vs manual approval
- Gasless transfers (facilitator pays fees)

## Dashboard Management
- View claims
- Approve/reject
- Fund refund wallet

## API Reference
- reportFailure params
- getClaimable params
- executeClaim params

## Best Practices
- Error handling
- Retry logic
- When NOT to report (user errors vs system errors)
```

### Existing Refund Content

The refund functionality exists in the codebase:

1. **SDK exports** (`packages/sdk/src/index.ts`):
   - `reportFailure`, `getClaimable`, `getClaimHistory`, `executeClaim`
   - `withRefundProtection`, `createRefundMiddleware`, `honoRefundMiddleware`
   - `createPaymentMiddleware` with `refundProtection` option
   - `honoPaymentMiddleware` with `refundProtection` option

2. **Dashboard UI** (`apps/dashboard/src/components/refunds-section.tsx`):
   - Refund wallet management
   - Server registration
   - Claims list with approve/reject/execute

3. **Code examples in UI** (`apps/dashboard/src/components/resource-owner/sdk-integration.tsx`):
   - Already has SDK, Hono, and Express examples
   - Can extract these for documentation

---

## Integration Points Summary

### Phase 1: SDK Type Updates

```
packages/sdk/src/types.ts     -- Update types
packages/sdk/src/utils.ts     -- Update type guard
packages/sdk/src/index.ts     -- No changes (exports same)
```

### Phase 2: Documentation Updates

```
apps/dashboard/src/app/docs/sdk/refunds/page.mdx    -- CREATE
apps/dashboard/src/components/docs/Sidebar.tsx       -- Add nav item
apps/dashboard/src/app/docs/layout.tsx               -- Add mobile nav
```

### Phase 3: Example Updates (if types change)

```
apps/dashboard/src/app/docs/quickstart/page.mdx
apps/dashboard/src/app/docs/sdk/page.mdx
apps/dashboard/src/app/docs/sdk/verify/page.mdx
apps/dashboard/src/app/docs/sdk/settle/page.mdx
apps/dashboard/src/app/claims/setup/page.tsx
apps/dashboard/src/components/resource-owner/sdk-integration.tsx
```

---

## Quality Gate Checklist

- [x] SDK usage points in codebase identified
- [x] Refund flow documented
- [x] Docs location determined

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| SDK type changes | HIGH | Examined current types, minimal changes needed |
| Docs location | HIGH | Clear existing pattern to follow |
| Integration points | HIGH | Grep found all usages |
| Build order | HIGH | Standard monorepo workflow |

## Open Questions

1. Should v2 types be discriminated unions or keep current flexible structure?
   - **Recommendation:** Discriminated unions for better DX, but optional

2. Should refund guide include video/screenshots?
   - **Recommendation:** Code examples only for v1.1, media can be added later

---

*Research complete. Ready for roadmap creation.*
