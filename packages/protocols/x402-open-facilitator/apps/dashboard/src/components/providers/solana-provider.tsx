'use client';

import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * SolanaProvider wraps the app with Solana wallet adapter providers.
 *
 * Configuration:
 * - Network: Mainnet (production)
 * - Wallets: Empty array (auto-detect standard wallets like Phantom, Solflare, Backpack)
 * - AutoConnect: false (user triggers connection)
 *
 * Provider order (outermost to innermost):
 * - ConnectionProvider: RPC connection to Solana
 * - WalletProvider: Wallet state management
 * - WalletModalProvider: Standard wallet selection modal UI
 */
export const SolanaProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
