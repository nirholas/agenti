/**
 * Wallet deployment utilities for Crossmint smart wallets
 */

import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { EVMWallet } from '@crossmint/wallets-sdk';

const CHAIN_CONFIG = {
  chain: baseSepolia,
  rpc: 'https://sepolia.base.org'
};

/**
 * Check if a wallet is deployed on-chain by looking for contract bytecode
 */
export async function checkWalletDeployment(walletAddress: string): Promise<boolean> {
  try {
    const publicClient = createPublicClient({
      chain: CHAIN_CONFIG.chain,
      transport: http(CHAIN_CONFIG.rpc)
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
    return false;
  }
}

/**
 * Deploy a pre-deployed wallet by making a minimal self-transfer
 */
export async function deployWallet(wallet: any): Promise<string> {
  console.log("🚀 Deploying wallet...");

  try {
    const evmWallet = EVMWallet.from(wallet);

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
    console.error("❌ Deployment error:", error);

    if (errorMsg.includes('insufficient') || errorMsg.includes('balance')) {
      throw new Error("Insufficient ETH balance for deployment gas fees");
    }

    throw new Error(`Wallet deployment failed: ${errorMsg}`);
  }
}

