/**
 * @ag402/solana — Solana USDC PaymentProvider for @ag402/fetch
 *
 * Implements real on-chain USDC transfers via SPL Token Program.
 * Fully aligned with Python ag402_core.payment.solana_adapter.SolanaAdapter.
 *
 * Usage:
 *   import { SolanaPaymentProvider, fromEnv } from "@ag402/solana";
 *   const provider = new SolanaPaymentProvider({ privateKey: process.env.SOLANA_PRIVATE_KEY! });
 *   const apiFetch = createX402Fetch({ wallet, provider });
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createMemoInstruction } from "@solana/spl-memo";
import bs58 from "bs58";
import type { PaymentProvider, X402PaymentChallenge } from "@ag402/fetch";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEVNET_RPC = "https://api.devnet.solana.com";
const MAINNET_RPC_PATTERN = /mainnet/i;
const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
/** Official mainnet USDC mint — pass as `usdcMint` when using a mainnet RPC. */
export const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** USDC has 6 decimal places */
const USDC_DECIMALS = 6;

// ─── Options ─────────────────────────────────────────────────────────────────

export interface SolanaPaymentProviderOptions {
  /** Base58-encoded Solana private key — mirrors Python SOLANA_PRIVATE_KEY env var */
  privateKey: string;
  /** Solana RPC endpoint. Defaults to devnet. */
  rpcUrl?: string;
  /** USDC mint address. Defaults to devnet USDC mint. */
  usdcMint?: string;
  /**
   * Transaction confirmation level.
   * - "confirmed" (default): ~12–16 seconds, 2/3 validator votes. Fine for micropayments.
   * - "finalized": ~48 seconds, no rollback possible. Recommended for >$100 payments.
   */
  confirmationLevel?: "confirmed" | "finalized";
}

// ─── SolanaPaymentProvider ───────────────────────────────────────────────────

export class SolanaPaymentProvider implements PaymentProvider {
  private readonly connection: Connection;
  private readonly keypair: Keypair;
  private readonly usdcMint: PublicKey;
  private readonly confirmationLevel: "confirmed" | "finalized";

  constructor(options: SolanaPaymentProviderOptions) {
    const rpcUrl = options.rpcUrl ?? DEVNET_RPC;
    const mintAddress = options.usdcMint ?? DEVNET_USDC_MINT;
    this.confirmationLevel = options.confirmationLevel ?? "confirmed";

    // Guard: mainnet RPC + devnet mint is almost certainly a misconfiguration.
    // Catches the common "forgot to set usdcMint after changing rpcUrl" mistake.
    if (MAINNET_RPC_PATTERN.test(rpcUrl) && mintAddress === DEVNET_USDC_MINT) {
      throw new Error(
        "Detected mainnet RPC with devnet USDC mint. " +
          "Set usdcMint to the mainnet USDC mint: " +
          `"${MAINNET_USDC_MINT}"`
      );
    }

    // bs58.decode() throws for invalid input — do NOT use Buffer.from(..., "base58")
    // which silently falls back to UTF-8 and produces garbage bytes.
    this.keypair = Keypair.fromSecretKey(bs58.decode(options.privateKey));
    this.connection = new Connection(rpcUrl, this.confirmationLevel);
    this.usdcMint = new PublicKey(mintAddress);
  }

  /**
   * Returns the payer's base58 public key.
   * Guaranteed to not contain CR, LF, or quotes (header injection safety —
   * mirrors @ag402/fetch buildAuthorization protection).
   */
  getAddress(): string {
    const addr = this.keypair.publicKey.toBase58();
    return addr.replace(/[\r\n"]/g, "");
  }

  /**
   * Pay the x402 challenge by broadcasting a real USDC transfer on Solana.
   * Mirrors Python SolanaAdapter.pay() exactly.
   *
   * Steps:
   *   1. Validate chain + token
   *   2. Parse amount string → lamports (× 10^6)
   *   3. Get/create recipient ATA (first — if this fails, no SOL wasted on payer ATA)
   *   4. Get/create payer ATA
   *   5. Build transfer_checked instruction
   *   6. Attach Memo: "Ag402-v1|{requestId}"
   *   7. Fetch blockhash, build tx, sign, send, confirm
   *   8. Check on-chain result — throw if value.err is set
   *   9. Return base58 tx signature
   */
  async pay(challenge: X402PaymentChallenge, requestId: string): Promise<string> {
    // Step 1: Validate — throw immediately, no RPC calls
    if (challenge.chain !== "solana") {
      throw new Error(
        `Unsupported chain: "${challenge.chain}". @ag402/solana only supports "solana".`
      );
    }
    if (challenge.token !== "USDC") {
      throw new Error(
        `Unsupported token: "${challenge.token}". @ag402/solana only supports "USDC".`
      );
    }

    // Step 2: Parse amount → integer lamports (BigInt required by SPL Token)
    const amountFloat = parseFloat(challenge.amount);
    if (!isFinite(amountFloat) || amountFloat <= 0) {
      throw new Error(`Invalid payment amount: "${challenge.amount}"`);
    }
    const lamports = BigInt(Math.round(amountFloat * Math.pow(10, USDC_DECIMALS)));
    // Guard: sub-minimum amounts (< 0.000001 USDC) round down to 0 lamports.
    // A 0-value transfer costs SOL fees but sends no USDC, causing wallet deduction
    // with no value delivered.
    if (lamports === 0n) {
      throw new Error(
        `Payment amount too small: "${challenge.amount}" — minimum is 0.000001 USDC (1 lamport).`
      );
    }

    const recipientPubkey = new PublicKey(challenge.address);
    const payerPubkey = this.keypair.publicKey;

    // Guard: self-payment creates a 0-net-value transfer (ATA → same ATA).
    // It costs SOL fees and deducts from the wallet budget with no service delivered.
    if (recipientPubkey.equals(payerPubkey)) {
      throw new Error("Self-payment not allowed: recipient address matches payer address.");
    }

    // Step 3: Get/create recipient ATA first.
    // If this fails (e.g. insufficient SOL for rent), we haven't yet spent SOL
    // on the payer ATA, minimising wasted fees.
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.keypair,
      this.usdcMint,
      recipientPubkey
    );

    // Step 4: Get/create payer ATA
    const payerAta = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.keypair,
      this.usdcMint,
      payerPubkey
    );

    // Step 5: Build transfer_checked instruction
    const transferIx = createTransferCheckedInstruction(
      payerAta.address,
      this.usdcMint,
      recipientAta.address,
      payerPubkey,
      lamports,
      USDC_DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    );

    // Step 6: Attach Memo — mirrors Python: f"Ag402-v1|{request_id}"
    const memoIx = createMemoInstruction(`Ag402-v1|${requestId}`, [payerPubkey]);

    // Step 7: Fetch blockhash, build tx, sign, send, confirm.
    // recentBlockhash + feePayer MUST be set before sendTransaction.
    // confirmTransaction uses BlockheightBasedTransactionConfirmationStrategy
    // (string-only overload is deprecated in @solana/web3.js v1.98).
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash(this.confirmationLevel);
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payerPubkey;
    tx.add(transferIx, memoIx);

    const signature = await this.connection.sendTransaction(tx, [this.keypair]);
    const result = await this.connection.confirmTransaction(
      { blockhash, lastValidBlockHeight, signature },
      this.confirmationLevel
    );

    // Step 8: Check on-chain result.
    // confirmTransaction resolves even when the transaction failed on-chain.
    // value.err is non-null if the tx was confirmed but failed (e.g. insufficient
    // USDC, program error). Without this check, pay() would return a signature
    // for a failed transfer, causing @ag402/fetch to deduct the wallet without
    // actually sending USDC — direct financial loss to the user.
    if (result?.value.err) {
      throw new Error(
        `Payment transaction confirmed but failed on-chain: ${JSON.stringify(result.value.err)}. ` +
          `Signature: ${signature}`
      );
    }

    // Step 9: Return tx hash
    return signature;
  }
}

// ─── fromEnv ─────────────────────────────────────────────────────────────────

/**
 * Construct SolanaPaymentProvider from environment variables.
 * Mirrors Python config.py: reads SOLANA_PRIVATE_KEY.
 *
 * @throws {Error} if SOLANA_PRIVATE_KEY is not set
 */
export function fromEnv(options?: { rpcUrl?: string; usdcMint?: string; confirmationLevel?: "confirmed" | "finalized" }): SolanaPaymentProvider {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "SOLANA_PRIVATE_KEY environment variable is not set. " +
        "Set it to your base58-encoded Solana private key."
    );
  }
  return new SolanaPaymentProvider({ privateKey, ...options });
}
