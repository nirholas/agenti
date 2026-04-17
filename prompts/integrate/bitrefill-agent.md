# Integrate: Bitrefill Shopping Agent

status: complete

## Source repo
https://github.com/nirholas/bitrefill-agent

## Goal
Add a Bitrefill integration so AI agents can purchase gift cards, eSIMs, and
mobile top-ups using crypto (including x402 USDC on Base). This gives agents
real-world spending capability beyond DeFi.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/bitrefill-agent /tmp/bitrefill-agent
```
Read:
- `/tmp/bitrefill-agent/src/bitrefill-shopping-assistant.json` (full agent definition)
- Any API integration files in `src/`

### 2. Create `packages/sdk/src/bitrefill.ts`

```ts
export interface BitrefillProduct {
  id: string
  name: string
  type: 'giftcard' | 'esim' | 'topup'
  country: string
  currency: string
  denominations: number[]
  minValue?: number
  maxValue?: number
  description?: string
}

export interface BitrefillInvoice {
  id: string
  paymentAddress: string
  paymentMethod: 'bitcoin' | 'lightning' | 'ethereum' | 'usdc' | 'tether'
  amountDue: number
  currency: string
  expiresAt: number
  product: string
  quantity: number
}

export interface BitrefillOrder {
  id: string
  status: 'pending' | 'paid' | 'completed' | 'failed'
  redemptionCode?: string
  deliveryMethod?: 'email' | 'sms' | 'pin'
  createdAt: number
}

export interface BitrefillConfig {
  apiKey: string  // from BITREFILL_API_KEY env var
  testMode?: boolean
}

/**
 * Search for gift cards, eSIMs, or mobile top-ups.
 */
export async function searchProducts(
  config: BitrefillConfig,
  query: string,
  options?: { country?: string; type?: BitrefillProduct['type'] }
): Promise<BitrefillProduct[]>

/**
 * Create a payment invoice for a product.
 * Returns payment address and amount — pass to agent.pay() for crypto settlement.
 */
export async function createInvoice(
  config: BitrefillConfig,
  params: {
    productId: string
    value: number
    currency?: string
    paymentMethod?: BitrefillInvoice['paymentMethod']
    deliveryEmail?: string
  }
): Promise<BitrefillInvoice>

/**
 * Poll order status and return redemption code when ready.
 */
export async function waitForOrder(
  config: BitrefillConfig,
  invoiceId: string,
  options?: { timeoutMs?: number; pollIntervalMs?: number }
): Promise<BitrefillOrder>

/**
 * Get featured products (top gift cards, popular eSIMs).
 * No auth required.
 */
export async function getFeaturedProducts(country?: string): Promise<BitrefillProduct[]>
```

### 3. Add 5 MCP tools to `packages/mcp/src/server.ts`

**`bitrefill_search`**
- Input: `{ query: string, country?: string, type?: string }`
- Searches Bitrefill catalog (no API key needed)
- Returns list of matching products with denominations and prices

**`bitrefill_get_featured`**
- Input: `{ country?: string }`
- Returns top gift cards and eSIMs for a country
- Great for suggesting spending options to agents

**`bitrefill_create_invoice`**
- Input: `{ product_id: string, value: number, delivery_email?: string, api_key?: string }`
- Creates an invoice with a USDC payment address
- The returned payment_address can be passed to the `pay` tool

**`bitrefill_check_order`**
- Input: `{ invoice_id: string, api_key?: string }`
- Polls order status and returns redemption code when ready

**`bitrefill_get_categories`**
- Input: `{ country?: string }`
- Returns available product categories and countries
- Useful for orientation before search

### 4. Add example `examples/08-bitrefill-purchase.ts`
```ts
// Agent buys an Amazon gift card with USDC
// 1. Search for "Amazon" gift cards
// 2. Create invoice (returns USDC payment address)
// 3. agent.pay() handles x402 or direct USDC transfer
// 4. Wait for redemption code
// 5. Deliver code to user
```

### 5. Export from SDK
```ts
// packages/sdk/src/index.ts
export { searchProducts, createInvoice, waitForOrder, getFeaturedProducts } from './bitrefill.js'
export type { BitrefillProduct, BitrefillInvoice, BitrefillOrder, BitrefillConfig } from './bitrefill.js'
```

## Environment variable
- `BITREFILL_API_KEY` — required for invoice creation and order management
- `BITREFILL_TEST_MODE=true` — use test mode for safe dev/testing

## Bitrefill API base URL
- Production: `https://api.bitrefill.com/v2`
- Documentation: https://developers.bitrefill.com/

## Sensitivity check
bitrefill-agent is a JSON agent definition — just prompts and workflow specs.
The Bitrefill API is public and documented. The integration code is standard
REST API client work. Safe to implement from scratch.

## Output files
- `packages/sdk/src/bitrefill.ts`
- Updated `packages/mcp/src/server.ts` (5 new tools)
- Updated `packages/sdk/src/index.ts`
- `examples/08-bitrefill-purchase.ts`

Mark this file's status as `complete` when done.
