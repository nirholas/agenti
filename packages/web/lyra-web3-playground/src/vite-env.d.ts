/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every bug fixed is a lesson learned 🎓
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_INFURA_API_KEY?: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
  readonly VITE_QUICKNODE_ENDPOINT?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_ANTHROPIC_API_KEY?: string;
  readonly VITE_PLAUSIBLE_DOMAIN?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_ENABLE_AI_FEATURES?: string;
  readonly VITE_ENABLE_PREMIUM_FEATURES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Ethereum provider types
interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
  selectedAddress?: string | null;
  chainId?: string;
}

interface Window {
  ethereum?: EthereumProvider;
}
