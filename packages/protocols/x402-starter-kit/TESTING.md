# Testing Guide

Complete guide for testing the x402 payment API starter kit.

## Test Scripts Available

### 1. Basic Health Check
Simple curl test to verify the API is running:

```bash
curl http://localhost:3000/health
```

### 2. Simple Request Test
Test the payment requirement flow:

```bash
./test-request.sh
```

This will:
- Check API health
- Send a request without payment
- Show the 402 Payment Required response

### 3. Full Test Client
Comprehensive test with payment signing:

```bash
npm test
```

or

```bash
./test-request.sh
```

## Test Scenarios

### Test 1: API Health Check

**What it tests:** API is running and configured properly

```bash
curl http://localhost:3000/health
```

**Expected output:**
```json
{
  "status": "healthy",
  "service": "x402-payment-api",
  "version": "1.0.0",
  "payment": {
    "address": "0xYourAddress...",
    "network": "base-sepolia",
    "price": "$0.10"
  }
}
```

### Test 2: Payment Required Flow

**What it tests:** API correctly requests payment

```bash
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "parts": [{"kind": "text", "text": "Hello!"}]
    }
  }'
```

**Expected output:** HTTP 402 with payment requirements
```json
{
  "error": "Payment Required",
  "x402": {
    "x402Version": 1,
    "accepts": [{
      "scheme": "eip3009",
      "network": "base-sepolia",
      "asset": "USDC",
      "payTo": "0xYourAddress...",
      "maxAmountRequired": "100000",
      "resource": "/process-request",
      "description": "AI request processing service"
    }],
    "error": "Payment required for service: /process-request"
  }
}
```

### Test 3: Complete Payment Flow

**What it tests:** Full payment and request processing

**Prerequisites:**
- Test wallet with USDC
- Test wallet with gas tokens
- USDC approval set for the facilitator

**Setup:**
```bash
# Add to .env
CLIENT_PRIVATE_KEY=your_test_wallet_private_key
```

**Run:**
```bash
npm test
```

**What happens:**
1. Client sends request
2. API returns 402 Payment Required
3. Client signs payment with wallet
4. Client submits signed payment
5. API verifies payment signature
6. API processes request (calls OpenAI in this example)
7. API settles payment on blockchain
8. API returns response

**Expected output:**
```
🧪 x402 Payment API Test Client
================================

🏥 Checking API health...
✅ API is healthy
   Service: x402-payment-api
   Payment address: 0x...
   Network: base-sepolia
   Price: $0.10

📋 TEST 1: Request without payment
=====================================
📤 Sending request: "What is 2+2?"
💳 Payment required!
✅ Correctly received payment requirement

📋 TEST 2: Request with payment
=====================================
💼 Client wallet: 0x...

=== STEP 1: Initial Request ===
📤 Sending request: "Tell me a joke about TypeScript!"
💳 Payment required!

=== STEP 2: Processing Payment ===
Payment options: 1
First option: USDC on base-sepolia
Amount: 100000 (micro units)
🔐 Signing payment...
✅ Payment signed successfully
Payment payload created for base-sepolia

=== STEP 3: Submitting Payment ===
✅ Payment accepted and request processed!

🎉 SUCCESS! Response from AI:
-----------------------------------
Why do TypeScript developers prefer dark mode?
Because light attracts bugs! 🐛
-----------------------------------

✅ Tests complete!
```

## Test Client Configuration

The test client (`src/testClient.ts`) supports:

### Environment Variables

```env
# Required for the API
OPENAI_API_KEY=your_openai_api_key
PAY_TO_ADDRESS=0xYourMerchantAddress
NETWORK=base-sepolia

# Optional for testing with payments
CLIENT_PRIVATE_KEY=your_test_wallet_private_key
API_URL=http://localhost:3000
```

### Test Client API

You can also use the test client programmatically:

```typescript
import { TestClient } from './testClient.js';

const client = new TestClient(privateKey);

// Check health
await client.checkHealth();

// Send request without payment
const response1 = await client.sendRequest('What is 2+2?');

// Send request with payment
const response2 = await client.sendPaidRequest('Tell me a joke!');
```

## Setting Up for Full Payment Testing

### 1. Get a Test Wallet

Create a new wallet for testing:

```typescript
import { Wallet } from 'ethers';
const wallet = Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
```

Or use an existing test wallet.

### 2. Get Testnet Tokens

For Base Sepolia:

**Get testnet ETH:**
- https://www.alchemy.com/faucets/base-sepolia
- https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

**Get testnet USDC:**
- Swap testnet ETH for USDC on Uniswap testnet
- Or use a testnet USDC faucet

### 3. Set USDC Approval

Your test wallet needs to approve the facilitator to spend USDC:

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const wallet = new ethers.Wallet(privateKey, provider);

// USDC contract on Base Sepolia
const usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const facilitatorAddress = '0x...'; // Get from facilitator docs

const usdc = new ethers.Contract(
  usdcAddress,
  ['function approve(address spender, uint256 amount) returns (bool)'],
  wallet
);

// Approve facilitator to spend USDC (approve large amount for testing)
const tx = await usdc.approve(facilitatorAddress, ethers.parseUnits('1000', 6));
await tx.wait();
console.log('Approval granted!');
```

### 4. Configure Test Client

Add to `.env`:

```env
CLIENT_PRIVATE_KEY=0x1234...your_test_wallet_private_key
```

### 5. Run Tests

```bash
npm test
```

## Troubleshooting Tests

### "API is not running"

Start the API first:
```bash
npm start
```

In another terminal, run tests:
```bash
npm test
```

### "CLIENT_PRIVATE_KEY not configured"

Test 2 (paid requests) will be skipped without a client wallet. This is expected.

To test with payments, add `CLIENT_PRIVATE_KEY` to `.env`.

### "Payment verification failed"

Check:
- Wallet has USDC tokens
- Wallet has gas tokens (ETH)
- USDC approval is set for the facilitator
- Network matches (testnet vs mainnet)

### "OpenAI API error"

Check:
- `OPENAI_API_KEY` is valid
- OpenAI account has credits
- Not hitting rate limits

### "Network mismatch"

Ensure:
- API's `NETWORK` setting matches your test wallet's network
- Client wallet is funded on the correct network
- USDC contract address matches the network

## CI/CD Testing

For automated testing without payments:

```yaml
# .github/workflows/test.yml
name: Test Payment API

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Start API
        run: npm start &
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          PAY_TO_ADDRESS: "0x0000000000000000000000000000000000000000"

      - name: Wait for API
        run: sleep 5

      - name: Test health endpoint
        run: curl -f http://localhost:3000/health

      - name: Test payment requirement
        run: |
          curl -X POST http://localhost:3000/process \
            -H "Content-Type: application/json" \
            -d '{"message":{"parts":[{"kind":"text","text":"test"}]}}' \
            | grep -q "Payment Required"
```

## Manual Testing Checklist

- [ ] API starts without errors
- [ ] Health endpoint returns 200 OK
- [ ] Request without payment returns 402
- [ ] Payment requirements include correct network
- [ ] Payment requirements include correct amount ($0.10 = 100000 micro USDC)
- [ ] Test client can sign payment
- [ ] API accepts signed payment
- [ ] API verifies payment signature locally
- [ ] API processes request (calls service)
- [ ] API settles payment on blockchain
- [ ] API returns service response
- [ ] Response includes transaction hash
- [ ] USDC transferred to merchant wallet

## Performance Testing

Test API under load:

```bash
# Install apache bench
brew install ab  # macOS
apt-get install apache2-utils  # Linux

# Test 100 requests, 10 concurrent
ab -n 100 -c 10 -p request.json -T application/json http://localhost:3000/process
```

Create `request.json`:
```json
{"message":{"parts":[{"kind":"text","text":"test"}]}}
```

## Security Testing

- [ ] API rejects requests without payment
- [ ] API validates payment signatures
- [ ] API checks payment amounts
- [ ] API verifies network matches
- [ ] API prevents replay attacks (nonce checking)
- [ ] Private keys never logged or exposed
- [ ] HTTPS in production
- [ ] Rate limiting implemented

## Next Steps

After successful testing:

1. Deploy to staging environment
2. Test with real testnet USDC
3. Monitor facilitator responses
4. Check blockchain transactions
5. Verify merchant receives payments
6. Deploy to production
7. Monitor production metrics

## Support

If tests fail:
- Check the [README.md](./README.md)
- Review [RPC_CONFIGURATION.md](./RPC_CONFIGURATION.md)
- Check API logs
- Verify environment variables
- Test blockchain connectivity
