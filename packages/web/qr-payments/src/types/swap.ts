// Swap type definitions for QR Pay
// Based on CrossFund Global Swap API

import { SupportedChainId } from './chain';
import { TokenInfo } from './token';

// Request to get a swap quote
export interface SwapRequest {
  fromChainId: SupportedChainId;
  fromAssetAddress: string;
  toChainId: SupportedChainId;
  toAssetAddress: string;
  inputAmountHuman?: string; // Amount in human readable format (e.g., "1.5")
  outputAmountHuman?: string; // For exact output swaps
  userWalletAddress: string;
  recipient?: string; // If different from userWalletAddress
  slippage?: number; // In percentage (e.g., 0.5 for 0.5%)
  deadline?: number; // Unix timestamp
  referrer?: string; // Referral address for fee sharing
}

// Response from swap quote
export interface SwapResponse {
  route: TxnData[];
  output: {
    amount: string;
    minimumAmount: string;
    token: TokenInfo;
  };
  input: {
    amount: string;
    token: TokenInfo;
  };
  swapTime: number; // Estimated time in seconds
  deadline: number; // Unix timestamp
  slippage: number;
  fees: SwapFees;
  priceImpact: number; // Percentage
  exchangeRate: string; // Input token per output token
}

export interface TxnData {
  to: string;
  data: string;
  value: string;
  chainId: SupportedChainId;
  gasLimit?: string;
  type: 'approval' | 'swap' | 'bridge';
  description?: string; // Human readable description
}

export interface SwapFees {
  gas: string; // In native token (wei)
  gasUSD: string;
  protocol: string; // Protocol fee in output token
  protocolUSD: string;
  bridge?: string; // Bridge fee if cross-chain
  bridgeUSD?: string;
  total: string; // Total fees in USD
}

// Swap execution request
export interface SwapExecuteRequest {
  swapRequest: SwapRequest;
  transactions: TxnData[];
  signature?: string; // For permit-based approvals
}

// Swap execution result
export interface SwapExecuteResult {
  success: boolean;
  transactions: TransactionResult[];
  totalGasUsed: string;
  totalGasUSD: string;
  actualOutput?: {
    amount: string;
    token: TokenInfo;
  };
  error?: SwapError;
}

export interface TransactionResult {
  hash: string;
  chainId: SupportedChainId;
  type: 'approval' | 'swap' | 'bridge';
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  blockNumber?: number;
  timestamp?: Date;
}

export interface SwapError {
  code: SwapErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type SwapErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'INSUFFICIENT_ALLOWANCE'
  | 'SLIPPAGE_EXCEEDED'
  | 'DEADLINE_EXCEEDED'
  | 'ROUTE_NOT_FOUND'
  | 'LIQUIDITY_INSUFFICIENT'
  | 'GAS_ESTIMATION_FAILED'
  | 'BRIDGE_ERROR'
  | 'NETWORK_ERROR'
  | 'USER_REJECTED'
  | 'UNKNOWN_ERROR';

// Aggregator source for routing
export type SwapAggregator =
  | '0x'
  | '1inch'
  | 'paraswap'
  | 'kyberswap'
  | 'openocean'
  | 'odos'
  | 'crossfund';

// Route information
export interface SwapRoute {
  aggregator: SwapAggregator;
  path: RouteHop[];
  estimatedGas: string;
  priceImpact: number;
  isBestRoute: boolean;
}

export interface RouteHop {
  protocol: string; // e.g., "Uniswap V3", "Curve"
  poolAddress: string;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  amountOut: string;
  fee?: number; // Pool fee in bps
}

// Cross-chain swap specific
export interface CrossChainSwapInfo {
  sourceChain: SupportedChainId;
  destinationChain: SupportedChainId;
  bridgeProtocol: string; // e.g., "Stargate", "Hop", "Across"
  estimatedBridgeTime: number; // in minutes
  bridgeFee: string;
  requiresConfirmation: boolean;
  confirmationsRequired?: number;
}

// Swap quote comparison
export interface SwapQuoteComparison {
  quotes: SwapResponse[];
  bestQuote: SwapResponse;
  comparisonTimestamp: Date;
  reasoning: string; // Why this is the best quote
}

// Swap settings/preferences
export interface SwapSettings {
  slippageTolerance: number;
  deadline: number; // Minutes from now
  gasSpeed: 'slow' | 'standard' | 'fast' | 'instant';
  enableMultiHop: boolean;
  maxHops: number;
  preferredAggregators: SwapAggregator[];
  autoApprove: boolean;
}

// Swap transaction history item
export interface SwapHistoryItem {
  id: string;
  swapRequest: SwapRequest;
  result: SwapExecuteResult;
  createdAt: Date;
  completedAt?: Date;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
}
