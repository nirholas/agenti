import type { SchemeRegistration } from "@x402/fetch";
import type { WalletConfig } from "../config";
import { EvmPrivateKeyWallet } from "./evm-private-key";

export interface Wallet {
  type: string;
  address: string;
  getX402Schemes(): SchemeRegistration[];
}

export function loadWallet(walletConfig: WalletConfig): Wallet {
  switch (walletConfig.type) {
    case "evm-private-key":
      return new EvmPrivateKeyWallet(
        walletConfig.privateKey as `0x${string}`,
        typeof walletConfig.rpcUrl === "string" ? walletConfig.rpcUrl : undefined,
      );
    default:
      throw new Error(`Unknown wallet type: ${walletConfig.type}`);
  }
}
