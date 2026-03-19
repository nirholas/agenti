# Schemas Reference

## Amount Format

**All amounts are in smallest units (atomic units).**

- USDC (6 decimals): `1000000` = $1.00, `500000` = $0.50, `100` = $0.0001
- WETH (18 decimals): `1000000000000000000` = 1 ETH
- SOL (9 decimals): `1000000000` = 1 SOL
- STX (6 decimals): `1000000` = 1 STX
- sBTC (8 decimals): `100000000` = 1 sBTC

Never use decimal strings like `"1.00"`. Always use integer strings like `"1000000"`.

---

## Payment Requirements

Requirements define what payment the server expects. There are two versions:

### V1 Requirements (recommended for most use cases)

```typescript
interface PaymentRequirementsV1 {
  scheme: string;               // "exact"
  network: string;              // v1 short name: "base", "solana", "stacks"
  maxAmountRequired: string;    // Amount in smallest units
  asset: string;                // Token contract address or mint
  payTo?: string;               // Recipient wallet address
  description?: string;         // Human-readable description
  mimeType?: string;            // Response MIME type
  maxTimeoutSeconds?: number;   // Payment validity window
  resource?: string;            // Resource URL
  outputSchema?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}
```

### V2 Requirements

```typescript
interface PaymentRequirementsV2 {
  scheme: string;               // "exact"
  network: string;              // CAIP-2: "eip155:8453"
  amount: string;               // Amount in smallest units (replaces maxAmountRequired)
  asset: string;                // Token contract address or mint
  payTo: string;                // Required in v2
  maxTimeoutSeconds: number;    // Required in v2
  resource?: string;
  description?: string;
  outputSchema?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}
```

### Key Differences

| Field | V1 | V2 |
|-------|----|----|
| Amount field | `maxAmountRequired` | `amount` |
| Network format | Short name (`base`) | CAIP-2 (`eip155:8453`) |
| `payTo` | Optional | Required |
| `maxTimeoutSeconds` | Optional | Required |

The middleware normalizes v1 to v2 in 402 responses automatically.

---

## Payment Payload

The payment payload is what the client sends in the `X-PAYMENT` header (base64-encoded JSON).

### V1 Payload

```typescript
interface PaymentPayloadV1 {
  x402Version: 1;
  scheme: string;              // "exact"
  network: string;             // v1 short name
  payload: {
    signature: string;         // ERC-3009 signature (EVM) or signed tx
    authorization: {
      from: string;            // Payer address
      to: string;              // Recipient address
      value: string;           // Amount in smallest units
      validAfter: number;      // Unix timestamp
      validBefore: number;     // Unix timestamp
      nonce: string;           // bytes32 hex nonce
    };
  };
}
```

### V2 Payload

```typescript
interface PaymentPayloadV2 {
  x402Version: 2;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepted: {
    scheme: string;            // "exact"
    network: string;           // CAIP-2 format
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, unknown>;
  };
  payload: Record<string, unknown>;  // Chain-specific signed data
  extensions?: Record<string, unknown>;
}
```

### Solana Payload

For Solana, the payload contains a pre-signed transaction:

```typescript
{
  payload: {
    transaction: string;       // Base64-encoded signed transaction
  }
}
```

### Stacks Payload

For Stacks, the payload contains a hex-encoded signed transaction:

```typescript
{
  payload: {
    transaction: string;       // Hex-encoded signed transaction
  }
}
```

---

## Response Types

### VerifyResponse

```typescript
interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;      // Present when isValid is false
  payer?: string;              // Payer wallet address
  details?: {
    amount?: string;
    recipient?: string;
    scheme?: string;
  };
}
```

### SettleResponse

```typescript
interface SettleResponse {
  success: boolean;
  transaction: string;         // On-chain tx hash (empty string on failure)
  payer: string;               // Payer address
  network: string;             // Network identifier
  errorReason?: string;        // Present when success is false
}
```

### SupportedResponse

```typescript
interface SupportedResponse {
  kinds: PaymentKind[];
  signers?: Record<string, string[]>;
  extensions?: string[];
}

interface PaymentKind {
  x402Version: 1 | 2;
  scheme: string;
  network: string;
  extra?: {
    feePayer?: string;         // Solana: facilitator pays gas
    [key: string]: unknown;
  };
}
```

---

## PaymentContext (middleware-injected)

```typescript
interface PaymentContext {
  transactionHash: string;     // Confirmed on-chain tx hash
  userWallet: string;          // Payer address
  amount: string;              // Paid amount in smallest units
  asset: string;               // Token address
  network: string;             // Network identifier
}
```

**Access after middleware:**
- Express: `req.paymentContext` or `res.locals.paymentContext`
- Hono: `c.get('paymentContext')`

---

## Supported Networks

### EVM Mainnets

| Chain | v1 ID | CAIP-2 (v2 ID) | Chain ID |
|-------|-------|-----------------|----------|
| Base | `base` | `eip155:8453` | 8453 |
| Ethereum | `ethereum` | `eip155:1` | 1 |
| Polygon | `polygon` | `eip155:137` | 137 |
| Avalanche | `avalanche` | `eip155:43114` | 43114 |
| Sei | `sei` | `eip155:1329` | 1329 |
| IoTeX | `iotex` | `eip155:4689` | 4689 |
| Peaq | `peaq` | `eip155:3338` | 3338 |
| X Layer | `xlayer` | `eip155:196` | 196 |

### Solana

| Chain | v1 ID | CAIP-2 (v2 ID) |
|-------|-------|-----------------|
| Solana Mainnet | `solana` | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |

### Stacks

| Chain | v1 ID | CAIP-2 (v2 ID) |
|-------|-------|-----------------|
| Stacks Mainnet | `stacks` | `stacks:1` |

### Testnets

| Chain | v1 ID | CAIP-2 (v2 ID) | Chain ID |
|-------|-------|-----------------|----------|
| Base Sepolia | `base-sepolia` | `eip155:84532` | 84532 |
| Sepolia | `sepolia` | `eip155:11155111` | 11155111 |
| Polygon Amoy | `polygon-amoy` | `eip155:80002` | 80002 |
| Avalanche Fuji | `avalanche-fuji` | `eip155:43113` | 43113 |
| Sei Testnet | `sei-testnet` | `eip155:1328` | 1328 |
| X Layer Testnet | `xlayer-testnet` | `eip155:195` | 195 |
| Solana Devnet | `solana-devnet` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Stacks Testnet | `stacks-testnet` | `stacks:2147483648` |

---

## Token Addresses

### USDC

| Chain | Address | Decimals |
|-------|---------|----------|
| Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| Solana | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 |
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 6 |
| Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6 |
| Solana Devnet | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | 6 |

### WETH

| Chain | Address | Decimals |
|-------|---------|----------|
| Ethereum | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| Base | `0x4200000000000000000000000000000000000006` | 18 |
| Base Sepolia | `0x4200000000000000000000000000000000000006` | 18 |
| Sepolia | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` | 18 |

### Solana Native

| Token | Address | Decimals |
|-------|---------|----------|
| Wrapped SOL | `So11111111111111111111111111111111111111112` | 9 |

### Stacks Tokens

| Token | Chain | Address | Decimals |
|-------|-------|---------|----------|
| STX | Stacks | `STX` | 6 |
| sBTC | Stacks | `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` | 8 |
| USDCx | Stacks | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` | 6 |
| STX | Stacks Testnet | `STX` | 6 |
| sBTC | Stacks Testnet | `ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token` | 8 |
| USDCx | Stacks Testnet | `ST2Y455NJPETB2SRSD0VDZP3KJE50WNHY0BN3TWY5.usdcx` | 6 |

---

## EVM Signing Scheme

EVM payments use **ERC-3009 `transferWithAuthorization`**. The client signs an EIP-712 typed data message authorizing a token transfer. The facilitator submits the transaction on-chain using the authorization and signature. The payer never pays gas.

## Solana Signing Scheme

Solana payments use **pre-signed transactions**. The client builds and partially signs a SPL token transfer transaction. If the facilitator provides a `feePayer`, the transaction is structured so the facilitator pays SOL gas fees. The facilitator adds its signature and broadcasts.

## Stacks Signing Scheme

Stacks payments use **pre-signed transactions**. Supports both native STX transfers and SIP-010 contract calls. The facilitator broadcasts the fully-signed transaction to the Hiro API.
