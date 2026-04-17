---
name: tokenized-agents
description: >
  Use when the user wants to charge users for actions. Use @agenti/sdk together
  with @pump-fun/agent-payments-sdk to build Solana payment transactions, verify
  on-chain invoice payments, or integrate Solana wallet adapters for agent
  payment flows.
metadata:
  author: pump-fun
  version: "1.1"
---

## Before Starting Work

**MANDATORY — Do NOT write or modify any code until every item below is answered by the user:**

- [ ] Agent token mint address (from pump.fun)
- [ ] Payment currency decided (USDC or SOL)
- [ ] Price/amount confirmed (in smallest unit)
- [ ] RPC URL provided or a fallback agreed upon
- [ ] Framework confirmed (Next.js, Express, other)

You MUST ask the user for ALL unchecked items in your very first response. Do not assume defaults. Do not proceed until the user has explicitly answered each one.

## Safety Rules

- **NEVER** log, print, or return private keys or secret key material.
- **NEVER** sign transactions on behalf of a user — you build the instruction, the user signs.
- Always validate that `amount > 0` before creating an invoice.
- Always ensure `endTime > startTime` and both are valid Unix timestamps.
- Use the correct decimal precision for the currency (6 decimals for USDC, 9 for SOL).
- **Always verify payments on the server** using `validateInvoicePayment` before delivering any service. Never trust the client alone — clients can be spoofed.
- **Always verify your code against this skill before finalizing.** Before delivering generated code, re-read the relevant sections of this document and confirm:
  - Parameter types match the documented signatures — `buildAcceptPaymentInstructions` accepts `number` for numeric fields, `validateInvoicePayment` accepts `number`, and `getInvoiceIdPDA` accepts `number`.
  - Parameter ordering and names match exactly.
  - Default values (e.g. `computeUnitLimit` defaults to `100_000`) are not contradicted.
  - Import paths use `@pump-fun/agent-payments-sdk`, not internal module paths.

## Supported Currencies

| Currency    | Decimals | Smallest unit example |
| ----------- | -------- | --------------------- |
| USDC        | 6        | `1000000` = 1 USDC    |
| Wrapped SOL | 9        | `1000000000` = 1 SOL  |

## Environment Variables

Create a `.env` (or `.env.local` for Next.js) file with the following:

```env
# Solana RPC — server-side (used to build transactions and verify payments)
SOLANA_RPC_URL=https://rpc.solanatracker.io/public

# Solana RPC — client-side (used by wallet adapter in the browser)
NEXT_PUBLIC_SOLANA_RPC_URL=https://rpc.solanatracker.io/public

# The token mint address of your tokenized agent on pump.fun
AGENT_TOKEN_MINT_ADDRESS=<your-agent-mint-address>

# Payment currency mint
# USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
# SOL (wrapped): So11111111111111111111111111111111111111112
CURRENCY_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

**RPC for mainnet-beta:** The default Solana public RPC (`https://api.mainnet-beta.solana.com`) does **not** support sending transactions. You MUST ask the user which RPC endpoint to use. Present these free mainnet-beta options if the user does not have their own:

- **Solana Tracker** — `https://rpc.solanatracker.io/public`
- **Ankr** — `https://rpc.ankr.com/solana`

Do NOT silently pick one — wait for the user to confirm before proceeding.

Read these values from `process.env` at runtime. Never hard-code mint addresses or RPC URLs.

## Install

```bash
npm install @agenti/sdk @pump-fun/agent-payments-sdk@3.0.2 @solana/web3.js@^1.98.0
```

### Dependency Compatibility — IMPORTANT

`@pump-fun/agent-payments-sdk` depends on `@solana/web3.js` and `@solana/spl-token`. When the app also installs these packages directly, mismatched versions can cause runtime errors.

**Rules:**

1. Before installing `@solana/web3.js`, `@solana/spl-token`, or any `@solana/wallet-adapter-*` package, first check what versions `@pump-fun/agent-payments-sdk` declares in its own `package.json` (inspect it via `npm info @pump-fun/agent-payments-sdk dependencies`). Install the same ranges — or ranges that resolve to the same major.minor — so npm/pnpm hoists a single copy instead of two.
2. Never blindly install "latest" for these shared packages. Always prefer the version that is most compatible with the latest `@pump-fun/agent-payments-sdk`.
3. If the project already has these packages at different versions, align them to match the SDK and re-install.

## SDK Setup

`PumpAgent` is the main class. It can build payment instructions and verify invoices.

```typescript
import { PumpAgent } from "@pump-fun/agent-payments-sdk";
import { PublicKey } from "@solana/web3.js";

const agentMint = new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS!);
```

### Constructor

```typescript
new PumpAgent(mint: PublicKey, environment?: "mainnet" | "devnet", connection?: Connection)
```

| Parameter     | Type                      | Default     | Description                                                   |
| ------------- | ------------------------- | ----------- | ------------------------------------------------------------- |
| `mint`        | `PublicKey`               | —           | The tokenized agent's token mint address                      |
| `environment` | `"mainnet"` \| `"devnet"` | `"mainnet"` | Network environment                                           |
| `connection`  | `Connection` (optional)   | `undefined` | Solana RPC connection (enables RPC fallback for verification) |

**Without connection** — enough for building instructions and HTTP-based payment verification:

```typescript
const agent = new PumpAgent(agentMint);
```

**With connection** — also enables RPC-based verification fallback and balance queries:

```typescript
import { Connection } from "@solana/web3.js";

const connection = new Connection(process.env.SOLANA_RPC_URL!);
const agent = new PumpAgent(agentMint, "mainnet", connection);
```

## Wallet Integration (Frontend)

Install `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, and `@solana/wallet-adapter-wallets`. Use `useWallet()` for `publicKey` and `signTransaction`, and `useConnection()` for the active RPC connection. See [wallet-integration.md](./wallet-integration.md) for the full WalletProvider setup, layout wrapping, and hook usage.

## Building Payment Instructions

Use `buildAcceptPaymentInstructions` to get all the instructions needed for a payment. This is the recommended method — it automatically derives the user's token account and handles native SOL wrapping/unwrapping.

### Parameters (`BuildAcceptPaymentParams`)

| Parameter          | Type                         | Description                                                                                          |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `user`             | `PublicKey`                  | The payer's wallet address                                                                           |
| `currencyMint`     | `PublicKey`                  | Mint address of the payment currency (USDC, wSOL)                                                    |
| `amount`           | `bigint \| number \| string` | Price in the currency's smallest unit                                                                |
| `memo`             | `bigint \| number \| string` | Unique invoice identifier (random number)                                                            |
| `startTime`        | `bigint \| number \| string` | Unix timestamp — when the invoice becomes valid                                                      |
| `endTime`          | `bigint \| number \| string` | Unix timestamp — when the invoice expires                                                            |
| `tokenProgram`     | `PublicKey` (optional)       | Token program for the currency (defaults to SPL Token)                                               |
| `computeUnitLimit` | `number` (optional)          | Compute unit budget (default `100_000`). Increase if transactions fail with compute exceeded.        |
| `computeUnitPrice` | `number` (optional)          | Priority fee in microlamports per CU. If provided, a `SetComputeUnitPrice` instruction is prepended. |

### Example

```typescript
const ixs = await agent.buildAcceptPaymentInstructions({
  user: userPublicKey,
  currencyMint,
  amount: "1000000", // 1 USDC
  memo: "123456789", // unique invoice identifier
  startTime: "1700000000", // valid from
  endTime: "1700086400", // expires at
});
```

### What It Returns

The returned `TransactionInstruction[]` always starts with compute budget instructions, followed by the payment instructions:

- **`SetComputeUnitLimit`** is always prepended (default `100_000` CU). Override via `computeUnitLimit` if your transactions fail with "compute exceeded".
- **`SetComputeUnitPrice`** is prepended only when `computeUnitPrice` is provided. Use this to set a priority fee for faster landing during congestion.

After the compute budget prefix:

- **For SPL tokens (USDC):** The accept-payment instruction.
- **For native SOL:** Instructions that handle wrapping/unwrapping automatically:
  1. Create the user's wrapped SOL token account (idempotent)
  2. Transfer SOL lamports into that token account
  3. Sync the native balance
  4. The accept-payment instruction
  5. Close the wrapped SOL account (returns rent back to user)

You do not need to handle SOL wrapping or compute budget yourself — `buildAcceptPaymentInstructions` does it for you.

### Important

- The `amount`, `memo`, `startTime`, and `endTime` must exactly match when verifying later.
- Each unique combination of `(mint, currencyMint, amount, memo, startTime, endTime)` can only be paid once — the on-chain Invoice ID PDA prevents duplicate payments.
- Generate a unique `memo` for each invoice (e.g. `Math.floor(Math.random() * 900000000000) + 100000`).

## Deriving the Invoice ID

The Invoice ID is a PDA (`PublicKey`) that uniquely identifies an invoice on-chain. It is derived deterministically from the six invoice parameters.

### Import

```typescript
import { getInvoiceIdPDA } from "@pump-fun/agent-payments-sdk";
import { PublicKey } from "@solana/web3.js";
```

### Usage

`getInvoiceIdPDA` returns `[PublicKey, number]`. The first element is the Invoice ID; the second is the PDA bump seed.

```typescript
const tokenMint = new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS!);
const currencyMint = new PublicKey(process.env.CURRENCY_MINT!);

const amount = 1000000;
const memo = 123456789;
const startTime = 1700000000;
const endTime = 1700086400;

const [invoiceId] = getInvoiceIdPDA(
  tokenMint,
  currencyMint,
  amount,
  memo,
  startTime,
  endTime,
);

console.log("Invoice ID:", invoiceId.toBase58());
```

All numeric parameters (`amount`, `memo`, `startTime`, `endTime`) are plain `number` values. BN conversion is handled internally.

## Full Transaction Flow — Server to Client

### Step 1: Generate Invoice Parameters (Server)

```typescript
function generateInvoiceParams() {
  const memo = Math.floor(Math.random() * 900000000000) + 100000;
  const now = Math.floor(Date.now() / 1000);
  const startTime = now;
  const endTime = now + 86400; // valid for 24 hours
  const amount = Number(process.env.PRICE_AMOUNT) || 1000000; // e.g. 1 USDC

  return { amount, memo, startTime, endTime };
}
```

### Step 2: Build Transaction and Serialize as Base64 (Server)

```typescript
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { PumpAgent } from "@pump-fun/agent-payments-sdk";

async function buildPaymentTransaction(params: {
  userWallet: string;
  amount: string;
  memo: string;
  startTime: string;
  endTime: string;
}) {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const agentMint = new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS!);
  const currencyMint = new PublicKey(process.env.CURRENCY_MINT!);

  const agent = new PumpAgent(agentMint, "mainnet", connection);
  const userPublicKey = new PublicKey(params.userWallet);

  const instructions = await agent.buildAcceptPaymentInstructions({
    user: userPublicKey,
    currencyMint,
    amount: params.amount,
    memo: params.memo,
    startTime: params.startTime,
    endTime: params.endTime,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = userPublicKey;
  tx.add(...instructions);

  const serializedTx = tx
    .serialize({ requireAllSignatures: false })
    .toString("base64");

  return { transaction: serializedTx };
}
```

### Step 3: Deserialize, Sign, and Send (Client)

```typescript
import { Connection, Transaction } from "@solana/web3.js";

async function signAndSendPayment(
  txBase64: string,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  connection: Connection,
): Promise<string> {
  if (!signTransaction) {
    throw new Error("Wallet does not support signing");
  }

  const tx = Transaction.from(Buffer.from(txBase64, "base64"));
  const signedTx = await signTransaction(tx);

  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    { signature, ...latestBlockhash },
    "confirmed",
  );

  return signature;
}
```

## Verify Payment

Use `validateInvoicePayment` to confirm that a specific invoice was paid on-chain.

### Parameters

| Parameter      | Type        | Description                         |
| -------------- | ----------- | ----------------------------------- |
| `user`         | `PublicKey` | The wallet that paid                |
| `currencyMint` | `PublicKey` | Currency used for payment           |
| `amount`       | `number`    | Amount paid (smallest unit)         |
| `memo`         | `number`    | The invoice memo                    |
| `startTime`    | `number`    | Invoice start time (Unix timestamp) |
| `endTime`      | `number`    | Invoice end time (Unix timestamp)   |

> **Type note:** `validateInvoicePayment` expects `amount`, `memo`, `startTime`,
> and `endTime` as `number`, not strings. If you stored them as strings,
> parse them first: `Number(memo)`.

```typescript
import { PumpAgent } from "@pump-fun/agent-payments-sdk";
import { PublicKey } from "@solana/web3.js";

const agentMint = new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS!);
const agent = new PumpAgent(agentMint);

const paid = await agent.validateInvoicePayment({
  user: new PublicKey(userWalletAddress),
  currencyMint: new PublicKey(process.env.CURRENCY_MINT!),
  amount: 1000000,
  memo: 123456789,
  startTime: 1700000000,
  endTime: 1700086400,
});

if (paid) {
  // Payment confirmed — deliver the service
} else {
  // Payment not found
}
```

### Verification with Retries

```typescript
async function verifyPayment(params: {
  user: string;
  currencyMint: string;
  amount: number;
  memo: number;
  startTime: number;
  endTime: number;
}): Promise<boolean> {
  const agentMint = new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS!);
  const agent = new PumpAgent(agentMint);

  const invoiceParams = {
    user: new PublicKey(params.user),
    currencyMint: new PublicKey(params.currencyMint),
    amount: params.amount,
    memo: params.memo,
    startTime: params.startTime,
    endTime: params.endTime,
  };

  for (let attempt = 0; attempt < 10; attempt++) {
    const verified = await agent.validateInvoicePayment(invoiceParams);
    if (verified) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }

  return false;
}
```

## End-to-End Flow

```
1. Agent decides on price → generates unique memo(number) → sets time window
2. Server: buildAcceptPaymentInstructions({...}) → returns TransactionInstruction[]
3. Server: builds full Transaction (blockhash + feePayer + instructions) → serializes as base64
4. Client: deserializes base64 → Transaction.from(Buffer.from(txBase64, "base64"))
5. Client: signTransaction(tx) — wallet prompts user to approve
6. Client: connection.sendRawTransaction(signedTx.serialize()) → connection.confirmTransaction(signature)
7. Server: with the exactly same parameters used for buildAcceptPaymentInstructions server validateInvoicePayment({...}) → returns true/false (ALWAYS verify server-side)
8. Agent delivers the service (or asks user to retry)
```

## Scenario Tests & Troubleshooting

See [scenarios.md](./scenarios.md) for detailed test scenarios (happy path, duplicate rejection, expired invoices, etc.) and a troubleshooting table for common errors. For wallet integration, see [wallet-integration.md](./wallet-integration.md).
