
---

## Agent 5: On-Chain Payment Verification + Revenue Dashboard

```
You are building the x402 payment verification and revenue tracking system.

Location: /workspaces/agenti/

1. src/x402/verify.ts - On-chain payment verification:

Using viem:
- verifyUSDCTransfer(txHash, expectedAmount, expectedRecipient, chainId)
  - Fetch transaction receipt
  - Decode Transfer event logs
  - Verify: correct token, amount >= expected, recipient matches
  - Return { valid, actualAmount, sender, blockNumber }

- verifyPaymentForTool(toolName, txHash, chainId)
  - Get tool price from TOOL_PRICING
  - Call verifyUSDCTransfer
  - Cache verified payments (prevent replay)

- Supported chains: Base (8453), Ethereum (1), Arbitrum (42161)
- USDC addresses per chain from src/lib/fees/config.ts

2. src/hosting/revenue.ts - Revenue tracking:

- recordPayment(serverId, toolId, txHash, amount, chain)
- getServerRevenue(serverId, period: 'day' | 'week' | 'month')
- getUserRevenue(userId, period)
- getPlatformRevenue(period) - total 15% cuts
- getPendingPayouts() - creators waiting for payout
- processPayouts() - batch send to creators (for later)

3. packages/web/qr-payments/src/app/dashboard/revenue/page.tsx:

Dashboard page showing:
- Total earnings (with chart over time)
- Per-server breakdown
- Per-tool breakdown
- Recent transactions table
- Pending payout amount
- "Request Payout" button (min $10)

Use recharts or tremor for charts. Style with existing glass/opal aesthetic.

4. packages/web/qr-payments/src/app/api/revenue/route.ts:
- GET /api/revenue - returns revenue stats for current user
- GET /api/revenue/transactions - paginated transaction history

Include proper error handling and TypeScript types throughout.
```

---

## How to Use

Run each prompt in a separate Copilot/Claude session. They're designed to work independently and merge cleanly:

1. **Agent 1** (Stripe) - No dependencies
2. **Agent 2** (Dashboard UI) - No dependencies  
3. **Agent 3** (Database) - No dependencies
4. **Agent 4** (Router) - Needs types from existing hosting/
5. **Agent 5** (Payments) - Needs types from existing hosting/

After all complete, one integration pass to wire everything together.