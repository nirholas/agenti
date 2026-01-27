/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your potential is limitless 🌌
 */

import { create } from 'zustand';
import { WalletState } from '@/types';

interface WalletStore extends WalletState {
  setWallet: (wallet: Partial<WalletState>) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  address: null,
  chainId: null,
  balance: null,
  isConnected: false,
  provider: null,
  setWallet: (wallet) => set((state) => ({ ...state, ...wallet })),
  disconnect: () =>
    set({
      address: null,
      chainId: null,
      balance: null,
      isConnected: false,
      provider: null,
    }),
}));
