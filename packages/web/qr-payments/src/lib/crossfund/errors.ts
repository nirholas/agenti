/**
 * CrossFund Error Handling
 * 
 * Comprehensive error types and handling for swap operations
 */

import { SwapError, SwapErrorCode } from './types';

// ============= ERROR CLASS =============

export class CrossFundError extends Error {
  public readonly code: SwapErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly recoverable: boolean;
  public readonly suggestedAction?: string;
  public readonly timestamp: number;

  constructor(error: SwapError) {
    super(error.message);
    this.name = 'CrossFundError';
    this.code = error.code;
    this.details = error.details;
    this.recoverable = error.recoverable;
    this.suggestedAction = error.suggestedAction;
    this.timestamp = Date.now();
    
    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CrossFundError);
    }
  }

  toJSON(): SwapError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      suggestedAction: this.suggestedAction,
    };
  }
}

// ============= ERROR FACTORIES =============

export const SwapErrors = {
  insufficientBalance(
    tokenSymbol: string,
    required: string,
    available: string
  ): CrossFundError {
    return new CrossFundError({
      code: 'INSUFFICIENT_BALANCE',
      message: `Insufficient ${tokenSymbol} balance. Required: ${required}, Available: ${available}`,
      details: { tokenSymbol, required, available },
      recoverable: false,
      suggestedAction: `Please add more ${tokenSymbol} to your wallet`,
    });
  },

  insufficientAllowance(
    tokenSymbol: string,
    spender: string,
    required: string,
    current: string
  ): CrossFundError {
    return new CrossFundError({
      code: 'INSUFFICIENT_ALLOWANCE',
      message: `Insufficient ${tokenSymbol} allowance for spender`,
      details: { tokenSymbol, spender, required, current },
      recoverable: true,
      suggestedAction: 'Approve token spending before swapping',
    });
  },

  slippageExceeded(
    expectedOutput: string,
    actualOutput: string,
    slippageBps: number
  ): CrossFundError {
    return new CrossFundError({
      code: 'SLIPPAGE_EXCEEDED',
      message: `Slippage exceeded. Expected minimum: ${expectedOutput}, Got: ${actualOutput}`,
      details: { expectedOutput, actualOutput, slippageBps },
      recoverable: true,
      suggestedAction: 'Increase slippage tolerance or try again with a smaller amount',
    });
  },

  priceImpactTooHigh(
    priceImpact: number,
    maxPriceImpact: number
  ): CrossFundError {
    return new CrossFundError({
      code: 'PRICE_IMPACT_TOO_HIGH',
      message: `Price impact too high: ${priceImpact.toFixed(2)}% (max: ${maxPriceImpact}%)`,
      details: { priceImpact, maxPriceImpact },
      recoverable: true,
      suggestedAction: 'Try swapping a smaller amount or use a different route',
    });
  },

  quoteExpired(quoteId: string, expiresAt: number): CrossFundError {
    return new CrossFundError({
      code: 'QUOTE_EXPIRED',
      message: 'Quote has expired. Please request a new quote.',
      details: { quoteId, expiresAt, expiredAt: Date.now() },
      recoverable: true,
      suggestedAction: 'Request a fresh quote and try again',
    });
  },

  noRouteFound(
    inputToken: string,
    outputToken: string,
    inputChain: number,
    outputChain: number
  ): CrossFundError {
    return new CrossFundError({
      code: 'NO_ROUTE_FOUND',
      message: `No swap route found from ${inputToken} to ${outputToken}`,
      details: { inputToken, outputToken, inputChain, outputChain },
      recoverable: false,
      suggestedAction: 'Try a different token pair or check if the tokens are supported',
    });
  },

  bridgeTimeout(
    bridgeProvider: string,
    sourceTxHash: string,
    waitTimeMs: number
  ): CrossFundError {
    return new CrossFundError({
      code: 'BRIDGE_TIMEOUT',
      message: `Bridge transaction timed out after ${Math.round(waitTimeMs / 1000)}s`,
      details: { bridgeProvider, sourceTxHash, waitTimeMs },
      recoverable: true,
      suggestedAction: 'Wait and check the bridge status manually, or contact support',
    });
  },

  bridgeFailed(
    bridgeProvider: string,
    reason: string,
    sourceTxHash?: string
  ): CrossFundError {
    return new CrossFundError({
      code: 'BRIDGE_FAILED',
      message: `Bridge transaction failed: ${reason}`,
      details: { bridgeProvider, reason, sourceTxHash },
      recoverable: false,
      suggestedAction: 'Contact bridge support with the transaction hash',
    });
  },

  gasEstimationFailed(
    chainId: number,
    reason: string
  ): CrossFundError {
    return new CrossFundError({
      code: 'GAS_ESTIMATION_FAILED',
      message: `Failed to estimate gas: ${reason}`,
      details: { chainId, reason },
      recoverable: true,
      suggestedAction: 'Try again or manually set gas limit',
    });
  },

  transactionFailed(
    txHash: string,
    chainId: number,
    reason?: string
  ): CrossFundError {
    return new CrossFundError({
      code: 'TRANSACTION_FAILED',
      message: reason || 'Transaction failed to execute',
      details: { txHash, chainId, reason },
      recoverable: false,
      suggestedAction: 'Check the transaction on the block explorer for details',
    });
  },

  transactionReverted(
    txHash: string,
    chainId: number,
    revertReason?: string
  ): CrossFundError {
    return new CrossFundError({
      code: 'TRANSACTION_REVERTED',
      message: `Transaction reverted: ${revertReason || 'Unknown reason'}`,
      details: { txHash, chainId, revertReason },
      recoverable: false,
      suggestedAction: 'Check slippage settings and token allowances',
    });
  },

  userRejected(): CrossFundError {
    return new CrossFundError({
      code: 'USER_REJECTED',
      message: 'Transaction was rejected by user',
      details: {},
      recoverable: true,
      suggestedAction: 'Try again when ready',
    });
  },

  networkError(
    chainId: number,
    message: string
  ): CrossFundError {
    return new CrossFundError({
      code: 'NETWORK_ERROR',
      message: `Network error on chain ${chainId}: ${message}`,
      details: { chainId, message },
      recoverable: true,
      suggestedAction: 'Check your network connection and try again',
    });
  },

  apiError(
    statusCode: number,
    message: string,
    requestId?: string
  ): CrossFundError {
    return new CrossFundError({
      code: 'API_ERROR',
      message: `API error (${statusCode}): ${message}`,
      details: { statusCode, message, requestId },
      recoverable: statusCode >= 500,
      suggestedAction: statusCode >= 500 
        ? 'Wait a moment and try again' 
        : 'Check your request parameters',
    });
  },

  rateLimited(
    retryAfterMs: number
  ): CrossFundError {
    return new CrossFundError({
      code: 'RATE_LIMITED',
      message: `Rate limited. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds`,
      details: { retryAfterMs },
      recoverable: true,
      suggestedAction: `Wait ${Math.ceil(retryAfterMs / 1000)} seconds before trying again`,
    });
  },

  invalidParams(
    paramName: string,
    message: string
  ): CrossFundError {
    return new CrossFundError({
      code: 'INVALID_PARAMS',
      message: `Invalid parameter '${paramName}': ${message}`,
      details: { paramName, message },
      recoverable: false,
      suggestedAction: 'Check the parameter value and try again',
    });
  },

  unsupportedChain(chainId: number): CrossFundError {
    return new CrossFundError({
      code: 'UNSUPPORTED_CHAIN',
      message: `Chain ${chainId} is not supported`,
      details: { chainId },
      recoverable: false,
      suggestedAction: 'Use a supported chain',
    });
  },

  unsupportedToken(
    tokenAddress: string,
    chainId: number
  ): CrossFundError {
    return new CrossFundError({
      code: 'UNSUPPORTED_TOKEN',
      message: `Token ${tokenAddress} on chain ${chainId} is not supported`,
      details: { tokenAddress, chainId },
      recoverable: false,
      suggestedAction: 'Use a different token',
    });
  },

  unknown(
    message: string,
    details?: Record<string, unknown>
  ): CrossFundError {
    return new CrossFundError({
      code: 'UNKNOWN_ERROR',
      message: message || 'An unknown error occurred',
      details,
      recoverable: false,
      suggestedAction: 'Please try again or contact support',
    });
  },
};

// ============= ERROR PARSING =============

/**
 * Parse various error types into CrossFundError
 */
export function parseError(error: unknown): CrossFundError {
  // Already a CrossFundError
  if (error instanceof CrossFundError) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Parse common error patterns
    if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
      return SwapErrors.insufficientBalance('Token', 'unknown', 'unknown');
    }

    if (message.includes('user rejected') || message.includes('user denied')) {
      return SwapErrors.userRejected();
    }

    if (message.includes('execution reverted')) {
      const revertReason = extractRevertReason(error.message);
      return SwapErrors.transactionReverted('', 0, revertReason);
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return SwapErrors.networkError(0, 'Request timed out');
    }

    if (message.includes('network') || message.includes('connection')) {
      return SwapErrors.networkError(0, error.message);
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return SwapErrors.rateLimited(60000);
    }

    if (message.includes('slippage')) {
      return SwapErrors.slippageExceeded('unknown', 'unknown', 0);
    }

    return SwapErrors.unknown(error.message);
  }

  // Unknown error type
  return SwapErrors.unknown(String(error));
}

/**
 * Extract revert reason from error message
 */
function extractRevertReason(message: string): string | undefined {
  // Common patterns for revert reasons
  const patterns = [
    /execution reverted: (.+)/i,
    /revert: (.+)/i,
    /reason: (.+)/i,
    /error: (.+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

// ============= ERROR RECOVERY =============

export interface RecoveryAction {
  action: 'retry' | 'increase_slippage' | 'approve' | 'add_funds' | 'wait' | 'abort';
  message: string;
  params?: Record<string, unknown>;
}

/**
 * Get recovery action for an error
 */
export function getRecoveryAction(error: CrossFundError): RecoveryAction {
  switch (error.code) {
    case 'INSUFFICIENT_BALANCE':
      return {
        action: 'add_funds',
        message: 'Add more tokens to your wallet',
        params: { tokenSymbol: error.details?.tokenSymbol },
      };

    case 'INSUFFICIENT_ALLOWANCE':
      return {
        action: 'approve',
        message: 'Approve token spending',
        params: {
          token: error.details?.tokenSymbol,
          spender: error.details?.spender,
          amount: error.details?.required,
        },
      };

    case 'SLIPPAGE_EXCEEDED':
      return {
        action: 'increase_slippage',
        message: 'Increase slippage tolerance',
        params: { suggestedSlippage: 200 }, // 2%
      };

    case 'PRICE_IMPACT_TOO_HIGH':
      return {
        action: 'retry',
        message: 'Try with a smaller amount',
      };

    case 'QUOTE_EXPIRED':
      return {
        action: 'retry',
        message: 'Request a new quote',
      };

    case 'RATE_LIMITED':
      return {
        action: 'wait',
        message: 'Wait before retrying',
        params: { waitMs: error.details?.retryAfterMs },
      };

    case 'BRIDGE_TIMEOUT':
      return {
        action: 'wait',
        message: 'Check bridge status manually',
        params: { sourceTxHash: error.details?.sourceTxHash },
      };

    case 'NETWORK_ERROR':
    case 'API_ERROR':
      return {
        action: 'retry',
        message: 'Try again',
      };

    case 'USER_REJECTED':
      return {
        action: 'retry',
        message: 'Confirm the transaction when ready',
      };

    default:
      return {
        action: 'abort',
        message: error.suggestedAction || 'Unable to recover from this error',
      };
  }
}

// ============= RETRY LOGIC =============

export interface RetryConfig {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  retryableErrors: SwapErrorCode[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
  retryableErrors: [
    'NETWORK_ERROR',
    'API_ERROR',
    'RATE_LIMITED',
    'GAS_ESTIMATION_FAILED',
  ],
};

/**
 * Check if an error is retryable
 */
export function isRetryable(error: CrossFundError, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  return error.recoverable && config.retryableErrors.includes(error.code);
}

/**
 * Execute with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: CrossFundError | undefined;
  let delay = config.delayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseError(error);

      if (!isRetryable(lastError, config) || attempt === config.maxRetries) {
        throw lastError;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError || SwapErrors.unknown('Max retries exceeded');
}
