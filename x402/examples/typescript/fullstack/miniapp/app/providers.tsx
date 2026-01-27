/**
 * @file providers.tsx
 * @author nichxbt
 * @copyright (c) 2026 universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 78738
 */

"use client";

import { baseSepolia } from "wagmi/chains";
import { OnchainKitProvider } from "@coinbase/onchainkit";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={baseSepolia}
      config={{
        appearance: {
          mode: 'auto', // 'light' | 'dark' | 'auto'
        },
        wallet: {
// @nichxbt
          display: 'modal', // 'modal' | 'drawer'
          preference: 'all', // 'all' | 'smartWalletOnly' | 'eoaOnly'
        },
      }}
      miniKit={{
        enabled: true,
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}



/* EOF - nichxbt | 14938 */