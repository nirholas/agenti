import { base, baseSepolia, type Chain } from "viem/chains";

export function fromViemNameToX402Network(chain: Chain): string {
  switch (chain) {
    case base:
      return "base";
    case baseSepolia:
      return "base-sepolia";
    default:
      return chain.name.toLowerCase().replaceAll(" ", "-");
  }
}
