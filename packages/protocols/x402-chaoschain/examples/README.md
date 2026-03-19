# ChaosChain x402 Examples

This directory contains example implementations showing how to use the ChaosChain x402 decentralized facilitator.

## Available Examples

### TypeScript Demo ([ts-demo/](./ts-demo/))

Demonstrates how to use the `@chaoschain/x402-client` TypeScript client to verify and settle payments.

**Run it:**
```bash
cd ts-demo
bun install
bun run dev
```

### Python Demo ([py-demo/](./py-demo/))

Demonstrates how to use the `chaoschain-x402-client` Python client to verify and settle payments.

**Run it:**
```bash
cd py-demo
pip install -r requirements.txt
python demo.py
```

## Prerequisites

Both examples require the HTTP bridge to be running:

```bash
# In a separate terminal
cd ../http-bridge
bun install
bun run dev
```

The bridge will start on `http://localhost:8402`.

## What the Demos Show

Both demos demonstrate the complete flow:

1. **Health Check** - Verify the facilitator is responsive
2. **Get Supported Schemes** - Query available payment methods
3. **Verify Payment** - Submit a payment for decentralized verification
4. **Settle Payment** - Execute the on-chain settlement

## Expected Output

```
═══════════════════════════════════════════════════════════
  ChaosChain x402 Decentralized Facilitator Demo
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

## Customizing the Demos

You can modify the demos to:

- Change the payment network (e.g., `ethereum-sepolia`)
- Adjust payment amounts
- Point to a different facilitator URL
- Use real EIP-712 signatures (in production)

See the source code in each demo directory for details.

## Learn More

- [TypeScript Client Documentation](../clients/ts/README.md)
- [Python Client Documentation](../clients/py/README.md)
- [HTTP Bridge API Reference](../http-bridge/README.md)
- [Main README](../README.md)

