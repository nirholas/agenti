# TypeScript Demo for ChaosChain x402

This demo shows how to use the TypeScript client to interact with the decentralized x402 facilitator.

## Prerequisites

- **Bun** 1.2.21+ or Node.js 18+
- HTTP bridge running on port 8402

## Installation

```bash
bun install
```

## Running the Demo

### 1. Start the HTTP Bridge

In a separate terminal:
```bash
cd ../../http-bridge
bun install
bun run dev
```

### 2. Run the Demo

```bash
bun run dev
```

## Expected Output

```
═══════════════════════════════════════════════════════════
  ChaosChain x402 Decentralized Facilitator Demo (TypeScript)
═══════════════════════════════════════════════════════════

📡 Connecting to facilitator: http://localhost:8402

🏥 Health Check...
   ✅ Service: ChaosChain x402 Decentralized Facilitator
   ✅ Version: 0.1.0
   ✅ Mode: simulate

🔍 Checking supported schemes...
   ✅ Supported schemes:
      - exact on base-sepolia
      - exact on ethereum-sepolia

🔐 Verifying payment...
   Network: base-sepolia
   Amount: 1000000 (1 USDC)
   Resource: /api/weather

   ✅ Payment verification PASSED
   ✅ Consensus reached by CRE DON
   ✅ Consensus proof: 0xCRE-MOCK-1234567890
   ✅ Report ID: rep_1234567890

💰 Settling payment on-chain...

   ✅ Payment settlement SUCCESS
   ✅ Transaction hash: 0x30783734326433354363636333343330...
   ✅ Network: base-sepolia
   ✅ Consensus proof: 0xCRE-MOCK-1234567890

═══════════════════════════════════════════════════════════
  ✅ Demo Complete!
═══════════════════════════════════════════════════════════
```

## Customization

Edit `index.ts` to customize:

- `FACILITATOR_URL`: Point to your hosted facilitator
- `PAYMENT_REQUIREMENTS`: Change network, amount, resource
- `MOCK_PAYMENT_HEADER`: Use real EIP-712 signatures in production

## Integration with Your App

```typescript
import { X402Client } from '@chaoschain/x402-client';

const client = new X402Client({
  facilitatorUrl: process.env.X402_FACILITATOR_URL || 'http://localhost:8402'
});

// Verify payment
const result = await client.verifyPayment(paymentHeader, requirements);
if (result.isValid) {
  console.log('Payment verified!', result.consensusProof);
}

// Settle payment
const settlement = await client.settlePayment(paymentHeader, requirements);
if (settlement.success) {
  console.log('Payment settled!', settlement.txHash);
}
```

## Learn More

- [TypeScript Client Documentation](../../clients/ts/README.md)
- [x402 Protocol](https://github.com/coinbase/x402)
- [ChaosChain Docs](https://docs.chaoscha.in)

