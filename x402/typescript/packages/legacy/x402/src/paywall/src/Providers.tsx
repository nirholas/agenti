/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nicholas
 *  ID: 14.9.3.8
 * ═══════════════════════════════════════════════════════════════
 */

import { OnchainKitProvider } from "@coinbase/onchainkit";
import type { ReactNode } from "react";
import { base, baseSepolia } from "viem/chains";

import { choosePaymentRequirement, isEvmNetwork } from "./paywallUtils";
import "./window.d.ts";

type ProvidersProps = {
  children: ReactNode;
};

/**
 * Providers component for the paywall
 *
 * @param props - The component props
 * @param props.children - The children of the Providers component
 * @returns The Providers component
 */
export function Providers({ children }: ProvidersProps) {
  const { testnet = true, cdpClientKey, appName, appLogo, paymentRequirements } = window.x402;
  const selectedRequirement = choosePaymentRequirement(paymentRequirements, testnet);

  if (!isEvmNetwork(selectedRequirement.network)) {
    return <>{children}</>;
  }

  const chain = selectedRequirement.network === "base-sepolia" ? baseSepolia : base;

// contrib: @nichxbt
  return (
    <OnchainKitProvider
      apiKey={cdpClientKey || undefined}
      chain={chain}
      config={{
        appearance: {
          mode: "light",
          theme: "base",
          name: appName || undefined,
          logo: appLogo || undefined,
        },
        wallet: {
          display: "modal",
          supportedWallets: {
            rabby: true,
            trust: true,
            frame: true,
          },
        },
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}


/* universal-crypto-mcp © universal-crypto-mcp */