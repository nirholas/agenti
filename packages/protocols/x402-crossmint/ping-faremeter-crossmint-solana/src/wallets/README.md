# Custom Wallet Adapters

This directory contains custom wallet adapters for use with Faremeter payment handlers.

## Overview

Wallet adapters provide a consistent interface for different wallet implementations to work with Faremeter payment handlers. Each adapter implements the standard wallet interface with `network`, `publicKey`, and `sendTransaction` methods.

## Keypair Wallet

The `keypairWallet.ts` adapter allows you to use a Solana Keypair for signing transactions.

### Usage

```typescript
import { createKeypairWallet } from "./wallets/keypairWallet.js";
import { Keypair } from "@solana/web3.js";
import { createPaymentHandler } from "@faremeter/payment-solana/exact";

// Create keypair from secret key
const keypair = Keypair.fromSecretKey(secretKeyBytes);

// Create wallet adapter
const wallet = await createKeypairWallet("devnet", keypair);

// Use with payment handler
const handler = createPaymentHandler(wallet, mint, connection);
```

### Environment Setup

Set the path to your keypair file in `.env`:

```bash
PAYER_KEYPAIR_PATH=./keypairs/payer.json
```

The keypair file should be a JSON array of 64 numbers (standard Solana keypair format).

### Getting Your Private Key

**From Phantom/Solana CLI:**
```bash
# View your keypair file
cat ~/.config/solana/id.json
```

**From Solana CLI (as base58):**
```bash
solana-keygen pubkey --outfile /dev/null ~/.config/solana/id.json 2>&1 | grep -v "^Wrote"
```

**Generate a new keypair:**
```bash
solana-keygen new --outfile ./keypairs/my-wallet.json
```

### Security Warning

- Never commit private keys to version control
- Keep `.env` in your `.gitignore`
- Use environment variables for production
- Consider using hardware wallets (Ledger) for production

### See Also

- Example usage: `src/examples/useKeypairWallet.ts`
- Alternative: `@faremeter/wallet-crossmint` for custodial wallets
- Alternative: `crossmintExternalDelegatedWallet.ts` for Crossmint smart wallets
- Alternative: `@faremeter/wallet-ledger` for hardware wallets

## Crossmint Delegated Wallet

The `crossmintExternalDelegatedWallet.ts` adapter uses Crossmint's delegated signing flow, giving you cryptographic control over transaction approvals while leveraging Crossmint's smart wallet infrastructure.

### When to Use

**Choose Delegated Wallet when:**
- You want control over signing and need transparency
- You have existing external keypairs to use as signers
- You need cryptographic proof of each approval
- Enterprise/institutional use cases requiring audit trails

**Choose Custodial Wallet (`@faremeter/wallet-crossmint`) when:**
- You want maximum convenience
- You don't need to manage external signing keys
- You trust Crossmint with key management
- Consumer-facing applications

**Choose Keypair Wallet when:**
- Local development and testing
- You need complete control over keys
- Non-production environments only

### Comparison Table

| Feature | Custodial | Delegated | Keypair |
|---------|-----------|-----------|---------|
| **Key Management** | Crossmint | You control external key | You control all keys |
| **Signing** | Automatic via API | Manual approval required | Local signing |
| **Setup Complexity** | Simple | Moderate | Simple |
| **Security Model** | Trust Crossmint | Self-custodial approval | Full self-custody |
| **Transaction Speed** | Fast (~1-2s) | Moderate (~3-5s) | Fast (~1-2s) |
| **Production Ready** | ✅ Yes | ✅ Yes | ❌ No (dev only) |
| **Use Case** | Consumer apps | Enterprise/institutional | Testing |

### How Delegated Signing Works

1. Your app creates a transaction
2. Transaction is submitted to Crossmint API
3. Crossmint returns an approval message
4. You sign the approval with your external private key (client-side)
5. Submit signature back to Crossmint
6. Crossmint executes the transaction on-chain
7. Returns the Solana transaction hash

This flow gives you cryptographic proof of each transaction approval while still benefiting from smart wallet features like gas sponsorship and batching.

### Usage

```typescript
import { createCrossmintDelegatedWallet } from "./wallets/crossmintExternalDelegatedWallet.js";
import { createPaymentHandler } from "@faremeter/payment-solana/exact";

const wallet = await createCrossmintDelegatedWallet({
  smartWalletAddress: process.env.CROSSMINT_WALLET!,
  externalPrivateKey: process.env.PAYER_KEYPAIR_PATH!,  // Path to keypair JSON file
  apiKey: process.env.CROSSMINT_API_KEY!,
  environment: "staging",
  polling: {
    maxAttempts: 30,  // Optional: default 30
    delayMs: 1000,    // Optional: default 1000ms
  },
});

// Use with payment handler
const handler = createPaymentHandler(wallet, mint, connection, {
  features: {
    enableSettlementAccounts: true,
  },
  token: {
    allowOwnerOffCurve: true,
  },
});
```

### Environment Setup

Add these variables to your `.env`:

```bash
PAYER_KEYPAIR_PATH=./keypairs/payer.json    # Path to external signer keypair
CROSSMINT_WALLET=ABC123...                  # Smart wallet address
CROSSMINT_API_KEY=cm_api_key_...            # Crossmint API key
CROSSMINT_ENVIRONMENT=staging               # "staging" or "production"
RPC_URL=https://api.devnet.solana.com       # Solana RPC endpoint
```

**Note:** The delegated wallet uses the same `PAYER_KEYPAIR_PATH` as the keypair wallet adapter. The difference is:
- **Keypair wallet**: The keypair holds funds and signs transactions
- **Delegated wallet**: The keypair only approves transactions; funds are in Crossmint smart wallet

### Setting Up Delegated Wallet

You have two options for getting a delegated wallet:

**Option 1: Create a new wallet via API (recommended)**
```bash
# Automatically creates a wallet with only delegated signing (no admin signer)
npm run build
npm run create:wallet
```

This will:
- Read your keypair from `PAYER_KEYPAIR_PATH`
- Create a new Crossmint smart wallet
- Register your keypair as the only signer (no admin signer)
- Output the wallet address to add to your `.env`

**Option 2: Add external signer to existing wallet**
```bash
# If you already have a Crossmint wallet
npm run setup:delegated
```

⚠️ **Warning**: If your existing wallet has an admin signer (API-key), Crossmint will use that by default instead of delegated signing. Use `npm run check:wallet` to verify your wallet configuration.

**Keypair Setup:**

The external signer is a standard Solana keypair used to approve transactions:

```bash
# Option 1: Use existing payer keypair (simplest)
PAYER_KEYPAIR_PATH=./keypairs/payer.json

# Option 2: Create a dedicated signer keypair
solana-keygen new --outfile ./keypairs/crossmint-signer.json
# Then update .env to use this path
```

### Security Considerations

**Private Key Storage:**
- Never commit external private keys to version control
- Store in environment variables only
- Keep `.env` in your `.gitignore`
- Consider hardware wallets (Ledger/Trezor) for production
- Rotate keys periodically

**API Key Security:**
- Never include API keys in error messages or logs
- Treat API keys as sensitive as private keys
- Use separate keys for staging and production
- Rotate keys if compromised

**Error Messages:**
- The adapter sanitizes errors to avoid exposing sensitive data
- Transaction IDs are safe to log for debugging
- Check Crossmint dashboard for detailed transaction history

### Troubleshooting

**Error: "No pending approval returned"**

This usually means your wallet has an admin signer (API-key) that takes precedence over delegated signers.

Diagnosis:
```bash
npm run check:wallet
```

Solutions:
1. Create a new wallet with only delegated signing:
   ```bash
   npm run create:wallet
   ```
2. Contact Crossmint support to remove the admin signer from your existing wallet
3. Use custodial wallet instead: `npm run start:test`

**Error: "Transaction timeout"**
- Check Crossmint API status at status.crossmint.com
- Verify network connectivity
- Increase `polling.maxAttempts` or `polling.delayMs` if needed
- Look up transaction ID in Crossmint dashboard for status

**Error: "Invalid private key" or "Keypair file not found"**
- Verify the file path in `PAYER_KEYPAIR_PATH` is correct
- Ensure the keypair file exists: `ls -la ./keypairs/payer.json`
- Check file permissions: `chmod 600 ./keypairs/payer.json`
- Verify keypair format: `solana-keygen verify ./keypairs/payer.json`

**Error: "Crossmint API error 401"**
- Verify `CROSSMINT_API_KEY` is correct
- Check that API key is for the correct environment (staging/production)
- Ensure API key has not expired or been revoked

**Transaction succeeds but payment fails:**
- Check wallet has sufficient SOL for fees
- Verify wallet has USDC tokens for payment
- Use `checkWalletSetup()` utility to diagnose
- Check Solana explorer for transaction details

### See Also

- Example usage: `src/examples/useCrossmintDelegatedWallet.ts`
- Reference implementation: `src/sample.ts.disabled`
- Crossmint docs: https://docs.crossmint.com
- Alternative: `@faremeter/wallet-crossmint` for custodial approach
