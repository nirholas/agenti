// @ts-nocheck
/**
 * Privacy SDK Types
 */

import type { Hex, WalletClient } from 'viem';

/**
 * Note commitment - represents a private USDC balance
 */
export interface NoteCommitment {
  secret: string;           // Random secret (field element)
  nullifier: string;        // Random nullifier (field element)
  amount: number;           // Amount in micro USDC (6 decimals)
  depositChain: string;     // Chain where this commitment was created
}

/**
 * Note - contains one or more commitments (UTXO model)
 * After spending, old commitment is removed and change commitment is added
 */
export interface Note {
  version: string;
  commitments: NoteCommitment[];
}

/**
 * Chain configuration
 */
export interface ChainConfig {
  chainName: string;
  chainId: number;
  layerZeroEid: number;
  rpcUrl: string;
  poolAddress: string;
  paymasterAddress: string;
  walletAddress: string;
  entryPointAddress: string;
  usdcAddress: string;
}

/**
 * SDK configuration
 */
export interface PrivacySDKConfig {
  chain?: 'base' | 'polygon';      // Chain to use (defaults to 'base')
  bundlerUrl?: string;             // Custom bundler URL (defaults to prxvt proxy)
  bundlerApiKey?: string;          // Pimlico API key (if using Pimlico directly)
  rpcUrl?: string;                 // Custom RPC URL (defaults to public RPC)
  attestorUrl?: string;            // Attestor service URL (optional)
  circuitWasmPath?: string;        // Path to circuit WASM (optional)
  circuitZkeyPath?: string;        // Path to circuit zkey (optional)
}

/**
 * Payment result
 */
export interface PaymentResult {
  note: Note;                      // Updated note with change
  txHash: string;                  // Transaction hash
  nullifierHash: string;           // Nullifier hash (for tracking)
  burnerAddress?: string;          // Burner wallet address (for x402 payments)
  burnerPrivateKey?: string;       // Burner private key (for x402 payments)
}

/**
 * ZK Proof (Groth16)
 */
export interface ZKProof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
  protocol: string;
  curve: string;
}

/**
 * UserOperation (ERC-4337)
 */
export interface UserOperation {
  sender: string;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

/**
 * Merkle proof
 */
export interface MerkleProof {
  root: string;
  pathElements: string[];
  pathIndices: number[];
}

/**
 * x402 payment options
 */
export interface X402PaymentOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}

/**
 * x402 response with updated note
 */
export interface X402Response<T = any> {
  data: T;
  note: Note;                      // Updated note after payment
  txHash: string;                  // Payment transaction hash
}
