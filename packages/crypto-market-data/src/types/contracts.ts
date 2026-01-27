/**
 * Contract and Chain type definitions
 */

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface TestnetConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  faucetUrl: string;
}

export interface ChainConfig {
  id: string;
  name: string;
  icon: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: NativeCurrency;
  testnet?: TestnetConfig;
  compilerVersion: string;
  language: string;
  isEVM: boolean;
  blockTime: number;
  color: string;
  description: string;
  isActive: boolean;
}
