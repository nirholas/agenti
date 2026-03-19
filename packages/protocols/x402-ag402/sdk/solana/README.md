# @ag402/solana

Real Solana USDC on-chain payment provider for [`@ag402/fetch`](https://www.npmjs.com/package/@ag402/fetch).

Broadcasts genuine SPL USDC `transfer_checked` transactions. Each payment includes an `Ag402-v1|{requestId}` Memo for server-side idempotency — matching the Python `ag402-core` SDK behavior exactly.

> **Default network: devnet.** See [Mainnet Quickstart](#mainnet-quickstart) to go live.

## Installation

```bash
npm install @ag402/solana @ag402/fetch
```

## Prerequisites: SOL balance

Even when paying in USDC, you need SOL in your wallet for:

| Cost | Amount |
|------|--------|
| Transaction fee | ~0.000005 SOL per payment |
| ATA rent (new recipient) | ~0.002 SOL per new recipient address |

**Recommendation:** Keep at least 0.01 SOL in your wallet. ATA rent is a one-time cost per recipient — subsequent payments to the same address are free.

If your wallet has USDC but runs out of SOL, payments will fail with an "insufficient funds" error from the RPC.

## Usage

```typescript
import { createX402Fetch, InMemoryWallet } from "@ag402/fetch";
import { SolanaPaymentProvider, fromEnv } from "@ag402/solana";

// Recommended for agents: reads SOLANA_PRIVATE_KEY from environment
const provider = fromEnv();

const wallet = new InMemoryWallet(10);  // $10 spend budget
const apiFetch = createX402Fetch({ wallet, provider });

try {
  const res = await apiFetch("https://api.example.com/paid-endpoint");
  console.log("tx:", res.x402.txHash);
} catch (err) {
  // pay() throws on: invalid chain/token, RPC failure, on-chain tx failure
  console.error("Payment failed:", err.message);
}
```

## Mainnet Quickstart

> ⚠️ You must set **both** `rpcUrl` and `usdcMint` for mainnet. Setting only `rpcUrl` while leaving `usdcMint` at the default devnet value will cause all payments to fail.

```typescript
const provider = new SolanaPaymentProvider({
  privateKey: process.env.SOLANA_PRIVATE_KEY!,
  rpcUrl: "https://api.mainnet-beta.solana.com",
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  // mainnet USDC
});
```

Or with environment variables:

```bash
export SOLANA_PRIVATE_KEY="your-base58-private-key"
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
export SOLANA_USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

```typescript
const provider = fromEnv({
  rpcUrl: process.env.SOLANA_RPC_URL,
  usdcMint: process.env.SOLANA_USDC_MINT,
  confirmationLevel: "confirmed",  // optional
});
```

> **`fromEnv()` does not read `SOLANA_RPC_URL` or `SOLANA_USDC_MINT` from the environment automatically** — pass them explicitly in the options as shown above if you need to configure the network or mint.

> **Mainnet + devnet mint mismatch guard:** if `rpcUrl` contains `"mainnet"` and `usdcMint` is the devnet default, the constructor throws immediately with a clear error message.

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `privateKey` | **required** | Base58-encoded Solana private key |
| `rpcUrl` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `usdcMint` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | USDC mint (devnet default) |
| `confirmationLevel` | `"confirmed"` | `"confirmed"` (~12–16s) or `"finalized"` (~48s, no rollback risk) |

**Mainnet USDC mint:** `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

Also exported as a named constant:

```typescript
import { MAINNET_USDC_MINT } from "@ag402/solana";
const provider = new SolanaPaymentProvider({
  privateKey: "...",
  rpcUrl: "https://api.mainnet-beta.solana.com",
  usdcMint: MAINNET_USDC_MINT,
});
```

For payments above $100, consider `confirmationLevel: "finalized"` to eliminate the small fork-rollback risk.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SOLANA_PRIVATE_KEY` | Base58-encoded private key — read by `fromEnv()` |

## How It Works

Each `pay()` call:

1. Validates `chain === "solana"` and `token === "USDC"` — throws immediately otherwise
2. Converts amount string → lamports (`BigInt(Math.round(amount × 10^6))`)
3. Gets/creates recipient Associated Token Account (ATA) — recipient-first to minimise wasted SOL on failure
4. Gets/creates payer ATA
5. Builds `transfer_checked` SPL instruction
6. Attaches Memo instruction: `Ag402-v1|{requestId}`
7. Signs, broadcasts, and awaits confirmation at the configured level
8. Checks on-chain result — throws if the transaction was confirmed but failed (e.g. insufficient USDC balance)
9. Returns the base58 transaction signature as `tx_hash`

Any failure throws an error, triggering `@ag402/fetch`'s automatic wallet rollback.

## License

MIT
