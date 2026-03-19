# @prxvt/sdk

**px402** - Private x402 payments using zero-knowledge proofs. Pay privately without revealing your identity or transaction history.

[![npm version](https://badge.fury.io/js/@prxvt%2Fsdk.svg)](https://www.npmjs.com/package/@prxvt/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Full Privacy**: Each payment uses a fresh burner wallet, unlinkable to previous payments
- **x402 Compatible**: Works seamlessly with any x402-enabled API
- **Cross-Chain**: Deposit on one chain, spend on another (Base <-> Polygon)
- **ZK Proofs**: All transactions validated with Groth16 zero-knowledge proofs
- **Note Encryption**: AES-256-GCM encryption for secure note storage

## Installation

```bash
npm install @prxvt/sdk
```

## Quick Start

### 1. Initialize SDK

```typescript
import { PrivacySDK } from '@prxvt/sdk';

const sdk = new PrivacySDK({
  chain: 'base', // or 'polygon'
});
```

### 2. Deposit USDC -> Get Private Note

```typescript
// Deposit 10 USDC -> Get private note
const note = await sdk.deposit(10, '0xYourPrivateKey');

// The note is your private balance - save it securely!
console.log('Note created:', JSON.stringify(note));
```

### 3. Make Private px402 Payments

```typescript
// Load your note
sdk.setNote(note);

// Wrap fetch with privacy
const privateFetch = sdk.wrapFetch(fetch);

// Make px402 payment - COMPLETELY PRIVATE!
const response = await privateFetch('https://api.example.com/x402/endpoint', {
  method: 'POST',
  body: JSON.stringify({ message: 'Hello!' }),
});

// Get updated note (old note is spent, this is the change!)
const updatedNote = sdk.getUpdatedNote();
```

### 4. Encrypt Notes for Storage

```typescript
import { encryptNote, decryptNote } from '@prxvt/sdk';

// Encrypt note with password
const encrypted = await encryptNote(note, 'my-secret-password');
localStorage.setItem('encrypted-note', encrypted);

// Later: decrypt to use
const decrypted = await decryptNote(encrypted, 'my-secret-password');
```

## Complete Example

```typescript
import {
  PrivacySDK,
  encryptNote,
  decryptNote,
  getNoteBalance,
  logger
} from '@prxvt/sdk';

async function main() {
  // Enable debug logging (optional)
  logger.setLevel('debug');

  // 1. Setup SDK
  const sdk = new PrivacySDK({ chain: 'base' });

  // 2. Deposit USDC
  const note = await sdk.deposit(10, '0xYourPrivateKey');
  console.log('Deposited:', getNoteBalance(note), 'USDC');

  // 3. Encrypt and save
  const encrypted = await encryptNote(note, 'password123');
  localStorage.setItem('note', encrypted);

  // 4. Make payments
  sdk.setNote(note);
  const privateFetch = sdk.wrapFetch(fetch);

  const response = await privateFetch('https://api.example.com/x402');
  console.log('Payment successful!');

  // 5. Save updated note
  const updated = sdk.getUpdatedNote();
  const newEncrypted = await encryptNote(updated, 'password123');
  localStorage.setItem('note', newEncrypted);

  console.log('Remaining:', getNoteBalance(updated), 'USDC');
}
```

## API Reference

### PrivacySDK

The main SDK class for privacy payments.

#### Constructor

```typescript
new PrivacySDK(config: PrivacySDKConfig)
```

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chain` | `'base' \| 'polygon'` | `'base'` | Blockchain to use |
| `bundlerUrl` | `string` | prxvt proxy | Custom bundler URL |
| `bundlerApiKey` | `string` | - | Pimlico API key (optional) |
| `rpcUrl` | `string` | public RPC | Custom RPC URL |

#### Methods

##### `deposit(amount: number, privateKey: string): Promise<Note>`

Deposit USDC to create a private note.

```typescript
const note = await sdk.deposit(50, '0xYourPrivateKey');
```

##### `depositFast(amount: number, privateKey: string): Promise<Note>`

Fast deposit using ERC-3009 `transferWithAuthorization` (gasless).

```typescript
const note = await sdk.depositFast(50, '0xYourPrivateKey');
```

##### `makePayment(note: Note, recipient: string, amount: number): Promise<PaymentResult>`

Make a direct payment to a recipient.

```typescript
const result = await sdk.makePayment(note, '0x742d35Cc...', 1.5);
console.log('TX:', result.txHash);
console.log('Change note:', result.note);
```

##### `wrapFetch(fetch: typeof fetch): typeof fetch`

Wrap fetch to automatically handle x402 payments.

```typescript
const privateFetch = sdk.wrapFetch(fetch);
const response = await privateFetch('https://api.example.com/x402');
```

##### `setNote(note: Note): void`

Load a saved note into the SDK.

```typescript
sdk.setNote(savedNote);
```

##### `getUpdatedNote(): Note | undefined`

Get the current note state after payments.

```typescript
const updatedNote = sdk.getUpdatedNote();
```

### Encryption Functions

##### `encryptNote(note: Note, password: string): Promise<string>`

Encrypt a note with AES-256-GCM.

```typescript
const encrypted = await encryptNote(note, 'my-password');
// encrypted is a base64 string safe for storage
```

##### `decryptNote(encrypted: string, password: string): Promise<Note>`

Decrypt an encrypted note.

```typescript
const note = await decryptNote(encrypted, 'my-password');
```

##### `isEncryptedNote(str: string): boolean`

Check if a string is an encrypted note.

```typescript
if (isEncryptedNote(stored)) {
  const note = await decryptNote(stored, password);
}
```

### Helper Functions

##### `getNoteBalance(note: Note): number`

Get balance from a note in USDC.

```typescript
const balance = getNoteBalance(note); // e.g., 10.5
```

##### `hasEnoughBalance(note: Note, amount: number): boolean`

Check if note has sufficient balance.

```typescript
if (!hasEnoughBalance(note, 5)) {
  console.log('Insufficient balance');
}
```

##### `formatUSDCAmount(microUsdc: number): string`

Format micro USDC to display string.

```typescript
formatUSDCAmount(1500000); // "1.50"
```

##### `parseUSDCAmount(usdc: number): number`

Parse USDC to micro USDC.

```typescript
parseUSDCAmount(1.5); // 1500000
```

### Cross-Chain Functions

##### `isCrossChain(depositChain: string, paymentChain: string): boolean`

Check if payment is cross-chain.

```typescript
isCrossChain('base', 'polygon'); // true
isCrossChain('base', 'base');    // false
```

##### `getChainEid(chain: string): number`

Get LayerZero endpoint ID for a chain.

```typescript
getChainEid('base');    // 30184
getChainEid('polygon'); // 30109
```

### Logger

##### `logger.setLevel(level: LogLevel): void`

Configure logging level.

```typescript
import { logger } from '@prxvt/sdk';

logger.setLevel('debug'); // 'none' | 'error' | 'warn' | 'info' | 'debug'
```

### Error Types

```typescript
import {
  PrivacySDKError,
  InsufficientBalanceError,
  InvalidNoteError,
  DecryptionError,
  MerkleProofError,
  ProofGenerationError,
  BundlerError,
  NetworkError,
  PaymentRequiredError,
  TransactionError,
  NullifierSpentError,
} from '@prxvt/sdk';
```

## Types

### Note

```typescript
interface Note {
  version: string;
  commitments: NoteCommitment[];
}

interface NoteCommitment {
  secret: string;      // Random secret (field element)
  nullifier: string;   // Random nullifier (field element)
  amount: number;      // Amount in micro USDC (6 decimals)
  depositChain: string; // Chain where commitment was created
}
```

### PaymentResult

```typescript
interface PaymentResult {
  note: Note;              // Updated note with change
  txHash: string;          // Transaction hash
  nullifierHash: string;   // Nullifier hash (for tracking)
  burnerAddress?: string;  // Burner wallet address
  burnerPrivateKey?: string; // Burner private key (for x402)
}
```

### PrivacySDKConfig

```typescript
interface PrivacySDKConfig {
  chain?: 'base' | 'polygon';
  bundlerUrl?: string;
  bundlerApiKey?: string;
  rpcUrl?: string;
  attestorUrl?: string;
  circuitWasmPath?: string;
  circuitZkeyPath?: string;
}
```

## How It Works

### Privacy Payment Flow

1. **Generate Burner Wallet**: SDK creates ephemeral EOA
2. **ZK Proof Generation**: Proves you have a valid note without revealing it
3. **Withdraw to Burner**: UserOperation withdraws USDC to burner (paymaster sponsors gas!)
4. **Sign x402 Payment**: Burner signs EIP-3009 authorization (no gas needed!)
5. **Make API Call**: Payment is sent to merchant
6. **Create Change Note**: Remaining balance becomes a new note
7. **Discard Burner**: Burner wallet is thrown away

**Result**: Completely private payment, no gas fees, untraceable!

### Cross-Chain Payments

Deposit on Base, pay on Polygon (or vice versa):

```typescript
// Deposit on Base
const sdk = new PrivacySDK({ chain: 'base' });
const note = await sdk.deposit(10, privateKey);

// Pay on Polygon
const polygonSdk = new PrivacySDK({ chain: 'polygon' });
polygonSdk.setNote(note); // Note from Base works on Polygon!
const result = await polygonSdk.makePayment(note, recipient, 1);
```

Cross-chain payments use an attestor service that verifies the nullifier hasn't been spent on the origin chain.

## Browser Usage

For browser environments, load Poseidon hash and snarkjs:

```html
<script src="https://cdn.prxvt.io/poseidon-browser.js"></script>
<script src="https://cdn.jsdelivr.net/npm/snarkjs@0.7.0/build/snarkjs.min.js"></script>
<script type="module">
  import { PrivacySDK } from '@prxvt/sdk';

  const sdk = new PrivacySDK({ chain: 'base' });
  // ... use SDK
</script>
```

## Node.js Usage

For Node.js, install circomlibjs:

```bash
npm install circomlibjs snarkjs
```

```typescript
import { PrivacySDK } from '@prxvt/sdk';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

// Setup global Poseidon (required for Node.js)
const poseidon = await buildPoseidon();
globalThis.window = {
  poseidonHash3: (a, b, c) => Promise.resolve(
    poseidon.F.toString(poseidon([BigInt(a), BigInt(b), BigInt(c)]))
  ),
  poseidonHash2: (a, b) => Promise.resolve(
    poseidon.F.toString(poseidon([BigInt(a), BigInt(b)]))
  ),
  poseidonHash: (a) => Promise.resolve(
    poseidon.F.toString(poseidon([BigInt(a)]))
  ),
  snarkjs,
};

const sdk = new PrivacySDK({ chain: 'base' });
```

## Important Notes

### Note Management

- **Notes are spent after each payment**: You CANNOT reuse the same note
- **Always save the updated note**: After each payment, get and save the new note
- **UTXO model**: Each payment consumes the old commitment and creates a new change commitment

### Privacy Guarantees

- **Unlinkable payments**: Each payment uses a fresh burner wallet
- **No transaction history**: Payments cannot be linked together
- **Zero-knowledge proofs**: Your identity and note are never revealed
- **Cross-chain privacy**: Deposit and withdraw on different chains

### Security

- **Never share your note data**: Notes contain secrets that prove ownership
- **Use note encryption**: Always encrypt notes before storage
- **HTTPS only**: Always use HTTPS for API calls
- **Trusted RPCs**: Use trusted RPC providers

## Supported Chains

| Chain | Network | USDC Contract | LayerZero EID |
|-------|---------|---------------|---------------|
| Base | Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 30184 |
| Polygon | Mainnet | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | 30109 |

## License

MIT

## Links

- **GitHub**: [github.com/prxvt/sdk](https://github.com/prxvt/sdk)
- **npm**: [npmjs.com/package/@prxvt/sdk](https://www.npmjs.com/package/@prxvt/sdk)
- **Issues**: [Report bugs](https://github.com/prxvt/sdk/issues)
