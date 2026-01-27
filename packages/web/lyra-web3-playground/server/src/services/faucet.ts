/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The future is being built right here 🏗️
 */

import { ethers } from 'ethers';
import { AppError } from '../middleware/errorHandler.js';

interface FundResult {
  transactionHash: string;
  amount: string;
  network: string;
}

// Network configurations
const networks: Record<string, { rpc: string; chainId: number; explorer: string }> = {
  sepolia: {
    rpc: process.env.VITE_ALCHEMY_API_KEY 
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_API_KEY}`
      : 'https://rpc.sepolia.org',
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io'
  },
  mumbai: {
    rpc: process.env.VITE_ALCHEMY_API_KEY
      ? `https://polygon-mumbai.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_API_KEY}`
      : 'https://rpc-mumbai.maticvigil.com',
    chainId: 80001,
    explorer: 'https://mumbai.polygonscan.com'
  }
};

// Amount to fund (0.1 ETH or equivalent)
const FUND_AMOUNT = '0.1';

export async function fundAddress(address: string, network: string): Promise<FundResult> {
  // Check if faucet is configured
  const privateKey = process.env.FUNDER_PRIVATE_KEY;
  if (!privateKey) {
    throw new AppError('Faucet service not configured', 503);
  }

  // Get network config
  const networkConfig = networks[network];
  if (!networkConfig) {
    throw new AppError(`Unsupported network: ${network}`, 400);
  }

  try {
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Check faucet balance
    const balance = await provider.getBalance(wallet.address);
    const fundAmount = ethers.parseEther(FUND_AMOUNT);

    if (balance < fundAmount) {
      throw new AppError('Faucet has insufficient funds', 503);
    }

    // Send transaction
    const tx = await wallet.sendTransaction({
      to: address,
      value: fundAmount
    });

    await tx.wait();

    return {
      transactionHash: tx.hash,
      amount: `${FUND_AMOUNT} ETH`,
      network
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Faucet transaction failed: ${error.message}`, 500);
  }
}
