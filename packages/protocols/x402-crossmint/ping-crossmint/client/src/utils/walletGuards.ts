/**
 * Simple wallet guard utilities for Crossmint smart wallets
 */

import { createPublicClient, http } from 'viem';
import { EVMWallet } from '@crossmint/wallets-sdk';
import { CHAIN_CONFIGS } from '../constants/chains';
import type { SupportedChain } from '../types';

/**
 * Check if a wallet is deployed on-chain by looking for contract bytecode
 */
export async function checkWalletDeployment(
  walletAddress: string,
  chain: SupportedChain
): Promise<boolean> {
  try {
    const chainConfig = CHAIN_CONFIGS[chain];
    if (!chainConfig) {
      console.warn(`⚠️ Unsupported chain: ${chain}`);
      return false;
    }

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    const code = await publicClient.getCode({
      address: walletAddress as `0x${string}`
    });

    // If bytecode exists and is not just "0x", the wallet is deployed
    const isDeployed = code !== undefined && code !== '0x' && code.length > 2;

    console.log(`🔍 Wallet ${walletAddress} deployment status: ${isDeployed ? 'deployed' : 'pre-deployed'}`);

    return isDeployed;
  } catch (error) {
    console.error('❌ Failed to check wallet deployment:', error);
    // Default to pre-deployed if we can't check
    return false;
  }
}

/**
 * Deploy a pre-deployed wallet by making a minimal self-transfer
 */
export async function deployWallet(wallet: any): Promise<string> {
  console.log("🚀 Deploying wallet...");
  console.log("🔍 Wallet instance:", { address: wallet.address, type: typeof wallet });

  try {
    const evmWallet = EVMWallet.from(wallet);

    console.log("📝 Attempting sendTransaction for deployment...");

    // Deploy wallet with a minimal self-transfer (1 wei)
    const deploymentTx = await evmWallet.sendTransaction({
      to: wallet.address,
      value: 1n, // 1 wei
      data: "0x"
    });

    console.log(`✅ Wallet deployed! Transaction: ${deploymentTx.hash}`);

    return deploymentTx.hash || `deployment_tx_${Date.now()}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Deployment error details:", error);

    if (errorMsg.includes('insufficient') || errorMsg.includes('balance')) {
      throw new Error("Insufficient ETH balance for deployment gas fees");
    }

    throw new Error(`Wallet deployment failed: ${errorMsg}`);
  }
}

/**
 * Check if a payment amount justifies wallet deployment cost
 */
export function shouldDeployForPayment(paymentAmount: number, chain: SupportedChain): boolean {
  const thresholds: Record<SupportedChain, number> = {
    'base-sepolia': 1000,    // 0.001 USDC
    'base': 5000,            // 0.005 USDC
    'ethereum': 10000        // 0.01 USDC (higher due to gas costs)
  };

  return paymentAmount >= (thresholds[chain] || 1000);
}

/**
 * Analyze settlement errors to provide helpful feedback
 */
export function analyzeSettlementError(error: any): {
  isPreDeployedWalletError: boolean;
  isInfrastructureError: boolean;
  userFriendlyMessage: string;
} {
  const errorMessage = error?.message || error?.response?.data?.error || '';
  const statusCode = error?.response?.status;

  // Check for pre-deployed wallet settlement issues
  const isPreDeployedWalletError = (
    statusCode === 402 &&
    (errorMessage === '' ||
     typeof errorMessage === 'object' ||
     errorMessage.includes('settlement') ||
     errorMessage.includes('execution'))
  );

  // Check for infrastructure issues
  const isInfrastructureError = (
    statusCode === 500 ||
    errorMessage.includes('Internal Server Error') ||
    errorMessage.includes('facilitator')
  );

  let userFriendlyMessage = '';

  if (isPreDeployedWalletError) {
    userFriendlyMessage = "Payment verification successful! Settlement requires wallet deployment.";
  } else if (isInfrastructureError) {
    userFriendlyMessage = "Payment processing temporarily unavailable due to external service issues.";
  } else {
    userFriendlyMessage = "Payment failed due to an unexpected error.";
  }

  return {
    isPreDeployedWalletError,
    isInfrastructureError,
    userFriendlyMessage
  };
}