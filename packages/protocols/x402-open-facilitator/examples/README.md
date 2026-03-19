# OpenFacilitator Examples

This folder contains example scripts demonstrating OpenFacilitator features.

## Multi-Settle Test

The `multisettle-test.ts` script demonstrates the multi-settle feature, which allows a single signed payment authorization to be settled multiple times against different recipients.

### Prerequisites

1. Install dependencies:
   ```bash
   cd examples
   pnpm install
   ```

2. (Optional) Fund a test wallet with USDC on Base Sepolia for real on-chain tests

### Running the Test

```bash
# Test against the free public facilitator
pnpm multisettle

# Test against local development server
pnpm multisettle:local
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FACILITATOR_URL` | `https://free.openfacilitator.io` | Base URL of the facilitator API |
| `NETWORK` | `base-sepolia` | Network to use: `base-sepolia`, `base`, `sepolia` |
| `PAYER_PRIVATE_KEY` | (generated) | Private key of payer wallet. **Use test wallets only!** |

### Example Output

```
============================================================
🚀 Multi-Settle Test Script
============================================================

Facilitator URL: https://free.openfacilitator.io
Network: base-sepolia

🔹 Payer wallet
{
  "address": "0x...",
  "privateKey": "0x1234..."
}

----------------------------------------
Step 1: Authorize Multi-Settle
----------------------------------------
✅ Authorization created!
🔹 Authorization details
{
  "authorizationId": "abc123",
  "cap": "$2.00",
  "remaining": "$2.00",
  "validUntil": "2024-01-01T12:00:00.000Z"
}

----------------------------------------
Step 2: Make Multiple Settlements
----------------------------------------
🔹 Settling $0.50 to Alice...
✅ Settlement to Alice successful!

🔹 Settling $0.30 to Bob...
✅ Settlement to Bob successful!

🔹 Settling $0.40 to Carol...
✅ Settlement to Carol successful!

----------------------------------------
Step 3: Test Exceeding Cap (Should Fail)
----------------------------------------
✅ Correctly rejected settlement that exceeds cap!

...
```

### What This Test Demonstrates

1. **Authorization**: Creates a $2.00 spending cap with a 1-hour validity period
2. **Multiple Settlements**: Settles to three different recipients (Alice, Bob, Carol)
3. **Cap Enforcement**: Attempts to exceed the remaining balance (should fail)
4. **Status Check**: Retrieves the current authorization status and settlement history
5. **Revocation**: Revokes the authorization to prevent further use
6. **Post-Revocation**: Confirms that revoked authorizations cannot be used

### How Multi-Settle Works

1. **User signs once**: Creates an ERC-3009 `transferWithAuthorization` signature for the full cap amount, directed to the facilitator's wallet

2. **First settlement**: 
   - Facilitator executes the ERC-3009 transfer to receive funds
   - Transfers the requested amount to the first recipient
   - Updates remaining balance

3. **Subsequent settlements**:
   - Facilitator transfers from its balance to each recipient
   - Continues until cap is exhausted

4. **Expiry/Revocation**:
   - Authorization expires when time limit is reached
   - Can be explicitly revoked to prevent further use
   - Unused funds remain in facilitator (operator should return them)

