/**
 * Trade Ledger - Onchain Hash Anchoring
 *
 * Anchor decision hashes to blockchain for tamper-proof verification.
 * Supports Solana (memo), Polygon, and Base (calldata).
 */

import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export type AnchorChain = 'solana' | 'polygon' | 'base';

export interface AnchorConfig {
  chain: AnchorChain;
  /** Solana RPC URL */
  solanaRpcUrl?: string;
  /** Solana private key (base58 or JSON array) */
  solanaPrivateKey?: string;
  /** EVM RPC URL (Polygon or Base) */
  evmRpcUrl?: string;
  /** EVM private key (hex) */
  evmPrivateKey?: string;
  /** Batch anchors to save gas (anchor every N hashes) */
  batchSize?: number;
  /** Max batch age before forcing anchor (ms) */
  batchMaxAgeMs?: number;
}

export interface AnchorResult {
  success: boolean;
  chain: AnchorChain;
  txHash?: string;
  error?: string;
  timestamp: number;
}

// =============================================================================
// SOLANA ANCHOR
// =============================================================================

async function anchorToSolana(
  hash: string,
  config: AnchorConfig
): Promise<AnchorResult> {
  try {
    const { Connection, Keypair, Transaction, TransactionInstruction, PublicKey } = await import(
      '@solana/web3.js'
    );

    const rpcUrl = config.solanaRpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Load keypair
    const privateKey = config.solanaPrivateKey || process.env.SOLANA_PRIVATE_KEY;
    if (!privateKey) {
      return {
        success: false,
        chain: 'solana',
        error: 'No Solana private key configured',
        timestamp: Date.now(),
      };
    }

    const { loadSolanaKeypair } = await import('../solana/wallet');
    const keypair = loadSolanaKeypair({ privateKey });

    // Memo program ID
    const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

    // Create memo instruction with the hash
    const memoData = `clodds:ledger:${hash}`;
    const memoIx = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoData, 'utf-8'),
    });

    const tx = new Transaction().add(memoIx);
    tx.feePayer = keypair.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(keypair);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    logger.info({ chain: 'solana', hash: hash.slice(0, 16), signature }, 'Anchored hash to Solana');

    return {
      success: true,
      chain: 'solana',
      txHash: signature,
      timestamp: Date.now(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ chain: 'solana', error: message }, 'Failed to anchor to Solana');
    return {
      success: false,
      chain: 'solana',
      error: message,
      timestamp: Date.now(),
    };
  }
}

// =============================================================================
// EVM ANCHOR (Polygon / Base)
// =============================================================================

const EVM_RPC_URLS: Record<string, string> = {
  polygon: 'https://polygon-rpc.com',
  base: 'https://mainnet.base.org',
};

async function anchorToEvm(
  hash: string,
  chain: 'polygon' | 'base',
  config: AnchorConfig
): Promise<AnchorResult> {
  try {
    // Dynamic import to avoid bundling ethers if not needed
    const { ethers } = await import('ethers');

    const rpcUrl = config.evmRpcUrl || process.env[`${chain.toUpperCase()}_RPC_URL`] || EVM_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const privateKey = config.evmPrivateKey || process.env[`${chain.toUpperCase()}_PRIVATE_KEY`] || process.env.EVM_PRIVATE_KEY;
    if (!privateKey) {
      return {
        success: false,
        chain,
        error: `No ${chain} private key configured`,
        timestamp: Date.now(),
      };
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    // Encode hash as calldata (0x prefix + "clodds:ledger:" + hash)
    const data = ethers.hexlify(ethers.toUtf8Bytes(`clodds:ledger:${hash}`));

    // Send minimal transaction to self with hash in data
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0,
      data,
    });

    // Wait for confirmation
    const receipt = await tx.wait();

    logger.info({ chain, hash: hash.slice(0, 16), txHash: receipt?.hash }, `Anchored hash to ${chain}`);

    return {
      success: true,
      chain,
      txHash: receipt?.hash,
      timestamp: Date.now(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ chain, error: message }, `Failed to anchor to ${chain}`);
    return {
      success: false,
      chain,
      error: message,
      timestamp: Date.now(),
    };
  }
}

// =============================================================================
// ANCHOR SERVICE
// =============================================================================

export interface AnchorService {
  anchor(hash: string): Promise<AnchorResult>;
  anchorBatch(hashes: string[]): Promise<AnchorResult>;
  getConfig(): AnchorConfig;
}

/**
 * Create an anchor service for the specified chain
 */
export function createAnchorService(config: AnchorConfig): AnchorService {
  const pendingHashes: string[] = [];
  let batchTimer: NodeJS.Timeout | null = null;

  const flushBatch = async (): Promise<AnchorResult | null> => {
    if (pendingHashes.length === 0) return null;

    const hashes = [...pendingHashes];
    pendingHashes.length = 0;

    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }

    // Combine hashes into a Merkle-like root (simple concatenation for now)
    const combined = hashes.join(',');
    const { createHash } = await import('crypto');
    const batchHash = createHash('sha256').update(combined).digest('hex');

    return anchorHash(batchHash, config);
  };

  return {
    async anchor(hash: string): Promise<AnchorResult> {
      if (config.batchSize && config.batchSize > 1) {
        pendingHashes.push(hash);

        if (pendingHashes.length >= config.batchSize) {
          const result = await flushBatch();
          return result || { success: false, chain: config.chain, error: 'Batch empty', timestamp: Date.now() };
        }

        // Set timer to flush batch after max age
        if (!batchTimer && config.batchMaxAgeMs) {
          batchTimer = setTimeout(flushBatch, config.batchMaxAgeMs);
        }

        return {
          success: true,
          chain: config.chain,
          timestamp: Date.now(),
        };
      }

      return anchorHash(hash, config);
    },

    async anchorBatch(hashes: string[]): Promise<AnchorResult> {
      const combined = hashes.join(',');
      const { createHash } = await import('crypto');
      const batchHash = createHash('sha256').update(combined).digest('hex');

      return anchorHash(batchHash, config);
    },

    getConfig() {
      return config;
    },
  };
}

/**
 * Anchor a single hash to the configured chain
 */
async function anchorHash(hash: string, config: AnchorConfig): Promise<AnchorResult> {
  switch (config.chain) {
    case 'solana':
      return anchorToSolana(hash, config);
    case 'polygon':
    case 'base':
      return anchorToEvm(hash, config.chain, config);
    default:
      return {
        success: false,
        chain: config.chain,
        error: `Unsupported chain: ${config.chain}`,
        timestamp: Date.now(),
      };
  }
}

/**
 * Verify an anchor exists on chain
 */
export async function verifyAnchor(
  txHash: string,
  expectedHash: string,
  chain: AnchorChain
): Promise<{ verified: boolean; error?: string }> {
  try {
    const expectedData = `clodds:ledger:${expectedHash}`;

    if (chain === 'solana') {
      const { Connection } = await import('@solana/web3.js');
      const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      const tx = await connection.getParsedTransaction(txHash, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return { verified: false, error: 'Transaction not found' };
      }

      // Check memo instruction data
      const instructions = tx.transaction.message.instructions;
      for (const ix of instructions) {
        if ('parsed' in ix && ix.parsed?.info?.message === expectedData) {
          return { verified: true };
        }
      }

      return { verified: false, error: 'Hash not found in transaction' };
    } else {
      // EVM chains
      const { ethers } = await import('ethers');
      const rpcUrl = EVM_RPC_URLS[chain];
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const tx = await provider.getTransaction(txHash);
      if (!tx) {
        return { verified: false, error: 'Transaction not found' };
      }

      const data = ethers.toUtf8String(tx.data);
      if (data === expectedData) {
        return { verified: true };
      }

      return { verified: false, error: 'Hash mismatch in transaction data' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { verified: false, error: message };
  }
}
