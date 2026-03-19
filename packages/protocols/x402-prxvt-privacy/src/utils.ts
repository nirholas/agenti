// @ts-nocheck
/**
 * Utility functions
 */

import type { ChainConfig, MerkleProof, Note } from './types';
import { createPublicClient, http } from 'viem';
import { base, polygon } from 'viem/chains';

/**
 * Default bundler proxy URL (sponsored by prxvt)
 * Users can override with their own Pimlico key or custom bundler
 */
const DEFAULT_BUNDLER_URLS: Record<number, string> = {
  8453: 'https://sdk-api.prxvt.com/bundler/base',    // Base mainnet
  137: 'https://sdk-api.prxvt.com/bundler/polygon',  // Polygon mainnet
};

/**
 * Public RPC URLs (no API key required)
 */
const PUBLIC_RPC_URLS: Record<number, string> = {
  8453: 'https://mainnet.base.org',
  137: 'https://polygon-rpc.com',
};

/**
 * Chain configurations
 */
const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  base: {
    chainName: 'base',
    chainId: 8453,
    layerZeroEid: 30184,
    rpcUrl: PUBLIC_RPC_URLS[8453],
    poolAddress: '0xfB78e37B93b16B9aB4256e27AB6b32B98e6fdb97',
    paymasterAddress: '0xF785f24B3725fabe8669D1cb439577403E02B6BE',
    walletAddress: '0xdb02bac7310F3d4C1E7739DACFbA8c6C50c50419',
    entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  polygon: {
    chainName: 'polygon',
    chainId: 137,
    layerZeroEid: 30109,
    rpcUrl: PUBLIC_RPC_URLS[137],
    poolAddress: '0xE6F040AC35373FB5b0a213007623Ad84182b358A',
    paymasterAddress: '0xbacF89264E760Cae4EfDE1EeF48b69D73A12C94C',
    walletAddress: '0xBddDaB0AbFFBDd7C4b78aDdA2a25f1c45eb98F6a',
    entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
};

/**
 * Get chain configuration
 */
export function getChainConfig(chain: 'base' | 'polygon'): ChainConfig {
  return CHAIN_CONFIGS[chain];
}

/**
 * Get bundler URL
 * Priority: bundlerUrl > bundlerApiKey (Pimlico) > default prxvt proxy
 */
export function getBundlerUrl(
  chainId: number,
  options?: { bundlerUrl?: string; bundlerApiKey?: string }
): string {
  // 1. Custom bundler URL takes priority
  if (options?.bundlerUrl) {
    return options.bundlerUrl;
  }

  // 2. Pimlico API key (for users with their own key)
  if (options?.bundlerApiKey) {
    return `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${options.bundlerApiKey}`;
  }

  // 3. Default to prxvt proxy (sponsored)
  return DEFAULT_BUNDLER_URLS[chainId] || `https://api.prxvt.io/bundler/${chainId}`;
}

/**
 * Calculate balance from note
 */
export function calculateNoteBalance(note: Note): number {
  return note.commitments.reduce((sum, c) => sum + c.amount, 0) / 1_000_000;
}

/**
 * Get nonce from EntryPoint
 */
export async function getNonce(chainConfig: ChainConfig): Promise<bigint> {
  const chain = chainConfig.chainId === 8453 ? base : polygon;
  const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl),
  });

  const ENTRYPOINT_ABI = [
    {
      inputs: [
        { name: 'sender', type: 'address' },
        { name: 'key', type: 'uint192' },
      ],
      name: 'getNonce',
      outputs: [{ name: 'nonce', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  const nonce = await publicClient.readContract({
    address: chainConfig.entryPointAddress as `0x${string}`,
    abi: ENTRYPOINT_ABI,
    functionName: 'getNonce',
    args: [chainConfig.walletAddress as `0x${string}`, 0n],
  });

  return nonce as bigint;
}

/**
 * Fetch Merkle proof for commitment
 * Re-exported from merkle.ts (now implemented!)
 */
export { fetchMerkleProof } from './merkle';

/**
 * Validate note structure
 */
export function validateNote(note: Note): void {
  if (!note.version || !note.commitments || !Array.isArray(note.commitments)) {
    throw new Error('Invalid note structure');
  }

  if (note.commitments.length === 0) {
    throw new Error('Note has no commitments');
  }

  for (const commitment of note.commitments) {
    if (!commitment.secret || !commitment.nullifier || !commitment.amount || !commitment.depositChain) {
      throw new Error('Invalid commitment structure');
    }
  }
}

/**
 * Create empty note
 */
export function createEmptyNote(): Note {
  return {
    version: '2.0',
    commitments: [],
  };
}

/**
 * Format USDC amount (6 decimals)
 */
export function formatUSDC(microAmount: number | bigint): string {
  return (Number(microAmount) / 1_000_000).toFixed(2);
}

/**
 * Parse USDC amount to micro units
 */
export function parseUSDC(amount: number): bigint {
  return BigInt(Math.floor(amount * 1_000_000));
}
