// x402 Protocol Implementation for QR Pay
// Handles payment header generation, verification, and $CF token balance checking

import { ethers } from 'ethers';

// x402 Payment Protocol Constants
const X402_VERSION = '1.0';
const X402_PAYMENT_TOKEN_ADDRESS = process.env.X402_PAYMENT_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000';
const X402_PAYMENT_AMOUNT = process.env.X402_PAYMENT_AMOUNT || '100'; // 100 $CF per API call
const X402_PAYMENT_RECIPIENT = process.env.X402_PAYMENT_RECIPIENT || '0x0000000000000000000000000000000000000000';
const X402_CHAIN_ID = parseInt(process.env.X402_CHAIN_ID || '8453'); // Default to Base

// ERC20 ABI for balance checking
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// Payment header structure
export interface X402PaymentHeader {
  version: string;
  token: string;
  amount: string;
  recipient: string;
  payer: string;
  signature: string;
  timestamp: number;
  nonce: string;
  chainId: number;
}

// Payment receipt for verification
export interface X402PaymentReceipt {
  valid: boolean;
  header?: X402PaymentHeader;
  error?: string;
  txHash?: string;
}

/**
 * Generate a payment header for x402 protocol
 */
export async function generatePaymentHeader(
  signer: ethers.Signer,
  overrides?: Partial<{
    amount: string;
    recipient: string;
    chainId: number;
  }>
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  const payerAddress = await signer.getAddress();

  const header: Omit<X402PaymentHeader, 'signature'> = {
    version: X402_VERSION,
    token: X402_PAYMENT_TOKEN_ADDRESS,
    amount: overrides?.amount || X402_PAYMENT_AMOUNT,
    recipient: overrides?.recipient || X402_PAYMENT_RECIPIENT,
    payer: payerAddress,
    timestamp,
    nonce,
    chainId: overrides?.chainId || X402_CHAIN_ID,
  };

  // Create message to sign
  const message = createSigningMessage(header);
  const signature = await signer.signMessage(message);

  const fullHeader: X402PaymentHeader = {
    ...header,
    signature,
  };

  // Encode as base64 JSON
  return Buffer.from(JSON.stringify(fullHeader)).toString('base64');
}

/**
 * Verify an x402 payment header
 */
export async function verifyX402Payment(
  headerString: string | null
): Promise<boolean> {
  if (!headerString) {
    return false;
  }

  try {
    const receipt = await verifyPaymentHeader(headerString);
    return receipt.valid;
  } catch (error) {
    console.error('x402 verification error:', error);
    return false;
  }
}

/**
 * Parse and verify a payment header with detailed receipt
 */
export async function verifyPaymentHeader(
  headerString: string
): Promise<X402PaymentReceipt> {
  try {
    // Decode header
    const headerJson = Buffer.from(headerString, 'base64').toString('utf-8');
    const header: X402PaymentHeader = JSON.parse(headerJson);

    // Validate version
    if (header.version !== X402_VERSION) {
      return {
        valid: false,
        error: `Invalid x402 version: ${header.version}`,
      };
    }

    // Validate timestamp (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 5 * 60; // 5 minutes
    if (now - header.timestamp > maxAge) {
      return {
        valid: false,
        error: 'Payment header expired',
      };
    }

    // Validate amount
    const requiredAmount = BigInt(X402_PAYMENT_AMOUNT);
    const providedAmount = BigInt(header.amount);
    if (providedAmount < requiredAmount) {
      return {
        valid: false,
        error: `Insufficient payment amount. Required: ${X402_PAYMENT_AMOUNT}, provided: ${header.amount}`,
      };
    }

    // Verify signature
    const message = createSigningMessage(header);
    const recoveredAddress = ethers.verifyMessage(message, header.signature);
    
    if (recoveredAddress.toLowerCase() !== header.payer.toLowerCase()) {
      return {
        valid: false,
        error: 'Invalid signature',
      };
    }

    // Verify payer has sufficient balance
    const hasBalance = await checkTokenBalance(
      header.payer,
      header.token,
      header.amount,
      header.chainId
    );

    if (!hasBalance) {
      return {
        valid: false,
        error: 'Insufficient $CF token balance',
      };
    }

    return {
      valid: true,
      header,
    };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to parse payment header',
    };
  }
}

/**
 * Check if an address has sufficient token balance
 */
export async function checkTokenBalance(
  address: string,
  tokenAddress: string,
  requiredAmount: string,
  chainId: number
): Promise<boolean> {
  try {
    // Skip check if token address is zero (payments disabled)
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      return true;
    }

    const rpcUrl = getRpcUrl(chainId);
    if (!rpcUrl) {
      console.warn(`No RPC URL for chain ${chainId}, skipping balance check`);
      return true;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    const [balance, decimals] = await Promise.all([
      token.balanceOf(address) as Promise<bigint>,
      token.decimals() as Promise<number>,
    ]);

    const requiredAmountWei = ethers.parseUnits(requiredAmount, decimals);
    return balance >= requiredAmountWei;

  } catch (error) {
    console.error('Balance check error:', error);
    // Fail open in case of RPC errors
    return true;
  }
}

/**
 * Get $CF token balance for an address
 */
export async function getCFBalance(
  address: string,
  chainId: number = X402_CHAIN_ID
): Promise<{ balance: string; formatted: string }> {
  try {
    const rpcUrl = getRpcUrl(chainId);
    if (!rpcUrl || X402_PAYMENT_TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return { balance: '0', formatted: '0' };
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const token = new ethers.Contract(X402_PAYMENT_TOKEN_ADDRESS, ERC20_ABI, provider);

    const [balance, decimals] = await Promise.all([
      token.balanceOf(address) as Promise<bigint>,
      token.decimals() as Promise<number>,
    ]);

    return {
      balance: balance.toString(),
      formatted: ethers.formatUnits(balance, decimals),
    };

  } catch (error) {
    console.error('Get CF balance error:', error);
    return { balance: '0', formatted: '0' };
  }
}

/**
 * Estimate cost for API calls
 */
export function estimateApiCost(
  callCount: number,
  callType: 'quote' | 'execute' = 'quote'
): { amount: string; token: string } {
  // Execute calls cost more than quote calls
  const costPerCall = callType === 'execute' 
    ? BigInt(X402_PAYMENT_AMOUNT) * 2n 
    : BigInt(X402_PAYMENT_AMOUNT);
  
  const totalCost = costPerCall * BigInt(callCount);

  return {
    amount: totalCost.toString(),
    token: X402_PAYMENT_TOKEN_ADDRESS,
  };
}

/**
 * Create the message to be signed
 */
function createSigningMessage(
  header: Omit<X402PaymentHeader, 'signature'>
): string {
  return [
    'x402 Payment Authorization',
    `Version: ${header.version}`,
    `Token: ${header.token}`,
    `Amount: ${header.amount}`,
    `Recipient: ${header.recipient}`,
    `Payer: ${header.payer}`,
    `Timestamp: ${header.timestamp}`,
    `Nonce: ${header.nonce}`,
    `Chain ID: ${header.chainId}`,
  ].join('\n');
}

/**
 * Get RPC URL for a chain
 */
function getRpcUrl(chainId: number): string | undefined {
  const rpcUrls: Record<number, string | undefined> = {
    1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    10: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    8453: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    56: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    43114: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  };
  return rpcUrls[chainId];
}

/**
 * Create x402 payment required response
 */
export function createPaymentRequiredResponse(): {
  status: number;
  headers: Record<string, string>;
  body: object;
} {
  return {
    status: 402,
    headers: {
      'X-402-Version': X402_VERSION,
      'X-402-Token': X402_PAYMENT_TOKEN_ADDRESS,
      'X-402-Amount': X402_PAYMENT_AMOUNT,
      'X-402-Recipient': X402_PAYMENT_RECIPIENT,
      'X-402-Chain-Id': X402_CHAIN_ID.toString(),
    },
    body: {
      error: 'Payment Required',
      message: 'This API endpoint requires x402 payment authentication',
      payment: {
        version: X402_VERSION,
        token: X402_PAYMENT_TOKEN_ADDRESS,
        amount: X402_PAYMENT_AMOUNT,
        recipient: X402_PAYMENT_RECIPIENT,
        chainId: X402_CHAIN_ID,
      },
    },
  };
}

// Export configuration for client-side usage
export const X402_CONFIG = {
  version: X402_VERSION,
  tokenAddress: X402_PAYMENT_TOKEN_ADDRESS,
  paymentAmount: X402_PAYMENT_AMOUNT,
  recipient: X402_PAYMENT_RECIPIENT,
  chainId: X402_CHAIN_ID,
};
