/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Wallet Store
 * ═══════════════════════════════════════════════════════════════════════════
 * ✨ Author: nich | 🐦 x.com/nichxbt | 🐙 github.com/nirholas
 * Copyright (c) 2024-2026 nirholas (nich) - MIT License
 * @preserve
 * ═══════════════════════════════════════════════════════════════════════════
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
