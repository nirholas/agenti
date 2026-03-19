import type { WalletContextState } from "@aptos-labs/wallet-adapter-react";

export interface RegistryInitOptions {
  initEndpoint?: string;
  contractAddress?: string;
  toast?: {
    info: (message: string) => void;
    success: (message: string) => void;
  };
}

/**
 * Hook for handling payment registry initialization
 * Separated from main payment flow for better composability
 */
export async function initializeRegistry(
  wallet: WalletContextState,
  options: RegistryInitOptions = {}
): Promise<void> {
  const {
    initEndpoint = "/api/facilitator/init",
    contractAddress,
    toast,
  } = options;

  if (!wallet.connected || !wallet.account) {
    throw new Error("Wallet not connected");
  }

  const userAddress = wallet.account.address.toString();

  // Check if registry is initialized
  const initResponse = await fetch(initEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userAddress }),
  });

  if (!initResponse.ok) {
    throw new Error("Failed to check payment registry");
  }

  const initResult = await initResponse.json();

  if (!initResult.success) {
    throw new Error("Failed to initialize payment registry");
  }

  if (initResult.requiresTransaction) {
    toast?.info("Setting up your payment account...");

    const contractAddr =
      contractAddress ||
      (typeof window !== "undefined" ? window.X402_CONTRACT_ADDRESS : undefined);

    if (!contractAddr) {
      throw new Error("Payment system not configured");
    }

    if (!wallet.signAndSubmitTransaction) {
      throw new Error("Wallet does not support transactions");
    }

    await wallet.signAndSubmitTransaction({
      data: {
        function: `${contractAddr}::x402_transfer::initialize_registry`,
        functionArguments: [],
      },
    });

    toast?.success("Payment account ready!");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
