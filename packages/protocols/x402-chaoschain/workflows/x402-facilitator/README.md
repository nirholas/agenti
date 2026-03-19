# x402-facilitator Workflow

This is a Chainlink Runtime Environment (CRE) workflow that provides decentralized verification and settlement for x402 payments.

## Overview

This workflow replaces the centralized facilitator server in the x402 protocol with a Byzantine Fault Tolerant (BFT) consensus mechanism running across a Decentralized Oracle Network (DON).

## Architecture

```
Agent → Resource Server → CRE Workflow DON → Blockchain
```

Each payment verification and settlement request is:
1. Executed independently by multiple nodes in the DON
2. Results are aggregated via BFT consensus
3. A single verified result with cryptographic proof is returned

## Current Mode: Simulation

This workflow currently runs in **simulate mode**, which means:
- ✅ It demonstrates the workflow structure and flow
- ✅ It returns mock verification and settlement results
- ❌ It does NOT interact with real blockchains
- ❌ It does NOT verify real signatures

## Running the Workflow

### Prerequisites
- Bun 1.2.21+
- CRE CLI installed

### Install Dependencies
```bash
cd workflows/x402-facilitator
bun install
cd ../..
```

### Run Simulation
```bash
# From the project root
cre workflow simulate x402-facilitator --target local-simulation
```

You should see health check logs every 30 seconds demonstrating self-tests of verify and settle operations.

## Upgrading to Production

When you're ready to deploy to real CRE (once it's publicly available), enable the `TODO` sections in `main.ts`:

### 1. Add Real EVM Interactions
Uncomment the EVMClient usage in `handleVerify()` and `handleSettle()` to:
- Read on-chain state (nonces, balances, allowances)
- Verify EIP-712 signatures cryptographically  
- Execute ERC-20 `receiveWithAuthorization` transactions
- Emit Proof-of-Agency to ValidationRegistry

### 2. Switch to HTTP Triggers
Replace the cron trigger with HTTP triggers:
```typescript
const httpCapability = new cre.capabilities.HTTPCapability();
return [
  cre.handler(httpCapability.trigger({ path: "/verify", method: "POST" }), onVerifyHTTP),
  cre.handler(httpCapability.trigger({ path: "/settle", method: "POST" }), onSettleHTTP),
];
```

### 3. Update Configuration
- Set `"mode": "production"` in `config.json`
- Add real RPC URLs to `project.yaml`
- Configure secrets in `secrets.yaml` (use a secrets manager)

### 4. Deploy to CRE
```bash
cre workflow deploy x402-facilitator --target production
```

## File Structure

- `main.ts` - Workflow entry point with verify/settle handlers
- `workflow.yaml` - CRE workflow manifest
- `config.json` - Workflow configuration parameters
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript configuration

## Learn More

- [CRE Documentation](https://docs.chain.link/cre)
- [x402 Protocol](https://github.com/coinbase/x402)
- [ChaosChain Docs](https://docs.chaoscha.in)

