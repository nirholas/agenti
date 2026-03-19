# Integration Patterns

Complete working examples for every common integration pattern.

---

## 1. Express Middleware — API Paywall

Protect an endpoint behind a $1 USDC payment on Base.

```typescript
import express from 'express';
import { createPaymentMiddleware } from '@openfacilitator/sdk';
import type { PaymentContext } from '@openfacilitator/sdk';

const app = express();

const paymentMiddleware = createPaymentMiddleware({
  facilitator: 'https://pay.openfacilitator.io',
  getRequirements: () => ({
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000', // $1 USDC
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xYOUR_WALLET_ADDRESS',
  }),
});

app.post('/api/premium-data', paymentMiddleware, (req, res) => {
  // Payment is verified and settled at this point
  const { transactionHash, userWallet, amount } =
    (req as unknown as { paymentContext: PaymentContext }).paymentContext;

  res.json({
    success: true,
    txHash: transactionHash,
    payer: userWallet,
    data: { /* your premium content */ },
  });
});

app.listen(3000);
```

---

## 2. Hono Middleware — API Paywall

Same pattern, Hono framework.

```typescript
import { Hono } from 'hono';
import { honoPaymentMiddleware } from '@openfacilitator/sdk';
import type { PaymentContext } from '@openfacilitator/sdk';

type Env = { Variables: { paymentContext: PaymentContext } };
const app = new Hono<Env>();

app.post('/api/premium-data', honoPaymentMiddleware({
  facilitator: 'https://pay.openfacilitator.io',
  getRequirements: (c) => ({
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000', // $1 USDC
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xYOUR_WALLET_ADDRESS',
  }),
}), async (c) => {
  const { transactionHash, userWallet } = c.get('paymentContext');

  return c.json({
    success: true,
    txHash: transactionHash,
    payer: userWallet,
    data: { /* your premium content */ },
  });
});

export default app;
```

---

## 3. Manual Verify + Settle — Full Control (Priority Pattern)

Use this when you need business logic between verification and settlement. This is the most flexible pattern.

**Use case:** User pays $1 to unlock content. You verify the payment, create a database record, then settle.

```typescript
import { Hono } from 'hono';
import { OpenFacilitator } from '@openfacilitator/sdk';
import type { PaymentRequirementsV1, PaymentPayload } from '@openfacilitator/sdk';

const app = new Hono();
const facilitator = new OpenFacilitator(); // defaults to pay.openfacilitator.io

app.post('/api/unlock-content', async (c) => {
  const xPayment = c.req.header('x-payment');

  // Define what payment we require
  const requirements: PaymentRequirementsV1 = {
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000', // $1 USDC
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xYOUR_WALLET_ADDRESS',
  };

  // No payment header? Return 402 with requirements
  if (!xPayment) {
    return c.json({
      x402Version: 2,
      error: 'Payment Required',
      accepts: [{
        scheme: requirements.scheme,
        network: requirements.network,
        amount: requirements.maxAmountRequired,
        asset: requirements.asset,
        payTo: requirements.payTo,
        maxTimeoutSeconds: 300,
      }],
    }, 402);
  }

  // Decode the payment payload
  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = JSON.parse(atob(xPayment));
  } catch {
    return c.json({ error: 'Invalid payment header' }, 400);
  }

  // Step 1: Verify the payment is valid (does NOT settle)
  const verifyResult = await facilitator.verify(paymentPayload, requirements);
  if (!verifyResult.isValid) {
    return c.json({
      error: 'Payment verification failed',
      reason: verifyResult.invalidReason,
    }, 402);
  }

  // Step 2: Business logic — safe to do here because payment is verified
  //         but not yet settled (no money has moved)
  const { contentId } = await c.req.json();
  const content = await db.content.findById(contentId);
  if (!content) {
    // Return error — payment is NOT settled, user keeps their money
    return c.json({ error: 'Content not found' }, 404);
  }

  await db.purchases.create({
    userWallet: verifyResult.payer,
    contentId,
    amount: requirements.maxAmountRequired,
    status: 'pending_settlement',
  });

  // Step 3: Settle the payment on-chain
  const settleResult = await facilitator.settle(paymentPayload, requirements);
  if (!settleResult.success) {
    // Rollback: mark purchase as failed
    await db.purchases.updateStatus(verifyResult.payer, contentId, 'settlement_failed');
    return c.json({
      error: 'Settlement failed',
      reason: settleResult.errorReason,
    }, 500);
  }

  // Step 4: Finalize
  await db.purchases.updateStatus(verifyResult.payer, contentId, 'completed');

  return c.json({
    success: true,
    txHash: settleResult.transaction,
    payer: settleResult.payer,
    content: content.data,
  });
});

export default app;
```

### Express version of the same pattern

```typescript
import express from 'express';
import { OpenFacilitator } from '@openfacilitator/sdk';
import type { PaymentRequirementsV1, PaymentPayload } from '@openfacilitator/sdk';

const app = express();
app.use(express.json());

const facilitator = new OpenFacilitator();

app.post('/api/unlock-content', async (req, res) => {
  const xPayment = req.headers['x-payment'] as string | undefined;

  const requirements: PaymentRequirementsV1 = {
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xYOUR_WALLET_ADDRESS',
  };

  if (!xPayment) {
    return res.status(402).json({
      x402Version: 2,
      error: 'Payment Required',
      accepts: [{
        scheme: requirements.scheme,
        network: requirements.network,
        amount: requirements.maxAmountRequired,
        asset: requirements.asset,
        payTo: requirements.payTo,
        maxTimeoutSeconds: 300,
      }],
    });
  }

  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = JSON.parse(Buffer.from(xPayment, 'base64').toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid payment header' });
  }

  // Verify
  const verifyResult = await facilitator.verify(paymentPayload, requirements);
  if (!verifyResult.isValid) {
    return res.status(402).json({
      error: 'Payment verification failed',
      reason: verifyResult.invalidReason,
    });
  }

  // Business logic
  const { contentId } = req.body;
  // ... your logic here ...

  // Settle
  const settleResult = await facilitator.settle(paymentPayload, requirements);
  if (!settleResult.success) {
    return res.status(500).json({
      error: 'Settlement failed',
      reason: settleResult.errorReason,
    });
  }

  res.json({
    success: true,
    txHash: settleResult.transaction,
    payer: settleResult.payer,
  });
});

app.listen(3000);
```

---

## 4. Dynamic Pricing

Use `getRequirements` to set price per-request.

```typescript
import { honoPaymentMiddleware } from '@openfacilitator/sdk';

app.post('/api/generate', honoPaymentMiddleware({
  facilitator: 'https://pay.openfacilitator.io',
  getRequirements: async (c) => {
    const body = await c.req.json();
    const model = body.model || 'gpt-4';

    // Price based on model
    const prices: Record<string, string> = {
      'gpt-3.5': '100000',    // $0.10
      'gpt-4': '500000',      // $0.50
      'claude-3': '1000000',  // $1.00
    };

    return {
      scheme: 'exact',
      network: 'base',
      maxAmountRequired: prices[model] || '500000',
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: '0xYOUR_WALLET_ADDRESS',
    };
  },
}), async (c) => {
  const { transactionHash } = c.get('paymentContext');
  const body = await c.req.json();

  const result = await generateWithModel(body.model, body.prompt);
  return c.json({ result, txHash: transactionHash });
});
```

---

## 5. Refund Protection

Automatically report failures for refund when your handler throws.

### Middleware with Refund Protection

```typescript
import { honoPaymentMiddleware } from '@openfacilitator/sdk';

app.post('/api/resource', honoPaymentMiddleware({
  facilitator: 'https://pay.openfacilitator.io',
  getRequirements: (c) => ({
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xYOUR_WALLET_ADDRESS',
  }),
  refundProtection: {
    apiKey: process.env.REFUND_API_KEY!,
    // facilitatorUrl is inherited from the facilitator config
  },
}), async (c) => {
  // If this handler throws, the middleware automatically calls reportFailure()
  // with the payment context (txHash, wallet, amount, etc.)
  const result = await riskyOperation();
  return c.json(result);
});
```

### Standalone Refund Wrapper (manual flow)

```typescript
import { OpenFacilitator, withRefundProtection, createPaymentContext } from '@openfacilitator/sdk';

const facilitator = new OpenFacilitator();

app.post('/api/resource', async (c) => {
  const xPayment = c.req.header('x-payment');
  // ... verify and settle as in pattern 3 ...

  const settleResult = await facilitator.settle(paymentPayload, requirements);

  // Create payment context from settle result
  const paymentContext = createPaymentContext(
    settleResult,
    paymentPayload,
    requirements,
  );

  // Wrap your business logic with refund protection
  const protectedHandler = withRefundProtection(
    {
      apiKey: process.env.REFUND_API_KEY!,
      facilitatorUrl: 'https://pay.openfacilitator.io',
    },
    async (ctx) => {
      // If this throws, failure is reported automatically
      return await doBusinessLogic(ctx);
    },
  );

  const result = await protectedHandler(paymentContext);
  return c.json(result);
});
```

### Manual Refund Reporting

```typescript
import { reportFailure } from '@openfacilitator/sdk';

// After settlement, if your business logic fails:
try {
  await processOrder(settleResult.transaction);
} catch (error) {
  await reportFailure({
    facilitatorUrl: 'https://pay.openfacilitator.io',
    apiKey: process.env.REFUND_API_KEY!,
    originalTxHash: settleResult.transaction,
    userWallet: settleResult.payer,
    amount: requirements.maxAmountRequired,
    asset: requirements.asset,
    network: requirements.network,
    reason: error.message,
  });
  throw error;
}
```

---

## 6. Multi-Network Support

Accept payment on multiple chains. Return an array from `getRequirements`.

```typescript
app.post('/api/resource', honoPaymentMiddleware({
  facilitator: 'https://pay.openfacilitator.io',
  getRequirements: (c) => [
    {
      scheme: 'exact',
      network: 'base',
      maxAmountRequired: '1000000',
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: '0xYOUR_EVM_WALLET',
    },
    {
      scheme: 'exact',
      network: 'solana',
      maxAmountRequired: '1000000',
      asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      payTo: 'YOUR_SOLANA_WALLET_ADDRESS',
    },
    {
      scheme: 'exact',
      network: 'stacks',
      maxAmountRequired: '1000000',
      asset: 'STX',
      payTo: 'YOUR_STACKS_WALLET_ADDRESS',
    },
  ],
}), async (c) => {
  // The middleware matches the incoming payment to the right network
  const { transactionHash, network, userWallet } = c.get('paymentContext');
  return c.json({ success: true, txHash: transactionHash, network });
});
```

The 402 response will include all accepted payment methods:

```json
{
  "x402Version": 2,
  "error": "Payment Required",
  "accepts": [
    { "scheme": "exact", "network": "base", "amount": "1000000", "asset": "0x833...", "payTo": "0x...", "maxTimeoutSeconds": 300 },
    { "scheme": "exact", "network": "solana", "amount": "1000000", "asset": "EPjF...", "payTo": "...", "maxTimeoutSeconds": 300 },
    { "scheme": "exact", "network": "stacks", "amount": "1000000", "asset": "STX", "payTo": "...", "maxTimeoutSeconds": 300 }
  ]
}
```

---

## 7. Solana with Gas-Free Transactions

Solana facilitators can act as fee payers so users don't need SOL for gas.

```typescript
const facilitator = new OpenFacilitator();

// Check if facilitator provides fee payer for Solana
const feePayer = await facilitator.getFeePayer('solana');
// Returns the facilitator's Solana address that will pay gas, or undefined

app.post('/api/resource', honoPaymentMiddleware({
  facilitator,
  getRequirements: (c) => ({
    scheme: 'exact',
    network: 'solana',
    maxAmountRequired: '1000000',
    asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    payTo: 'YOUR_SOLANA_ADDRESS',
  }),
}), async (c) => {
  return c.json({ success: true });
});
```

The free facilitator at `pay.openfacilitator.io` provides Solana fee payer support. The `feePayer` address is included in the 402 response under `extra.feePayer` so clients know to structure the transaction accordingly.

---

## 8. Stacks Integration

Accept STX, sBTC, or USDCx payments on Stacks.

```typescript
app.post('/api/resource', honoPaymentMiddleware({
  facilitator: 'https://pay.openfacilitator.io',
  getRequirements: (c) => ({
    scheme: 'exact',
    network: 'stacks',
    maxAmountRequired: '1000000', // 1 STX (6 decimals)
    asset: 'STX',
    payTo: 'YOUR_STACKS_ADDRESS',
  }),
}), async (c) => {
  const { transactionHash } = c.get('paymentContext');
  return c.json({ success: true, txHash: transactionHash });
});
```

For sBTC:

```typescript
getRequirements: (c) => ({
  scheme: 'exact',
  network: 'stacks',
  maxAmountRequired: '100000', // 0.001 sBTC (8 decimals)
  asset: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
  payTo: 'YOUR_STACKS_ADDRESS',
}),
```

Note: Stacks settlement polls the Hiro API for confirmation (up to ~5 minutes). The `settle()` call will take longer than EVM or Solana.

---

## 9. Custom Facilitator URL

Use your own branded facilitator instead of the free shared one.

```typescript
import { OpenFacilitator, createPaymentMiddleware } from '@openfacilitator/sdk';

// Option 1: Pass URL string directly
const middleware = createPaymentMiddleware({
  facilitator: 'https://pay.yourdomain.com',
  getRequirements: () => ({ /* ... */ }),
});

// Option 2: Create an instance with custom config
const facilitator = new OpenFacilitator({
  url: 'https://pay.yourdomain.com',
  timeout: 60000, // 60s timeout
  headers: { 'X-Custom-Header': 'value' },
});

const middleware = createPaymentMiddleware({
  facilitator,
  getRequirements: () => ({ /* ... */ }),
});
```
