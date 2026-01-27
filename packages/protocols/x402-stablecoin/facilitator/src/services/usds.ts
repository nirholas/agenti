/**
 * Sperax USD (USDs) Contract Interactions
 * 
 * Specialized service for USDs auto-yield stablecoin operations
 * Supports EIP-3009 transferWithAuthorization for gasless payments
 */

import {
  type Address,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
} from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { Network, EIP3009Authorization } from '../types.js';
import { logger } from '../middleware/logger.js';

/**
 * USDs Contract Address
 */
export const USDS_ADDRESS: Address = '0xD74f5255D557944cf7Dd0E45FF521520002D5748';

/**
 * USDs Decimals
 */
export const USDS_DECIMALS = 18;

/**
 * USDs Contract ABI (relevant functions only)
 */
const USDS_ABI = [
  // Standard ERC-20
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  // USDs specific - rebase opt-in
  {
    name: 'rebaseOptIn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'rebaseOptOut',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'isRebaseOptedIn',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  // EIP-3009 - Transfer With Authorization
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'authorizationState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  // EIP-2612 - Permit
  {
    name: 'permit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'DOMAIN_SEPARATOR',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;

/**
 * USDs Service for contract interactions
 */
export class USdsService {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private _network: Network;

  constructor(network: Network, rpcUrl: string, privateKey?: `0x${string}`) {
    this._network = network;
    const chain = network === 'arbitrum' ? arbitrum : arbitrumSepolia;

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    if (privateKey) {
      const account = privateKeyToAccount(privateKey);
      this.walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      });
    }

    logger.info('USdsService initialized', { network, hasWallet: !!this.walletClient });
  }

  /**
   * Get USDs balance
   */
  async getBalance(address: Address): Promise<{
    raw: bigint;
    formatted: string;
  }> {
    const balance = await this.publicClient.readContract({
      address: USDS_ADDRESS,
      abi: USDS_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    return {
      raw: balance,
      formatted: formatUnits(balance, USDS_DECIMALS),
    };
  }

  /**
   * Check if address is opted into rebase (auto-yield)
   */
  async isRebaseOptedIn(address: Address): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: USDS_ADDRESS,
        abi: USDS_ABI,
        functionName: 'isRebaseOptedIn',
        args: [address],
      });
    } catch {
      // If function doesn't exist, assume opted in by default
      return true;
    }
  }

  /**
   * Check if authorization nonce has been used
   */
  async isAuthorizationUsed(authorizer: Address, nonce: `0x${string}`): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: USDS_ADDRESS,
        abi: USDS_ABI,
        functionName: 'authorizationState',
        args: [authorizer, nonce],
      });
    } catch (error) {
      logger.error('Error checking authorization state', { error, authorizer, nonce });
      throw error;
    }
  }

  /**
   * Execute transferWithAuthorization (gasless transfer)
   */
  async executeTransferWithAuthorization(auth: EIP3009Authorization): Promise<{
    success: boolean;
    txHash?: `0x${string}`;
    gasUsed?: string;
    effectiveGasPrice?: string;
    error?: string;
  }> {
    if (!this.walletClient) {
      return { success: false, error: 'Wallet not configured' };
    }

    try {
      // Validate authorization hasn't expired
      const now = Math.floor(Date.now() / 1000);
      if (now > auth.validBefore) {
        return { success: false, error: 'Authorization expired' };
      }
      if (now < auth.validAfter) {
        return { success: false, error: 'Authorization not yet valid' };
      }

      // Check if nonce already used
      const isUsed = await this.isAuthorizationUsed(auth.from, auth.nonce as `0x${string}`);
      if (isUsed) {
        return { success: false, error: 'Authorization nonce already used' };
      }

      // Check sender has sufficient balance
      const balance = await this.getBalance(auth.from);
      const requiredAmount = BigInt(auth.value);
      if (balance.raw < requiredAmount) {
        return {
          success: false,
          error: `Insufficient balance: has ${balance.formatted} USDs, needs ${formatUnits(requiredAmount, USDS_DECIMALS)} USDs`,
        };
      }

      // Execute the transfer
      const hash = await this.walletClient.writeContract({
        address: USDS_ADDRESS,
        abi: USDS_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          auth.from,
          auth.to,
          BigInt(auth.value),
          BigInt(auth.validAfter),
          BigInt(auth.validBefore),
          auth.nonce as `0x${string}`,
          auth.v,
          auth.r,
          auth.s,
        ],
      });

      logger.info('USDs transferWithAuthorization submitted', {
        txHash: hash,
        from: auth.from,
        to: auth.to,
        value: auth.value,
      });

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 60000,
      });

      if (receipt.status !== 'success') {
        return { success: false, txHash: hash, error: 'Transaction reverted' };
      }

      return {
        success: true,
        txHash: hash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      };
    } catch (error) {
      logger.error('Error executing transferWithAuthorization', { error, auth });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Opt into rebase (enable auto-yield)
   */
  async rebaseOptIn(): Promise<{ success: boolean; txHash?: `0x${string}`; error?: string }> {
    if (!this.walletClient) {
      return { success: false, error: 'Wallet not configured' };
    }

    try {
      const hash = await this.walletClient.writeContract({
        address: USDS_ADDRESS,
        abi: USDS_ABI,
        functionName: 'rebaseOptIn',
        args: [],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      
      return {
        success: receipt.status === 'success',
        txHash: hash,
      };
    } catch (error) {
      logger.error('Error opting into rebase', { error });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Parse USDs amount
   */
  parseAmount(amount: string): bigint {
    return parseUnits(amount, USDS_DECIMALS);
  }

  /**
   * Format USDs amount
   */
  formatAmount(amount: bigint): string {
    return formatUnits(amount, USDS_DECIMALS);
  }

  /**
   * Get EIP-712 domain for USDs
   */
  getEIP712Domain(chainId: number) {
    return {
      name: 'Sperax USD',
      version: '1',
      chainId,
      verifyingContract: USDS_ADDRESS,
    };
  }
}

/**
 * Create USdsService instance
 */
export function createUSdsService(
  network: Network,
  rpcUrl: string,
  privateKey?: `0x${string}`
): USdsService {
  return new USdsService(network, rpcUrl, privateKey);
}
