import type { Chain } from "viem";

export const skaleBaseSepolia = {
    id: 324705682,
    name: "SKALE Base Sepolia",
    rpcUrls: {
      default: {
        http: [
          "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
        ],
      },
    },
    blockExplorers: {
      default: {
        name: "Blockscout",
        url: "https://base-sepolia-testnet-explorer.skalenodes.com",
      },
    },
    nativeCurrency: {
      name: "Credits",
      decimals: 18,
      symbol: "CREDIT",
    },
}