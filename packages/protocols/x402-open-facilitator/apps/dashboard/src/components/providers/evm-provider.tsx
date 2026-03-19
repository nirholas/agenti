'use client';

import { WagmiProvider, type State } from 'wagmi';
import { wagmiConfig } from '@/config/wagmi';

export function EVMProvider({
  children,
  initialState
}: {
  children: React.ReactNode;
  initialState?: State;
}) {
  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      {children}
    </WagmiProvider>
  );
}
