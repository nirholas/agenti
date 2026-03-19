# RPC Configuration Guide

## How RPC URLs Work in x402 AI Agent

### Default Behavior

By default, **you don't need to configure an RPC URL**. The agent uses the default x402 facilitator service at `https://x402.org/facilitator`, which handles all blockchain interactions for you:

```
Your Agent → x402 Facilitator → Blockchain (via Facilitator's RPC)
```

The facilitator service:
- Manages RPC connections
- Verifies payment signatures
- Executes blockchain transactions
- Handles gas management
- Returns transaction receipts

### Architecture Overview

```
┌─────────────────┐
│   Your Agent    │
│  (server.ts)    │
└────────┬────────┘
         │
         │ Payment verification/settlement
         ▼
┌─────────────────┐
│  Facilitator    │
│ (x402.org or    │
│   custom)       │
└────────┬────────┘
         │
         │ RPC calls
         ▼
┌─────────────────┐
│   Blockchain    │
│ (Base, Polygon, │
│   etc.)         │
└─────────────────┘
```

## Configuration Options

### Option 1: Default (Recommended)

**No configuration needed!** Just leave `.env` as is:

```env
# No FACILITATOR_URL needed
# Uses https://x402.org/facilitator by default
```

The default facilitator handles everything for you.

### Option 2: Local Settlement (Direct Mode)

If you want to keep settlement inside this server (no facilitator call), enable the built-in direct flow:

```env
SETTLEMENT_MODE=local
PRIVATE_KEY=your_private_key_here
# Optional - override default RPC endpoint for the selected network
RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
# Provide ASSET_ADDRESS/ASSET_NAME if using a non-built-in network
ASSET_ADDRESS=0xTokenAddress
ASSET_NAME=USDC
CHAIN_ID=84532
```

With these variables set, the agent:
- Verifies the EIP-3009 payload locally
- Uses your RPC endpoint to call `transferWithAuthorization` on the USDC contract

Make sure the wallet behind `PRIVATE_KEY` holds the gas token for the selected network.

### Option 3: Custom Facilitator

If you want to use a different facilitator service, set:

```env
FACILITATOR_URL=https://your-custom-facilitator.com
FACILITATOR_API_KEY=your_api_key_if_required
# Provide ASSET_ADDRESS/ASSET_NAME if the facilitator expects a different asset for your network
ASSET_ADDRESS=0xTokenAddress
ASSET_NAME=USDC
CHAIN_ID=84532
```

Your custom facilitator would need to implement the x402 facilitator API:
- `POST /verify` - Verify payment signatures
- `POST /settle` - Settle payments on-chain

### Option 4: Self-Hosted Facilitator

To run your own facilitator with custom RPC:

1. **Deploy your own facilitator service** (see x402 facilitator repo)
2. **Configure the facilitator** with your RPC URL:
   ```env
   # In your facilitator's config
   RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
   ```
3. **Point this agent to your facilitator** (for example, if it runs locally at `http://localhost:4000`):
   ```env
   # In agent/.env
   FACILITATOR_URL=https://your-facilitator.yoursite.com
   ```

### Option 5: Direct Blockchain Integration (Advanced)

Local settlement mode already performs on-chain verification/settlement for USDC via EIP-3009. If you need more control (additional assets, alternative schemes), you can still implement your own executor:

1. Replace or extend `src/MerchantExecutor.ts`
2. Use `ethers` (or another SDK) together with your RPC URL(s)
3. Add any custom verification/settlement logic your flow requires

Use the bundled executor as a reference for how to construct payment requirements, log settlement details, and surface errors back to the server.

## RPC Providers

If you need to configure an RPC URL (for custom facilitator or direct integration), here are popular providers:

### Alchemy
```env
RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```
Sign up: https://www.alchemy.com

### Infura
```env
RPC_URL=https://base-sepolia.infura.io/v3/YOUR_PROJECT_ID
```
Sign up: https://www.infura.io

### QuickNode
```env
RPC_URL=https://your-endpoint.base-sepolia.quiknode.pro/YOUR_TOKEN/
```
Sign up: https://www.quicknode.com

### Public RPCs (Not recommended for production)
```env
# Base Sepolia
RPC_URL=https://sepolia.base.org

# Base Mainnet
RPC_URL=https://mainnet.base.org
```

## Network-Specific RPC URLs

### Base Sepolia (Testnet)
- Alchemy: `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY`
- Public: `https://sepolia.base.org`
- Chain ID: 84532

### Base Mainnet
- Alchemy: `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY`
- Public: `https://mainnet.base.org`
- Chain ID: 8453

### Polygon Amoy (Testnet)
- Alchemy: `https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY`
- Chain ID: 80002

### Ethereum Sepolia
- Alchemy: `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`
- Infura: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`
- Chain ID: 11155111

## Current Implementation

The agent currently uses:

**File: src/server.ts**
```typescript
const merchantOptions = {
  payToAddress: PAY_TO_ADDRESS,
  network: resolvedNetwork,
  price: 0.1,
  facilitatorUrl: FACILITATOR_URL,
  facilitatorApiKey: FACILITATOR_API_KEY,
};

const merchantExecutor = new MerchantExecutor(merchantOptions);

if (FACILITATOR_URL) {
  console.log(`🌐 Using custom facilitator: ${FACILITATOR_URL}`);
} else {
  console.log('🌐 Using default facilitator: https://x402.org/facilitator');
}
```

## Recommendations

### For Development/Testing
✅ **Use the default facilitator** (`https://x402.org/facilitator`)
- No configuration needed
- Works out of the box
- Handles testnet transactions

### For Production
Consider these options:

1. **Default facilitator** (easiest)
   - Managed service
   - No infrastructure to maintain
   - May have rate limits

2. **Custom facilitator** (recommended)
   - Your own RPC endpoints
   - Better control and monitoring
   - Can optimize for your needs
   - Set up failover/redundancy

3. **Direct integration** (advanced)
   - Maximum control
   - Requires blockchain expertise
   - More maintenance

## Troubleshooting

### "Network error" during payment
- Check facilitator URL is accessible
- Verify API key if using custom facilitator
- Check RPC endpoint is responding (if self-hosting)

### "Settlement failed"
- If you're using the hosted facilitator, retry later or contact support if the status page reports issues
- If you're running a custom facilitator, ensure its RPC URL matches the selected network, the settlement wallet has gas, and the RPC endpoint is healthy

### "Invalid signature"
- Network mismatch (e.g., mainnet signature on testnet)
- Check NETWORK env variable matches RPC network

## Summary

**Quick Answer:**
- RPC URL is **not required** for basic setup
- The default facilitator at `https://x402.org/facilitator` handles blockchain interactions
- Set `SETTLEMENT_MODE=local` (with `PRIVATE_KEY`/`RPC_URL`) for on-chain settlement inside this server
- Use `FACILITATOR_URL` to point at a custom facilitator endpoint

**Environment Variables:**
```env
# Required
OPENAI_API_KEY=your_key
PAY_TO_ADDRESS=0xYourAddress

# Optional - local (direct) settlement
SETTLEMENT_MODE=local
PRIVATE_KEY=your_private_key
RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=84532

# Optional - custom facilitator endpoint
FACILITATOR_URL=https://your-facilitator.com
FACILITATOR_API_KEY=your_key

# Optional - asset overrides (required if NETWORK isn't base/base-sepolia/polygon/polygon-amoy)
ASSET_ADDRESS=0xTokenAddress
ASSET_NAME=USDC
EXPLORER_URL=https://explorer.your-network.org

# Optional - ensure payment requirements include a fully-qualified endpoint URL
SERVICE_URL=https://your-domain.com/process
```
