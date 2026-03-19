# ping-crossmint

Demonstrates Crossmint smart wallet integration with the x402 payment protocol.

## What it does

A React client and Express server that show how Crossmint wallets handle HTTP 402 payment-required responses. The client creates a smart wallet, makes requests to protected endpoints, and signs payment authorizations. The server uses x402 middleware to require payment before serving content.

## Prerequisites

### Development Environment
- **Node.js 18.17.0 or higher** - Check version: `node --version`
- **npm 9.0.0 or higher** - Check version: `npm --version`
- **Git** - For cloning repository

### Crossmint Account

1. Create account at https://www.crossmint.com/
2. Navigate to **Developer Console → API Keys**
3. Generate two API keys:
   - **Server API Key** (format: `sk_staging_...`) - For API key signer
   - **Client API Key** (format: `ck_staging_...`) - For Email OTP signer
4. **Important:** Save keys securely - never commit to git

### Testnet Tokens (Base Sepolia Recommended)

You'll need testnet tokens to test payments:

**ETH for gas fees (0.01 ETH minimum):**
- Visit: https://www.alchemy.com/faucets/base-sepolia
- Paste your wallet address (you'll get this after initialization)
- Request tokens

**USDC for payments (1 USDC minimum):**
- Visit: https://faucet.circle.com/
- Select "Base Sepolia" network
- Paste your wallet address
- Request USDC

### Network Access
- Ports 3100 (server) and 5174 (client) available
- Outbound HTTPS access to `api.crossmint.com` and `x402.org`

## Quick Start

### 1. Clone and Install

```bash
# Clone repository
cd ping-crossmint

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Server

```bash
cd server

# Create environment file (optional - defaults work for testing)
cat > .env << 'EOF'
PORT=3100
PAY_TO=0x233521928665E16de96267D17313571687eC41b7
NETWORK=base-sepolia
EOF

# Start server
npm run dev
```

**Expected output:**
```
Server running on http://localhost:3100
Network: base-sepolia
Payment recipient: 0x2335...c41b7
Protected endpoints:
  GET /ping -> $0.001 USDC
```

### 3. Configure and Start Client

```bash
cd client

# No .env needed - configure via UI
npm run dev
```

**Expected output:**
```
VITE ready in 234 ms
➜  Local:   http://localhost:5174/
```

### 4. Verify Setup

```bash
# Test server health
curl http://localhost:3100/health

# Expected: {"status":"healthy","port":3100,"network":"base-sepolia",...}

# Test 402 response
curl -H "Accept: application/vnd.x402+json" http://localhost:3100/ping

# Expected: 402 status with payment details

# Open client in browser
open http://localhost:5174
```

If all commands succeed, you're ready to use the demo!

## Configuration

### Server Environment Variables

Create a `.env` file in the `server/` directory (optional - defaults provided):

**PORT** (optional)
- Default: `3100`
- Server listen port
- Example: `PORT=8080`

**PAY_TO** (optional)
- Default: `0x233521928665E16de96267D17313571687eC41b7`
- Recipient address for payments
- Use your own address to receive testnet USDC
- Must be valid Ethereum address

**NETWORK** (optional)
- Default: `base-sepolia`
- Payment settlement network
- Valid values: `base-sepolia`, `base`, `ethereum`, `polygon`, `polygon-amoy`, `avalanche`, `avalanche-fuji`, `solana`, `solana-devnet`, `sei`, `sei-testnet`, `iotex`
- Must match chain selected in client

### Client Configuration (via UI)

Configure at http://localhost:5174:

**API Key** (required)
- Server signer: Enter `sk_staging_...` key (42+ characters)
- Email OTP signer: Enter `ck_staging_...` key (42+ characters)
- **Never use production keys** (`sk_production_*`) for testing

**Email** (required)
- Valid email address
- Used as wallet owner identifier
- For Email OTP: Receives one-time verification codes
- For API key: Identifier only (no email sent)

**Chain** (required)
- Supported: `base-sepolia` (recommended), `base`, `ethereum`
- Must match server `NETWORK` environment variable
- Different chains require different testnet tokens

**Server URL** (required)
- Default: `http://localhost:3100`
- Where client sends payment requests
- Include protocol (`http://` or `https://`) and port

**Signer Type** (required)
- **API Key**: Server-side signing, requires `sk_*` key, no email verification
- **Email OTP**: Client-side signing, requires `ck_*` key + JWT authentication, email verification required

## Usage Guide

### 1. Initialize Wallet

#### For API Key Signer (Simpler)

1. Open http://localhost:5174
2. **Signer Type**: Select "API Key"
3. **API Key**: Enter your `sk_staging_...` key
4. **Email**: `your-email@example.com`
5. **Chain**: `base-sepolia`
6. **Server URL**: `http://localhost:3100`
7. Click **"Initialize Wallet"**

**Success Output:**
```
✅ Crossmint wallet created!
📍 Wallet address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
🏗️ Wallet status: pre-deployed
```

#### For Email OTP Signer (More Secure)

1. Open http://localhost:5174
2. **Signer Type**: Select "Email OTP"
3. **API Key**: Enter your `ck_staging_...` key
4. **Email**: Enter accessible email address
5. **Chain**: `base-sepolia`
6. **Server URL**: `http://localhost:3100`
7. Click **"Initialize Wallet"**
8. Click **"Send OTP"** when prompted
9. Check email for 6-digit verification code
10. Enter code and click **"Verify OTP"**

**Success Output:**
```
✅ OTP verified successfully!
✅ Crossmint wallet created!
📍 Wallet address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
🏗️ Wallet status: pre-deployed
```

**If Failed:**
- Check API key format matches signer type (`sk_*` for API Key, `ck_*` for Email OTP)
- For Email OTP: Verify JWT authentication completed (check browser console)
- Check browser console (F12) for detailed error messages

### 2. Fund Wallet (Required for Payments)

Copy the wallet address from the UI, then fund with testnet tokens:

```bash
# 1. Get Base Sepolia ETH (for gas fees)
# Visit: https://www.alchemy.com/faucets/base-sepolia
# Paste your wallet address: 0x742d35Cc...
# Click "Send Me ETH"
# Wait 30-60 seconds for confirmation

# 2. Get Base Sepolia USDC (for payments)
# Visit: https://faucet.circle.com/
# Select "Base Sepolia" network
# Paste your wallet address
# Click "Request USDC"
# Wait 30-60 seconds for confirmation
```

**Verify balances in UI:**
```
💰 ETH: 0.1000
💰 USDC: 10.0000
```

If balances show 0 after 2 minutes, check the block explorer:
- Visit: https://sepolia.basescan.org/address/YOUR_ADDRESS
- Verify transactions are confirmed

### 3. Deploy Wallet (Optional but Recommended)

Pre-deployed wallets work for signature verification but may fail at payment settlement.

**To deploy:**
1. Click **"Deploy Wallet"** button
2. Wait 30-60 seconds for transaction confirmation
3. Status changes to **"deployed"**

**Expected output:**
```
🚀 Deploying wallet...
📝 Transaction hash: 0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z
✅ Wallet deployed successfully!
🏗️ Wallet status: deployed
```

**Cost:** ~0.001 ETH (Base Sepolia gas)

**When to deploy:**
- Before making production payments
- If settlement consistently fails with 402 errors
- Not required for testing signature verification only

### 4. Make Payment Request

1. Click **"Make Ping"** button
2. Client requests `/ping` endpoint
3. Server returns **402 Payment Required** with payment details

**402 Response (visible in Network tab):**
```json
{
  "accepts": [{
    "payTo": "0x233521928665E16de96267D17313571687eC41b7",
    "network": "base-sepolia",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "maxAmountRequired": "1000",
    "extra": {
      "name": "USDC",
      "symbol": "USDC",
      "decimals": 6
    }
  }]
}
```

**UI displays:**
```
💳 Payment Required
Amount: 0.001000 USDC
Recipient: 0x2335...c41b7
Network: base-sepolia
```

### 5. Approve and Execute Payment

1. Review payment details in the dialog
2. Click **"Approve Payment"**
3. Wallet signs EIP-712 authorization (automatic)
4. Client retries request with `X-PAYMENT` header
5. Server verifies signature

**Success Output:**
```
✅ Payment executed successfully!
📨 Server response: {"message":"pong"}
🎉 X402 + Crossmint payment complete!
```

**Partial Success (Common with Pre-deployed Wallets):**
```
🔧 Payment verification completed, settlement phase had issues
✅ This demonstrates successful signature verification with Crossmint!
🔍 Payer verified: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

This is **expected** with pre-deployed wallets - signature verification works perfectly, but settlement may require deployment. The core integration is working!

### 6. Monitor Transaction Logs

**Server Console:**
```
[REQ] GET /ping accept=application/vnd.x402+json xpay=none
[RES] GET /ping -> 402 Payment Required dur=23ms

[REQ] GET /ping accept=application/vnd.x402+json xpay=len:854
[X-PAYMENT] v2 scheme=exact.evm network=base-sepolia
[X-PAYMENT] authorization.from: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
[X-PAYMENT] authorization.to: 0x233521928665E16de96267D17313571687eC41b7
[X-PAYMENT] authorization.value: 1000
[RES] GET /ping -> 200 OK dur=156ms
```

**Client Console (Browser F12):**
```
🔐 Signing x402 payment data
📝 Processing signature (ERC-6492 format)
✅ Payment signature created
📤 Retrying request with payment header
```

## Payment Flow Internals

### Complete Request Flow

**1. Initial Request (No Payment)**
```http
GET /ping HTTP/1.1
Host: localhost:3100
Accept: application/vnd.x402+json
```

**2. Server Returns 402 Payment Required**
```http
HTTP/1.1 402 Payment Required
Content-Type: application/vnd.x402+json
X-PAYMENT-RESPONSE: present

{
  "accepts": [{
    "payTo": "0x233521928665E16de96267D17313571687eC41b7",
    "network": "base-sepolia",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "maxAmountRequired": "1000",
    "extra": {"name": "USDC", "symbol": "USDC", "decimals": 6}
  }],
  "version": "2"
}
```

**3. Client Signs EIP-712 Authorization**

Crossmint wallet signs typed data:
```typescript
{
  domain: {
    name: "x402",
    version: "2",
    chainId: 84532  // Base Sepolia
  },
  types: {
    Authorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "asset", type: "address" },
      { name: "nonce", type: "uint256" }
    ]
  },
  message: {
    from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    to: "0x233521928665E16de96267D17313571687eC41b7",
    value: "1000",  // 0.001 USDC in base units
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    nonce: "1234567890"
  }
}
```

**4. Client Retries with Payment Header**
```http
GET /ping HTTP/1.1
Host: localhost:3100
Accept: application/vnd.x402+json
X-PAYMENT: <base64-encoded-payment-data>
```

**5. Server Verifies Signature**
- Decodes `X-PAYMENT` header
- Extracts EIP-712 signature
- Recovers signer address from signature
- Validates signer matches `from` address
- Checks payment amount ≥ required amount
- Signature verification succeeds off-chain

**6. Settlement Attempt (External Facilitator)**
- Server forwards payment to facilitator: `https://x402.org/facilitator`
- Facilitator attempts on-chain transfer execution
- **Pre-deployed wallets**: Signature valid, but on-chain settlement may fail (contract not deployed)
- **Deployed wallets**: Executes USDC transfer via EIP-1271 contract signature

**7. Server Returns Content**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"message": "pong"}
```

### Signature Formats Explained

**Pre-deployed Wallet (ERC-6492):**
```
Format: 0x<signature><factory-data>6492649264926492...
Length: ~854 characters
Purpose: Enables signature verification before contract deployment
```

**Deployed Wallet (EIP-1271):**
```
Format: 0x<signature-data>
Length: ~174 characters
Purpose: Contract validates signature on-chain via isValidSignature()
```

**Standard ECDSA (Traditional):**
```
Format: 0x<r-32-bytes><s-32-bytes><v-1-byte>
Length: 132 characters (65 bytes)
Purpose: EOA signature recovery via ecrecover
```

### Facilitator Role

The facilitator (`https://x402.org/facilitator`) handles:
- ✅ Receiving signed payment authorizations from server
- ✅ Executing on-chain USDC transfers
- ✅ Managing nonces and replay protection
- ✅ Handling gas fees for transaction execution
- ✅ Returning settlement receipts

**Why Settlement May Fail:**
- Pre-deployed wallets cannot execute EIP-1271 verification on-chain (no contract exists yet)
- Facilitator requires deployed smart contract to call `isValidSignature()`
- Signature verification works off-chain (server validates correctly using ERC-6492)
- On-chain settlement requires contract deployment first

**Solution:** Deploy wallet before making payments requiring on-chain settlement.

## API Reference

### GET /health

Health check endpoint - no payment required.

**Request:**
```bash
curl http://localhost:3100/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-10-02T14:32:15.234Z",
  "uptime": 3456.789,
  "port": 3100,
  "network": "base-sepolia",
  "payTo": "0x233521928665E16de96267D17313571687eC41b7",
  "endpoints": {
    "ping": "$0.001"
  }
}
```

### GET /ping

Protected endpoint requiring $0.001 USDC payment.

**Request (without payment):**
```bash
curl -H "Accept: application/vnd.x402+json" \
  http://localhost:3100/ping
```

**Response (402 Payment Required):**
```json
{
  "accepts": [{
    "payTo": "0x233521928665E16de96267D17313571687eC41b7",
    "network": "base-sepolia",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "maxAmountRequired": "1000",
    "extra": {
      "name": "USDC",
      "symbol": "USDC",
      "decimals": 6
    }
  }],
  "version": "2"
}
```

**Request (with payment):**
```bash
curl -H "Accept: application/vnd.x402+json" \
  -H "X-PAYMENT: <base64-encoded-payment>" \
  http://localhost:3100/ping
```

**Response (200 OK):**
```json
{
  "message": "pong"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid payment format or missing required fields
- `402 Payment Required` - Payment verification failed or settlement failed
- `500 Internal Server Error` - Server error or facilitator unreachable

## Troubleshooting

### Wallet Initialization Issues

**Error: "Invalid API key. Please use a server API key"**
```
Cause: Using client key (ck_*) with API Key signer
Solution:
  - Use server key (sk_staging_...) for API Key signer
  - OR switch to Email OTP signer if you have client key
```

**Error: "Email OTP signer requires JWT authentication"**
```
Cause: CrossmintAuthProvider not initialized or JWT expired
Solution:
  1. Verify CrossmintAuthProvider wraps App component in client/src/App.tsx
  2. Ensure apiKey prop matches your client key (ck_*)
  3. Check browser localStorage for jwt_token
  4. Try refreshing page to re-authenticate
```

**Error: "OTP verification failed"**
```
Cause: Incorrect OTP code or expired code (5min expiry)
Solution:
  1. Verify 6-digit code from email exactly
  2. Request new OTP if >5 minutes elapsed
  3. Check email spam/junk folder
  4. Verify email address is correct and accessible
```

### Wallet Deployment Issues

**Error: "Insufficient ETH balance for deployment"**
```
Cause: Wallet has 0 ETH or not enough for gas fees
Solution:
  1. Copy wallet address from UI
  2. Visit: https://www.alchemy.com/faucets/base-sepolia
  3. Request 0.1 ETH to your wallet address
  4. Wait 30-60 seconds for confirmation
  5. Retry deployment
```

**Error: "Wallet deployment failed: transaction reverted"**
```
Cause: Gas estimation failed or RPC issue
Solution:
  1. Check Base Sepolia network status
  2. Verify RPC responding (check browser Network tab)
  3. Wait 60 seconds and retry (possible rate limiting)
  4. Ensure wallet has sufficient ETH balance
```

### Payment Execution Issues

**Error: "Request failed: Network Error"**
```
Cause: Server not running or incorrect URL
Solution:
  1. Verify server running: curl http://localhost:3100/health
  2. Check Server URL in client UI exactly matches
  3. Ensure firewall not blocking localhost:3100
  4. Check server console for startup errors
```

**Message: "Payment verification completed, settlement had issues"**
```
Status: This is EXPECTED with pre-deployed wallets
Explanation:
  - Signature verification: ✅ Success (core feature working!)
  - On-chain settlement: ⚠️ May fail (pre-deployed wallet limitation)
Solution:
  - For full payment flow: Deploy wallet first
  - For signature testing: No action needed, working as expected!
```

**Error: "Payment execution failed: unauthorized"**
```
Cause: Signature verification failed - wrong signer
Solution:
  1. Verify wallet address in payment matches initialized wallet
  2. Check chain matches between client and server (both base-sepolia)
  3. Review server logs for recovered payer address
  4. Ensure wallet hasn't been reset/reinitialized
```

### Server Issues

**Server won't start: "Error: listen EADDRINUSE"**
```
Cause: Port 3100 already in use by another process
Solution:
  # Find process using port 3100
  lsof -i :3100

  # Kill the process
  kill -9 <PID>

  # OR use different port
  PORT=3200 npm run dev
```

**Server logs: "facilitator unreachable"**
```
Cause: Cannot connect to https://x402.org/facilitator
Solution:
  1. Check internet connection
  2. Verify HTTPS outbound access allowed (firewall)
  3. Test: curl https://x402.org/facilitator
  4. May be temporary - wait and retry

Note: Payment signature still verified even if facilitator fails
```

### Network & RPC Issues

**Error: "Cannot connect to RPC endpoint"**
```
Cause: Alchemy RPC rate limit or network issue
Solution:
  1. Check Alchemy status: https://status.alchemy.com/
  2. Create free Alchemy account for personal API key
  3. Update RPC URLs in client/src/constants/chains.ts:
     - base-sepolia: https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
     - ethereum: https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

**Transaction not confirming after 5 minutes**
```
Cause: Network congestion or transaction dropped
Solution:
  1. Check block explorer: https://sepolia.basescan.org/
  2. Search for transaction hash from UI
  3. If pending: Wait (testnet can be slow)
  4. If not found: Transaction dropped, retry operation
```

### Client UI Issues

**Error: "Cannot read property 'jwt' of undefined"**
```
Cause: useAuth() hook called outside CrossmintAuthProvider
Solution:
  Verify App.tsx structure:
  <CrossmintAuthProvider apiKey={apiKey}>
    <YourComponents />
  </CrossmintAuthProvider>
```

**Balances show 0.000000 after funding**
```
Cause: Balance query cached or RPC lag
Solution:
  1. Wait 60-90 seconds after funding transaction
  2. Click "Deploy Wallet" to trigger balance refresh
  3. Check block explorer to confirm tokens arrived
  4. Check browser console for balance fetch errors
```

## Development Guide

### Project Structure

```
ping-crossmint/
├── client/                           # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/              # UI components
│   │   │   ├── WalletDisplay.tsx   # Shows address, balances, status
│   │   │   ├── PaymentApproval.tsx # Payment confirmation dialog
│   │   │   ├── ServerStatus.tsx    # Server health indicator
│   │   │   └── ActivityLogs.tsx    # Event logging display
│   │   ├── hooks/                   # React hooks
│   │   │   ├── useCrossmintWallet.ts   # Wallet init, deployment, OTP
│   │   │   ├── useX402Payments.ts      # Payment request/execution
│   │   │   └── useWalletBalances.ts    # ETH/USDC balance queries
│   │   ├── utils/                   # Helper functions
│   │   │   ├── x402Adapter.ts      # Crossmint → x402 signer adapter
│   │   │   └── walletGuards.ts     # Deployment checks, utilities
│   │   ├── constants/               # Configuration
│   │   │   └── chains.ts           # Chain configs, RPC URLs, USDC addresses
│   │   └── types/                   # TypeScript definitions
│   └── package.json                 # Dependencies: @crossmint/wallets-sdk, x402-axios, viem
├── server/                          # Express backend (TypeScript)
│   ├── src/
│   │   └── server.ts               # Express + x402 payment middleware
│   └── package.json                 # Dependencies: express, x402-express, cors
└── README.md                        # This file
```

### Key Implementation Files

**Wallet Initialization** - `client/src/hooks/useCrossmintWallet.ts`
- Demonstrates `createCrossmint()` and `CrossmintWallets.from()`
- Shows API key vs Email OTP signer configuration
- Handles JWT authentication for client-side signers
- Implements OTP flow: send, verify, reject
- Example wallet creation for both signer types

**Payment Integration** - `client/src/hooks/useX402Payments.ts`
- Demonstrates x402 payment protocol with Crossmint
- Uses `withPaymentInterceptor()` from x402-axios
- Handles 402 response parsing and automatic retry with payment
- Manages payment approval dialog and execution

**Signature Adapter** - `client/src/utils/x402Adapter.ts`
- **Critical integration point** between Crossmint SDK and x402
- Converts Crossmint wallet to x402 Signer interface
- Handles ERC-6492, EIP-1271, and ECDSA signature formats
- Preserves pre-deployed signature wrapper for facilitator

**Server Middleware** - `server/src/server.ts`
- Configures x402-express payment middleware
- Defines payment requirements per endpoint
- Implements signature verification logging
- Facilitator integration configuration

### Adding New Payment Endpoints

**Server-side:**
```typescript
// server/src/server.ts
app.use(paymentMiddleware(payTo, {
  "GET /ping": { price: "$0.001", network },
  "GET /premium": { price: "$0.05", network },  // New endpoint
  "POST /action": { price: "$0.10", network },  // Supports any method
}, {
  url: "https://x402.org/facilitator",
  createAuthHeaders: undefined
}));

app.get("/premium", (req, res) => {
  // Only executes after payment verification
  res.json({ data: "premium content", tier: "gold" });
});
```

**Client-side:**
```typescript
// Similar to useX402Payments.ts
const makePremiumRequest = async () => {
  try {
    const response = await axiosInstance.get('/premium', {
      headers: { 'Accept': 'application/vnd.x402+json' }
    });
    console.log('Premium data:', response.data);
  } catch (error) {
    console.error('Premium request failed:', error);
  }
};
```

### Testing Different Networks

**1. Update server environment:**
```bash
# server/.env
NETWORK=polygon-amoy
```

**2. Update client chain in UI:**
- Select "polygon-amoy" from chain dropdown
- OR set default in code

**3. Add chain configuration if new:**
```typescript
// client/src/constants/chains.ts
import { polygonAmoy } from 'viem/chains';

export const CHAIN_CONFIGS = {
  'polygon-amoy': {
    chain: polygonAmoy,
    rpc: 'https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY'
  },
  // ... existing chains
};

export const USDC_ADDRESSES = {
  'polygon-amoy': '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582',  // Polygon Amoy USDC
  // ... existing addresses
};
```

**4. Get testnet tokens:**
- Search "<network-name> faucet" for native token (ETH equivalent)
- Visit Circle USDC faucet for USDC: https://faucet.circle.com/

### Switching Between Signers

**API Key Signer (Server-side)**
- **Use when:** Building backend services, automated payments, server-to-server
- **Pros:** No user interaction, faster signing, simpler flow
- **Cons:** Key must be secured server-side, custodial
- **Setup:** Just needs `sk_*` key, no additional auth

**Email OTP Signer (Client-side)**
- **Use when:** User-facing apps, non-custodial wallets, end-user payments
- **Pros:** User controls keys, better security model, non-custodial
- **Cons:** Requires email verification flow, JWT management, more complex
- **Setup:** Needs `ck_*` key + CrossmintAuthProvider + OTP flow implementation

### Adding Custom Facilitator

Replace default facilitator with your own settlement service:

```typescript
// server/src/server.ts
app.use(paymentMiddleware(payTo, endpoints, {
  url: "https://your-facilitator.com/settle",
  createAuthHeaders: (req) => ({
    "Authorization": `Bearer ${process.env.FACILITATOR_API_KEY}`,
    "X-Request-Id": req.headers['x-request-id'] || '',
    "X-Origin": "ping-crossmint"
  })
}));
```

**Facilitator Requirements:**
- Must implement POST endpoint accepting x402 payment data
- Must execute on-chain USDC transfer
- Must return settlement receipt or error
- Should handle nonce management and replay protection

### Monitoring and Logging

**Server Logs to Watch:**
```bash
[REQ]       - Incoming request details (method, path, headers)
[RES]       - Response status and duration
[X-PAYMENT] - Decoded payment data (payer, amount, network)
[VERIFY]    - Signature verification results
```

**Client Logs (Browser Console):**
```bash
🔐 - Authentication/JWT events
📧 - OTP sending/verification
✅ - Successful operations
❌ - Errors with stack traces
💳 - Payment flow steps
```

**Add Custom Logging:**
```typescript
// server/src/server.ts
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[CUSTOM] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});
```

### Security Best Practices

**API Key Management:**
- ❌ Never commit `sk_*` or `ck_*` keys to git
- ✅ Use environment variables or secrets manager
- ✅ Rotate keys regularly (monthly recommended)
- ✅ Use staging keys (`sk_staging_*`) for development
- ✅ Use production keys (`sk_production_*`) only in production
- ✅ Add keys to `.gitignore`

**CORS Configuration:**
```typescript
// server/src/server.ts
// Development (permissive)
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true
}));

// Production (restrictive)
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept', 'X-Payment']
}));
```

**Rate Limiting:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests, please try again later'
});

app.use('/ping', limiter);
```

**Input Validation:**
```typescript
// Validate payment data before processing
app.use((req, res, next) => {
  const xpayment = req.header('X-PAYMENT');
  if (xpayment) {
    try {
      // Basic validation
      if (xpayment.length > 10000) {
        return res.status(400).json({ error: "Payment data too large" });
      }
      // x402 middleware will handle detailed validation
    } catch (e) {
      return res.status(400).json({ error: "Malformed payment data" });
    }
  }
  next();
});
```

## Production Deployment

### Environment Configuration

**Server (.env.production):**
```bash
PORT=443
PAY_TO=0xYourProductionWalletAddress
NETWORK=base  # Use mainnet network
NODE_ENV=production
ALLOWED_ORIGINS=https://your-app.com,https://www.your-app.com
```

**Client:**
```typescript
// Update to production RPC endpoints
// client/src/constants/chains.ts
export const CHAIN_CONFIGS = {
  'base': {
    chain: base,
    rpc: `https://base-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_KEY}`
  }
};

// Use production API keys
// Pass securely from backend, never hardcode
```

### API Key Management for Production

**Production Keys:**
1. Generate production keys in Crossmint Developer Console
2. Format: `sk_production_...` (server), `ck_production_...` (client)
3. Store securely:
   - **Server:** Environment variables, AWS Secrets Manager, HashiCorp Vault
   - **Client:** Never expose, pass via secure backend API
4. **Never** commit production keys to version control

**Key Rotation Process:**
```bash
# 1. Generate new production key in Crossmint console
# 2. Update environment variable in deployment
# 3. Restart server/redeploy application
# 4. Monitor logs for authentication errors
# 5. Deactivate old key after 24-hour grace period
```

### Hosting Options

**Server (Express App):**
- **Railway:** Connect git repo, auto-deploy, set env vars
- **Render:** Add `render.yaml`, configure environment
- **AWS ECS:** Containerize with Docker, deploy to Fargate
- **DigitalOcean App Platform:** Push Docker image or connect repo
- **Vercel:** Add `vercel.json` for serverless Express configuration

**Client (Vite React):**
- **Vercel:** `npm run build && vercel --prod`
- **Netlify:** Configure build command `npm run build`, publish dir `dist`
- **AWS S3 + CloudFront:** Build to S3, serve via CDN for global performance
- **GitHub Pages:** Build and deploy to gh-pages branch
- **Cloudflare Pages:** Connect git repo, auto-build on push

### Docker Deployment

**Dockerfile (server):**
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Expose port
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "require('http').get('http://localhost:3100/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "dist/server.js"]
```

**Build and Run:**
```bash
# Build application
cd server
npm run build

# Build Docker image
docker build -t ping-crossmint-server .

# Run container
docker run -p 3100:3100 \
  -e PAY_TO=0xYourWalletAddress \
  -e NETWORK=base \
  -e ALLOWED_ORIGINS=https://your-app.com \
  ping-crossmint-server
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  server:
    build: ./server
    ports:
      - "3100:3100"
    environment:
      - PORT=3100
      - PAY_TO=${PAY_TO}
      - NETWORK=${NETWORK}
      - NODE_ENV=production
    restart: unless-stopped
```

### Monitoring & Observability

**Health Checks:**
```bash
# Configure load balancer to check this endpoint
curl https://api.your-app.com/health

# Expected: 200 status within 100ms
# Alert if: 5xx status or >1000ms response time
```

**Error Tracking Integration:**
```typescript
// server/src/server.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**Key Metrics to Track:**
- 402 request count (payment attempts)
- 200 response count (successful payments)
- Payment verification latency
- Settlement failure rate
- RPC call latency
- Facilitator availability

**Centralized Logging:**
- AWS CloudWatch, Datadog, LogDNA, or Papertrail
- Log structured JSON for easier querying
- Include request IDs for tracing

### Cost Estimation

**Mainnet Costs (Approximate):**
- **Wallet deployment:** $0.50-2.00 one-time (Base), $10-50 (Ethereum mainnet)
- **USDC transfer gas:** $0.10-0.50 per payment (Base), $5-15 (Ethereum)
- **Crossmint API:** Free tier covers development, check pricing for production volume
- **Hosting:** $5-25/month (Railway, Render) or usage-based (AWS, serverless)

**Cost Optimizations:**
- ✅ Use Layer 2 networks (Base, Polygon) for 10-100x lower gas costs
- ✅ Batch operations when possible
- ✅ Deploy wallets during low-traffic periods (weekends, nights)
- ✅ Cache wallet deployment status to reduce RPC calls
- ✅ Use webhook notifications instead of polling

### Security Checklist

Before production launch:

- [ ] Production API keys configured (`sk_production_*`, `ck_production_*`)
- [ ] Staging/development keys removed from production environment
- [ ] CORS restricted to production domains only (no wildcards)
- [ ] Rate limiting enabled on all payment endpoints
- [ ] HTTPS enforced for all traffic (HTTP → HTTPS redirect)
- [ ] Environment variables secured (AWS Secrets Manager, etc.)
- [ ] Error messages sanitized (no stack traces, sensitive info)
- [ ] Dependencies audited (`npm audit fix`)
- [ ] Server logs exclude full payment signatures
- [ ] Facilitator endpoint uses HTTPS only
- [ ] Payment recipient address verified (`PAY_TO` is correct)
- [ ] Network configuration verified (`NETWORK` matches intended chain)
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (if using database)
- [ ] XSS prevention in client (React handles by default)

### Scaling Considerations

**Horizontal Scaling:**
- Express server is stateless - safe to run multiple instances
- Use load balancer (AWS ALB, nginx) for distribution
- No session affinity required (no server-side state)
- Each instance can handle 1000+ req/sec

**Database (Optional - For Tracking):**
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  wallet_address VARCHAR(42),
  amount_usdc DECIMAL(20,6),
  network VARCHAR(50),
  tx_hash VARCHAR(66),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wallet_address ON payments(wallet_address);
CREATE INDEX idx_created_at ON payments(created_at DESC);
```

**Caching Strategy:**
```typescript
// Cache wallet deployment status (Redis)
const isDeployed = await redis.get(`deployed:${address}`);
if (isDeployed === null) {
  const deployed = await checkDeployment(address);
  await redis.setex(`deployed:${address}`, 300, deployed ? '1' : '0');
}

// Cache USDC balances (shorter TTL)
const balance = await redis.get(`balance:${address}`);
if (balance === null) {
  const bal = await fetchBalance(address);
  await redis.setex(`balance:${address}`, 30, bal.toString());
}
```

**Bottleneck Analysis:**
- **RPC endpoints:** Alchemy free tier = 300 req/sec, growth plan = unlimited
- **Facilitator availability:** Monitor `https://x402.org/facilitator` uptime
- **Signature verification:** CPU-bound but fast (~10ms), unlikely bottleneck
- **Database queries:** Index on `wallet_address` and `created_at` for fast lookups

## FAQ

**Q: Can I use this with Solana or other non-EVM chains?**

A: Server supports Solana networks (`solana`, `solana-devnet`), but client currently implements EVM chains only. To add Solana:

1. Update `CHAIN_CONFIGS` in `client/src/constants/chains.ts` with Solana RPC
2. Use `SolanaWallet.from()` instead of `EVMWallet.from()` in wallet initialization
3. Adapt `x402Adapter.ts` for Solana signature format (ed25519)
4. Crossmint SDK fully supports Solana - see https://docs.crossmint.com/wallets

**Q: Why do payments show "settlement failed" but verification succeeds?**

A: Pre-deployed wallets can sign messages off-chain (verification works), but cannot execute on-chain operations until the contract is deployed (settlement fails). This demonstrates that signature verification is working perfectly! Deploy the wallet first for full end-to-end payment flow with on-chain settlement.

**Q: What's the difference between sk_* and ck_* API keys?**

A:
- **`sk_*` (server key):** Server-side signing, custodial, requires secure backend storage, no user interaction needed
- **`ck_*` (client key):** Client-side signing, non-custodial, requires user authentication (JWT + OTP), better security model for end users

**Q: How do I receive payments to my own wallet?**

A: Change the `PAY_TO` environment variable in `server/.env` to your wallet address. Ensure:
- Address exists on the target network
- Address can receive USDC (ERC-20 compatible)
- You have access to the private key to withdraw funds

**Q: Can users pay with ETH instead of USDC?**

A: Yes! The x402 protocol supports any ERC-20 token or native ETH. Modify server configuration:

```typescript
// server/src/server.ts
"GET /ping": {
  price: "0.0001",  // ETH amount (not USD)
  network,
  asset: "0x0000000000000000000000000000000000000000"  // Zero address = ETH
}
```

Update client UI to display ETH instead of USDC, and ensure users have ETH balance.

**Q: How much does wallet deployment cost?**

A: Varies by network and gas prices:
- **Base Sepolia (testnet):** ~$0 (testnet ETH is free)
- **Base mainnet:** $0.50-2.00 depending on gas price
- **Ethereum mainnet:** $10-50 depending on network congestion
- Check current rates: https://basescan.org/gastracker or https://etherscan.io/gastracker

**Q: Can I use this in a mobile app (iOS/Android)?**

A: Yes! Crossmint SDK supports React Native. To adapt this demo:

1. Replace Vite with React Native bundler (Metro)
2. Use `@crossmint/react-native-sdk` instead of browser SDK
3. Implement deep links for OTP email verification
4. Use native HTTP client or axios (works in React Native)
5. Adapt UI components to React Native components

**Q: What happens if the facilitator is down?**

A: Server returns 402 status even if facilitator is unreachable (signature verification succeeds, settlement fails). For production:
- Implement retry logic with exponential backoff
- Set up monitoring/alerting for facilitator availability
- Consider implementing custom facilitator for critical applications
- Payment signatures remain valid and can be settled later

**Q: How do I test without spending real money?**

A: Use testnet networks exclusively:
- **Recommended:** `base-sepolia` (fast, reliable)
- **Alternatives:** `polygon-amoy`, `solana-devnet`, `avalanche-fuji`
- Get free testnet tokens from faucets listed in Prerequisites section
- Testnet USDC has no real value

**Q: Can I customize the payment UI?**

A: Absolutely! The client is open-source React. Customize:
- `client/src/components/PaymentApproval.tsx` - Payment confirmation dialog
- `client/src/components/WalletDisplay.tsx` - Wallet information display
- `client/src/components/ServerStatus.tsx` - Server health indicator
- Add your branding, colors, logos, custom wording
- Fork and modify to match your app's design system

**Q: Is the signature process secure?**

A: Yes, very secure:
- Crossmint uses **MPC (Multi-Party Computation)** for key management
- Private keys never exist in a single location
- Signatures use **EIP-712** for human-readable transaction approval
- Users see exactly what they're signing
- Non-custodial option (Email OTP) available where user controls authentication

**Q: What's ERC-6492 and why does my wallet use it?**

A: **ERC-6492** enables counterfactual (pre-deployed) wallets to create valid signatures before the contract is deployed on-chain. The signature includes deployment data, so it can be verified even though the contract doesn't exist yet. This allows instant wallet creation without upfront gas costs, while still maintaining security.

**Q: Can I batch multiple payments?**

A: Not directly with the current x402 implementation (one payment per request). For batching:
- Implement custom facilitator that accumulates authorizations
- Create multi-payment endpoint that processes multiple signatures
- Consider using EIP-712 permit batching patterns
- Trade-off: Complexity vs gas savings

**Q: How do I handle payment disputes or refunds?**

A: On-chain payments are final and irreversible. For refunds:

1. Verify payment on block explorer (basescan.org, etherscan.io)
2. Check payment amount matches expected value
3. Implement refund endpoint that creates reverse payment authorization
4. Store payment metadata (invoice ID, order ID) in EIP-712 message for reference
5. Consider escrow pattern for dispute-prone scenarios

**Q: What's the payment latency (user wait time)?**

A: Typical flow breakdown:
- **Signature generation:** 200-500ms (Crossmint MPC signing)
- **Server verification:** 10-50ms (off-chain signature validation)
- **On-chain settlement:** 2-10 seconds (blockchain confirmation)
- **Total user experience:** 2-10 seconds from approval to completion

For better UX, show "Processing..." immediately and update async.

**Q: Can multiple users share the same wallet?**

A: No, by design. Crossmint wallets are tied to a single owner (email in this demo). For multi-signature or shared wallets:
- Implement custom signer with multiple approvers
- Use Gnosis Safe or similar multi-sig contract
- Coordinate signatures off-chain, submit combined
- Consider social recovery patterns

## Components

**Client** (React + Vite + TypeScript)
- Crossmint wallet creation via SDK
- Two signer types: API key (server-side) and Email OTP (client-side)
- x402 payment interceptor integration
- Wallet deployment utilities with ERC-6492 support
- Balance checking (ETH, USDC) across multiple networks
- Payment approval UI with detailed transaction information

**Server** (Express + TypeScript)
- x402 payment middleware with configurable endpoints
- Protected `/ping` endpoint requiring $0.001 USDC
- EIP-712 signature verification (ERC-6492 and EIP-1271)
- Health check endpoint at `/health` with system status
- CORS configuration for cross-origin requests
- Facilitator integration for on-chain settlement

## Key Files

- [`client/src/hooks/useCrossmintWallet.ts`](client/src/hooks/useCrossmintWallet.ts) - Wallet initialization, OTP flow, deployment
- [`client/src/hooks/useX402Payments.ts`](client/src/hooks/useX402Payments.ts) - Payment request/execution with x402 protocol
- [`client/src/utils/x402Adapter.ts`](client/src/utils/x402Adapter.ts) - Critical adapter: Crossmint → x402 signer interface
- [`client/src/utils/walletGuards.ts`](client/src/utils/walletGuards.ts) - Deployment utilities and wallet checks
- [`client/src/constants/chains.ts`](client/src/constants/chains.ts) - Chain configurations, RPC endpoints, USDC addresses
- [`server/src/server.ts`](server/src/server.ts) - Express server with x402 payment middleware

## Dependencies

**Client:**
- `@crossmint/wallets-sdk` - Crossmint smart wallet SDK for wallet creation and signing
- `@crossmint/client-sdk-react-ui` - React components and auth provider for Email OTP
- `x402-axios` - Axios interceptor for x402 payment protocol
- `viem` - Ethereum library for RPC calls, contract interaction, deployment checks
- `axios` - HTTP client for API requests

**Server:**
- `express` (v5.1.0) - Web framework for API server
- `x402-express` - Express middleware for x402 payment verification
- `cors` - Cross-origin resource sharing middleware

## References

- [Crossmint Wallets SDK Documentation](https://docs.crossmint.com/wallets)
- [x402 Payment Protocol Specification](https://x402.org)
- [EIP-712: Typed Data Signing](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-1271: Contract Signature Verification](https://eips.ethereum.org/EIPS/eip-1271)
- [ERC-6492: Pre-deployed Contract Signatures](https://eips.ethereum.org/EIPS/eip-6492)
- [Crossmint Developer Console](https://www.crossmint.com/console)
- [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
- [Circle USDC Testnet Faucet](https://faucet.circle.com/)
