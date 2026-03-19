'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { AuthProvider } from './auth/auth-provider';
import { SolanaProvider } from './providers/solana-provider';
import { EVMProvider } from './providers/evm-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <EVMProvider>
          <SolanaProvider>
            <AuthProvider>{children}</AuthProvider>
          </SolanaProvider>
        </EVMProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

