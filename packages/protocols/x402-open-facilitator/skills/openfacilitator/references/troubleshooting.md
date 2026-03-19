# Troubleshooting

## Error Classes

The SDK defines four specific error classes, all extending `FacilitatorError`:

```typescript
class FacilitatorError extends Error {
  code: string;           // e.g., 'HTTP_ERROR', 'NETWORK_ERROR'
  statusCode?: number;    // HTTP status code if applicable
  details?: unknown;      // Additional error context
}

class NetworkError extends FacilitatorError {}      // code: 'NETWORK_ERROR'
class VerificationError extends FacilitatorError {} // code: 'VERIFICATION_ERROR'
class SettlementError extends FacilitatorError {}   // code: 'SETTLEMENT_ERROR'
class ConfigurationError extends FacilitatorError {} // code: 'CONFIGURATION_ERROR'
```

### Error Code Reference

| Code | Class | Cause |
|------|-------|-------|
| `NETWORK_ERROR` | NetworkError | Facilitator unreachable, timeout, DNS failure |
| `VERIFICATION_ERROR` | VerificationError | Invalid signature, expired authorization, wrong amount |
| `SETTLEMENT_ERROR` | SettlementError | On-chain tx reverted, insufficient gas, nonce collision |
| `CONFIGURATION_ERROR` | ConfigurationError | Invalid SDK config (bad URL, missing fields) |
| `HTTP_ERROR` | FacilitatorError | Non-2xx HTTP response from facilitator |

### Catching Specific Errors

```typescript
import {
  FacilitatorError,
  NetworkError,
  VerificationError,
  SettlementError,
} from '@openfacilitator/sdk';

try {
  const result = await facilitator.settle(payment, requirements);
} catch (error) {
  if (error instanceof NetworkError) {
    // Facilitator is down or unreachable — safe to retry
    console.error('Network issue:', error.message);
  } else if (error instanceof SettlementError) {
    // On-chain failure — check error.details for specifics
    console.error('Settlement failed:', error.message);
  } else if (error instanceof FacilitatorError) {
    // Generic facilitator error
    console.error(`Error ${error.code}:`, error.message);
  }
}
```

---

## Common Failure Scenarios

### 1. verify() Succeeds but settle() Fails

**What happened:** The payment signature is valid but the on-chain transaction failed.

**Possible causes:**
- Payer's token balance dropped between verify and settle
- Authorization expired (`validBefore` timestamp passed)
- Nonce was already used (duplicate settlement attempt)
- Facilitator wallet has insufficient gas (EVM) or SOL (Solana)

**User impact:** No money moved. The payer's tokens are NOT deducted.

**What to do:**
```typescript
const verifyResult = await facilitator.verify(payment, requirements);
if (!verifyResult.isValid) return res.status(402).json({ error: verifyResult.invalidReason });

const settleResult = await facilitator.settle(payment, requirements);
if (!settleResult.success) {
  // Safe: no money moved. Return error, let client retry with fresh payment.
  return res.status(500).json({
    error: 'Settlement failed',
    reason: settleResult.errorReason,
    retryable: true,
  });
}
```

### 2. settle() Timeout

**What happened:** The on-chain confirmation didn't arrive in time.

**Chain-specific timeouts:**
- EVM: Waits for 1 confirmation (~2-12 seconds depending on chain)
- Solana: Waits for 'confirmed' status (~5-15 seconds)
- Stacks: Polls up to 30 attempts with 10s intervals (~5 minutes max)

**What to do:** The SDK throws a `SettlementError` on timeout. The transaction may still confirm later. Check the chain explorer manually if needed.

### 3. Insufficient Funds

**When detected:** During `verify()` — the facilitator checks the payer's balance.

**VerifyResponse:**
```typescript
{
  isValid: false,
  invalidReason: "Insufficient balance" // or similar message
}
```

**Middleware behavior:** Returns 402 with the original requirements so the client can fund their wallet and retry.

### 4. Duplicate Payment (Nonce Already Used)

**EVM-specific:** Each ERC-3009 authorization has a unique nonce. If the same nonce is submitted twice, the second `settle()` will fail with a revert.

**What happens:**
- First `settle()`: succeeds, returns tx hash
- Second `settle()` with same payment: fails with `"Duplicate submission: this authorization is already being processed"`

**Safe to ignore:** The first payment already went through.

### 5. Expired Authorization

**EVM-specific:** The `validBefore` timestamp in the authorization has passed.

**VerifyResponse:**
```typescript
{
  isValid: false,
  invalidReason: "Authorization expired"
}
```

**Fix:** Client needs to create a new payment with a fresh `validBefore` timestamp.

### 6. Wallet Not Configured on Facilitator

**Server-side error when using a custom facilitator:**

```
"Solana wallet not configured. Please set up a Solana wallet in the dashboard."
"EVM wallet not configured. Please set up an EVM wallet in the dashboard."
"Stacks wallet not configured. Please set up a Stacks wallet in the dashboard."
```

**Fix:** Configure the appropriate wallet in the OpenFacilitator dashboard. The free facilitator at `pay.openfacilitator.io` has all wallets pre-configured.

---

## Retry Semantics

### Is verify() safe to retry?

**Yes.** `verify()` is read-only. It checks the payment signature without modifying state. Call it as many times as needed.

### Is settle() safe to retry?

**With the same payment payload: mostly safe.** The facilitator uses nonce deduplication for EVM payments. If the same authorization nonce is submitted twice:
- If the first is still processing: returns `"Duplicate submission"`
- If the first already confirmed: fails with nonce-already-used revert

**With a new payment payload: always safe.** Each new payment has a unique nonce.

**Recommendation:** Don't retry `settle()` with the same payload. If settlement fails, return an error to the client and let them create a fresh payment.

### Network errors

`NetworkError` (facilitator unreachable) is always safe to retry. No state was modified.

---

## Middleware 402 Response Format

When no payment is provided or payment is invalid, the middleware returns:

```json
{
  "x402Version": 2,
  "error": "Payment Required",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "amount": "1000000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0xRecipient",
      "maxTimeoutSeconds": 300,
      "extra": {
        "supportsRefunds": true
      }
    }
  ]
}
```

- `extra.supportsRefunds: true` is included when refund protection is enabled
- `extra.feePayer` is included for Solana networks when fee payer is available
- Multiple entries in `accepts` when multi-network support is configured

---

## Refund Protection Edge Cases

### When does automatic refund reporting trigger?

Only when the **handler throws an error** after successful settlement. The middleware catches the error, reports the failure, then re-throws.

### What if reportFailure() itself fails?

The `onReportError` callback is called with both the report error and the original error. The original error is still re-thrown. The user's payment is NOT automatically refunded — you'll need to handle this manually.

### Claim lifecycle

1. `reportFailure()` → claim created with status `pending`
2. Resource owner approves → status `approved`
3. `executeClaim()` → payout executed, status `paid`
4. If not processed within 30 days → status `expired`

### Can the same tx be reported twice?

No. `reportFailure()` returns an error: `"Claim already exists for this transaction"`. Each transaction hash can only have one claim.

---

## Common Mistakes

### Wrong amount format

```typescript
// WRONG: decimal string
maxAmountRequired: '1.00'

// CORRECT: smallest units (1 USDC = 1000000)
maxAmountRequired: '1000000'
```

### Wrong network identifier

```typescript
// Both work — v1 short names are fine in requirements
network: 'base'          // OK
network: 'eip155:8453'   // Also OK

// WRONG
network: 'Base'          // Case-sensitive
network: 'base-mainnet'  // Not a valid ID
```

### Missing payTo address

```typescript
// V1: payTo is optional but you almost always want it
{
  scheme: 'exact',
  network: 'base',
  maxAmountRequired: '1000000',
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payTo: '0xYOUR_ADDRESS',  // Don't forget this!
}
```

### Using middleware + manual verify/settle together

Don't call `facilitator.verify()` or `facilitator.settle()` inside a middleware-protected route. The middleware already handles both. Your handler runs after settlement is complete.

```typescript
// WRONG
app.post('/api/resource', paymentMiddleware, async (req, res) => {
  await facilitator.settle(payment, requirements); // Already settled by middleware!
});

// CORRECT
app.post('/api/resource', paymentMiddleware, async (req, res) => {
  const { transactionHash } = req.paymentContext; // Just use the context
  res.json({ txHash: transactionHash });
});
```

### Assuming settle() is instant

`settle()` waits for on-chain confirmation. It's async and can take:
- EVM: ~2-12 seconds
- Solana: ~5-15 seconds
- Stacks: up to ~5 minutes

Don't set HTTP timeouts shorter than this.
