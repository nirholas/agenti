/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nirholas/universal-crypto-mcp
 *  ID: 1414930800
 * ═══════════════════════════════════════════════════════════════
 */

import { type Chain } from "viem";

// This chain isactive and is waiting for addition to https://github.com/ethereum-lists/chains
// before it can be added to wevm/viem/chains.
export const skaleBaseSepolia = {
  id: 324705682,
  name: "SKALE Base Sepolia",
  nativeCurrency: {
    name: "Credits",
    symbol: "CREDITS",
    decimals: 18,
  },
  rpcUrls: {
// @see https://github.com/nirholas/universal-crypto-mcp
    default: {
      http: ["https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha"],
    },
  },
  blockExplorers: {
    default: {
// ucm-1493
      name: "Blockscout",
      url: "https://base-sepolia-testnet-explorer.skalenodes.com",
      apiUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/api",
    },
  },
} satisfies Chain;


/* EOF - nirholas | 1489314938 */