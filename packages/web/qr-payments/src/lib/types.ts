// Core types for QR Pay

// Supported EVM chain IDs
export type ChainId = 
  | 1      // Ethereum
  | 10     // Optimism
  | 56     // BSC
  | 100    // Gnosis
  | 137    // Polygon
  | 250    // Fantom
  | 324    // zkSync Era
  | 8453   // Base
  | 42161  // Arbitrum One
  | 42170  // Arbitrum Nova
  | 43114  // Avalanche
  | 59144  // Linea
  | 534352 // Scroll
  | 81457  // Blast
  | 5000   // Mantle
  | 34443  // Mode
  | number; // Allow other chain IDs

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  name?: string;
}

export interface PaymentRequest {
  id: string;
  recipient: string; // wallet address
  recipientUsername?: string; // @handle
  amount?: string; // optional fixed amount in USDC
  memo?: string;
  chainId: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface SwapQuote {
  inputToken: Token;
  outputToken: Token; // always USDC
  inputAmount: string;
  outputAmount: string;
  route: string;
  priceImpact: number;
  estimatedGas: string;
  aggregator: 'zerox' | 'oneinch' | 'paraswap';
}

export interface PaymentTransaction {
  id: string;
  paymentRequestId: string;
  sender: string;
  recipient: string;
  inputToken: Token;
  inputAmount: string;
  outputAmount: string; // USDC received
  txHash: string;
  chainId: number;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
  confirmedAt?: Date;
}

export interface UserProfile {
  walletAddress: string;
  username?: string; // X handle
  xVerified: boolean;
  defaultChainId: number;
  totalReceived: string; // cumulative USDC
  createdAt: Date;
}

export interface QRCodeData {
  version: 1;
  type: 'payment';
  recipient: string;
  username?: string;
  amount?: string;
  chainId: number;
  memo?: string;
}
