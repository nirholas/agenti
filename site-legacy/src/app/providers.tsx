'use client';

import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, polygon, arbitrum, optimism, base, bsc, avalanche, linea, zkSync } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

// Configure chains with real RPC endpoints
const config = getDefaultConfig({
  appName: 'Agenti',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'agenti-demo',
  chains: [
    mainnet,
    polygon,
    arbitrum,
    optimism,
    base,
    bsc,
    avalanche,
    linea,
    zkSync,
  ],
  transports: {
    [mainnet.id]: http('https://eth.llamarpc.com'),
    [polygon.id]: http('https://polygon.llamarpc.com'),
    [arbitrum.id]: http('https://arbitrum.llamarpc.com'),
    [optimism.id]: http('https://optimism.llamarpc.com'),
    [base.id]: http('https://base.llamarpc.com'),
    [bsc.id]: http('https://bsc-dataseed.bnbchain.org'),
    [avalanche.id]: http('https://api.avax.network/ext/bc/C/rpc'),
    [linea.id]: http('https://rpc.linea.build'),
    [zkSync.id]: http('https://mainnet.era.zksync.io'),
  },
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#3b82f6',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
