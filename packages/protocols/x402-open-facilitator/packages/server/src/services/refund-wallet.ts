/**
 * Refund wallet service
 * Manages custodial wallets for refund payouts
 */
import {
  generateSolanaKeypair,
  getSolanaPublicKey,
  getSolanaUSDCBalance,
  getStacksBalance,
  isStacksNetwork,
} from '@openfacilitator/core';
import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';
import crypto from 'crypto';
import { encryptPrivateKey, decryptPrivateKey, generateEVMWallet } from '../utils/crypto.js';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createRefundWallet,
  getRefundWallet,
  getRefundWalletsByResourceOwner,
  deleteRefundWallet as dbDeleteRefundWallet,
} from '../db/refund-wallets.js';

// USDC contract addresses
const USDC_ADDRESSES: Record<string, Address> = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

// ERC20 balance ABI
const BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// isStacksNetwork is imported from @openfacilitator/core

/**
 * Check if a network is a Solana network
 */
function isSolanaNetwork(network: string): boolean {
  return network === 'solana' || network === 'solana-mainnet' || network === 'solana-devnet' || network.startsWith('solana:');
}

/**
 * Generate a new refund wallet for a resource owner on a specific network
 */
export async function generateRefundWallet(
  resourceOwnerId: string,
  network: string
): Promise<{ address: string; created: boolean }> {
  // Check if wallet already exists
  const existing = getRefundWallet(resourceOwnerId, network);
  if (existing) {
    return { address: existing.wallet_address, created: false };
  }

  let address: string;
  let encryptedKey: string;

  if (isSolanaNetwork(network)) {
    // Generate Solana keypair
    const keypair = generateSolanaKeypair();
    address = keypair.publicKey;
    encryptedKey = encryptPrivateKey(keypair.privateKey);
  } else if (isStacksNetwork(network)) {
    // Generate Stacks keypair
    const { getAddressFromPrivateKey } = await import('@stacks/transactions');
    const privateKey = crypto.randomBytes(32).toString('hex');
    const stacksAddress = getAddressFromPrivateKey(privateKey, 'mainnet');
    address = stacksAddress;
    encryptedKey = encryptPrivateKey(privateKey);
  } else {
    // Generate EVM keypair
    const wallet = generateEVMWallet();
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    address = account.address;
    encryptedKey = encryptPrivateKey(wallet.privateKey);
  }

  // Store in database
  createRefundWallet(resourceOwnerId, network, address, encryptedKey);

  return { address, created: true };
}

/**
 * Get USDC balance for a refund wallet
 */
export async function getRefundWalletBalance(
  resourceOwnerId: string,
  network: string
): Promise<{ balance: bigint; formatted: string } | null> {
  const wallet = getRefundWallet(resourceOwnerId, network);
  if (!wallet) {
    return null;
  }

  if (isSolanaNetwork(network)) {
    const solanaNetwork = network === 'solana-devnet' ? 'solana-devnet' : 'solana';
    return getSolanaUSDCBalance(solanaNetwork, wallet.wallet_address);
  } else if (isStacksNetwork(network)) {
    const stacksNetwork = network === 'stacks-testnet' ? 'stacks-testnet' : 'stacks';
    return getStacksBalance(stacksNetwork, wallet.wallet_address);
  } else {
    // EVM balance check
    const usdcAddress = USDC_ADDRESSES[network];
    if (!usdcAddress) {
      return { balance: BigInt(0), formatted: '0.00' };
    }

    const client = createPublicClient({
      chain: base,
      transport: http(),
    });

    try {
      const balance = await client.readContract({
        address: usdcAddress,
        abi: BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [wallet.wallet_address as Address],
      });

      const formatted = (Number(balance) / 1e6).toFixed(2);
      return { balance: BigInt(balance), formatted };
    } catch {
      return { balance: BigInt(0), formatted: '0.00' };
    }
  }
}

/**
 * Get all refund wallets for a resource owner with their balances
 */
export async function getRefundWalletBalances(
  resourceOwnerId: string
): Promise<Array<{
  network: string;
  address: string;
  balance: string;
  createdAt: string;
}>> {
  const wallets = getRefundWalletsByResourceOwner(resourceOwnerId);

  const results = await Promise.all(
    wallets.map(async (wallet) => {
      const balanceInfo = await getRefundWalletBalance(resourceOwnerId, wallet.network);
      return {
        network: wallet.network,
        address: wallet.wallet_address,
        balance: balanceInfo?.formatted || '0.00',
        createdAt: wallet.created_at,
      };
    })
  );

  return results;
}

/**
 * Get the decrypted private key for a refund wallet
 * INTERNAL USE ONLY - never expose via API
 */
export function decryptRefundPrivateKey(resourceOwnerId: string, network: string): string | null {
  const wallet = getRefundWallet(resourceOwnerId, network);
  if (!wallet) {
    return null;
  }
  return decryptPrivateKey(wallet.encrypted_private_key);
}

/**
 * Delete a refund wallet
 */
export function deleteRefundWallet(resourceOwnerId: string, network: string): boolean {
  return dbDeleteRefundWallet(resourceOwnerId, network);
}

/**
 * Supported networks for refund wallets
 */
export const SUPPORTED_REFUND_NETWORKS = ['base', 'solana', 'stacks'] as const;
export type SupportedRefundNetwork = typeof SUPPORTED_REFUND_NETWORKS[number];
