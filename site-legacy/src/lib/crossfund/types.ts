/**
 * CrossFund Swap Types
 * Type definitions for the swap engine
 */

export interface SwapQuote {
  aggregator: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  inputAmountHuman: string;
  outputAmountHuman: string;
  priceImpact: number;
  estimatedGas: string;
  gasPrice?: string;
  route?: SwapRoute[];
  txData?: TransactionData;
  validUntil?: number;
}

export interface SwapRoute {
  protocol: string;
  poolAddress: string;
  tokenIn: string;
  tokenOut: string;
  fee?: number;
  percent?: number;
}

export interface TransactionData {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  gasPrice?: string;
  chainId: number;
}

export interface SwapRequest {
  fromChainId: number;
  toChainId: number;
  fromAssetAddress: string;
  toAssetAddress: string;
  inputAmountHuman?: string;
  outputAmountHuman?: string;
  userWalletAddress: string;
  recipient?: string;
  slippage?: number; // percentage, e.g., 0.5 for 0.5%
}

export interface SwapResponse {
  success: boolean;
  quote?: SwapQuote;
  quotes?: SwapQuote[];
  error?: SwapError;
  meta?: {
    requestId: string;
    timestamp: string;
    latency: number;
  };
}

export interface SwapError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type AggregatorName = '0x' | '1inch' | 'paraswap' | 'odos' | 'kyberswap';
