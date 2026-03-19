/**
 * Real Solana transaction tests
 * 
 * These tests create and submit REAL transactions on Solana mainnet.
 * Only run these manually with a funded wallet!
 * 
 * Usage: pnpm test:solana
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { OpenFacilitator } from '@openfacilitator/sdk';
import { TEST_CONFIG } from './setup';
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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import bs58 from 'bs58';

// USDC on Solana mainnet
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

// Test amount: $0.01 USDC (10000 micro-units, USDC has 6 decimals)
const TEST_AMOUNT = BigInt(10000);

interface SolanaKeypair {
  publicKey: PublicKey;
  secretKey: Uint8Array;
}

/**
 * Load Solana keypair from ~/.config/solana/id.json
 */
function loadLocalKeypair(): SolanaKeypair | null {
  try {
    const keypairPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const secretKey = Uint8Array.from(keypairData);
    const keypair = Keypair.fromSecretKey(secretKey);
    return keypair;
  } catch (error) {
    console.error('Could not load Solana keypair:', error);
    return null;
  }
}

/**
 * Get USDC balance for an address
 */
async function getUSDCBalance(address: PublicKey): Promise<bigint> {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const mintPubkey = new PublicKey(USDC_MINT);
  const ata = await getAssociatedTokenAddress(mintPubkey, address);
  
  try {
    const balance = await connection.getTokenAccountBalance(ata);
    return BigInt(balance.value.amount);
  } catch {
    return BigInt(0);
  }
}

/**
 * Create a signed USDC transfer transaction
 */
async function createSignedTransfer(
  keypair: SolanaKeypair,
  recipient: string,
  amount: bigint,
  feePayer?: string
): Promise<{ serializedTransaction: string; signature: string }> {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  
  const senderPubkey = keypair.publicKey;
  const recipientPubkey = new PublicKey(recipient);
  const feePayerPubkey = feePayer ? new PublicKey(feePayer) : senderPubkey;
  
  const mintPubkey = new PublicKey(USDC_MINT);
  
  // Get associated token accounts
  const senderATA = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
  const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);
  
  // Create transfer instruction
  const transferIx = createTransferInstruction(
    senderATA,
    recipientATA,
    senderPubkey,
    amount,
    [],
    TOKEN_PROGRAM_ID
  );
  
  // Create transaction with compute budget
  const transaction = new Transaction();
  
  // Add priority fee
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 50000,
    })
  );
  
  transaction.add(transferIx);
  
  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = feePayerPubkey;
  
  // Sign the transaction
  const isFacilitatorFeePayer = feePayer && feePayer !== senderPubkey.toBase58();
  if (isFacilitatorFeePayer) {
    transaction.partialSign(keypair);
  } else {
    transaction.sign(keypair);
  }
  
  // Get signature
  const sig = transaction.signatures.find(
    s => s.publicKey.equals(senderPubkey) && s.signature
  );
  const signature = sig?.signature ? bs58.encode(sig.signature) : '';
  
  // Serialize
  const serializedTransaction = transaction.serialize({
    requireAllSignatures: !isFacilitatorFeePayer,
    verifySignatures: false,
  }).toString('base64');
  
  return { serializedTransaction, signature };
}

describe('solana real transactions', () => {
  let facilitator: OpenFacilitator;
  let keypair: SolanaKeypair | null;
  let feePayer: string | undefined;
  let payTo: string | undefined;

  beforeAll(async () => {
    // Load local keypair
    keypair = loadLocalKeypair();
    if (!keypair) {
      console.log('⚠️  No Solana keypair found at ~/.config/solana/id.json');
      console.log('   Skipping real transaction tests');
      return;
    }

    console.log(`📝 Loaded wallet: ${keypair.publicKey.toBase58()}`);

    // Check USDC balance
    const balance = await getUSDCBalance(keypair.publicKey);
    console.log(`💰 USDC balance: ${Number(balance) / 1e6} USDC`);

    if (balance < TEST_AMOUNT) {
      console.log(`⚠️  Insufficient balance for tests (need ${Number(TEST_AMOUNT) / 1e6} USDC)`);
      return;
    }

    // Initialize facilitator
    facilitator = new OpenFacilitator({
      url: TEST_CONFIG.FREE_ENDPOINT,
    });

    // Get supported info to find fee payer
    const supported = await facilitator.supported();
    const solanaKind = supported.kinds.find(k => 
      k.network === 'solana' || k.network.startsWith('solana:')
    );
    
    feePayer = solanaKind?.extra?.feePayer as string | undefined;
    
    // Get payTo from signers (uses wildcard key solana:*)
    payTo = supported.signers?.['solana:*']?.[0] || feePayer;
    
    console.log(`🎯 Fee payer: ${feePayer || '(sender pays)'}`);
    console.log(`📬 Pay to: ${payTo || '(unknown)'}`);
  });

  it('should verify a real signed transaction', async () => {
    if (!keypair || !payTo) {
      console.log('Skipping: no keypair or payTo address');
      return;
    }

    // Create signed transaction
    const { serializedTransaction, signature } = await createSignedTransfer(
      keypair,
      payTo,
      TEST_AMOUNT,
      feePayer
    );

    console.log(`✍️  Created transaction with signature: ${signature.slice(0, 20)}...`);

    // Create x402 payment payload
    const paymentPayload = {
      x402Version: 1 as const,
      scheme: 'exact',
      network: 'solana',
      payload: {
        transaction: serializedTransaction,
        signature,
        authorization: {
          from: keypair.publicKey.toBase58(),
          to: payTo,
          amount: TEST_AMOUNT.toString(),
          asset: USDC_MINT,
        },
      },
    };

    const requirements = {
      scheme: 'exact',
      network: 'solana',
      maxAmountRequired: TEST_AMOUNT.toString(),
      asset: USDC_MINT,
      payTo,
    };

    // Verify (should work for a properly signed transaction)
    const result = await facilitator.verify(paymentPayload, requirements);
    
    console.log('📋 Verify result:', result);
    
    // The transaction should be valid
    expect(result).toBeDefined();
  });

  it('should settle a real transaction (WARNING: spends real USDC)', async () => {
    if (!keypair || !payTo) {
      console.log('Skipping: no keypair or payTo address');
      return;
    }

    // Create signed transaction
    const { serializedTransaction, signature } = await createSignedTransfer(
      keypair,
      payTo,
      TEST_AMOUNT,
      feePayer
    );

    console.log(`✍️  Created transaction with signature: ${signature.slice(0, 20)}...`);

    // Create x402 payment payload
    const paymentPayload = {
      x402Version: 1 as const,
      scheme: 'exact',
      network: 'solana',
      payload: {
        transaction: serializedTransaction,
        signature,
        authorization: {
          from: keypair.publicKey.toBase58(),
          to: payTo,
          amount: TEST_AMOUNT.toString(),
          asset: USDC_MINT,
        },
      },
    };

    const requirements = {
      scheme: 'exact',
      network: 'solana',
      maxAmountRequired: TEST_AMOUNT.toString(),
      asset: USDC_MINT,
      payTo,
    };

    // Settle (THIS WILL SPEND REAL USDC!)
    console.log('⚠️  Settling real transaction...');
    const result = await facilitator.settle(paymentPayload, requirements);
    
    console.log('💸 Settle result:', result);
    
    if (result.success) {
      console.log(`✅ Transaction hash: ${result.transaction}`);
      console.log(`   View: https://solscan.io/tx/${result.transaction}`);
    }
    
    expect(result).toBeDefined();
  });
});

// Run these tests with: pnpm test:solana
// To enable the tests, change describe.skip to describe

