/**
 * MEV Protection Module
 *
 * Protects swaps from MEV attacks (sandwich attacks, front-running, etc.)
 *
 * EVM Protection:
 * - Flashbots Protect for private transactions
 * - MEV Blocker by CoW Protocol
 * - Private RPC endpoints
 *
 * Solana Protection:
 * - Jito bundles for atomic execution
 * - Priority fee optimization
 * - Private mempool submission
 */

import { Wallet, id as keccak256Id } from 'ethers';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { logger } from '../utils/logger';
import type { EvmChain } from '../evm/uniswap';

// =============================================================================
// TYPES
// =============================================================================

export type MevProtectionLevel = 'none' | 'basic' | 'aggressive';

export interface MevProtectionConfig {
  /** Protection level (default: 'basic') */
  level?: MevProtectionLevel;
  /** Maximum acceptable price impact % (default: 3) */
  maxPriceImpact?: number;
  /** Use private transaction pool (default: true) */
  usePrivatePool?: boolean;
  /** Flashbots API key */
  flashbotsApiKey?: string;
  /** Jito tip amount in lamports for Solana (default: 10000) */
  jitoTipLamports?: number;
  /** Custom private RPC endpoints */
  privateRpcEndpoints?: Partial<Record<EvmChain | 'solana', string>>;
}

export interface ProtectedSwapParams {
  chain: EvmChain | 'solana';
  inputToken: string;
  outputToken: string;
  amount: string;
  slippageBps?: number;
  deadline?: number;
}

export interface ProtectedSwapResult {
  success: boolean;
  txHash?: string;
  bundleId?: string;
  inputAmount: string;
  outputAmount?: string;
  priceImpact?: number;
  protectionUsed: string;
  error?: string;
}

export interface FlashbotsBundle {
  signedTransactions: string[];
  targetBlockNumber: number;
  minTimestamp?: number;
  maxTimestamp?: number;
}

export interface JitoBundle {
  /** Base58-encoded signed transactions, tip already injected into last tx */
  transactions: string[];
  tipLamports: number;
  expirySlot?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: Required<MevProtectionConfig> = {
  level: 'basic',
  maxPriceImpact: 3,
  usePrivatePool: true,
  flashbotsApiKey: '',
  jitoTipLamports: 10000,
  privateRpcEndpoints: {},
};

// Flashbots endpoints
const FLASHBOTS_RPC = 'https://rpc.flashbots.net';
const FLASHBOTS_PROTECT_RPC = 'https://protect.flashbots.net';
const FLASHBOTS_RELAY = 'https://relay.flashbots.net';

// MEV Blocker (CoW Protocol)
const MEV_BLOCKER_RPC = 'https://rpc.mevblocker.io';

// Jito endpoints
const JITO_BLOCK_ENGINE = 'https://mainnet.block-engine.jito.wtf';
const JITO_BUNDLES_ENDPOINT = '/api/v1/bundles';

// Private RPCs by chain
const PRIVATE_RPCS: Partial<Record<EvmChain | 'solana', string[]>> = {
  ethereum: [
    FLASHBOTS_PROTECT_RPC,
    MEV_BLOCKER_RPC,
    'https://rpc.builder0x69.io',
  ],
  arbitrum: [
    'https://arb1.arbitrum.io/rpc', // Limited MEV on L2
  ],
  optimism: [
    'https://mainnet.optimism.io', // Sequencer protected
  ],
  base: [
    'https://mainnet.base.org', // Sequencer protected
  ],
  polygon: [
    'https://polygon-rpc.com', // Limited MEV protection
  ],
  solana: [
    JITO_BLOCK_ENGINE,
  ],
};

// =============================================================================
// EVM MEV PROTECTION
// =============================================================================

/**
 * Send transaction via Flashbots Protect
 */
export async function sendFlashbotsProtect(
  signedTx: string,
  _options?: { apiKey?: string }
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const response = await fetch(FLASHBOTS_PROTECT_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendRawTransaction',
        params: [signedTx],
      }),
    });

    const result = await response.json() as { result?: string; error?: { message: string } };

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    logger.info({ txHash: result.result }, 'Transaction sent via Flashbots Protect');
    return { success: true, txHash: result.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Send transaction via MEV Blocker
 */
export async function sendMevBlocker(
  signedTx: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const response = await fetch(MEV_BLOCKER_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendRawTransaction',
        params: [signedTx],
      }),
    });

    const result = await response.json() as { result?: string; error?: { message: string } };

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    logger.info({ txHash: result.result }, 'Transaction sent via MEV Blocker');
    return { success: true, txHash: result.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Submit bundle to Flashbots relay
 */
export async function submitFlashbotsBundle(
  bundle: FlashbotsBundle,
  signingKey: string
): Promise<{ success: boolean; bundleHash?: string; error?: string }> {
  try {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendBundle',
      params: [
        {
          txs: bundle.signedTransactions,
          blockNumber: `0x${bundle.targetBlockNumber.toString(16)}`,
          minTimestamp: bundle.minTimestamp,
          maxTimestamp: bundle.maxTimestamp,
        },
      ],
    });

    // Flashbots requires X-Flashbots-Signature: <address>:<EIP-191 signature of keccak256(body)>
    // See: https://docs.flashbots.net/flashbots-auction/advanced/rpc-endpoint
    const authSigner = new Wallet(signingKey);
    const bodyHash = keccak256Id(body);
    const signedHash = await authSigner.signMessage(bodyHash);
    const signature = `${authSigner.address}:${signedHash}`;

    const response = await fetch(FLASHBOTS_RELAY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flashbots-Signature': signature,
      },
      body,
    });

    const result = await response.json() as { result?: { bundleHash: string }; error?: { message: string } };

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    logger.info({ bundleHash: result.result?.bundleHash }, 'Bundle submitted to Flashbots');
    return { success: true, bundleHash: result.result?.bundleHash };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// =============================================================================
// SOLANA MEV PROTECTION
// =============================================================================

/**
 * Submit bundle to Jito block engine
 */
export async function submitJitoBundle(
  bundle: JitoBundle
): Promise<{ success: boolean; bundleId?: string; error?: string }> {
  try {
    const response = await fetch(`${JITO_BLOCK_ENGINE}${JITO_BUNDLES_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [bundle.transactions],
      }),
    });

    const result = await response.json() as { result?: string; error?: { message: string } };

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    logger.info({ bundleId: result.result }, 'Bundle submitted to Jito');
    return { success: true, bundleId: result.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get Jito tip accounts
 */
export async function getJitoTipAccounts(): Promise<string[]> {
  try {
    const response = await fetch(`${JITO_BLOCK_ENGINE}/api/v1/bundles/tip_accounts`);
    const result = await response.json() as string[];
    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to get Jito tip accounts');
    // Return all 8 known Jito mainnet tip accounts as fallback
    return [
      '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
      'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
      'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
      'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
      'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
      'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
      'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
      '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
    ];
  }
}

/**
 * Create Jito tip instruction as a real Solana SystemProgram.transfer.
 * Must be added to the LAST transaction in a bundle before signing.
 * See: https://docs.jito.wtf/lowlatencytxnsend/
 */
export function createJitoTipInstruction(
  tipAccount: string,
  payerPubkey: string,
  tipLamports: number
) {
  return SystemProgram.transfer({
    fromPubkey: new PublicKey(payerPubkey),
    toPubkey: new PublicKey(tipAccount),
    lamports: tipLamports,
  });
}

// =============================================================================
// PRICE IMPACT PROTECTION
// =============================================================================

/**
 * Check if price impact is acceptable
 */
export function checkPriceImpact(
  expectedOutput: number,
  actualOutput: number,
  maxImpact: number
): { acceptable: boolean; impact: number } {
  if (expectedOutput <= 0) {
    return { acceptable: false, impact: 100 };
  }
  const impact = ((expectedOutput - actualOutput) / expectedOutput) * 100;
  return {
    acceptable: impact <= maxImpact,
    impact,
  };
}

/**
 * Calculate safe slippage based on liquidity
 */
export function calculateSafeSlippage(
  amount: number,
  liquidity: number,
  baseSlippage = 50 // 0.5%
): number {
  // Guard against zero liquidity
  if (liquidity <= 0) return baseSlippage * 5;

  // Increase slippage for larger orders relative to liquidity
  const ratio = amount / liquidity;

  if (ratio < 0.01) return baseSlippage; // < 1% of liquidity
  if (ratio < 0.05) return baseSlippage * 2; // 1-5% of liquidity
  if (ratio < 0.1) return baseSlippage * 3; // 5-10% of liquidity

  return baseSlippage * 5; // > 10% of liquidity
}

// =============================================================================
// UNIFIED MEV PROTECTION SERVICE
// =============================================================================

export interface MevProtectionService {
  /** Get private RPC for chain */
  getPrivateRpc(chain: EvmChain | 'solana'): string | undefined;

  /** Check if protection is available for chain */
  isProtectionAvailable(chain: EvmChain | 'solana'): boolean;

  /** Send protected EVM transaction */
  sendEvmTransaction(
    chain: EvmChain,
    signedTx: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }>;

  /** Create Jito bundle for Solana — injects tip into last transaction */
  createSolanaBundle(
    transactions: Transaction[],
    payerPubkey: string
  ): Promise<JitoBundle>;

  /** Submit Solana bundle */
  submitSolanaBundle(bundle: JitoBundle): Promise<{ success: boolean; bundleId?: string; error?: string }>;

  /** Validate swap parameters */
  validateSwap(params: ProtectedSwapParams): { valid: boolean; warnings: string[] };
}

export function createMevProtectionService(
  config: MevProtectionConfig = {}
): MevProtectionService {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return {
    getPrivateRpc(chain: EvmChain | 'solana'): string | undefined {
      // Check custom endpoints first
      if (cfg.privateRpcEndpoints[chain]) {
        return cfg.privateRpcEndpoints[chain];
      }

      // Use default private RPCs
      const rpcs = PRIVATE_RPCS[chain];
      return rpcs?.[0];
    },

    isProtectionAvailable(chain: EvmChain | 'solana'): boolean {
      // Ethereum has best MEV protection
      if (chain === 'ethereum') return true;

      // Solana has Jito
      if (chain === 'solana') return true;

      // L2s have sequencer protection but limited MEV
      if (['arbitrum', 'optimism', 'base'].includes(chain)) return true;

      return false;
    },

    async sendEvmTransaction(
      chain: EvmChain,
      signedTx: string
    ): Promise<{ success: boolean; txHash?: string; error?: string }> {
      if (cfg.level === 'none' || !cfg.usePrivatePool) {
        // No protection - return empty result, caller should use public RPC
        return { success: false, error: 'Protection disabled' };
      }

      // Use Flashbots Protect for Ethereum mainnet
      if (chain === 'ethereum') {
        // Try Flashbots Protect first
        const flashbotsResult = await sendFlashbotsProtect(signedTx, {
          apiKey: cfg.flashbotsApiKey,
        });

        if (flashbotsResult.success) {
          return flashbotsResult;
        }

        // Fall back to MEV Blocker
        if (cfg.level === 'aggressive') {
          return sendMevBlocker(signedTx);
        }

        return flashbotsResult;
      }

      // For L2s, no special protection needed (sequencer handles it)
      return { success: false, error: `No MEV protection for ${chain}` };
    },

    async createSolanaBundle(
      transactions: Transaction[],
      payerPubkey: string
    ): Promise<JitoBundle> {
      if (transactions.length === 0) {
        return { transactions: [], tipLamports: cfg.jitoTipLamports };
      }
      if (transactions.length > 5) {
        throw new Error('Jito bundles support a maximum of 5 transactions');
      }

      // Get tip account — pick one at random per Jito docs
      const tipAccounts = await getJitoTipAccounts();
      const tipAccount = tipAccounts[Math.floor(Math.random() * tipAccounts.length)];

      // Inject tip into the LAST transaction. Jito requires the tip in the last
      // tx to prevent theft on forks. Do NOT use ALTs for the tip account.
      // See: https://docs.jito.wtf/lowlatencytxnsend/
      const lastTx = transactions[transactions.length - 1];
      lastTx.add(
        createJitoTipInstruction(tipAccount, payerPubkey, cfg.jitoTipLamports)
      );

      // Serialize all transactions (unsigned — caller signs after tip injection).
      // Jito accepts base58-encoded signed transactions.
      const serialized = transactions.map((tx) =>
        tx.serialize({ verifySignatures: false }).toString('base64')
      );

      return {
        transactions: serialized,
        tipLamports: cfg.jitoTipLamports,
      };
    },

    async submitSolanaBundle(
      bundle: JitoBundle
    ): Promise<{ success: boolean; bundleId?: string; error?: string }> {
      if (cfg.level === 'none') {
        return { success: false, error: 'Protection disabled' };
      }

      return submitJitoBundle(bundle);
    },

    validateSwap(params: ProtectedSwapParams): { valid: boolean; warnings: string[] } {
      const warnings: string[] = [];

      // Check slippage
      const slippage = params.slippageBps || 50;
      if (slippage > 300) {
        warnings.push(`High slippage (${slippage / 100}%) - vulnerable to sandwich attacks`);
      }

      // Check deadline
      if (params.deadline) {
        const now = Math.floor(Date.now() / 1000);
        const deadlineSeconds = params.deadline - now;
        if (deadlineSeconds > 1800) {
          warnings.push('Long deadline - consider shorter timeout for MEV protection');
        }
      }

      // Chain-specific warnings
      if (params.chain === 'ethereum' && cfg.level === 'none') {
        warnings.push('Ethereum mainnet without MEV protection - high risk of sandwich attacks');
      }

      return {
        valid: warnings.length === 0 || cfg.level !== 'aggressive',
        warnings,
      };
    },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  FLASHBOTS_RPC,
  FLASHBOTS_PROTECT_RPC,
  FLASHBOTS_RELAY,
  MEV_BLOCKER_RPC,
  JITO_BLOCK_ENGINE,
  PRIVATE_RPCS,
};
