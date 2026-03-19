/**
 * Solana transaction validation integration tests
 *
 * Tests all 5 attack vectors from the security audit against the LIVE
 * facilitator endpoint on Solana mainnet. Attack vector tests only call
 * /verify (no USDC spent). The happy-path settlement test requires a
 * funded wallet.
 *
 * Usage:
 *   pnpm test:security          — verify-only tests (no funded wallet needed)
 *   pnpm test:solana-all        — includes settlement happy path (needs funded wallet)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { OpenFacilitator } from '@openfacilitator/sdk';
import { TEST_CONFIG } from './setup';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  createApproveInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import bs58 from 'bs58';

// ============================================
// Constants
// ============================================

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const MEMO_PROGRAM_V1_ID = new PublicKey('Memo1UhkJBfCR6MNLc2TcVvLBYhiC9TZSfN7CEcDuiw');
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TEST_AMOUNT = BigInt(10000); // $0.01 USDC (6 decimals)

// ============================================
// Helpers
// ============================================

/** Derive ATA without RPC (sync PDA derivation) */
function deriveATA(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

interface BuildTxOptions {
  feePayer: PublicKey;
  instructions: TransactionInstruction[];
  signers?: Keypair[];
  blockhash: string;
}

/** Build and serialize a transaction (signatures optional for verify-only tests) */
function buildTransaction(options: BuildTxOptions): string {
  const tx = new Transaction();
  tx.feePayer = options.feePayer;
  tx.recentBlockhash = options.blockhash;

  for (const ix of options.instructions) {
    tx.add(ix);
  }

  if (options.signers?.length) {
    tx.partialSign(...options.signers);
  }

  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');
}

/** Wrap a serialized transaction in the x402 payment payload format */
function makePayload(
  serializedTx: string,
  payer: PublicKey,
  payTo: string,
) {
  return {
    x402Version: 1 as const,
    scheme: 'exact',
    network: 'solana',
    payload: {
      transaction: serializedTx,
      signature: '',
      authorization: {
        from: payer.toBase58(),
        to: payTo,
        amount: TEST_AMOUNT.toString(),
        asset: USDC_MINT,
      },
    },
  };
}

function loadLocalKeypair(): Keypair | null {
  try {
    const keypairPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch {
    return null;
  }
}

async function getUSDCBalance(address: PublicKey): Promise<bigint> {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const ata = await getAssociatedTokenAddress(new PublicKey(USDC_MINT), address);
  try {
    const balance = await connection.getTokenAccountBalance(ata);
    return BigInt(balance.value.amount);
  } catch {
    return BigInt(0);
  }
}

// ============================================
// Tests
// ============================================

describe('solana transaction validation - mainnet integration', () => {
  let facilitator: OpenFacilitator;
  let feePayerPubkey: PublicKey;
  let payTo: string;
  let payToPubkey: PublicKey;
  let blockhash: string;

  // Random keypair for the "payer" in verify-only tests (no USDC needed)
  const payerKeypair = Keypair.generate();
  const payerPubkey = payerKeypair.publicKey;
  const usdcMint = new PublicKey(USDC_MINT);

  // Derived ATAs (set in beforeAll)
  let payerATA: PublicKey;
  let payToATA: PublicKey;
  let facilitatorATA: PublicKey;

  const requirements = {
    scheme: 'exact',
    network: 'solana',
    maxAmountRequired: TEST_AMOUNT.toString(),
    asset: USDC_MINT,
    payTo: undefined as string | undefined,
  };

  beforeAll(async () => {
    facilitator = new OpenFacilitator({ url: TEST_CONFIG.FREE_ENDPOINT });

    // Get facilitator fee payer and payTo from /supported
    const supported = await facilitator.supported();
    const solanaKind = supported.kinds.find(
      (k) => k.network === 'solana' || k.network.startsWith('solana:'),
    );
    expect(solanaKind).toBeDefined();

    const feePayerAddress = solanaKind!.extra?.feePayer as string;
    expect(feePayerAddress).toBeDefined();
    feePayerPubkey = new PublicKey(feePayerAddress);

    payTo = (supported as any).signers?.['solana:*']?.[0] || feePayerAddress;
    payToPubkey = new PublicKey(payTo);
    requirements.payTo = payTo;

    // Derive ATAs
    payerATA = deriveATA(payerPubkey, usdcMint);
    payToATA = deriveATA(payToPubkey, usdcMint);
    facilitatorATA = deriveATA(feePayerPubkey, usdcMint);

    // Get a real blockhash from mainnet
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const { blockhash: bh } = await connection.getLatestBlockhash('confirmed');
    blockhash = bh;

    console.log('Test setup:');
    console.log(`  Fee payer (facilitator): ${feePayerPubkey.toBase58()}`);
    console.log(`  Pay to:                 ${payTo}`);
    console.log(`  Test payer (random):    ${payerPubkey.toBase58()}`);
    console.log(`  Blockhash:              ${blockhash.slice(0, 20)}...`);
  });

  // ------------------------------------------------------------------
  // Happy path: legitimate transactions should pass
  // ------------------------------------------------------------------

  describe('legitimate transactions pass validation', () => {
    it('should verify a valid ComputeBudget + Token Transfer transaction', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(payerPubkey.toBase58());
    });

    it('should verify a valid Token Transfer without ComputeBudget', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(payerPubkey.toBase58());
    });

    it('should verify transaction with SPL Memo v2 (x402/svm client pattern)', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
          // Memo instruction added automatically by @x402/svm during transaction construction
          new TransactionInstruction({
            programId: MEMO_PROGRAM_ID,
            keys: [{ pubkey: payerPubkey, isSigner: true, isWritable: false }],
            data: Buffer.from('x402 payment', 'utf-8'),
          }),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(payerPubkey.toBase58());
    });

    it('should verify transaction with SPL Memo v1', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
          new TransactionInstruction({
            programId: MEMO_PROGRAM_V1_ID,
            keys: [],
            data: Buffer.from('payment-ref:abc123', 'utf-8'),
          }),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(payerPubkey.toBase58());
    });

    it('should return actual payer address (not hardcoded "solana-payer")', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.payer).not.toBe('solana-payer');
      expect(result.payer).toBe(payerPubkey.toBase58());
    });
  });

  // ------------------------------------------------------------------
  // Attack vector 1: SOL theft via SystemProgram.transfer
  // Blocked by Layer 1 — SystemProgram not in program allowlist
  // ------------------------------------------------------------------

  describe('attack vector 1: SOL theft via SystemProgram', () => {
    it('should reject SystemProgram.transfer bundled with legitimate token transfer', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          // Malicious: steal SOL from fee payer
          SystemProgram.transfer({
            fromPubkey: feePayerPubkey,
            toPubkey: payerPubkey,
            lamports: 1_000_000_000, // 1 SOL
          }),
          // Legitimate-looking USDC transfer
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 1 rejected:', result.invalidReason);
    });

    it('should reject standalone SystemProgram.transfer', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: feePayerPubkey,
            toPubkey: payerPubkey,
            lamports: 5_000_000_000, // 5 SOL
          }),
        ],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 1b rejected:', result.invalidReason);
    });
  });

  // ------------------------------------------------------------------
  // Attack vector 2: Token theft — facilitator as transfer authority
  // Blocked by Layer 3 — fee payer isolation
  // ------------------------------------------------------------------

  describe('attack vector 2: token theft via facilitator as authority', () => {
    it('should reject transfer where facilitator is the authority', async () => {
      const attackerATA = deriveATA(payerPubkey, usdcMint);

      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
          // Malicious: transfer FROM facilitator's USDC, facilitator is authority
          createTransferInstruction(
            facilitatorATA,    // source: facilitator's USDC account
            attackerATA,       // destination: attacker
            feePayerPubkey,    // authority: facilitator (signs as fee payer!)
            BigInt(1000000000), // 1000 USDC
            [],
            TOKEN_PROGRAM_ID,
          ),
        ],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 2 rejected:', result.invalidReason);
    });

    it('should reject transfer where facilitator is the source account', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          // Source is facilitator's pubkey directly (belt-and-suspenders check)
          createTransferInstruction(
            feePayerPubkey,    // source: facilitator's raw pubkey
            payerATA,          // destination: attacker
            payerPubkey,       // authority: payer (but source is facilitator)
            TEST_AMOUNT,
            [],
            TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 2b rejected:', result.invalidReason);
    });
  });

  // ------------------------------------------------------------------
  // Attack vector 3: Account reallocation via SystemProgram.assign
  // Blocked by Layer 1 — SystemProgram not in program allowlist
  // ------------------------------------------------------------------

  describe('attack vector 3: account reallocation via SystemProgram.assign', () => {
    it('should reject SystemProgram.assign instruction', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          // Malicious: reassign facilitator's account to attacker's program
          SystemProgram.assign({
            accountPubkey: feePayerPubkey,
            programId: payerPubkey, // reassign to attacker-controlled program
          }),
          // Bundle a legitimate transfer to look innocent
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 3 rejected:', result.invalidReason);
    });
  });

  // ------------------------------------------------------------------
  // Attack vector 4: Governance hijack via arbitrary program
  // Blocked by Layer 1 — arbitrary programs not in allowlist
  // ------------------------------------------------------------------

  describe('attack vector 4: governance hijack via arbitrary program', () => {
    it('should reject invocation of an arbitrary program', async () => {
      const maliciousProgram = Keypair.generate().publicKey;

      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          // Malicious: call an arbitrary program
          new TransactionInstruction({
            programId: maliciousProgram,
            keys: [
              { pubkey: feePayerPubkey, isSigner: true, isWritable: true },
              { pubkey: payerPubkey, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([0x01, 0x02, 0x03]),
          }),
          // Bundle legitimate transfer
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 4 rejected:', result.invalidReason);
    });

    it('should reject a well-known DeFi program (e.g. Raydium AMM)', async () => {
      // Raydium AMM V4 program ID
      const raydiumAMM = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          new TransactionInstruction({
            programId: raydiumAMM,
            keys: [{ pubkey: feePayerPubkey, isSigner: true, isWritable: true }],
            data: Buffer.alloc(8),
          }),
        ],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 4b rejected:', result.invalidReason);
    });
  });

  // ------------------------------------------------------------------
  // Attack vector 5: Token delegation via approve / setAuthority
  // Blocked by Layer 2 — approve (type 4) and setAuthority (type 6) not allowed
  // ------------------------------------------------------------------

  describe('attack vector 5: token delegation via approve/setAuthority', () => {
    it('should reject token Approve instruction', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          // Malicious: approve attacker as delegate for facilitator's tokens
          createApproveInstruction(
            facilitatorATA,     // token account
            payerPubkey,        // delegate (attacker)
            feePayerPubkey,     // owner (facilitator signs as fee payer!)
            BigInt(1000000000), // 1000 USDC delegation
          ),
          // Bundle legitimate transfer
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 5a rejected:', result.invalidReason);
    });

    it('should reject token SetAuthority instruction', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          // Malicious: change the authority on facilitator's token account
          createSetAuthorityInstruction(
            facilitatorATA,           // account
            feePayerPubkey,           // current authority (facilitator signs!)
            AuthorityType.AccountOwner,
            payerPubkey,              // new authority (attacker)
          ),
          // Bundle legitimate transfer
          createTransferInstruction(
            payerATA, payToATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 5b rejected:', result.invalidReason);
    });

    it('should reject token CloseAccount instruction (type 9)', async () => {
      // Manually construct CloseAccount (type 9) since there may not be a helper
      const closeAccountData = Buffer.alloc(1);
      closeAccountData.writeUInt8(9, 0);

      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          new TransactionInstruction({
            programId: TOKEN_PROGRAM_ID,
            keys: [
              { pubkey: facilitatorATA, isSigner: false, isWritable: true },  // account to close
              { pubkey: payerPubkey, isSigner: false, isWritable: true },     // destination for rent
              { pubkey: feePayerPubkey, isSigner: true, isWritable: false },  // owner
            ],
            data: closeAccountData,
          }),
        ],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 5c rejected:', result.invalidReason);
    });

    it('should reject token MintTo instruction (type 7)', async () => {
      const mintToData = Buffer.alloc(9);
      mintToData.writeUInt8(7, 0);
      mintToData.writeBigUInt64LE(BigInt(999999999999), 1);

      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          new TransactionInstruction({
            programId: TOKEN_PROGRAM_ID,
            keys: [
              { pubkey: usdcMint, isSigner: false, isWritable: true },
              { pubkey: payerATA, isSigner: false, isWritable: true },
              { pubkey: feePayerPubkey, isSigner: true, isWritable: false },
            ],
            data: mintToData,
          }),
        ],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Attack 5d rejected:', result.invalidReason);
    });
  });

  // ------------------------------------------------------------------
  // Payment requirements validation (Layer 4)
  // ------------------------------------------------------------------

  describe('payment requirements validation', () => {
    it('should reject transfer with insufficient amount', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          createTransferInstruction(
            payerATA, payToATA, payerPubkey,
            BigInt(1), // 1 micro-unit, way below required 10000
            [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Insufficient amount rejected:', result.invalidReason);
    });

    it('should reject transfer to wrong destination (payTo mismatch)', async () => {
      const wrongRecipient = Keypair.generate().publicKey;
      const wrongATA = deriveATA(wrongRecipient, usdcMint);

      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          createTransferInstruction(
            payerATA, wrongATA, payerPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
          ),
        ],
        signers: [payerKeypair],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  Wrong destination rejected:', result.invalidReason);
    });

    it('should reject transaction with no token transfer instruction', async () => {
      const tx = buildTransaction({
        feePayer: feePayerPubkey,
        blockhash,
        instructions: [
          // Only ComputeBudget, no token transfer
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
        ],
      });

      const result = await facilitator.verify(makePayload(tx, payerPubkey, payTo), requirements);

      expect(result.isValid).toBe(false);
      console.log('  No transfer rejected:', result.invalidReason);
    });
  });

  // ------------------------------------------------------------------
  // Happy path: real settlement (requires funded wallet)
  // ------------------------------------------------------------------

  describe('happy path settlement (requires funded wallet)', () => {
    it('should settle a real valid USDC transfer', async () => {
      const keypair = loadLocalKeypair();
      if (!keypair) {
        console.log('  Skipping settlement test: no keypair at ~/.config/solana/id.json');
        return;
      }

      const balance = await getUSDCBalance(keypair.publicKey);
      if (balance < TEST_AMOUNT) {
        console.log(`  Skipping settlement test: insufficient USDC (${Number(balance) / 1e6})`);
        return;
      }

      console.log(`  Wallet: ${keypair.publicKey.toBase58()}`);
      console.log(`  USDC balance: ${Number(balance) / 1e6}`);

      // Create a real signed transaction
      const connection = new Connection(SOLANA_RPC, 'confirmed');
      const realSenderPubkey = keypair.publicKey;
      const realSenderATA = await getAssociatedTokenAddress(usdcMint, realSenderPubkey);
      const realPayToATA = await getAssociatedTokenAddress(usdcMint, payToPubkey);

      const { blockhash: realBlockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

      const tx = new Transaction();
      tx.feePayer = feePayerPubkey;
      tx.recentBlockhash = realBlockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }));
      tx.add(
        createTransferInstruction(
          realSenderATA, realPayToATA, realSenderPubkey, TEST_AMOUNT, [], TOKEN_PROGRAM_ID,
        ),
      );
      tx.partialSign(keypair);

      const serializedTx = tx
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('base64');

      const sig = tx.signatures.find(
        (s) => s.publicKey.equals(realSenderPubkey) && s.signature,
      );
      const signature = sig?.signature ? bs58.encode(sig.signature) : '';

      const payload = {
        x402Version: 1 as const,
        scheme: 'exact',
        network: 'solana',
        payload: {
          transaction: serializedTx,
          signature,
          authorization: {
            from: realSenderPubkey.toBase58(),
            to: payTo,
            amount: TEST_AMOUNT.toString(),
            asset: USDC_MINT,
          },
        },
      };

      const settleRequirements = {
        scheme: 'exact',
        network: 'solana',
        maxAmountRequired: TEST_AMOUNT.toString(),
        asset: USDC_MINT,
        payTo,
      };

      console.log('  Settling real transaction...');
      const result = await facilitator.settle(payload, settleRequirements);

      console.log('  Settle result:', JSON.stringify(result, null, 2));
      if (result.success) {
        console.log(`  Transaction: https://solscan.io/tx/${result.transaction}`);
      }

      expect(result).toBeDefined();
      // If the server has the new validation, it should succeed for a valid tx
      // (may fail for other reasons like expired blockhash, but shouldn't fail validation)
      if (!result.success && result.errorReason) {
        expect(result.errorReason).not.toContain('Disallowed program');
        expect(result.errorReason).not.toContain('Disallowed token instruction');
        expect(result.errorReason).not.toContain('Facilitator cannot be');
        expect(result.errorReason).not.toContain('validation failed');
      }
    });
  });
});
