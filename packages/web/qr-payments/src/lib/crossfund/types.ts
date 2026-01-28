/**
 * CrossFund API Types
 * 
 * Complete type definitions for the CrossFund Global Swap API
 */

// ============= CORE TYPES =============

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  name?: string;
  logoURI?: string;
  priceUsd?: number;
}

export interface ChainInfo {
  chainId: number;
  name: string;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorer: string;
  avgBlockTime: number;
  isTestnet: boolean;
}

// ============= QUOTE TYPES =============

export interface QuoteRequest {
  inputToken: Token;
  outputToken: Token;
  amount: string; // Raw amount in smallest unit
  amountType: 'inputAmountHuman' | 'outputAmountHuman';
  slippageBps?: number; // Default 100 = 1%
  deadline?: number; // Unix timestamp, default 15 min
  userAddress?: string;
  referrer?: string;
}

export interface RouteStep {
  protocol: string;
  protocolLogo?: string;
  protocolType: 'dex' | 'dex-aggregator' | 'bridge' | 'bridge-aggregator';
  action: 'swap' | 'bridge' | 'wrap' | 'unwrap' | 'approve';
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  fromChainId: number;
  toChainId: number;
  estimatedGas: string;
  estimatedTime: number; // seconds
  fee?: {
    amount: string;
    token: Token;
    type: 'protocol' | 'bridge' | 'gas';
  };
}

export interface SwapRoute {
  id: string;
  steps: RouteStep[];
  totalSteps: number;
  isCrossChain: boolean;
  bridgeUsed?: string;
  estimatedTime: number; // Total seconds
  estimatedGas: string; // Total gas in wei
}

export interface SwapQuote {
  id: string;
  createdAt: number;
  expiresAt: number;
  
  // Input/Output
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  outputAmount: string;
  outputAmountMin: string; // After slippage
  
  // Pricing
  exchangeRate: string; // 1 input = X output
  priceImpact: number; // Percentage
  inputAmountUsd: number;
  outputAmountUsd: number;
  
  // Route info
  route: SwapRoute;
  aggregator: string;
  
  // Gas
  estimatedGas: string;
  gasCostUsd: number;
  
  // Net value
  netOutputUsd: number; // outputAmountUsd - gasCostUsd
  
  // Slippage
  slippageBps: number;
  
  // Transaction data (if requested)
  txData?: TxnData[];
}

export interface QuoteComparison {
  quotes: SwapQuote[];
  bestQuote: SwapQuote;
  savings: number; // USD saved vs worst quote
  queryTime: number; // ms
  aggregatorsQueried: string[];
  aggregatorsFailed: string[];
}

// ============= TRANSACTION TYPES =============

export interface TxnData {
  id: string;
  type: 'approval' | 'swap' | 'bridge' | 'wrap' | 'unwrap';
  chainId: number;
  to: string;
  from: string;
  data: string;
  value: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  
  // Metadata
  description: string;
  estimatedGas: string;
  tokenApproval?: {
    token: Token;
    spender: string;
    amount: string;
  };
  
  // Execution order
  order: number;
  dependsOn?: string; // Previous txn id
  
  // Status tracking
  status?: 'pending' | 'submitted' | 'confirmed' | 'failed';
  txHash?: string;
  confirmations?: number;
  error?: string;
}

export interface SwapExecution {
  quoteId: string;
  transactions: TxnData[];
  status: 'preparing' | 'approving' | 'swapping' | 'bridging' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  
  // Results
  actualInputAmount?: string;
  actualOutputAmount?: string;
  
  // Timing
  startedAt: number;
  completedAt?: number;
  
  // Cross-chain specific
  sourceTxHash?: string;
  destinationTxHash?: string;
  bridgeStatus?: {
    provider: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    estimatedArrival?: number;
  };
}

// ============= SWAP EXECUTION TYPES =============

export interface SwapParams {
  inputToken: Token;
  outputToken: Token;
  amount: string;
  amountType: 'inputAmountHuman' | 'outputAmountHuman';
  slippageBps?: number;
  deadline?: number;
  userAddress: string;
  recipient?: string; // If different from sender
  referrer?: string;
}

export interface SwapResult {
  success: boolean;
  quoteId: string;
  inputAmount: string;
  outputAmount: string;
  txHashes: string[];
  execution: SwapExecution;
  error?: SwapError;
}

// ============= ERROR TYPES =============

export type SwapErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'INSUFFICIENT_ALLOWANCE'
  | 'SLIPPAGE_EXCEEDED'
  | 'PRICE_IMPACT_TOO_HIGH'
  | 'QUOTE_EXPIRED'
  | 'NO_ROUTE_FOUND'
  | 'BRIDGE_TIMEOUT'
  | 'BRIDGE_FAILED'
  | 'GAS_ESTIMATION_FAILED'
  | 'TRANSACTION_FAILED'
  | 'TRANSACTION_REVERTED'
  | 'USER_REJECTED'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_PARAMS'
  | 'UNSUPPORTED_CHAIN'
  | 'UNSUPPORTED_TOKEN'
  | 'UNKNOWN_ERROR';

export interface SwapError {
  code: SwapErrorCode;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
  suggestedAction?: string;
}

// ============= GAS TYPES =============

export interface GasEstimate {
  chainId: number;
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCostWei: string;
  estimatedCostUsd: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface GasPrices {
  chainId: number;
  timestamp: number;
  slow: {
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    estimatedTime: number;
  };
  standard: {
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    estimatedTime: number;
  };
  fast: {
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    estimatedTime: number;
  };
  nativeTokenPriceUsd: number;
}

// ============= API RESPONSE TYPES =============

export interface CrossFundApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: number;
    latency: number;
  };
}

// ============= CONFIGURATION =============

export interface CrossFundConfig {
  apiKey?: string;
  apiUrl?: string;
  defaultSlippageBps: number;
  defaultDeadlineMinutes: number;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableCache: boolean;
  cacheTtlMs: number;
}

export const DEFAULT_CONFIG: CrossFundConfig = {
  apiUrl: 'https://api.crossfund.io/v1',
  defaultSlippageBps: 100, // 1%
  defaultDeadlineMinutes: 15,
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  enableCache: true,
  cacheTtlMs: 10000,
};
