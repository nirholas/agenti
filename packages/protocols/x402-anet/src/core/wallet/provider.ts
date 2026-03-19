import { ethers } from 'ethers';
import { createWalletClient, createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../config.js';

// ethers.js provider
export function createEthersProvider(rpcUrl?: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl || config.rpcUrl);
}

export function createEthersSigner(privateKey: string, rpcUrl?: string): ethers.Wallet {
  const provider = createEthersProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

// viem clients
export function createViemPublicClient(rpcUrl?: string): any {
  const chain = config.network === 'mainnet' ? base : baseSepolia;
  return createPublicClient({
    chain,
    transport: http(rpcUrl || config.rpcUrl),
  });
}

export function createViemWalletClient(privateKey: `0x${string}`, rpcUrl?: string): any {
  const chain = config.network === 'mainnet' ? base : baseSepolia;
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl || config.rpcUrl),
  });
}

export function getViemAccount(privateKey: `0x${string}`): any {
  return privateKeyToAccount(privateKey);
}
