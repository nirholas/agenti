import { createConfig, http, cookieStorage, createStorage } from 'wagmi';
import { mainnet, base, polygon } from 'wagmi/chains';
import { injected, metaMask, safe } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [mainnet, base, polygon],
  connectors: [
    injected(),
    metaMask(),
    safe(),
  ],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
  },
});
