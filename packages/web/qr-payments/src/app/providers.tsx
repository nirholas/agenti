'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { 
  mainnet, 
  arbitrum, 
  base, 
  optimism, 
  polygon,
  bsc,
  avalanche,
  gnosis,
  fantom,
  zkSync,
  linea,
  scroll,
  mantle,
  blast,
  mode,
  manta,
  zora,
  arbitrumNova,
  celo,
  moonbeam,
  cronos,
  metis,
  polygonZkEvm,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
} from 'wagmi/chains';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

// Configure all supported chains
const config = getDefaultConfig({
  appName: 'QR Pay',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [
    // Primary chains
    mainnet,
    base,
    arbitrum,
    optimism,
    polygon,
    // L2s
    zkSync,
    linea,
    scroll,
    mantle,
    blast,
    mode,
    manta,
    zora,
    arbitrumNova,
    polygonZkEvm,
    metis,
    // Other EVM chains
    bsc,
    avalanche,
    gnosis,
    fantom,
    celo,
    moonbeam,
    cronos,
    // Testnets (dev mode)
    ...(process.env.NODE_ENV === 'development' ? [
      sepolia,
      baseSepolia,
      arbitrumSepolia,
      optimismSepolia,
    ] : []),
  ],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
