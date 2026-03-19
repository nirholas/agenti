import type { Chain } from "viem";
import { base } from "viem/chains";

export interface ChainConfig {
  chainId: number;
  network: string;
  chain: Chain;
  usdc: `0x${string}`;
  usdcDecimals: number;
}

const chains: Record<string, ChainConfig> = {
  base: {
    chainId: base.id, // 8453
    network: `eip155:${base.id}`,
    chain: base,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
  },
};

export function getChainConfig(name: string = "base"): ChainConfig {
  const config = chains[name];
  if (!config) {
    throw new Error(`Unsupported chain: "${name}". Supported chains: ${Object.keys(chains).join(", ")}`);
  }
  return config;
}

/** Resolve a chain config from an EIP-155 network identifier (e.g. "eip155:8453"). */
export function getChainConfigByNetwork(network: string): ChainConfig {
  const config = Object.values(chains).find((c) => c.network === network);
  if (!config) {
    const supported = Object.values(chains)
      .map((c) => c.network)
      .join(", ");
    throw new Error(`Unsupported network: "${network}". Supported networks: ${supported}`);
  }
  return config;
}
