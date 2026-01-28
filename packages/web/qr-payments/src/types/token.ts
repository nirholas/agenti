// Token type definitions for QR Pay

import { SupportedChainId } from './chain';

export interface TokenInfo {
  address: string;
  chainId: SupportedChainId;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
  tags?: TokenTag[];
}

export type TokenTag = 
  | 'stablecoin'
  | 'wrapped'
  | 'native'
  | 'governance'
  | 'lp-token'
  | 'bridged'
  | 'verified';

// Token balance with additional metadata
export interface TokenBalance {
  token: TokenInfo;
  balance: string; // Raw balance in smallest unit
  balanceFormatted: string; // Human readable balance
  valueUSD?: string;
  priceUSD?: string;
}

// Token price information
export interface TokenPrice {
  address: string;
  chainId: SupportedChainId;
  priceUSD: string;
  priceChange24h?: number;
  volume24h?: string;
  marketCap?: string;
  lastUpdated: Date;
}

// Token list following Uniswap token list standard
export interface TokenList {
  name: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tags?: Record<string, TagDefinition>;
  tokens: TokenInfo[];
  logoURI?: string;
}

export interface TagDefinition {
  name: string;
  description: string;
}

// Native token configuration per chain
export interface NativeToken {
  chainId: SupportedChainId;
  name: string;
  symbol: string;
  decimals: 18;
  wrappedAddress: string; // WETH, WMATIC, etc.
  logoURI?: string;
}

// Token approval status
export interface TokenApproval {
  tokenAddress: string;
  spenderAddress: string;
  ownerAddress: string;
  allowance: string;
  isUnlimited: boolean;
}

// Token transfer
export interface TokenTransfer {
  token: TokenInfo;
  from: string;
  to: string;
  amount: string;
  txHash?: string;
  blockNumber?: number;
  timestamp?: Date;
}

// Stablecoin configuration
export interface StablecoinConfig {
  symbol: 'USDC' | 'USDT' | 'DAI' | 'FRAX' | 'BUSD';
  addresses: Partial<Record<SupportedChainId, string>>;
  decimals: number;
  isPrimary: boolean; // Primary stablecoin for payments
}

// Popular tokens quick access
export interface PopularToken {
  token: TokenInfo;
  rank: number;
  volume24h: string;
  holders?: number;
}

// Token search result
export interface TokenSearchResult {
  tokens: TokenInfo[];
  query: string;
  chainId?: SupportedChainId;
  totalResults: number;
}

// Token import for custom tokens
export interface TokenImportRequest {
  address: string;
  chainId: SupportedChainId;
  userAddress: string;
}

export interface TokenImportResult {
  success: boolean;
  token?: TokenInfo;
  error?: string;
  isVerified: boolean;
  warning?: string; // e.g., "This token is not verified"
}
