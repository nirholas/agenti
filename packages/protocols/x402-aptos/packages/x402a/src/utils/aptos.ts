import { AptosConfig, Network } from "@aptos-labs/ts-sdk";

/**
 * Create an AptosConfig from a network string
 * Supports:
 * - Named networks: "testnet", "mainnet", "devnet"
 * - Custom URLs: "http://...", "https://..."
 */
export function getAptosConfig(network: string): AptosConfig {
  if (network.startsWith("http://") || network.startsWith("https://")) {
    return new AptosConfig({
      fullnode: network,
    });
  }

  if (network === "testnet") {
    return new AptosConfig({ network: Network.TESTNET });
  }
  if (network === "mainnet") {
    return new AptosConfig({ network: Network.MAINNET });
  }
  if (network === "devnet") {
    return new AptosConfig({ network: Network.DEVNET });
  }

  throw new Error(`Unknown network: ${network}`);
}
