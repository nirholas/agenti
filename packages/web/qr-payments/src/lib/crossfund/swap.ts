/**
 * CrossFund Core Swap Engine
 * 
 * Main entry point for swap operations
 * Integrates quotes, transactions, and error handling
 */

import { ethers } from 'ethers';
import {
  Token,
  SwapQuote,
  SwapParams,
  SwapResult,
  SwapExecution,
  QuoteRequest,
  QuoteComparison,
  TxnData,
  CrossFundConfig,
  DEFAULT_CONFIG,
} from './types';
import { quoteService, getQuote, getQuotes, USDC_ADDRESSES, SUPPORTED_CHAINS } from './quote';
import { transactionBuilder, transactionExecutor, executeSwap as execSwap } from './transaction';
import { CrossFundError, SwapErrors, parseError, withRetry } from './errors';

// ============= CONSTANTS =============

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Default slippage in basis points (1% = 100 bps)
const DEFAULT_SLIPPAGE_BPS = 100;

// Default deadline in minutes
const DEFAULT_DEADLINE_MINUTES = 15;

// Maximum price impact allowed (5%)
const MAX_PRICE_IMPACT = 5;

// ============= MAIN SWAP CLASS =============

export class CrossFundSwap {
  private config: CrossFundConfig;

  constructor(config: Partial<CrossFundConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get a swap quote
   * 
   * @param inputToken - Token to swap from
   * @param outputToken - Token to receive
   * @param amount - Amount in raw units (wei, etc)
   * @param amountType - Whether amount is input or output
   * @param options - Additional options
   */
  async getQuote(
    inputToken: Token,
    outputToken: Token,
    amount: string,
    amountType: 'inputAmountHuman' | 'outputAmountHuman' = 'inputAmountHuman',
    options: {
      slippageBps?: number;
      deadline?: number;
      userAddress?: string;
    } = {}
  ): Promise<SwapQuote> {
    const request: QuoteRequest = {
      inputToken,
      outputToken,
      amount: this.normalizeAmount(amount, inputToken, amountType),
      amountType,
      slippageBps: options.slippageBps ?? this.config.defaultSlippageBps,
      deadline: options.deadline ?? Date.now() + this.config.defaultDeadlineMinutes * 60 * 1000,
      userAddress: options.userAddress,
    };

    return withRetry(() => getQuote(request));
  }

  /**
   * Get quotes from all aggregators for comparison
   */
  async getQuotes(
    inputToken: Token,
    outputToken: Token,
    amount: string,
    amountType: 'inputAmountHuman' | 'outputAmountHuman' = 'inputAmountHuman',
    options: {
      slippageBps?: number;
      deadline?: number;
      userAddress?: string;
    } = {}
  ): Promise<QuoteComparison> {
    const request: QuoteRequest = {
      inputToken,
      outputToken,
      amount: this.normalizeAmount(amount, inputToken, amountType),
      amountType,
      slippageBps: options.slippageBps ?? this.config.defaultSlippageBps,
      deadline: options.deadline ?? Date.now() + this.config.defaultDeadlineMinutes * 60 * 1000,
      userAddress: options.userAddress,
    };

    return withRetry(() => getQuotes(request));
  }

  /**
   * Execute a swap
   * 
   * @param params - Swap parameters
   * @param signer - Ethers signer for transaction signing
   */
  async executeSwap(
    params: SwapParams,
    signer: ethers.Signer
  ): Promise<SwapResult> {
    // Validate params
    this.validateSwapParams(params);

    // Get quote
    const quote = await this.getQuote(
      params.inputToken,
      params.outputToken,
      params.amount,
      params.amountType,
      {
        slippageBps: params.slippageBps,
        deadline: params.deadline,
        userAddress: params.userAddress,
      }
    );

    // Check price impact
    if (quote.priceImpact > MAX_PRICE_IMPACT) {
      throw SwapErrors.priceImpactTooHigh(quote.priceImpact, MAX_PRICE_IMPACT);
    }

    // Check quote expiry
    if (Date.now() > quote.expiresAt) {
      throw SwapErrors.quoteExpired(quote.id, quote.expiresAt);
    }

    // Execute the swap
    return execSwap(params, quote, signer);
  }

  /**
   * Execute a swap with a pre-obtained quote
   */
  async executeSwapWithQuote(
    params: SwapParams,
    quote: SwapQuote,
    signer: ethers.Signer
  ): Promise<SwapResult> {
    // Validate quote hasn't expired
    if (Date.now() > quote.expiresAt) {
      throw SwapErrors.quoteExpired(quote.id, quote.expiresAt);
    }

    return execSwap(params, quote, signer);
  }

  /**
   * Prepare transactions without executing
   * Useful for showing users what will happen
   */
  async prepareTransactions(
    inputToken: Token,
    outputToken: Token,
    amount: string,
    userAddress: string,
    options: {
      slippageBps?: number;
      recipient?: string;
    } = {}
  ): Promise<{
    quote: SwapQuote;
    transactions: TxnData[];
    estimatedGasTotal: string;
    estimatedCostUsd: number;
  }> {
    const quote = await this.getQuote(
      inputToken,
      outputToken,
      amount,
      'inputAmountHuman',
      { slippageBps: options.slippageBps, userAddress }
    );

    const transactions = await transactionBuilder.buildTransactions(
      quote,
      userAddress,
      options.recipient
    );

    // Calculate total gas
    const estimatedGasTotal = transactions.reduce(
      (sum, tx) => sum + BigInt(tx.estimatedGas),
      0n
    ).toString();

    // Estimate total cost
    const estimatedCostUsd = transactions.length * quote.gasCostUsd;

    return {
      quote,
      transactions,
      estimatedGasTotal,
      estimatedCostUsd,
    };
  }

  /**
   * Check if user needs to approve token spending
   */
  async checkApproval(
    token: Token,
    owner: string,
    amount: string,
    spender: string
  ): Promise<{
    needsApproval: boolean;
    currentAllowance: string;
    requiredAllowance: string;
  }> {
    const needsApproval = await transactionBuilder.checkNeedsApproval(
      token,
      owner,
      amount,
      spender
    );

    return {
      needsApproval,
      currentAllowance: '0', // Would need to fetch from contract
      requiredAllowance: amount,
    };
  }

  /**
   * Get USDC token for a chain
   */
  getUSDC(chainId: number): Token {
    const address = USDC_ADDRESSES[chainId];
    if (!address) {
      throw SwapErrors.unsupportedChain(chainId);
    }

    return {
      address,
      symbol: 'USDC',
      decimals: 6,
      chainId,
      name: 'USD Coin',
    };
  }

  /**
   * Get native token for a chain
   */
  getNativeToken(chainId: number): Token {
    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) {
      throw SwapErrors.unsupportedChain(chainId);
    }

    return {
      address: NATIVE_TOKEN,
      symbol: chain.nativeCurrency,
      decimals: chain.nativeDecimals,
      chainId,
      name: chain.nativeCurrency,
    };
  }

  /**
   * Check if a chain is supported
   */
  isSupportedChain(chainId: number): boolean {
    return !!SUPPORTED_CHAINS[chainId];
  }

  /**
   * Get all supported chain IDs
   */
  getSupportedChains(): number[] {
    return Object.keys(SUPPORTED_CHAINS).map(Number);
  }

  // ============= PRIVATE METHODS =============

  private validateSwapParams(params: SwapParams): void {
    if (!params.inputToken) {
      throw SwapErrors.invalidParams('inputToken', 'Input token is required');
    }

    if (!params.outputToken) {
      throw SwapErrors.invalidParams('outputToken', 'Output token is required');
    }

    if (!params.amount || BigInt(params.amount) <= 0n) {
      throw SwapErrors.invalidParams('amount', 'Amount must be positive');
    }

    if (!params.userAddress || !ethers.isAddress(params.userAddress)) {
      throw SwapErrors.invalidParams('userAddress', 'Valid user address is required');
    }

    if (!this.isSupportedChain(params.inputToken.chainId)) {
      throw SwapErrors.unsupportedChain(params.inputToken.chainId);
    }

    if (!this.isSupportedChain(params.outputToken.chainId)) {
      throw SwapErrors.unsupportedChain(params.outputToken.chainId);
    }
  }

  private normalizeAmount(
    amount: string,
    token: Token,
    amountType: 'inputAmountHuman' | 'outputAmountHuman'
  ): string {
    // If amount looks like it's already in raw units (very large number), return as-is
    if (amount.length > 10 && !amount.includes('.')) {
      return amount;
    }

    // Convert human-readable amount to raw units
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) {
      throw SwapErrors.invalidParams('amount', 'Invalid amount format');
    }

    const rawAmount = BigInt(Math.floor(parsed * Math.pow(10, token.decimals)));
    return rawAmount.toString();
  }
}

// ============= CONVENIENCE FUNCTIONS =============

const defaultSwap = new CrossFundSwap();

/**
 * Get a swap quote
 */
export async function getSwapQuote(
  inputToken: Token,
  outputToken: Token,
  amount: string,
  options?: {
    amountType?: 'inputAmountHuman' | 'outputAmountHuman';
    slippageBps?: number;
    deadline?: number;
    userAddress?: string;
  }
): Promise<SwapQuote> {
  return defaultSwap.getQuote(
    inputToken,
    outputToken,
    amount,
    options?.amountType ?? 'inputAmountHuman',
    options
  );
}

/**
 * Get quotes from all aggregators
 */
export async function getSwapQuotes(
  inputToken: Token,
  outputToken: Token,
  amount: string,
  options?: {
    amountType?: 'inputAmountHuman' | 'outputAmountHuman';
    slippageBps?: number;
    deadline?: number;
    userAddress?: string;
  }
): Promise<QuoteComparison> {
  return defaultSwap.getQuotes(
    inputToken,
    outputToken,
    amount,
    options?.amountType ?? 'inputAmountHuman',
    options
  );
}

/**
 * Execute a swap
 */
export async function executeSwap(
  params: SwapParams,
  signer: ethers.Signer
): Promise<SwapResult> {
  return defaultSwap.executeSwap(params, signer);
}

/**
 * Prepare transactions for a swap
 */
export async function prepareSwapTransactions(
  inputToken: Token,
  outputToken: Token,
  amount: string,
  userAddress: string,
  options?: {
    slippageBps?: number;
    recipient?: string;
  }
): Promise<{
  quote: SwapQuote;
  transactions: TxnData[];
  estimatedGasTotal: string;
  estimatedCostUsd: number;
}> {
  return defaultSwap.prepareTransactions(
    inputToken,
    outputToken,
    amount,
    userAddress,
    options
  );
}

// ============= RE-EXPORTS =============

export { USDC_ADDRESSES, SUPPORTED_CHAINS } from './quote';
