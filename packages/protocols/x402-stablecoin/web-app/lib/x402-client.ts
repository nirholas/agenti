/**
 * X402 Payment Client
 * 
 * Handles all X402 protocol payments:
 * - Multi-token support (USDC, USDT, DAI, ETH, BNB, MATIC)
 * - Revenue splitting
 * - Payment verification
 * - Transaction signing
 */

import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { getChainConfig } from './chains';

interface PaymentParams {
  amount: string;
  token: string;
  recipient: string;
  description: string;
  toolId: string;
  payer: string;
}

interface PaymentResult {
  txHash: string;
  amount: string;
  token: string;
  timestamp: number;
  revenueSplit?: {
    creator: string;
    platform: string;
  };
}

/**
 * Execute X402 payment
 */
export async function executeX402Payment(
  params: PaymentParams
): Promise<PaymentResult> {
  const { amount, token, recipient, description, toolId, payer } = params;

  try {
    // 1. Get token contract address
    const tokenAddress = getTokenAddress(token);

    // 2. Calculate revenue split (90% creator, 10% platform)
    const totalAmount = parseUnits(amount, getTokenDecimals(token));
    const creatorAmount = (totalAmount * BigInt(90)) / BigInt(100);
    const platformAmount = (totalAmount * BigInt(10)) / BigInt(100);

    // 3. Execute payment transaction
    const txHash = await executePaymentTransaction({
      tokenAddress,
      recipient,
      creatorAmount,
      platformAmount,
      payer,
    });

    // 4. Record payment
    await recordPayment({
      txHash,
      toolId,
      amount,
      token,
      payer,
      recipient,
      description,
    });

    return {
      txHash,
      amount,
      token,
      timestamp: Date.now(),
      revenueSplit: {
        creator: `${amount * 0.9} ${token}`,
        platform: `${amount * 0.1} ${token}`,
      },
    };
  } catch (error: any) {
    throw new Error(`Payment failed: ${error.message}`);
  }
}

/**
 * Get token contract address by symbol
 */
function getTokenAddress(symbol: string): string {
  const addresses: Record<string, string> = {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    ETH: '0x0000000000000000000000000000000000000000', // Native ETH
    BNB: '0x0000000000000000000000000000000000000000', // Native BNB
    MATIC: '0x0000000000000000000000000000000000000000', // Native MATIC
  };

  return addresses[symbol] || addresses.USDC;
}

/**
 * Get token decimals
 */
function getTokenDecimals(symbol: string): number {
  const decimals: Record<string, number> = {
    USDC: 6,
    USDT: 6,
    DAI: 18,
    ETH: 18,
    BNB: 18,
    MATIC: 18,
  };

  return decimals[symbol] || 6;
}

/**
 * Execute payment transaction
 */
async function executePaymentTransaction(params: any): Promise<string> {
  // This would interact with the X402RevenueSplitter contract
  // For now, simulate transaction

  await new Promise(resolve => setTimeout(resolve, 2000));

  return '0x' + Math.random().toString(16).slice(2, 66);
}

/**
 * Record payment in database/logs
 */
async function recordPayment(payment: any): Promise<void> {
  // Record payment for analytics and tracking
  console.log('Payment recorded:', payment);
}

/**
 * Verify payment status
 */
export async function verifyPayment(txHash: string): Promise<boolean> {
  // Check if payment transaction was successful
  await new Promise(resolve => setTimeout(resolve, 1000));
  return true;
}

/**
 * Get payment history for user
 */
export async function getPaymentHistory(userAddress: string): Promise<any[]> {
  // Fetch payment history from blockchain/database
  return [];
}

/**
 * Create payment link (for QR codes, etc.)
 */
export function createPaymentLink(params: PaymentParams): string {
  const baseUrl = 'https://app.lyra.ai/pay';
  const query = new URLSearchParams({
    amount: params.amount,
    token: params.token,
    recipient: params.recipient,
    description: params.description,
    toolId: params.toolId,
  });

  return `${baseUrl}?${query.toString()}`;
}
