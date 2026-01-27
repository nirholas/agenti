/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Code with kindness, deploy with confidence 🎪
 */

import { ethers } from 'ethers';
import { AppError } from '../middleware/errorHandler.js';

interface DeployOptions {
  bytecode: string;
  abi: any[];
  network: string;
  constructorArgs?: any[];
}

interface DeployResult {
  address: string;
  transactionHash: string;
  network: string;
  explorerUrl?: string;
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

export async function deployContract(options: DeployOptions): Promise<DeployResult> {
  const { bytecode, abi, network, constructorArgs = [] } = options;

  // Check if deployment key is available
  const privateKey = process.env.FUNDER_PRIVATE_KEY;
  if (!privateKey) {
    throw new AppError('Deployment service not configured. Please connect your own wallet to deploy.', 503);
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

    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    // Deploy contract
    const contract = await factory.deploy(...constructorArgs);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const deployTx = contract.deploymentTransaction();
    
    if (!deployTx) {
      throw new AppError('Deployment transaction not found', 500);
    }

    return {
      address,
      transactionHash: deployTx.hash,
      network,
      explorerUrl: `${networkConfig.explorer}/address/${address}`
    };
  } catch (error: any) {
    throw new AppError(`Deployment failed: ${error.message}`, 500);
  }
}
