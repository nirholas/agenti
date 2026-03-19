# Payment Construction

How to BUILD payment payloads for x402. Use this when you control the signing key server-side (managed wallets like Openfort, Privy, Turnkey) or need to construct payments programmatically.

---

## EVM: ERC-3009 Payment Construction

EVM payments use EIP-712 typed data signatures for `transferWithAuthorization`. The payer signs an authorization off-chain; the facilitator submits it on-chain and pays gas.

### Complete Example

```typescript
import { privateKeyToAccount } from 'viem/accounts';
import { parseUnits, toHex } from 'viem';
import crypto from 'crypto';

// Step 1: Create authorization
const account = privateKeyToAccount(privateKey as `0x${string}`);

const authorization = {
  from: account.address,                         // Payer address
  to: '0xRECIPIENT_ADDRESS',                     // Where funds go
  value: parseUnits('1.00', 6).toString(),        // $1 USDC (6 decimals)
  validAfter: Math.floor(Date.now() / 1000) - 60, // Valid from 1 min ago
  validBefore: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
  nonce: toHex(crypto.getRandomValues(new Uint8Array(32))), // Random 32-byte nonce
};

// Step 2: Sign EIP-712 typed data
const signature = await account.signTypedData({
  domain: {
    name: 'USD Coin',       // USDC contract name
    version: '2',           // USDC EIP-712 version
    chainId: BigInt(8453),  // Base chain ID
    verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`, // USDC on Base
  },
  types: {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  },
  primaryType: 'TransferWithAuthorization',
  message: {
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: authorization.nonce as `0x${string}`,
  },
});

// Step 3: Package as x402 payment payload
const paymentPayload = {
  authorization,
  signature,
};

// Step 4: Base64 encode for X-PAYMENT header
const encoded = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
```

### EIP-712 Domain Values by Chain

| Chain | `name` | `version` | `chainId` | USDC `verifyingContract` |
|-------|--------|-----------|-----------|--------------------------|
| Base | `USD Coin` | `2` | `8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Ethereum | `USD Coin` | `2` | `1` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Base Sepolia | `USD Coin` | `2` | `84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

### Key Details

- The `nonce` must be a random 32-byte hex value (`bytes32`). Each nonce can only be used once.
- `validAfter` and `validBefore` are Unix timestamps in seconds.
- The payer never pays gas. The facilitator calls `transferWithAuthorization` on the USDC contract and pays gas from their own wallet.
- Amounts are in smallest units: `parseUnits('1.00', 6)` = `1000000` for $1 USDC.

---

## Solana: SPL Token Transfer Payment Construction

Solana payments use pre-signed transactions. The payer builds and signs a SPL token transfer, then the facilitator broadcasts it.

### Complete Example (Payer Pays Gas)

```typescript
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function buildSolanaPayment(
  privateKey: string,    // Base58 private key
  recipient: string,     // Recipient wallet address
  amount: bigint,        // Amount in atomic units (1000000 = $1 USDC)
): Promise<string> {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  const recipientPubkey = new PublicKey(recipient);

  // Get associated token accounts
  const senderATA = await getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
  const recipientATA = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

  // Build transfer instruction
  const transferIx = createTransferInstruction(
    senderATA,
    recipientATA,
    keypair.publicKey,
    amount,
    [],
    TOKEN_PROGRAM_ID,
  );

  // Build transaction
  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
  );
  transaction.add(transferIx);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = keypair.publicKey; // Payer pays gas

  // Full sign
  transaction.sign(keypair);

  // Serialize
  const serialized = transaction.serialize();
  const base64Tx = Buffer.from(serialized).toString('base64');

  // Package as x402 payment payload
  const paymentPayload = {
    x402Version: 2,
    payload: {
      transaction: base64Tx,
    },
  };

  return Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
}
```

### With Facilitator as Fee Payer (Gas-Free)

When the facilitator provides a fee payer address, the payer only partially signs. The facilitator adds their signature and pays SOL gas fees.

```typescript
import { OpenFacilitator } from '@openfacilitator/sdk';

async function buildGasFreeSolanaPayment(
  privateKey: string,
  recipient: string,
  amount: bigint,
): Promise<string> {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  const recipientPubkey = new PublicKey(recipient);

  // Step 1: Get the facilitator's fee payer address
  const facilitator = new OpenFacilitator();
  const feePayerAddress = await facilitator.getFeePayer('solana');
  // Returns the facilitator's Solana address, or undefined if not supported

  const feePayerPubkey = feePayerAddress
    ? new PublicKey(feePayerAddress)
    : keypair.publicKey; // Fall back to self-pay
  const isFacilitatorFeePayer = feePayerAddress && feePayerAddress !== keypair.publicKey.toBase58();

  // Step 2: Build token accounts and transfer instruction
  const senderATA = await getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
  const recipientATA = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

  const transferIx = createTransferInstruction(
    senderATA,
    recipientATA,
    keypair.publicKey,
    amount,
    [],
    TOKEN_PROGRAM_ID,
  );

  // Step 3: Build transaction with facilitator as fee payer
  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
  );
  transaction.add(transferIx);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = feePayerPubkey; // Facilitator pays gas

  // Step 4: PARTIAL sign — only the payer signs, fee payer slot left empty
  if (isFacilitatorFeePayer) {
    transaction.partialSign(keypair);
  } else {
    transaction.sign(keypair);
  }

  // Step 5: Serialize — allow missing signatures for fee payer slot
  const serialized = transaction.serialize({
    requireAllSignatures: !isFacilitatorFeePayer,
    verifySignatures: false,
  });

  const base64Tx = Buffer.from(serialized).toString('base64');

  const paymentPayload = {
    x402Version: 2,
    payload: {
      transaction: base64Tx,
    },
  };

  return Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
}
```

### How Fee Payer Works

1. Call `facilitator.getFeePayer('solana')` to get the facilitator's Solana address.
2. Set `transaction.feePayer` to the facilitator's address (not the payer's).
3. Use `transaction.partialSign(keypair)` instead of `transaction.sign(keypair)`. This signs the payer's transfer instruction but leaves the fee payer signature slot empty.
4. Serialize with `requireAllSignatures: false` since the fee payer hasn't signed yet.
5. The facilitator deserializes the transaction, adds their fee payer signature, and broadcasts it. The facilitator pays SOL gas; the payer only transfers USDC.

---

## Server-Side Signing Pattern (Custodial/Managed Wallets)

For architectures where the server holds signing keys (Openfort, Privy, Turnkey backend wallets), you can construct, sign, verify, and settle in a single request.

### EVM Server-Side Pattern

```typescript
import { Hono } from 'hono';
import { privateKeyToAccount } from 'viem/accounts';
import { parseUnits, toHex } from 'viem';
import { OpenFacilitator } from '@openfacilitator/sdk';
import type { PaymentRequirementsV1 } from '@openfacilitator/sdk';
import crypto from 'crypto';

const app = new Hono();
const facilitator = new OpenFacilitator();

app.post('/api/pay-for-user', async (c) => {
  const { userId, contentId } = await c.req.json();

  // Look up the user's managed wallet private key
  const userPrivateKey = await vault.getKey(userId); // Openfort / Privy / Turnkey
  const account = privateKeyToAccount(userPrivateKey as `0x${string}`);

  const requirements: PaymentRequirementsV1 = {
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000', // $1 USDC
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xMERCHANT_WALLET',
  };

  // Step 1: Build ERC-3009 authorization
  const authorization = {
    from: account.address,
    to: requirements.payTo!,
    value: requirements.maxAmountRequired,
    validAfter: Math.floor(Date.now() / 1000) - 60,
    validBefore: Math.floor(Date.now() / 1000) + 3600,
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
  };

  // Step 2: Sign with the user's managed key
  const signature = await account.signTypedData({
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: BigInt(8453),
      verifyingContract: requirements.asset as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce as `0x${string}`,
    },
  });

  // Step 3: Package as payment payload
  const paymentPayload = { authorization, signature };

  // Step 4: Verify
  const verifyResult = await facilitator.verify(paymentPayload, requirements);
  if (!verifyResult.isValid) {
    return c.json({ error: verifyResult.invalidReason }, 400);
  }

  // Step 5: Business logic
  await db.purchases.create({ userId, contentId, status: 'pending' });

  // Step 6: Settle
  const settleResult = await facilitator.settle(paymentPayload, requirements);
  if (!settleResult.success) {
    return c.json({ error: settleResult.errorReason }, 500);
  }

  await db.purchases.updateStatus(userId, contentId, 'completed');

  return c.json({
    success: true,
    txHash: settleResult.transaction,
  });
});
```

### Solana Server-Side Pattern

```typescript
app.post('/api/pay-for-user', async (c) => {
  const { userId, contentId } = await c.req.json();

  // Look up the user's managed Solana key
  const userPrivateKey = await vault.getSolanaKey(userId);
  const keypair = Keypair.fromSecretKey(bs58.decode(userPrivateKey));

  const requirements: PaymentRequirementsV1 = {
    scheme: 'exact',
    network: 'solana',
    maxAmountRequired: '1000000',
    asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    payTo: 'MERCHANT_SOLANA_ADDRESS',
  };

  // Step 1: Get fee payer (optional, for gas-free)
  const feePayerAddress = await facilitator.getFeePayer('solana');
  const feePayerPubkey = feePayerAddress
    ? new PublicKey(feePayerAddress)
    : keypair.publicKey;
  const isFacilitatorFeePayer = feePayerAddress !== undefined;

  // Step 2: Build SPL transfer
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const USDC_MINT = new PublicKey(requirements.asset);
  const recipientPubkey = new PublicKey(requirements.payTo!);

  const senderATA = await getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
  const recipientATA = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
  );
  transaction.add(
    createTransferInstruction(
      senderATA, recipientATA, keypair.publicKey,
      BigInt(requirements.maxAmountRequired), [], TOKEN_PROGRAM_ID,
    ),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = feePayerPubkey;

  // Step 3: Sign (partial if facilitator pays gas)
  if (isFacilitatorFeePayer) {
    transaction.partialSign(keypair);
  } else {
    transaction.sign(keypair);
  }

  const serialized = transaction.serialize({
    requireAllSignatures: !isFacilitatorFeePayer,
    verifySignatures: false,
  });

  // Step 4: Package as payment payload
  const paymentPayload = {
    x402Version: 2,
    payload: {
      transaction: Buffer.from(serialized).toString('base64'),
    },
  };

  // Step 5: Verify + settle
  const verifyResult = await facilitator.verify(paymentPayload, requirements);
  if (!verifyResult.isValid) {
    return c.json({ error: verifyResult.invalidReason }, 400);
  }

  await db.purchases.create({ userId, contentId, status: 'pending' });

  const settleResult = await facilitator.settle(paymentPayload, requirements);
  if (!settleResult.success) {
    return c.json({ error: settleResult.errorReason }, 500);
  }

  return c.json({ success: true, txHash: settleResult.transaction });
});
```

---

## Payload Format Summary

### EVM Payment Payload (before base64 encoding)

```json
{
  "authorization": {
    "from": "0xPayerAddress",
    "to": "0xRecipientAddress",
    "value": "1000000",
    "validAfter": 1706745600,
    "validBefore": 1706749200,
    "nonce": "0xabcdef..."
  },
  "signature": "0xEIP712Signature..."
}
```

### Solana Payment Payload (before base64 encoding)

```json
{
  "x402Version": 2,
  "payload": {
    "transaction": "base64EncodedSignedTransaction..."
  }
}
```

### Sending the Payment

Both are base64-encoded and sent as the `X-PAYMENT` HTTP header:

```typescript
const encoded = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

const response = await fetch('https://api.example.com/paid-endpoint', {
  method: 'POST',
  headers: {
    'X-PAYMENT': encoded,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ /* your request body */ }),
});
```
