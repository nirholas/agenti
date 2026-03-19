import type { Chain } from 'viem';

export const zeroGTestnet = {
    id: 16600,
    name: '0G Galileo Testnet',
    nativeCurrency: {
      decimals: 18,
      name: '0G',
      symbol: 'A0GI',
    },
    rpcUrls: {
      default: {
        http: [process.env.ZG_TESTNET_RPC_URL || 'https://rpc-testnet.0g.ai'],
      },
      public: {
        http: [process.env.ZG_TESTNET_RPC_URL || 'https://rpc-testnet.0g.ai'],
      },
    },
    blockExplorers: {
      default: { name: '0G Explorer', url: 'https://scan-testnet.0g.ai' },
    },
    testnet: true,
} as const satisfies Chain;