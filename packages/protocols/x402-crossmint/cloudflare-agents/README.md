# Crossmint x402 Payment Demo

Agent-to-agent payments using **Crossmint smart wallets** + **x402 protocol**.

## What This Demo Does

This example demonstrates **wallet-to-wallet autonomous payments** between two agents:

1. **Server Agent** - Has a Crossmint wallet that receives $0.10 payments
2. **Client Agent** - Has a Crossmint wallet that automatically pays for protected content

**No private keys needed** - both wallets are Crossmint smart wallets managed via API.

```
User → PayAgent (Wallet A) → Protected API (Wallet B)
                           ↓ (402 Payment Required)
                           ↓ Agent pays $0.10 automatically
                           ↓ Content returned ✅
```

## Prerequisites

**Crossmint API Key**

Get a server API key from [Crossmint Console](https://www.crossmint.com/console):
1. Create a new Smart Wallet project
2. Navigate to API Keys section
3. Create an API key with scopes: `wallets.create`, `wallets.read`, `wallets:messages.sign`
4. Copy the key (starts with `sk_`)

**Test Tokens** (optional for testing)

Get test USDC on Base Sepolia from [Circle Faucet](https://faucet.circle.com/)

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd crossmint-x402
npm install
```

### Step 2: Configure Environment Variables

Create `.dev.vars` with your Crossmint API key:

```bash
CROSSMINT_API_KEY=sk_your_api_key_here
```

### Step 3: Run Locally

```bash
npm run dev
```

You should see:
```
💼 Server wallet created: 0xABC...
💰 Will receive payments at Crossmint smart wallet
⎔ Ready on http://localhost:8787
```

## Testing the Payment Flow

### 1. Check wallets are created

```bash
curl http://localhost:8787/
```

Response shows both wallet addresses and their roles.

### 2. Try accessing protected route directly (will fail)

```bash
curl http://localhost:8787/protected-route
```

Returns `402 Payment Required` with payment instructions.

### 3. Trigger the agent to pay and access

```bash
curl http://localhost:8787/agent
```

The PayAgent will:
1. Create its own Crossmint wallet (on first request)
2. Attempt to fetch `/protected-route`
3. Receive `402 Payment Required`
4. **Automatically pay** $0.10 to the server wallet
5. Receive the protected content

Response:
```json
{
  "message": "🎉 This content is behind a paywall. Thanks for paying!",
  "data": {
    "premium": true,
    "timestamp": "2025-10-02T...",
    "service": "Crossmint Premium API"
  }
}
```

### 4. Check wallet balances

```bash
curl http://localhost:8787/wallets/status
```

Response:
```json
{
  "server": {
    "address": "0xABC...",
    "balance": { "usdc": "0.10", "eth": "0" }
  },
  "agent": {
    "address": "0xDEF...",
    "balance": { "usdc": "0", "eth": "0" }
  }
}
```

## Deploying to Production

### Step 1: Set Production Secret

```bash
npx wrangler secret put CROSSMINT_API_KEY
# Paste your API key when prompted
```

### Step 2: Update to Mainnet

Edit `src/index.ts` lines 44, 66, and 90:
```typescript
chain: "base",  // Change from "base-sepolia"
network: "base",  // Change from "base-sepolia"
```

### Step 3: Deploy

```bash
npm run deploy
```

### Step 4: Test Live

```bash
curl https://crossmint-x402.your-subdomain.workers.dev/agent
```

## How It Works

### Server Wallet (Receives Payments)

```typescript
// Create Crossmint wallet for server
const crossmint = createCrossmint({ apiKey });
const crossmintWallets = CrossmintWallets.from(crossmint);
const serverWallet = await crossmintWallets.createWallet({
  chain: "base-sepolia",
  signer: { type: "api-key" }
});

// Protect routes with payment middleware
paymentMiddleware(serverWallet.address, {
  "/protected-route": { price: "$0.10", network: "base-sepolia" }
});
```

### Client Agent (Makes Payments)

```typescript
export class PayAgent extends Agent {
  async onStart() {
    // Create agent's Crossmint wallet
    this.wallet = await crossmintWallets.createWallet({
      chain: "base-sepolia",
      signer: { type: "api-key" }
    });

    // Create x402-compatible signer
    const x402Signer = createX402Signer(this.wallet);
    this.fetchWithPay = wrapFetchWithPayment(fetch, x402Signer);
  }

  async onRequest(req: Request) {
    // Automatically pays when encountering 402 status
    return this.fetchWithPay(protectedUrl, {});
  }
}
```

## Use Cases

This pattern enables:

- 🔐 **Pay-per-use APIs**: Agents pay per call instead of subscriptions
- 📊 **Data marketplaces**: Buy/sell data between agents
- 🤝 **Agent-to-agent commerce**: Autonomous service transactions
- ⚡ **Micropayments**: Pay fractions of a cent per API call
- 🌐 **Cross-platform payments**: No platform lock-in

## Architecture

```
┌─────────────┐
│   Client    │
│   (Agent)   │
│  + Wallet   │
└──────┬──────┘
       │
       │ GET /protected-route
       ▼
┌─────────────────────┐
│  Payment Middleware │
│   (x402-hono)       │
└──────┬──────────────┘
       │
       │ 402 Payment Required
       │ + payment instructions
       ▼
┌─────────────┐         ┌──────────────────┐
│   Client    │────────▶│    Facilitator   │
│   Pays      │         │  (x402.org)      │
└─────────────┘         └────────┬─────────┘
       │                         │
       │                         │ Verify
       │ GET + payment proof     │
       ▼                         ▼
┌─────────────────────┐
│  Protected Content  │
│      Returned       │
└─────────────────────┘
```

## Troubleshooting

### "Wallets need test tokens"
- Both wallets start with zero balance
- Get test USDC from [Circle Faucet](https://faucet.circle.com/)
- Fund the agent wallet address shown in logs

### "Cannot find module '@crossmint/wallets-sdk'"
- Run `npm install` to install dependencies
- Make sure package.json has the correct version

### "Payment verification failed"
- Check agent wallet has sufficient USDC balance
- Verify network is "base-sepolia" consistently
- Ensure facilitator URL is accessible

## Learn More

- 📖 **Crossmint Wallets**: https://docs.crossmint.com/wallets
- 📖 **x402 Protocol**: https://developers.cloudflare.com/agents/x402/
- 🏗️ **Cloudflare Agents**: https://developers.cloudflare.com/agents/
- 💰 **Base Network**: https://base.org/

## Key Features

✅ **No private key management** - Crossmint handles wallet security
✅ **Smart contract wallets** - Account abstraction, gas sponsorship
✅ **Agent-to-agent payments** - Autonomous commerce between services
✅ **HTTP-native payments** - x402 protocol for seamless integration

---

Built with Cloudflare Agents + Crossmint Wallets + x402 Protocol
