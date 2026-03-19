/**
 * Solana transaction instruction validation
 *
 * Security module that validates Solana transaction instructions before
 * the facilitator co-signs as fee payer. Prevents attack vectors where
 * malicious instructions are bundled alongside legitimate USDC transfers.
 *
 * Four validation layers:
 * 1. Program ID allowlist — only SPL Token, Token-2022, ATA, ComputeBudget
 * 2. Token instruction type allowlist — only Transfer (3) and TransferChecked (12)
 * 3. Fee payer isolation — facilitator must not be source/authority in token ops
 * 4. Payment requirements — amount, mint, and destination verification
 */
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';

// ============================================
// Types
// ============================================

export interface SolanaValidationResult {
  valid: boolean;
  error?: string;
  /** Extracted payer address (authority of the transfer instruction) */
  payer?: string;
}

export interface SolanaPaymentRequirements {
  /** Required amount in base units (e.g., "10000" for $0.01 USDC) */
  amount: string;
  /** Expected token mint address (e.g., USDC mint) */
  asset: string;
  /** Expected destination wallet address (not ATA) */
  payTo?: string;
}

interface NormalizedInstruction {
  programId: PublicKey;
  accounts: PublicKey[];
  data: Uint8Array;
}

interface TransferInfo {
  instructionType: number;
  amount: bigint;
  source: string;
  destination: PublicKey;
  mint: PublicKey | undefined;
  authority: string;
  tokenProgramId: PublicKey;
}

// ============================================
// Constants
// ============================================

/** SPL Memo program (v1 and v2) — attaches arbitrary text to transactions */
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const MEMO_PROGRAM_V1_ID = 'Memo1UhkJBfCR6MNLc2TcVvLBYhiC9TZSfN7CEcDuiw';

/** Programs allowed in facilitator-signed transactions */
const ALLOWED_PROGRAM_IDS = new Set([
  TOKEN_PROGRAM_ID.toBase58(),
  TOKEN_2022_PROGRAM_ID.toBase58(),
  ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
  ComputeBudgetProgram.programId.toBase58(),
  MEMO_PROGRAM_ID,
  MEMO_PROGRAM_V1_ID,
]);

/** Token programs that require instruction type validation */
const TOKEN_PROGRAM_IDS = new Set([
  TOKEN_PROGRAM_ID.toBase58(),
  TOKEN_2022_PROGRAM_ID.toBase58(),
]);

/** Allowed SPL Token instruction types */
const ALLOWED_TOKEN_INSTRUCTION_TYPES = new Set([
  3,  // Transfer
  12, // TransferChecked
]);

// ============================================
// Helpers
// ============================================

/**
 * Deserialize a Solana transaction from base64 or base58 encoding.
 * Tries VersionedTransaction first, then falls back to legacy Transaction.
 */
export function deserializeSolanaTransaction(
  signedTransaction: string,
): Transaction | VersionedTransaction {
  // Try base64 first
  try {
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    try {
      return VersionedTransaction.deserialize(txBuffer);
    } catch {
      return Transaction.from(txBuffer);
    }
  } catch {
    // Fall through to base58
  }

  // Try base58
  try {
    const txBuffer = bs58.decode(signedTransaction);
    try {
      return VersionedTransaction.deserialize(txBuffer);
    } catch {
      return Transaction.from(txBuffer);
    }
  } catch (e) {
    throw new Error(
      `Failed to decode transaction: ${e instanceof Error ? e.message : 'Unknown error'}`,
    );
  }
}

/**
 * Extract normalized instructions from both Transaction types.
 *
 * VersionedTransaction uses compiled instructions with index-based accounts.
 * Legacy Transaction has resolved TransactionInstruction objects.
 */
export function extractInstructions(
  transaction: Transaction | VersionedTransaction,
): NormalizedInstruction[] {
  if (transaction instanceof VersionedTransaction) {
    const message = transaction.message;
    const accountKeys = message.staticAccountKeys;

    // Reject transactions with address lookup tables — can't validate without RPC
    if ('addressTableLookups' in message) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lookups = (message as any).addressTableLookups;
      if (Array.isArray(lookups) && lookups.length > 0) {
        throw new Error(
          'Transactions with address lookup tables are not supported — cannot validate accounts without RPC',
        );
      }
    }

    // Handle MessageV0 (compiledInstructions) vs legacy Message (instructions)
    if ('compiledInstructions' in message) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ixs = (message as any).compiledInstructions as Array<{
        programIdIndex: number;
        accountKeyIndexes: number[];
        data: Uint8Array;
      }>;
      return ixs.map((ix) => ({
        programId: accountKeys[ix.programIdIndex],
        accounts: ix.accountKeyIndexes.map((i: number) => accountKeys[i]),
        data: ix.data,
      }));
    }

    // Legacy message wrapped in VersionedTransaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ixs = (message as any).instructions as Array<{
      programIdIndex: number;
      accounts: number[];
      data: string;
    }>;
    return ixs.map((ix) => ({
      programId: accountKeys[ix.programIdIndex],
      accounts: ix.accounts.map((i: number) => accountKeys[i]),
      data: bs58.decode(ix.data),
    }));
  }

  // Legacy Transaction — instructions are already resolved
  return transaction.instructions.map((ix) => ({
    programId: ix.programId,
    accounts: ix.keys.map((k) => k.pubkey),
    data: ix.data,
  }));
}

/**
 * Derive the Associated Token Account address (no RPC needed).
 */
function deriveATA(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID,
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

/**
 * Read a u64 (little-endian) from a Uint8Array at the given offset.
 */
function readU64LE(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigUint64(0, true);
}

/**
 * Verify that a destination token account matches the expected payTo wallet's ATA.
 */
export function verifyDestinationMatchesPayTo(
  destinationAccount: PublicKey,
  payTo: string,
  mint: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID,
): boolean {
  const payToPubkey = new PublicKey(payTo);
  const expectedATA = deriveATA(payToPubkey, mint, tokenProgramId);
  return destinationAccount.equals(expectedATA);
}

// ============================================
// Main Validation
// ============================================

/**
 * Validate a Solana transaction's instructions before co-signing as fee payer.
 *
 * When called without requirements (settlement defense-in-depth), only layers 1-3 run.
 * When called with requirements (verify phase), all 4 layers run.
 */
export function validateSolanaTransaction(
  transaction: Transaction | VersionedTransaction,
  facilitatorPublicKey: PublicKey,
  requirements?: SolanaPaymentRequirements,
): SolanaValidationResult {
  let instructions: NormalizedInstruction[];
  try {
    instructions = extractInstructions(transaction);
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Failed to extract instructions',
    };
  }

  if (instructions.length === 0) {
    return { valid: false, error: 'Transaction contains no instructions' };
  }

  const facilitatorKey = facilitatorPublicKey.toBase58();
  const transfers: TransferInfo[] = [];

  // Pass 1: Validate layers 1-3 for all instructions
  for (const ix of instructions) {
    const programIdStr = ix.programId.toBase58();

    // ---- Layer 1: Program ID allowlist ----
    if (!ALLOWED_PROGRAM_IDS.has(programIdStr)) {
      return {
        valid: false,
        error: `Disallowed program: ${programIdStr}`,
      };
    }

    // Skip non-token programs (ComputeBudget, ATA) — they passed Layer 1
    if (!TOKEN_PROGRAM_IDS.has(programIdStr)) {
      continue;
    }

    // ---- Layer 2: Token instruction type allowlist ----
    if (ix.data.length === 0) {
      return { valid: false, error: 'Token instruction has empty data' };
    }

    const instructionType = ix.data[0];
    if (!ALLOWED_TOKEN_INSTRUCTION_TYPES.has(instructionType)) {
      return {
        valid: false,
        error: `Disallowed token instruction type: ${instructionType}`,
      };
    }

    // Parse transfer details based on instruction type
    let source: string;
    let authority: string;
    let destination: PublicKey;
    let mint: PublicKey | undefined;

    if (instructionType === 3) {
      // Transfer: [source, destination, authority]
      if (ix.accounts.length < 3) {
        return { valid: false, error: 'Transfer instruction has insufficient accounts' };
      }
      if (ix.data.length < 9) {
        return { valid: false, error: 'Transfer instruction data too short' };
      }
      source = ix.accounts[0].toBase58();
      destination = ix.accounts[1];
      authority = ix.accounts[2].toBase58();
    } else {
      // TransferChecked (12): [source, mint, destination, authority]
      if (ix.accounts.length < 4) {
        return { valid: false, error: 'TransferChecked instruction has insufficient accounts' };
      }
      if (ix.data.length < 10) {
        return { valid: false, error: 'TransferChecked instruction data too short' };
      }
      source = ix.accounts[0].toBase58();
      mint = ix.accounts[1];
      destination = ix.accounts[2];
      authority = ix.accounts[3].toBase58();
    }

    // ---- Layer 3: Fee payer isolation ----
    if (source === facilitatorKey) {
      return { valid: false, error: 'Facilitator cannot be source of token transfer' };
    }
    if (authority === facilitatorKey) {
      return { valid: false, error: 'Facilitator cannot be authority of token transfer' };
    }

    transfers.push({
      instructionType,
      amount: readU64LE(ix.data, 1),
      source,
      destination,
      mint,
      authority,
      tokenProgramId: ix.programId,
    });
  }

  // Pass 2: Layer 4 — Payment requirements verification
  if (requirements) {
    if (transfers.length === 0) {
      return {
        valid: false,
        error: 'Transaction does not contain a token transfer instruction',
      };
    }

    const requiredAmount = BigInt(requirements.amount);

    // Find a transfer that meets all requirements
    let matchingTransfer: TransferInfo | undefined;
    const errors: string[] = [];

    for (const t of transfers) {
      // Check amount
      if (t.amount < requiredAmount) {
        errors.push(`amount ${t.amount} < required ${requiredAmount}`);
        continue;
      }

      // Check mint for TransferChecked
      if (t.instructionType === 12 && t.mint) {
        if (t.mint.toBase58() !== requirements.asset) {
          errors.push(`mint ${t.mint.toBase58()} != expected ${requirements.asset}`);
          continue;
        }
      }

      // Check destination matches payTo ATA
      if (requirements.payTo) {
        const expectedMint = t.mint ?? new PublicKey(requirements.asset);
        if (!verifyDestinationMatchesPayTo(t.destination, requirements.payTo, expectedMint, t.tokenProgramId)) {
          errors.push('destination does not match expected payTo ATA');
          continue;
        }
      }

      matchingTransfer = t;
      break;
    }

    if (!matchingTransfer) {
      return {
        valid: false,
        error: `No transfer meets payment requirements: ${errors.join('; ')}`,
      };
    }

    return {
      valid: true,
      payer: matchingTransfer.authority,
    };
  }

  // No requirements — just return validation success with payer if found
  return {
    valid: true,
    payer: transfers.length > 0 ? transfers[0].authority : undefined,
  };
}
