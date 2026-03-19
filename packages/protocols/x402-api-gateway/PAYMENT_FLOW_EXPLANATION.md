# Payment Flow Explanation

## Current Status

Your wallet is funded and ready:
- **Client Wallet**: `0xf59B3Cd80021b77c43EA011356567095C4E45b0e`
  - ETH: 0.0948 (for gas)
  - USDC: 19.17 (enough for ~191 tests)
- **Merchant Wallet**: `0x3B9b10B8a63B93Ae8F447A907FD1EF067153c4e5`
  - ETH: 0.0549
  - USDC: 2.0

## Why No Transactions Are Showing

The x402 protocol uses **EIP-3009** (transferWithAuthorization), which is different from a regular ERC-20 transfer:

1. **Traditional Transfer**: Client directly calls `transfer()` on the USDC contract
2. **EIP-3009**: Client signs an authorization, then the facilitator calls `transferWithAuthorization()`

### The Flow:

```
1. Client → API: "Process my request"
2. API → Client: 402 Payment Required (with payment requirements)
3. Client → Signs payment authorization (NO blockchain transaction yet)
4. Client → API: "Here's my request with signed payment"
5. API → Verifies signature is valid
6. API → Blockchain: Calls transferWithAuthorization() directly ← ACTUAL TRANSACTION
7. API → Processes request
8. API → Client: Returns service response
```

## Current Test Behavior

The test is correctly:
- ✅ Signing the payment authorization
- ✅ Submitting it to the API
- ✅ API is verifying the signature

However:
- ❌ The actual blockchain transaction (step 6) is not happening
- ❌ No transaction hash is being returned

## Why?

The `MerchantExecutor` handles the payment verification and settlement. Looking at the server logs:
```
💰 Payment required for request processing
```

This confirms the API is correctly requiring payment, and the `MerchantExecutor` handles the payment flow for verification and settlement.

## Solution: Understanding MerchantExecutor

The `MerchantExecutor` handles:
1. Payment requirements generation
2. Payment signature verification
3. Payment settlement on blockchain

The payment flow works as follows:
1. Request without payment → returns 402 with payment requirements
2. Request with payment → verifies signature locally
3. If valid → settles payment via `transferWithAuthorization()` on USDC contract
4. Then passes control to `ExampleService` to process the request

## How to See Real Transactions

To see actual blockchain transactions on Base Sepolia:
1. The API accepts the signed authorization
2. Calls `transferWithAuthorization()` on the USDC contract directly
3. Returns a transaction hash

The transaction would show on Base Sepolia:
- https://sepolia.basescan.org/address/0xf59B3Cd80021b77c43EA011356567095C4E45b0e (client)
- https://sepolia.basescan.org/address/0x3B9b10B8a63B93Ae8F447A907FD1EF067153c4e5 (merchant)

## Next Steps

1. **Configure PRIVATE_KEY**: Set the merchant private key to enable direct settlement
2. **Add RPC_URL (optional)**: Configure a custom RPC endpoint for blockchain interaction
3. **Run tests**: Execute the test client to see the full payment flow with settlement

## Testing the Full Flow

Run the test with the server logs visible:

**Terminal 1** (Server):
```bash
npm run dev
```

**Terminal 2** (Test):
```bash
npm test
```

Watch for:
- "💰 Settling payment..." in the server logs
- "✅ Payment settlement result" with transaction hash
- "Transaction: 0x..." if successful

If you see a transaction hash, check it on BaseScan:
```
https://sepolia.basescan.org/tx/[TRANSACTION_HASH]
```

## Understanding the Test Output

Expected test output:
```
💳 Payment required!
🔐 Signing payment...
✅ Payment signed successfully
✅ Payment accepted and request processed!
🎉 SUCCESS! Response: [actual response]
```

The test flow:
1. First request without payment → receives 402
2. Client signs payment authorization
3. Second request with payment → payment verified
4. API settles payment on blockchain
5. API processes request and returns response

## Monitoring

To monitor your wallets for transactions:
```bash
node check-wallet.js
```

This will show current balances and transaction links.
