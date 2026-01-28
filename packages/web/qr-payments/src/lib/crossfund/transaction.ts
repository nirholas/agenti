/**
 * CrossFund Transaction Builder
 * 
 * Handles approval, swap, and bridge transactions
 * Sequential execution with status tracking
 */

import { ethers } from 'ethers';
import {
  Token,
  TxnData,
  SwapQuote,
  SwapExecution,
  SwapParams,
  SwapResult,
  GasPrices,
} from './types';
import { CrossFundError, SwapErrors, parseError } from './errors';
import { quoteService, SUPPORTED_CHAINS, USDC_ADDRESSES } from './quote';

// ============= CONSTANTS =============

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

// ERC20 ABI for approvals
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

// Standard swap router ABI
const SWAP_ROUTER_ABI = [
  'function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address recipient, uint256 deadline) external payable returns (uint256 amountOut)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
];

// ============= RPC PROVIDERS =============

const RPC_ENDPOINTS: Record<number, string[]> = {
  1: [
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
  ],
  10: [
    `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    'https://optimism.llamarpc.com',
    'https://mainnet.optimism.io',
  ],
  56: [
    'https://bsc-dataseed.binance.org',
    'https://bsc.llamarpc.com',
  ],
  137: [
    `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    'https://polygon.llamarpc.com',
    'https://polygon-rpc.com',
  ],
  8453: [
    `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    'https://base.llamarpc.com',
    'https://mainnet.base.org',
  ],
  42161: [
    `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    'https://arbitrum.llamarpc.com',
    'https://arb1.arbitrum.io/rpc',
  ],
  43114: [
    `https://avalanche-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    'https://avalanche.llamarpc.com',
    'https://api.avax.network/ext/bc/C/rpc',
  ],
  324: [
    'https://mainnet.era.zksync.io',
    'https://zksync.drpc.org',
  ],
  250: [
    'https://rpc.ftm.tools',
    'https://rpc.ankr.com/fantom',
  ],
  59144: [
    'https://rpc.linea.build',
    'https://linea.drpc.org',
  ],
  534352: [
    'https://rpc.scroll.io',
    'https://scroll.drpc.org',
  ],
};

// ============= PROVIDER MANAGEMENT =============

class ProviderManager {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();

  getProvider(chainId: number): ethers.JsonRpcProvider {
    let provider = this.providers.get(chainId);
    if (provider) return provider;

    const rpcs = RPC_ENDPOINTS[chainId];
    if (!rpcs || rpcs.length === 0) {
      throw SwapErrors.unsupportedChain(chainId);
    }

    // Try each RPC until one works
    for (const rpc of rpcs) {
      if (rpc.includes('undefined')) continue;
      try {
        provider = new ethers.JsonRpcProvider(rpc, chainId);
        this.providers.set(chainId, provider);
        return provider;
      } catch (e) {
        continue;
      }
    }

    throw SwapErrors.networkError(chainId, 'No available RPC endpoint');
  }

  clearProvider(chainId: number): void {
    this.providers.delete(chainId);
  }
}

const providerManager = new ProviderManager();

// ============= TRANSACTION BUILDER =============

export class TransactionBuilder {
  /**
   * Build all transactions needed for a swap
   */
  async buildTransactions(
    quote: SwapQuote,
    userAddress: string,
    recipient?: string
  ): Promise<TxnData[]> {
    const transactions: TxnData[] = [];
    const targetAddress = recipient || userAddress;

    // Check if approval is needed
    const needsApproval = await this.checkNeedsApproval(
      quote.inputToken,
      userAddress,
      quote.inputAmount,
      quote.txData?.[0]?.to || ''
    );

    if (needsApproval) {
      const approvalTx = await this.buildApprovalTransaction(
        quote.inputToken,
        userAddress,
        quote.txData?.[0]?.to || '',
        quote.inputAmount
      );
      transactions.push(approvalTx);
    }

    // Build swap transaction(s)
    if (quote.txData && quote.txData.length > 0) {
      // Use pre-built transaction data from quote
      for (let i = 0; i < quote.txData.length; i++) {
        const txData = quote.txData[i];
        transactions.push({
          ...txData,
          from: userAddress,
          order: transactions.length,
          dependsOn: transactions.length > 0 ? transactions[transactions.length - 1].id : undefined,
        });
      }
    } else {
      // Build transaction from scratch
      const swapTx = await this.buildSwapTransaction(quote, userAddress, targetAddress);
      transactions.push(swapTx);
    }

    return transactions;
  }

  /**
   * Check if token approval is needed
   */
  async checkNeedsApproval(
    token: Token,
    owner: string,
    amount: string,
    spender: string
  ): Promise<boolean> {
    // Native tokens don't need approval
    if (this.isNativeToken(token.address)) {
      return false;
    }

    if (!spender || spender === ethers.ZeroAddress) {
      return false;
    }

    const provider = providerManager.getProvider(token.chainId);
    const contract = new ethers.Contract(token.address, ERC20_ABI, provider);

    try {
      const allowance = await contract.allowance(owner, spender);
      return BigInt(allowance) < BigInt(amount);
    } catch (error) {
      console.warn('Failed to check allowance:', error);
      return true; // Assume approval needed if we can't check
    }
  }

  /**
   * Build approval transaction
   */
  async buildApprovalTransaction(
    token: Token,
    owner: string,
    spender: string,
    amount: string
  ): Promise<TxnData> {
    const provider = providerManager.getProvider(token.chainId);
    const contract = new ethers.Contract(token.address, ERC20_ABI, provider);

    // Use MAX_UINT256 for infinite approval (common practice, saves gas on future swaps)
    // Or use exact amount for more security-conscious users
    const approvalAmount = MAX_UINT256;

    const data = contract.interface.encodeFunctionData('approve', [spender, approvalAmount]);

    // Estimate gas
    const gasEstimate = await provider.estimateGas({
      from: owner,
      to: token.address,
      data,
    });

    const gasPrices = await quoteService.getGasPrices(token.chainId);

    return {
      id: `approval-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'approval',
      chainId: token.chainId,
      to: token.address,
      from: owner,
      data,
      value: '0',
      gasLimit: (gasEstimate * 120n / 100n).toString(), // 20% buffer
      gasPrice: gasPrices.standard.gasPrice,
      maxFeePerGas: gasPrices.standard.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.standard.maxPriorityFeePerGas,
      description: `Approve ${token.symbol} for trading`,
      estimatedGas: gasEstimate.toString(),
      tokenApproval: {
        token,
        spender,
        amount: approvalAmount,
      },
      order: 0,
    };
  }

  /**
   * Build swap transaction
   */
  async buildSwapTransaction(
    quote: SwapQuote,
    userAddress: string,
    recipient: string
  ): Promise<TxnData> {
    const provider = providerManager.getProvider(quote.inputToken.chainId);
    const gasPrices = await quoteService.getGasPrices(quote.inputToken.chainId);

    const isCrossChain = quote.route.isCrossChain;
    const isNativeInput = this.isNativeToken(quote.inputToken.address);

    // For direct aggregator quotes, we should have txData
    // This is a fallback for building generic swap transactions
    const deadline = Math.floor(Date.now() / 1000) + 900; // 15 minutes

    return {
      id: `swap-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: isCrossChain ? 'bridge' : 'swap',
      chainId: quote.inputToken.chainId,
      to: quote.txData?.[0]?.to || '',
      from: userAddress,
      data: quote.txData?.[0]?.data || '',
      value: isNativeInput ? quote.inputAmount : '0',
      gasLimit: quote.estimatedGas,
      gasPrice: gasPrices.standard.gasPrice,
      maxFeePerGas: gasPrices.standard.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.standard.maxPriorityFeePerGas,
      description: isCrossChain
        ? `Bridge ${quote.inputToken.symbol} to ${quote.outputToken.symbol}`
        : `Swap ${quote.inputToken.symbol} for ${quote.outputToken.symbol}`,
      estimatedGas: quote.estimatedGas,
      order: 0,
    };
  }

  /**
   * Build wrap/unwrap transaction for native tokens
   */
  async buildWrapTransaction(
    chainId: number,
    userAddress: string,
    amount: string,
    isWrap: boolean
  ): Promise<TxnData> {
    const wethAddresses: Record<number, string> = {
      1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      10: '0x4200000000000000000000000000000000000006',
      137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      8453: '0x4200000000000000000000000000000000000006',
      42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    };

    const wethAddress = wethAddresses[chainId];
    if (!wethAddress) {
      throw SwapErrors.unsupportedChain(chainId);
    }

    const provider = providerManager.getProvider(chainId);
    const wethAbi = isWrap
      ? ['function deposit() payable']
      : ['function withdraw(uint256 wad)'];
    const contract = new ethers.Contract(wethAddress, wethAbi, provider);

    const data = isWrap
      ? contract.interface.encodeFunctionData('deposit', [])
      : contract.interface.encodeFunctionData('withdraw', [amount]);

    const gasPrices = await quoteService.getGasPrices(chainId);

    return {
      id: `${isWrap ? 'wrap' : 'unwrap'}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: isWrap ? 'wrap' : 'unwrap',
      chainId,
      to: wethAddress,
      from: userAddress,
      data,
      value: isWrap ? amount : '0',
      gasLimit: '50000',
      gasPrice: gasPrices.standard.gasPrice,
      maxFeePerGas: gasPrices.standard.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.standard.maxPriorityFeePerGas,
      description: isWrap ? 'Wrap ETH to WETH' : 'Unwrap WETH to ETH',
      estimatedGas: '45000',
      order: 0,
    };
  }

  /**
   * Check if address is native token
   */
  private isNativeToken(address: string): boolean {
    return (
      address.toLowerCase() === NATIVE_TOKEN.toLowerCase() ||
      address === ethers.ZeroAddress
    );
  }
}

// ============= TRANSACTION EXECUTOR =============

export class TransactionExecutor {
  private builder: TransactionBuilder;

  constructor() {
    this.builder = new TransactionBuilder();
  }

  /**
   * Execute a swap with all necessary transactions
   */
  async executeSwap(
    params: SwapParams,
    quote: SwapQuote,
    signer: ethers.Signer
  ): Promise<SwapResult> {
    const userAddress = await signer.getAddress();
    const recipient = params.recipient || userAddress;

    // Validate balance
    await this.validateBalance(quote.inputToken, userAddress, quote.inputAmount);

    // Build transactions
    const transactions = await this.builder.buildTransactions(quote, userAddress, recipient);

    // Create execution tracker
    const execution: SwapExecution = {
      quoteId: quote.id,
      transactions,
      status: 'preparing',
      currentStep: 0,
      totalSteps: transactions.length,
      startedAt: Date.now(),
    };

    const txHashes: string[] = [];

    try {
      // Execute transactions sequentially
      for (let i = 0; i < transactions.length; i++) {
        const txData = transactions[i];
        execution.currentStep = i;
        execution.status = txData.type === 'approval' ? 'approving' : 
                          txData.type === 'bridge' ? 'bridging' : 'swapping';

        // Update transaction status
        txData.status = 'pending';

        // Send transaction
        const tx = await this.sendTransaction(txData, signer);
        txData.txHash = tx.hash;
        txData.status = 'submitted';
        txHashes.push(tx.hash);

        // Wait for confirmation
        const receipt = await tx.wait(1);
        
        if (!receipt || receipt.status === 0) {
          throw SwapErrors.transactionFailed(tx.hash, txData.chainId, 'Transaction reverted');
        }

        txData.status = 'confirmed';
        txData.confirmations = 1;

        // Store source tx hash for cross-chain swaps
        if (txData.type === 'bridge') {
          execution.sourceTxHash = tx.hash;
        }
      }

      // For cross-chain swaps, wait for bridge completion
      if (quote.route.isCrossChain && execution.sourceTxHash) {
        execution.status = 'bridging';
        const bridgeResult = await this.waitForBridge(
          execution.sourceTxHash,
          quote.route.bridgeUsed || 'unknown',
          quote.inputToken.chainId,
          quote.outputToken.chainId
        );
        execution.destinationTxHash = bridgeResult.destinationTxHash;
        execution.bridgeStatus = bridgeResult.status;
      }

      execution.status = 'completed';
      execution.completedAt = Date.now();

      return {
        success: true,
        quoteId: quote.id,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        txHashes,
        execution,
      };

    } catch (error) {
      const swapError = parseError(error);
      
      execution.status = 'failed';
      execution.completedAt = Date.now();

      return {
        success: false,
        quoteId: quote.id,
        inputAmount: quote.inputAmount,
        outputAmount: '0',
        txHashes,
        execution,
        error: swapError.toJSON(),
      };
    }
  }

  /**
   * Validate user has sufficient balance
   */
  async validateBalance(token: Token, userAddress: string, amount: string): Promise<void> {
    const provider = providerManager.getProvider(token.chainId);

    let balance: bigint;

    if (token.address.toLowerCase() === NATIVE_TOKEN.toLowerCase() || 
        token.address === ethers.ZeroAddress) {
      balance = await provider.getBalance(userAddress);
    } else {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      balance = await contract.balanceOf(userAddress);
    }

    if (balance < BigInt(amount)) {
      throw SwapErrors.insufficientBalance(
        token.symbol,
        amount,
        balance.toString()
      );
    }
  }

  /**
   * Send a transaction
   */
  private async sendTransaction(
    txData: TxnData,
    signer: ethers.Signer
  ): Promise<ethers.TransactionResponse> {
    const tx: ethers.TransactionRequest = {
      to: txData.to,
      data: txData.data,
      value: BigInt(txData.value),
      gasLimit: BigInt(txData.gasLimit),
      chainId: txData.chainId,
    };

    // Add gas pricing
    if (txData.maxFeePerGas && txData.maxPriorityFeePerGas) {
      tx.maxFeePerGas = BigInt(txData.maxFeePerGas);
      tx.maxPriorityFeePerGas = BigInt(txData.maxPriorityFeePerGas);
    } else if (txData.gasPrice) {
      tx.gasPrice = BigInt(txData.gasPrice);
    }

    try {
      return await signer.sendTransaction(tx);
    } catch (error) {
      if ((error as Error).message?.includes('user rejected')) {
        throw SwapErrors.userRejected();
      }
      throw parseError(error);
    }
  }

  /**
   * Wait for bridge transaction to complete
   */
  private async waitForBridge(
    sourceTxHash: string,
    bridgeProvider: string,
    sourceChainId: number,
    destinationChainId: number,
    timeoutMs: number = 600000 // 10 minutes default
  ): Promise<{
    destinationTxHash?: string;
    status: {
      provider: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      estimatedArrival?: number;
    };
  }> {
    const startTime = Date.now();

    // Poll for bridge completion
    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.checkBridgeStatus(
          sourceTxHash,
          bridgeProvider,
          sourceChainId,
          destinationChainId
        );

        if (status.status === 'completed') {
          return {
            destinationTxHash: status.destinationTxHash,
            status: {
              provider: bridgeProvider,
              status: 'completed',
            },
          };
        }

        if (status.status === 'failed') {
          throw SwapErrors.bridgeFailed(bridgeProvider, 'Bridge transaction failed', sourceTxHash);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds

      } catch (error) {
        if (error instanceof CrossFundError) {
          throw error;
        }
        // Continue polling on network errors
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw SwapErrors.bridgeTimeout(bridgeProvider, sourceTxHash, timeoutMs);
  }

  /**
   * Check bridge transaction status
   */
  private async checkBridgeStatus(
    sourceTxHash: string,
    bridgeProvider: string,
    sourceChainId: number,
    destinationChainId: number
  ): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    destinationTxHash?: string;
  }> {
    // Query bridge-specific APIs for status
    switch (bridgeProvider.toLowerCase()) {
      case 'socket':
        return this.checkSocketBridgeStatus(sourceTxHash);
      case 'lifi':
        return this.checkLiFiBridgeStatus(sourceTxHash);
      case 'across':
        return this.checkAcrossBridgeStatus(sourceTxHash, sourceChainId);
      case 'stargate':
        return this.checkStargateBridgeStatus(sourceTxHash, sourceChainId);
      default:
        // Generic status check - look for transaction on destination chain
        return { status: 'in_progress' };
    }
  }

  private async checkSocketBridgeStatus(sourceTxHash: string): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    destinationTxHash?: string;
  }> {
    const response = await fetch(
      `https://api.socket.tech/v2/bridge-status?transactionHash=${sourceTxHash}`,
      {
        headers: {
          'API-KEY': process.env.SOCKET_API_KEY || '',
        },
      }
    );

    if (!response.ok) {
      return { status: 'in_progress' };
    }

    const data = await response.json();
    const result = data.result;

    if (result?.destinationTransactionHash) {
      return {
        status: 'completed',
        destinationTxHash: result.destinationTransactionHash,
      };
    }

    if (result?.sourceTxStatus === 'FAILED') {
      return { status: 'failed' };
    }

    return { status: 'in_progress' };
  }

  private async checkLiFiBridgeStatus(sourceTxHash: string): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    destinationTxHash?: string;
  }> {
    const response = await fetch(
      `https://li.quest/v1/status?txHash=${sourceTxHash}`
    );

    if (!response.ok) {
      return { status: 'in_progress' };
    }

    const data = await response.json();

    if (data.status === 'DONE') {
      return {
        status: 'completed',
        destinationTxHash: data.receiving?.txHash,
      };
    }

    if (data.status === 'FAILED') {
      return { status: 'failed' };
    }

    return { status: 'in_progress' };
  }

  private async checkAcrossBridgeStatus(
    sourceTxHash: string,
    sourceChainId: number
  ): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    destinationTxHash?: string;
  }> {
    const response = await fetch(
      `https://across.to/api/deposit/status?originChainId=${sourceChainId}&depositTxHash=${sourceTxHash}`
    );

    if (!response.ok) {
      return { status: 'in_progress' };
    }

    const data = await response.json();

    if (data.status === 'filled') {
      return {
        status: 'completed',
        destinationTxHash: data.fillTxHash,
      };
    }

    return { status: 'in_progress' };
  }

  private async checkStargateBridgeStatus(
    sourceTxHash: string,
    sourceChainId: number
  ): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    destinationTxHash?: string;
  }> {
    // Stargate uses LayerZero - check via their API
    const response = await fetch(
      `https://api-mainnet.layerzero-scan.com/tx/${sourceTxHash}`
    );

    if (!response.ok) {
      return { status: 'in_progress' };
    }

    const data = await response.json();

    if (data.messages?.[0]?.status === 'DELIVERED') {
      return {
        status: 'completed',
        destinationTxHash: data.messages[0].dstTxHash,
      };
    }

    if (data.messages?.[0]?.status === 'FAILED') {
      return { status: 'failed' };
    }

    return { status: 'in_progress' };
  }
}

// ============= EXPORTS =============

export const transactionBuilder = new TransactionBuilder();
export const transactionExecutor = new TransactionExecutor();

export async function buildTransactions(
  quote: SwapQuote,
  userAddress: string,
  recipient?: string
): Promise<TxnData[]> {
  return transactionBuilder.buildTransactions(quote, userAddress, recipient);
}

export async function executeSwap(
  params: SwapParams,
  quote: SwapQuote,
  signer: ethers.Signer
): Promise<SwapResult> {
  return transactionExecutor.executeSwap(params, quote, signer);
}

export async function checkNeedsApproval(
  token: Token,
  owner: string,
  amount: string,
  spender: string
): Promise<boolean> {
  return transactionBuilder.checkNeedsApproval(token, owner, amount, spender);
}

export async function validateBalance(
  token: Token,
  userAddress: string,
  amount: string
): Promise<void> {
  return transactionExecutor.validateBalance(token, userAddress, amount);
}
