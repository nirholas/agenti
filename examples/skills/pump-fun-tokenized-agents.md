---
name: tokenized-agents
description: >
  Use when the user wants to charge users for actions. Use @agenti/sdk to build
  Solana payment transactions, verify on-chain invoice payments, or integrate
  Solana wallet adapters for agent payment flows using the Pump Agent Payments
  on-chain program.
metadata:
  author: agenti
  version: "2.0"
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
- **Always verify payments on the server** using `validatePayment` before delivering any service. Never trust the client alone — clients can be spoofed.
- **Always verify your code against this skill before finalizing.** Before delivering generated code, re-read the relevant sections of this document and confirm:
  - Import paths use `@agenti/sdk`, not any other payments package.
  - `createAgentPaymentInvoice` is used to generate invoice params — never construct them manually.
  - Invoice fields (`amount`, `memo`, `startTime`, `endTime`) are serialized as strings when passed between server calls (BN does not serialize to JSON safely).
  - `validatePayment` accepts string, number, or bigint for numeric fields.

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
npm install @agenti/sdk @solana/web3.js@^1.98.0 @solana/spl-token@^0.4.0
```

## SDK Setup

All payment functions are imported directly from `@agenti/sdk`. There is no class to instantiate.

```typescript
import {
  createAgentPaymentInvoice,
  acceptPayment,
  validatePayment,
  getInvoicePDA,
  USDC_MAINNET,
} from "@agenti/sdk";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

const connection = new Connection(process.env.SOLANA_RPC_URL!);
const agentMint = new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS!);
const currencyMint = new PublicKey(process.env.CURRENCY_MINT!);
```

## Creating an Invoice

`createAgentPaymentInvoice` generates all invoice parameters, including a unique memo and time window. Call this server-side when you want to charge a user.

```typescript
const invoice = createAgentPaymentInvoice({
  agentMint: process.env.AGENT_TOKEN_MINT_ADDRESS!,
  currencyMint: process.env.CURRENCY_MINT,  // optional, defaults to USDC mainnet
  amount: 1_000_000,                         // 1 USDC in minor units
  windowSeconds: 300,                        // invoice valid for 5 minutes (default)
});

// Serialize numeric fields as strings for safe JSON transport
const invoicePayload = {
  agentMint: invoice.agentMint.toBase58(),
  currencyMint: invoice.currencyMint.toBase58(),
  amount: invoice.amount.toString(),
  memo: invoice.memo.toString(),
  startTime: invoice.startTime.toString(),
  endTime: invoice.endTime.toString(),
};
```

## Building Payment Instructions

Use `acceptPayment` to build the transaction instructions. Pass the invoice fields directly.

```typescript
const ixs = await acceptPayment({
  user: userPublicKey,
  agentMint: invoice.agentMint,
  currencyMint: invoice.currencyMint,
  amount: invoice.amount,
  memo: invoice.memo,
  startTime: invoice.startTime,
  endTime: invoice.endTime,
  // Optional:
  // computeUnitLimit: 130_000,   // default
  // computeUnitPrice: 5000,      // priority fee in microlamports
});
```

The returned `TransactionInstruction[]` includes compute budget setup and automatically handles native SOL wrapping/unwrapping when the currency is wrapped SOL.

## Full Transaction Flow — Server to Client

### Step 1: Generate Invoice (Server)

```typescript
// POST /api/invoice
export async function POST(req: Request) {
  const agentMint = new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS!);
  const currencyMint = new PublicKey(process.env.CURRENCY_MINT!);
  const { userWallet } = await req.json();

  const invoice = createAgentPaymentInvoice({
    agentMint,
    currencyMint,
    amount: 1_000_000,  // 1 USDC
  });

  const userPublicKey = new PublicKey(userWallet);
  const ixs = await acceptPayment({
    user: userPublicKey,
    agentMint: invoice.agentMint,
    currencyMint: invoice.currencyMint,
    amount: invoice.amount,
    memo: invoice.memo,
    startTime: invoice.startTime,
    endTime: invoice.endTime,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = userPublicKey;
  tx.add(...ixs);

  return Response.json({
    transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    invoice: {
      agentMint: invoice.agentMint.toBase58(),
      currencyMint: invoice.currencyMint.toBase58(),
      amount: invoice.amount.toString(),
      memo: invoice.memo.toString(),
      startTime: invoice.startTime.toString(),
      endTime: invoice.endTime.toString(),
    },
  });
}
```

### Step 2: Sign and Send (Client)

```typescript
import { Connection, Transaction } from "@solana/web3.js";

async function signAndSendPayment(
  txBase64: string,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  connection: Connection,
): Promise<string> {
  const tx = Transaction.from(Buffer.from(txBase64, "base64"));
  const signedTx = await signTransaction(tx);

  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");

  return signature;
}
```

### Step 3: Verify Payment (Server)

```typescript
// POST /api/verify
export async function POST(req: Request) {
  const { userWallet, invoice } = await req.json();

  const paid = await validatePayment({
    connection,
    agentMint: invoice.agentMint,
    currencyMint: invoice.currencyMint,
    user: userWallet,
    amount: invoice.amount,     // string is fine — validatePayment converts internally
    memo: invoice.memo,
    startTime: invoice.startTime,
    endTime: invoice.endTime,
  });

  if (paid) {
    // deliver the service
    return Response.json({ success: true });
  }

  return Response.json({ success: false, error: "Payment not found" }, { status: 402 });
}
```

## Verify with Retries

```typescript
async function waitForPayment(
  invoice: Record<string, string>,
  userWallet: string,
  maxAttempts = 10,
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const verified = await validatePayment({
      connection,
      agentMint: invoice.agentMint,
      currencyMint: invoice.currencyMint,
      user: userWallet,
      amount: invoice.amount,
      memo: invoice.memo,
      startTime: invoice.startTime,
      endTime: invoice.endTime,
    });
    if (verified) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}
```

## Deriving the Invoice PDA

Use `getInvoicePDA` to derive the PDA that uniquely identifies an invoice on-chain. The PDA account is created when the payment is accepted — its existence is the proof of payment.

```typescript
import { getInvoicePDA } from "@agenti/sdk";

const pda = getInvoicePDA({
  agentMint: invoice.agentMint.toBase58(),
  currencyMint: invoice.currencyMint.toBase58(),
  amount: invoice.amount.toString(),
  memo: invoice.memo.toString(),
  startTime: invoice.startTime.toString(),
  endTime: invoice.endTime.toString(),
});

console.log("Invoice PDA:", pda.toBase58());
```

## End-to-End Flow

```
1. Agent decides on price → server calls createAgentPaymentInvoice({ agentMint, amount })
2. Server: acceptPayment({ user, ...invoice }) → TransactionInstruction[]
3. Server: builds full Transaction (blockhash + feePayer + instructions) → serializes as base64
4. Client: Transaction.from(Buffer.from(txBase64, "base64"))
5. Client: signTransaction(tx) — wallet prompts user to approve
6. Client: connection.sendRawTransaction(signedTx.serialize()) → confirmTransaction(signature)
7. Server: validatePayment({ connection, ...invoice, user }) → true/false  (ALWAYS verify server-side)
8. Agent delivers the service (or asks user to retry)
```

## Wallet Integration (Frontend)

Install `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, and `@solana/wallet-adapter-wallets`. Use `useWallet()` for `publicKey` and `signTransaction`, and `useConnection()` for the active RPC connection. See [wallet-integration.md](./wallet-integration.md) for the full WalletProvider setup, layout wrapping, and hook usage.

## Scenario Tests & Troubleshooting

See [scenarios.md](./scenarios.md) for detailed test scenarios (happy path, duplicate rejection, expired invoices, etc.) and a troubleshooting table for common errors.
