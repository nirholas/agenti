/**
 * Claims processing service
 * Handles failure reporting and payout execution
 */
import {
  createClaim,
  getClaimById,
  getClaimByTxHash,
  updateClaimStatus,
  claimExistsForTxHash,
} from '../db/claims.js';
import {
  getRegisteredServerByApiKey,
  hashApiKey,
} from '../db/registered-servers.js';
import { getRefundWallet } from '../db/refund-wallets.js';
import { getResourceOwnerById } from '../db/resource-owners.js';
import { getOrCreateRefundConfig } from '../db/refund-configs.js';
import { decryptRefundPrivateKey, getRefundWalletBalance } from './refund-wallet.js';
import type { ClaimRecord, RegisteredServerRecord } from '../db/types.js';
import { executeSolanaSettlement, getSolanaPublicKey, executeERC3009Settlement } from '@openfacilitator/core';
import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hex,
  hashTypedData,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount, signTypedData } from 'viem/accounts';
import { getFacilitatorById } from '../db/facilitators.js';
import { decryptPrivateKey } from '../utils/crypto.js';
import { randomBytes } from 'crypto';

// USDC contract addresses and chain IDs
const USDC_CONFIG: Record<string, { address: Address; chainId: number }> = {
  base: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chainId: 8453 },
  'base-sepolia': { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', chainId: 84532 },
};

// EIP-712 domain and types for ERC-3009 TransferWithAuthorization
const ERC3009_DOMAIN = (chainId: number, tokenAddress: Address) => ({
  name: 'USD Coin',
  version: '2',
  chainId,
  verifyingContract: tokenAddress,
});

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

/**
 * Normalize network identifier to simple format used by refund wallets
 * e.g., 'eip155:8453' -> 'base', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' -> 'solana'
 */
function normalizeNetwork(network: string): string {
  // CAIP-2 EVM networks
  if (network === 'eip155:8453') return 'base';
  if (network === 'eip155:84532') return 'base-sepolia';

  // CAIP-2 Solana
  if (network.startsWith('solana:')) return 'solana';

  // Already simple format
  return network;
}

/**
 * Generate a random 32-byte nonce for ERC-3009
 */
function generateNonce(): Hex {
  return `0x${randomBytes(32).toString('hex')}` as Hex;
}

/**
 * Check if a network is a Solana network
 */
function isSolanaNetwork(network: string): boolean {
  return network === 'solana' || network === 'solana-mainnet' || network === 'solana-devnet';
}

export interface ReportFailureParams {
  apiKey: string;
  originalTxHash: string;
  userWallet: string;
  amount: string;
  asset: string;
  network: string;
  reason?: string;
}

export interface ReportFailureResult {
  success: boolean;
  claimId?: string;
  error?: string;
}

/**
 * Report a failure and create a claim
 */
export async function reportFailure(params: ReportFailureParams): Promise<ReportFailureResult> {
  const { apiKey, originalTxHash, userWallet, amount, asset, network, reason } = params;

  // Validate API key and get server
  const server = getRegisteredServerByApiKey(apiKey);
  if (!server) {
    return { success: false, error: 'Invalid API key' };
  }

  if (server.active !== 1) {
    return { success: false, error: 'Server is not active' };
  }

  // Get the resource owner
  const resourceOwner = getResourceOwnerById(server.resource_owner_id);
  if (!resourceOwner) {
    return { success: false, error: 'Resource owner not found' };
  }

  // Check if refunds are enabled for this facilitator
  const refundConfig = getOrCreateRefundConfig(resourceOwner.facilitator_id);
  if (refundConfig.enabled !== 1) {
    return { success: false, error: 'Refunds are not enabled for this facilitator' };
  }

  // Check if claim already exists for this transaction
  if (claimExistsForTxHash(originalTxHash)) {
    return { success: false, error: 'Claim already exists for this transaction' };
  }

  // Normalize network identifier (e.g., 'eip155:8453' -> 'base')
  const normalizedNetwork = normalizeNetwork(network);

  // Check if refund wallet exists for this network (scoped to resource owner)
  const refundWallet = getRefundWallet(server.resource_owner_id, normalizedNetwork);
  if (!refundWallet) {
    return { success: false, error: `No refund wallet configured for network: ${normalizedNetwork}` };
  }

  // Create the claim
  try {
    const claim = createClaim({
      resource_owner_id: server.resource_owner_id,
      server_id: server.id,
      original_tx_hash: originalTxHash,
      user_wallet: userWallet,
      amount,
      asset,
      network: normalizedNetwork,
      reason,
    });

    return { success: true, claimId: claim.id };
  } catch (error) {
    console.error('Failed to create claim:', error);
    return { success: false, error: 'Failed to create claim' };
  }
}

export interface ExecutePayoutResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Execute a payout for an approved claim
 */
export async function executeClaimPayout(claimId: string): Promise<ExecutePayoutResult> {
  const claim = getClaimById(claimId);
  if (!claim) {
    return { success: false, error: 'Claim not found' };
  }

  if (claim.status !== 'approved') {
    return { success: false, error: `Claim is not approved (status: ${claim.status})` };
  }

  // Get refund wallet for this network (using resource_owner_id)
  const refundPrivateKey = decryptRefundPrivateKey(claim.resource_owner_id, claim.network);
  if (!refundPrivateKey) {
    return { success: false, error: 'Refund wallet not found or unable to decrypt' };
  }

  // Check balance before attempting payout
  const balance = await getRefundWalletBalance(claim.resource_owner_id, claim.network);
  if (!balance || BigInt(balance.balance) < BigInt(claim.amount)) {
    return {
      success: false,
      error: `Insufficient refund wallet balance. Required: ${claim.amount}, Available: ${balance?.balance || 0}`,
    };
  }

  // Get the resource owner to find the facilitator
  const resourceOwner = getResourceOwnerById(claim.resource_owner_id);
  if (!resourceOwner) {
    return { success: false, error: 'Resource owner not found' };
  }

  try {
    let transactionHash: string;

    if (isSolanaNetwork(claim.network)) {
      // Get facilitator for gas payment (gasless Solana transfer)
      const facilitator = getFacilitatorById(resourceOwner.facilitator_id);
      if (!facilitator || !facilitator.encrypted_solana_private_key) {
        return { success: false, error: 'Facilitator Solana wallet not configured - required for gasless refunds' };
      }

      const facilitatorSolanaKey = decryptPrivateKey(facilitator.encrypted_solana_private_key);

      // Solana payout - gasless SPL token transfer (facilitator pays fees)
      const result = await executeGaslessSolanaTransfer({
        network: claim.network as 'solana' | 'solana-devnet',
        refundPrivateKey,
        facilitatorPrivateKey: facilitatorSolanaKey,
        recipient: claim.user_wallet,
        amount: claim.amount,
        asset: claim.asset,
      });

      if (!result.success) {
        return { success: false, error: result.errorMessage || 'Solana transfer failed' };
      }

      transactionHash = result.transactionHash!;
    } else {
      // Get facilitator for gas payment (ERC-3009 gasless transfer)
      const facilitator = getFacilitatorById(resourceOwner.facilitator_id);
      if (!facilitator || !facilitator.encrypted_private_key) {
        return { success: false, error: 'Facilitator EVM wallet not configured - required for gasless refunds' };
      }

      const facilitatorPrivateKey = decryptPrivateKey(facilitator.encrypted_private_key);

      // EVM payout - use gasless ERC-3009 transfer
      const result = await executeGaslessEVMRefund({
        network: claim.network,
        refundPrivateKey,
        facilitatorPrivateKey: facilitatorPrivateKey as Hex,
        recipient: claim.user_wallet as Address,
        amount: claim.amount,
      });

      if (!result.success) {
        return { success: false, error: result.error || 'EVM transfer failed' };
      }

      transactionHash = result.transactionHash!;
    }

    // Update claim status to paid
    updateClaimStatus(claimId, 'paid', transactionHash);

    return { success: true, transactionHash };
  } catch (error) {
    console.error('Payout execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during payout',
    };
  }
}

/**
 * Execute a gasless Solana SPL token transfer
 * The refund wallet signs the transfer, facilitator pays the transaction fees
 */
async function executeGaslessSolanaTransfer(params: {
  network: 'solana' | 'solana-devnet';
  refundPrivateKey: string;
  facilitatorPrivateKey: string;
  recipient: string;
  amount: string;
  asset: string;
}): Promise<{ success: boolean; transactionHash?: string; errorMessage?: string }> {
  // Import required Solana libraries
  const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
  } = await import('@solana/web3.js');
  const {
    getAssociatedTokenAddress,
    createTransferInstruction,
    getAccount,
    createAssociatedTokenAccountInstruction,
  } = await import('@solana/spl-token');
  const bs58 = await import('bs58');

  const rpcUrl = params.network === 'solana-devnet'
    ? (process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com')
    : (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

  const connection = new Connection(rpcUrl, 'confirmed');
  const refundKeypair = Keypair.fromSecretKey(bs58.default.decode(params.refundPrivateKey));
  const facilitatorKeypair = Keypair.fromSecretKey(bs58.default.decode(params.facilitatorPrivateKey));
  const recipientPubkey = new PublicKey(params.recipient);
  const mintPubkey = new PublicKey(params.asset);

  console.log('[GaslessSolanaRefund] Creating transfer:', {
    from: refundKeypair.publicKey.toBase58(),
    to: params.recipient,
    amount: params.amount,
    feePayer: facilitatorKeypair.publicKey.toBase58(),
  });

  try {
    // Get token accounts
    const senderAta = await getAssociatedTokenAddress(mintPubkey, refundKeypair.publicKey);
    const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

    // Build transaction
    const transaction = new Transaction();

    // Check if recipient ATA exists, if not create it (facilitator pays for this too)
    try {
      await getAccount(connection, recipientAta);
    } catch {
      // ATA doesn't exist, add instruction to create it
      // Facilitator pays for the account creation
      console.log('[GaslessSolanaRefund] Creating recipient ATA...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          facilitatorKeypair.publicKey, // Payer for account creation
          recipientAta,
          recipientPubkey,
          mintPubkey
        )
      );
    }

    // Add transfer instruction (refund wallet is the authority)
    transaction.add(
      createTransferInstruction(
        senderAta,
        recipientAta,
        refundKeypair.publicKey, // Authority is the refund wallet
        BigInt(params.amount)
      )
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Facilitator pays the transaction fees
    transaction.feePayer = facilitatorKeypair.publicKey;

    // Both need to sign: facilitator (for fees) and refund wallet (for transfer authority)
    transaction.sign(facilitatorKeypair, refundKeypair);

    console.log('[GaslessSolanaRefund] Sending transaction...');

    // Send and confirm
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature, 'confirmed');

    console.log('[GaslessSolanaRefund] Success! TX:', signature);
    return { success: true, transactionHash: signature };
  } catch (error) {
    console.error('[GaslessSolanaRefund] Error:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute a gasless EVM refund using ERC-3009 (transferWithAuthorization)
 * The refund wallet signs the authorization, facilitator submits and pays gas
 */
async function executeGaslessEVMRefund(params: {
  network: string;
  refundPrivateKey: string;
  facilitatorPrivateKey: Hex;
  recipient: Address;
  amount: string;
}): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  const config = USDC_CONFIG[params.network];
  if (!config) {
    return { success: false, error: `Unsupported network: ${params.network}` };
  }

  try {
    const refundAccount = privateKeyToAccount(params.refundPrivateKey as Hex);
    const nonce = generateNonce();
    const validAfter = 0; // Valid immediately
    const validBefore = Math.floor(Date.now() / 1000) + 3600; // Valid for 1 hour

    console.log('[GaslessRefund] Creating ERC-3009 authorization:', {
      from: refundAccount.address,
      to: params.recipient,
      value: params.amount,
      nonce,
      chainId: config.chainId,
    });

    // Create the ERC-3009 authorization message
    const domain = ERC3009_DOMAIN(config.chainId, config.address);
    const message = {
      from: refundAccount.address,
      to: params.recipient,
      value: BigInt(params.amount),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce,
    };

    // Sign the authorization with the refund wallet
    const signature = await signTypedData({
      privateKey: params.refundPrivateKey as Hex,
      domain,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: 'TransferWithAuthorization',
      message,
    });

    console.log('[GaslessRefund] Authorization signed, submitting via facilitator...');

    // Submit using the facilitator's wallet (which pays gas)
    const result = await executeERC3009Settlement({
      chainId: config.chainId,
      tokenAddress: config.address,
      authorization: {
        from: refundAccount.address,
        to: params.recipient,
        value: params.amount,
        validAfter,
        validBefore,
        nonce,
      },
      signature,
      facilitatorPrivateKey: params.facilitatorPrivateKey,
    });

    if (!result.success) {
      console.error('[GaslessRefund] Settlement failed:', result.errorMessage);
      return { success: false, error: result.errorMessage };
    }

    console.log('[GaslessRefund] Refund successful! TX:', result.transactionHash);
    return { success: true, transactionHash: result.transactionHash };
  } catch (error) {
    console.error('[GaslessRefund] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Approve a claim (changes status from pending to approved)
 */
export function approveClaim(claimId: string): ClaimRecord | null {
  const claim = getClaimById(claimId);
  if (!claim || claim.status !== 'pending') {
    return null;
  }
  return updateClaimStatus(claimId, 'approved');
}

/**
 * Reject a claim
 */
export function rejectClaim(claimId: string): ClaimRecord | null {
  const claim = getClaimById(claimId);
  if (!claim || !['pending', 'approved'].includes(claim.status)) {
    return null;
  }
  return updateClaimStatus(claimId, 'rejected');
}
