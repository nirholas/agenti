/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Authentication made simple with Privy
 */

import { PrivyProvider as PrivyAuthProvider } from '@privy-io/react-auth';
import { ReactNode } from 'react';

interface PrivyProviderProps {
  children: ReactNode;
}

// Privy App ID - Get yours at https://console.privy.io
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

// Check if Privy is configured
export const isPrivyConfigured = Boolean(PRIVY_APP_ID && !PRIVY_APP_ID.startsWith('cl'));

export default function PrivyProvider({ children }: PrivyProviderProps) {
  // If Privy is not configured, just render children without auth
  if (!isPrivyConfigured) {
    return <>{children}</>;
  }

  return (
    <PrivyAuthProvider
      appId={PRIVY_APP_ID}
      config={{
        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#0ea5e9', // primary-500
          logo: 'https://lyra.works/logo.svg',
          showWalletLoginFirst: false,
        },
        // Login methods
        loginMethods: ['email', 'wallet', 'google', 'github', 'twitter'],
        // Embedded wallets
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        // Default chain
        defaultChain: {
          id: 11155111, // Sepolia
          name: 'Sepolia',
          network: 'sepolia',
          nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: {
            default: { http: ['https://rpc.sepolia.org'] },
            public: { http: ['https://rpc.sepolia.org'] },
          },
          blockExplorers: {
            default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
          },
        },
        // Supported chains
        supportedChains: [
          // Ethereum Sepolia
          {
            id: 11155111,
            name: 'Sepolia',
            network: 'sepolia',
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://rpc.sepolia.org'] },
              public: { http: ['https://rpc.sepolia.org'] },
            },
            blockExplorers: {
              default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
            },
          },
          // Base Sepolia
          {
            id: 84532,
            name: 'Base Sepolia',
            network: 'base-sepolia',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://sepolia.base.org'] },
              public: { http: ['https://sepolia.base.org'] },
            },
            blockExplorers: {
              default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
            },
          },
          // Polygon Amoy
          {
            id: 80002,
            name: 'Polygon Amoy',
            network: 'polygon-amoy',
            nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://rpc-amoy.polygon.technology'] },
              public: { http: ['https://rpc-amoy.polygon.technology'] },
            },
            blockExplorers: {
              default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' },
            },
          },
        ],
      }}
    >
      {children}
    </PrivyAuthProvider>
  );
}
