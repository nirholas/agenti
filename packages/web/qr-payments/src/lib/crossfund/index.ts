/**
 * CrossFund - Global Swap API Integration
 * 
 * Complete swap engine supporting:
 * - Multi-aggregator quote comparison
 * - Cross-chain swaps via bridge aggregators
 * - Slippage protection
 * - Gas estimation
 * - Transaction building and execution
 * - Comprehensive error handling
 * 
 * @example
 * ```typescript
 * import { CrossFundSwap, getSwapQuote, executeSwap } from '@/lib/crossfund';
 * 
 * // Get a quote
 * const quote = await getSwapQuote(
 *   { address: '0x...', symbol: 'ETH', decimals: 18, chainId: 1 },
 *   { address: '0x...', symbol: 'USDC', decimals: 6, chainId: 1 },
 *   '1.5', // 1.5 ETH
 *   { slippageBps: 100 }
 * );
 * 
 * // Execute the swap
 * const result = await executeSwap(
 *   {
 *     inputToken: quote.inputToken,
 *     outputToken: quote.outputToken,
 *     amount: quote.inputAmount,
 *     amountType: 'inputAmountHuman',
 *     userAddress: '0x...',
 *   },
 *   signer
 * );
 * ```
 */

// ============= CORE EXPORTS =============

export {
  CrossFundSwap,
  getSwapQuote,
  getSwapQuotes,
  executeSwap,
  prepareSwapTransactions,
  USDC_ADDRESSES,
  SUPPORTED_CHAINS,
} from './swap';

// Constants
export const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const DEFAULT_SLIPPAGE_BPS = 100;
export const DEFAULT_DEADLINE_MINUTES = 15;

// ============= QUOTE EXPORTS =============

export {
  QuoteService,
  quoteService,
  getQuote,
  getQuotes,
  getTokenPrice,
  getGasPrices,
} from './quote';

// ============= TRANSACTION EXPORTS =============

export {
  TransactionBuilder,
  TransactionExecutor,
  transactionBuilder,
  transactionExecutor,
  buildTransactions,
  checkNeedsApproval,
  validateBalance,
} from './transaction';

// ============= ERROR EXPORTS =============

export {
  CrossFundError,
  SwapErrors,
  parseError,
  getRecoveryAction,
  isRetryable,
  withRetry,
  DEFAULT_RETRY_CONFIG,
} from './errors';

// ============= TYPE EXPORTS =============

export type {
  // Core types
  Token,
  ChainInfo,
  
  // Quote types
  QuoteRequest,
  SwapQuote,
  QuoteComparison,
  RouteStep,
  SwapRoute,
  
  // Transaction types
  TxnData,
  SwapExecution,
  SwapParams,
  SwapResult,
  
  // Error types
  SwapError,
  SwapErrorCode,
  
  // Gas types
  GasEstimate,
  GasPrices,
  
  // Config types
  CrossFundConfig,
  CrossFundApiResponse,
} from './types';

// ============= UTILITIES =============

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: string,
  decimals: number,
  displayDecimals: number = 4
): string {
  const value = Number(amount) / Math.pow(10, decimals);
  
  if (value === 0) return '0';
  if (value < 0.0001) return '<0.0001';
  
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  });
}

/**
 * Parse human-readable amount to raw units
 */
export function parseTokenAmount(amount: string, decimals: number): string {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) {
    throw new Error('Invalid amount');
  }
  return BigInt(Math.floor(parsed * Math.pow(10, decimals))).toString();
}

/**
 * Format USD amount
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format price impact percentage
 */
export function formatPriceImpact(impact: number): string {
  if (impact < 0.01) return '<0.01%';
  return `${impact.toFixed(2)}%`;
}

/**
 * Get chain name from ID
 */
export function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    56: 'BNB Chain',
    137: 'Polygon',
    8453: 'Base',
    42161: 'Arbitrum',
    43114: 'Avalanche',
    324: 'zkSync Era',
    250: 'Fantom',
    59144: 'Linea',
    534352: 'Scroll',
  };
  return names[chainId] || `Chain ${chainId}`;
}

/**
 * Get block explorer URL for a transaction
 */
export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    10: 'https://optimistic.etherscan.io',
    56: 'https://bscscan.com',
    137: 'https://polygonscan.com',
    8453: 'https://basescan.org',
    42161: 'https://arbiscan.io',
    43114: 'https://snowtrace.io',
    324: 'https://explorer.zksync.io',
    250: 'https://ftmscan.com',
    59144: 'https://lineascan.build',
    534352: 'https://scrollscan.com',
  };
  
  const explorer = explorers[chainId];
  if (!explorer) return '';
  
  return `${explorer}/tx/${txHash}`;
}

import type { SwapQuote } from './types';

/**
 * Estimate swap time based on route
 */
export function estimateSwapTime(quote: SwapQuote): {
  minSeconds: number;
  maxSeconds: number;
  display: string;
} {
  const isCrossChain = quote.route.isCrossChain;
  
  if (isCrossChain) {
    return {
      minSeconds: 60,
      maxSeconds: 600,
      display: '1-10 minutes',
    };
  }
  
  return {
    minSeconds: 15,
    maxSeconds: 60,
    display: '15-60 seconds',
  };
}
