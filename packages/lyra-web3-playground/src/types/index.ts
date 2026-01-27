/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Spreading good vibes through good code 🌻
 */

// Core types for the platform

export interface Example {
  id: string;
  title: string;
  description: string;
  category: 'web3' | 'ai' | 'hybrid';
  chain?: 'ethereum' | 'solana' | 'bitcoin' | 'polygon' | 'multi';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  component: React.ComponentType;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  balance: string | null;
  isConnected: boolean;
  provider: any | null;
}

export interface Theme {
  mode: 'light' | 'dark';
  primaryColor: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  walletAddress?: string;
  createdAt: Date;
  preferences: {
    theme: Theme;
    defaultChain: string;
    showTutorials: boolean;
  };
}

export interface CodePlaygroundState {
  code: string;
  language: 'javascript' | 'typescript' | 'solidity' | 'rust';
  output: string;
  isRunning: boolean;
}

export interface AIChat {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}
