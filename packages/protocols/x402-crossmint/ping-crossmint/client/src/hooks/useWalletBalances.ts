/**
 * Wallet balance management hook
 * Handles ETH and USDC balance fetching with chain support
 */

import { useState, useCallback } from 'react';
import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { CHAIN_CONFIGS, USDC_ADDRESSES } from '../constants/chains';
import type { BalanceState, SupportedChain } from '../types';

interface UseWalletBalancesProps {
  walletAddress: string | null;
  chain: SupportedChain;
  onLog: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export function useWalletBalances({ walletAddress, chain, onLog }: UseWalletBalancesProps) {
  const [balanceState, setBalanceState] = useState<BalanceState>({
    eth: null,
    usdc: null,
    isLoading: false
  });

  const fetchBalances = useCallback(async () => {
    if (!walletAddress) return;

    try {
      setBalanceState(prev => ({ ...prev, isLoading: true }));
      onLog("💰 Fetching wallet balances...");

      const chainConfig = CHAIN_CONFIGS[chain];
      if (!chainConfig) {
        onLog(`❌ Unsupported chain for balance fetching: ${chain}`, 'error');
        return;
      }

      const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.rpc)
      });

      // Fetch ETH balance
      const ethBalanceWei = await publicClient.getBalance({
        address: walletAddress as `0x${string}`
      });
      const ethBalanceFormatted = formatEther(ethBalanceWei);
      onLog(`💎 ETH Balance: ${parseFloat(ethBalanceFormatted).toFixed(6)} ETH`, 'info');

      // Fetch USDC balance
      const usdcAddress = USDC_ADDRESSES[chain];
      let usdcBalanceFormatted = 'N/A';
      if (usdcAddress) {
        const usdcBalanceRaw = await publicClient.readContract({
          address: usdcAddress as `0x${string}`,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'balanceOf',
          args: [walletAddress as `0x${string}`],
        });

        usdcBalanceFormatted = formatUnits(usdcBalanceRaw as bigint, 6);
        onLog(`💵 USDC Balance: ${parseFloat(usdcBalanceFormatted).toFixed(6)} USDC`, 'info');
      } else {
        onLog(`⚠️ USDC contract not configured for ${chain}`, 'warning');
      }

      setBalanceState({
        eth: ethBalanceFormatted,
        usdc: usdcBalanceFormatted,
        isLoading: false
      });

    } catch (error) {
      onLog(`❌ Failed to fetch balances: ${error instanceof Error ? error.message : String(error)}`, 'error');
      console.error('Balance fetch error:', error);
      setBalanceState({
        eth: 'Error',
        usdc: 'Error',
        isLoading: false
      });
    }
  }, [walletAddress, chain, onLog]);

  const resetBalances = useCallback(() => {
    setBalanceState({
      eth: null,
      usdc: null,
      isLoading: false
    });
  }, []);

  return {
    balanceState,
    fetchBalances,
    resetBalances
  };
}