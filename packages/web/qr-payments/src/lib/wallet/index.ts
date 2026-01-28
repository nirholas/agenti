// Wallet interactions and state management
// Multi-wallet support via RainbowKit, chain switching, balance fetching, and transaction monitoring

import { type Address, type Hash, formatUnits, parseUnits } from 'viem';
import { 
  getChain, 
  getRpcUrl, 
  getTxUrl, 
  type ChainConfig,
  DEFAULT_CHAIN_ID 
} from '../chains/config';
import { 
  type TokenInfo, 
  isNativeToken, 
  NATIVE_TOKEN_ADDRESS 
} from '../tokens/lists';

// =============================================================================
// TYPES
// =============================================================================

export interface WalletState {
  address: Address | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  connector: string | null;
}

export interface TokenBalance {
  token: TokenInfo;
  balance: bigint;
  formatted: string;
  usdValue?: number;
}

export interface TransactionRequest {
  to: Address;
  from?: Address;
  value?: bigint;
  data?: `0x${string}`;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  chainId?: number;
}

export interface TransactionReceipt {
  transactionHash: Hash;
  blockNumber: bigint;
  blockHash: Hash;
  status: 'success' | 'reverted';
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  from: Address;
  to: Address | null;
  contractAddress: Address | null;
  logs: any[];
}

export type TransactionStatus = 
  | 'idle'
  | 'pending-signature'
  | 'pending-confirmation'
  | 'confirmed'
  | 'failed';

export interface TransactionState {
  status: TransactionStatus;
  hash?: Hash;
  receipt?: TransactionReceipt;
  error?: Error;
  confirmations: number;
}

export interface PendingTransaction {
  hash: Hash;
  chainId: number;
  from: Address;
  to: Address;
  value: bigint;
  timestamp: number;
  description?: string;
  status: TransactionStatus;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEYS = {
  PENDING_TXS: 'qrpay_pending_txs',
  LAST_CHAIN: 'qrpay_last_chain',
};

// ERC20 ABI fragments (minimal for balance checking)
const ERC20_BALANCE_OF_SIG = '0x70a08231';
const ERC20_ALLOWANCE_SIG = '0xdd62ed3e';
const ERC20_APPROVE_SIG = '0x095ea7b3';
const ERC20_TRANSFER_SIG = '0xa9059cbb';

// Max uint256 for unlimited approval
const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

// =============================================================================
// RPC HELPERS
// =============================================================================

/**
 * Make an eth_call to an RPC endpoint
 */
async function ethCall(
  rpcUrl: string,
  to: string,
  data: string
): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
      id: 1,
    }),
  });

  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message);
  }
  return json.result || '0x';
}

/**
 * Get the balance of a native token
 */
async function getNativeBalance(rpcUrl: string, address: string): Promise<bigint> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
      id: 1,
    }),
  });

  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message);
  }
  return BigInt(json.result || '0x0');
}

/**
 * Get transaction by hash
 */
async function getTransaction(rpcUrl: string, hash: string): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionByHash',
      params: [hash],
      id: 1,
    }),
  });

  const json = await response.json();
  return json.result;
}

/**
 * Get transaction receipt
 */
async function getTransactionReceipt(rpcUrl: string, hash: string): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [hash],
      id: 1,
    }),
  });

  const json = await response.json();
  return json.result;
}

/**
 * Get current block number
 */
async function getBlockNumber(rpcUrl: string): Promise<bigint> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    }),
  });

  const json = await response.json();
  return BigInt(json.result || '0x0');
}

// =============================================================================
// BALANCE FETCHING
// =============================================================================

/**
 * Get balance of a token for an address
 */
export async function getTokenBalance(
  chainId: number,
  tokenAddress: string,
  walletAddress: string
): Promise<bigint> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) {
    throw new Error(`No RPC URL for chain ${chainId}`);
  }

  // Native token balance
  if (isNativeToken(tokenAddress)) {
    return getNativeBalance(rpcUrl, walletAddress);
  }

  // ERC20 balance
  const paddedAddress = walletAddress.slice(2).padStart(64, '0');
  const data = `${ERC20_BALANCE_OF_SIG}${paddedAddress}`;
  
  const result = await ethCall(rpcUrl, tokenAddress, data);
  return BigInt(result || '0x0');
}

/**
 * Get balances for multiple tokens
 */
export async function getTokenBalances(
  chainId: number,
  tokens: TokenInfo[],
  walletAddress: string
): Promise<TokenBalance[]> {
  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const balance = await getTokenBalance(chainId, token.address, walletAddress);
      return {
        token,
        balance,
        formatted: formatUnits(balance, token.decimals),
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<TokenBalance> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Get native token balance
 */
export async function getNativeTokenBalance(
  chainId: number,
  walletAddress: string
): Promise<bigint> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) {
    throw new Error(`No RPC URL for chain ${chainId}`);
  }
  return getNativeBalance(rpcUrl, walletAddress);
}

/**
 * Check ERC20 allowance
 */
export async function getAllowance(
  chainId: number,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  if (isNativeToken(tokenAddress)) {
    return MAX_UINT256; // Native tokens don't need approval
  }

  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) {
    throw new Error(`No RPC URL for chain ${chainId}`);
  }

  const paddedOwner = ownerAddress.slice(2).padStart(64, '0');
  const paddedSpender = spenderAddress.slice(2).padStart(64, '0');
  const data = `${ERC20_ALLOWANCE_SIG}${paddedOwner}${paddedSpender}`;

  const result = await ethCall(rpcUrl, tokenAddress, data);
  return BigInt(result || '0x0');
}

/**
 * Check if approval is needed
 */
export async function needsApproval(
  chainId: number,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  amount: bigint
): Promise<boolean> {
  if (isNativeToken(tokenAddress)) {
    return false;
  }

  const allowance = await getAllowance(
    chainId,
    tokenAddress,
    ownerAddress,
    spenderAddress
  );

  return allowance < amount;
}

// =============================================================================
// TRANSACTION DATA BUILDERS
// =============================================================================

/**
 * Build ERC20 approval transaction data
 */
export function buildApprovalData(
  spenderAddress: string,
  amount: bigint = MAX_UINT256
): `0x${string}` {
  const paddedSpender = spenderAddress.slice(2).padStart(64, '0');
  const paddedAmount = amount.toString(16).padStart(64, '0');
  return `${ERC20_APPROVE_SIG}${paddedSpender}${paddedAmount}` as `0x${string}`;
}

/**
 * Build ERC20 transfer transaction data
 */
export function buildTransferData(
  toAddress: string,
  amount: bigint
): `0x${string}` {
  const paddedTo = toAddress.slice(2).padStart(64, '0');
  const paddedAmount = amount.toString(16).padStart(64, '0');
  return `${ERC20_TRANSFER_SIG}${paddedTo}${paddedAmount}` as `0x${string}`;
}

// =============================================================================
// TRANSACTION MONITORING
// =============================================================================

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  chainId: number,
  hash: Hash,
  confirmations = 1,
  timeout = 60000,
  onStatusChange?: (status: TransactionState) => void
): Promise<TransactionReceipt> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) {
    throw new Error(`No RPC URL for chain ${chainId}`);
  }

  const startTime = Date.now();
  let currentConfirmations = 0;

  onStatusChange?.({
    status: 'pending-confirmation',
    hash,
    confirmations: 0,
  });

  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await getTransactionReceipt(rpcUrl, hash);
      
      if (receipt) {
        const currentBlock = await getBlockNumber(rpcUrl);
        const txBlock = BigInt(receipt.blockNumber);
        currentConfirmations = Number(currentBlock - txBlock) + 1;

        const status: TransactionStatus = 
          receipt.status === '0x1' ? 'confirmed' : 'failed';

        if (currentConfirmations >= confirmations) {
          const parsedReceipt: TransactionReceipt = {
            transactionHash: receipt.transactionHash,
            blockNumber: BigInt(receipt.blockNumber),
            blockHash: receipt.blockHash,
            status: receipt.status === '0x1' ? 'success' : 'reverted',
            gasUsed: BigInt(receipt.gasUsed),
            effectiveGasPrice: BigInt(receipt.effectiveGasPrice || '0x0'),
            from: receipt.from,
            to: receipt.to,
            contractAddress: receipt.contractAddress,
            logs: receipt.logs,
          };

          onStatusChange?.({
            status,
            hash,
            receipt: parsedReceipt,
            confirmations: currentConfirmations,
          });

          if (status === 'failed') {
            throw new Error('Transaction reverted');
          }

          return parsedReceipt;
        }

        onStatusChange?.({
          status: 'pending-confirmation',
          hash,
          confirmations: currentConfirmations,
        });
      }
    } catch (error) {
      // Receipt not found yet, continue polling
    }

    await sleep(2000); // Poll every 2 seconds
  }

  throw new Error('Transaction confirmation timeout');
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
  chainId: number,
  hash: Hash
): Promise<TransactionState> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) {
    return { status: 'failed', error: new Error('No RPC URL'), confirmations: 0 };
  }

  try {
    const receipt = await getTransactionReceipt(rpcUrl, hash);
    
    if (!receipt) {
      // Check if tx exists
      const tx = await getTransaction(rpcUrl, hash);
      if (tx) {
        return { status: 'pending-confirmation', hash, confirmations: 0 };
      }
      return { status: 'failed', error: new Error('Transaction not found'), confirmations: 0 };
    }

    const currentBlock = await getBlockNumber(rpcUrl);
    const txBlock = BigInt(receipt.blockNumber);
    const confirmations = Number(currentBlock - txBlock) + 1;

    const parsedReceipt: TransactionReceipt = {
      transactionHash: receipt.transactionHash,
      blockNumber: BigInt(receipt.blockNumber),
      blockHash: receipt.blockHash,
      status: receipt.status === '0x1' ? 'success' : 'reverted',
      gasUsed: BigInt(receipt.gasUsed),
      effectiveGasPrice: BigInt(receipt.effectiveGasPrice || '0x0'),
      from: receipt.from,
      to: receipt.to,
      contractAddress: receipt.contractAddress,
      logs: receipt.logs,
    };

    return {
      status: receipt.status === '0x1' ? 'confirmed' : 'failed',
      hash,
      receipt: parsedReceipt,
      confirmations,
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error : new Error('Unknown error'),
      confirmations: 0,
    };
  }
}

// =============================================================================
// PENDING TRANSACTIONS STORE
// =============================================================================

class PendingTransactionsStore {
  private transactions: PendingTransaction[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PENDING_TXS);
      if (stored) {
        this.transactions = JSON.parse(stored);
        // Filter out old transactions (> 24 hours)
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.transactions = this.transactions.filter((tx) => tx.timestamp > cutoff);
        this.saveToStorage();
      }
    } catch (error) {
      console.error('Failed to load pending transactions:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEYS.PENDING_TXS, JSON.stringify(this.transactions));
    } catch (error) {
      console.error('Failed to save pending transactions:', error);
    }
  }

  add(tx: Omit<PendingTransaction, 'timestamp' | 'status'>): void {
    this.transactions.unshift({
      ...tx,
      timestamp: Date.now(),
      status: 'pending-confirmation',
    });
    this.saveToStorage();
  }

  update(hash: Hash, status: TransactionStatus): void {
    const tx = this.transactions.find((t) => t.hash === hash);
    if (tx) {
      tx.status = status;
      this.saveToStorage();
    }
  }

  remove(hash: Hash): void {
    this.transactions = this.transactions.filter((t) => t.hash !== hash);
    this.saveToStorage();
  }

  getAll(): PendingTransaction[] {
    return [...this.transactions];
  }

  getByChain(chainId: number): PendingTransaction[] {
    return this.transactions.filter((t) => t.chainId === chainId);
  }

  getPending(): PendingTransaction[] {
    return this.transactions.filter((t) => t.status === 'pending-confirmation');
  }

  clear(): void {
    this.transactions = [];
    this.saveToStorage();
  }
}

export const pendingTransactionsStore = new PendingTransactionsStore();

// =============================================================================
// CHAIN SWITCHING HELPERS
// =============================================================================

/**
 * Get the last used chain ID
 */
export function getLastChainId(): number {
  if (typeof window === 'undefined') return DEFAULT_CHAIN_ID;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_CHAIN);
    if (stored) {
      const chainId = parseInt(stored, 10);
      if (!isNaN(chainId) && getChain(chainId)) {
        return chainId;
      }
    }
  } catch {
    // Ignore
  }
  return DEFAULT_CHAIN_ID;
}

/**
 * Save the last used chain ID
 */
export function setLastChainId(chainId: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_CHAIN, chainId.toString());
  } catch {
    // Ignore
  }
}

/**
 * Build chain switch request for wallet
 */
export function buildSwitchChainRequest(chainId: number): {
  chainId: `0x${string}`;
  chainName?: string;
  nativeCurrency?: { name: string; symbol: string; decimals: number };
  rpcUrls?: string[];
  blockExplorerUrls?: string[];
} | null {
  const chain = getChain(chainId);
  if (!chain) return null;

  return {
    chainId: `0x${chainId.toString(16)}` as `0x${string}`,
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: chain.rpcUrls,
    blockExplorerUrls: chain.blockExplorers.map((e) => e.url),
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  maxDecimals = 6
): string {
  const formatted = formatUnits(amount, decimals);
  const [whole, fraction = ''] = formatted.split('.');
  
  if (!fraction) return whole;
  
  const trimmedFraction = fraction.slice(0, maxDecimals).replace(/0+$/, '');
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

/**
 * Parse token amount from string
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

/**
 * Check if address is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Get explorer URL for transaction
 */
export function getTransactionExplorerUrl(chainId: number, hash: Hash): string | undefined {
  return getTxUrl(chainId, hash);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// GAS ESTIMATION
// =============================================================================

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  chainId: number,
  tx: TransactionRequest
): Promise<bigint> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) {
    throw new Error(`No RPC URL for chain ${chainId}`);
  }

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_estimateGas',
      params: [{
        from: tx.from,
        to: tx.to,
        value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
        data: tx.data,
      }],
      id: 1,
    }),
  });

  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message);
  }
  return BigInt(json.result);
}

/**
 * Get current gas price
 */
export async function getGasPrice(chainId: number): Promise<bigint> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) {
    throw new Error(`No RPC URL for chain ${chainId}`);
  }

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      params: [],
      id: 1,
    }),
  });

  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message);
  }
  return BigInt(json.result);
}

/**
 * Get EIP-1559 fee data
 */
export async function getFeeData(chainId: number): Promise<{
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  gasPrice: bigint;
}> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) {
    throw new Error(`No RPC URL for chain ${chainId}`);
  }

  // Try EIP-1559 first
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_feeHistory',
        params: ['0x1', 'latest', [25, 50, 75]],
        id: 1,
      }),
    });

    const json = await response.json();
    
    if (json.result && json.result.baseFeePerGas) {
      const baseFee = BigInt(json.result.baseFeePerGas[0]);
      const priorityFees = json.result.reward?.[0] || [];
      const medianPriority = priorityFees[1] ? BigInt(priorityFees[1]) : BigInt(1500000000);
      
      return {
        maxFeePerGas: baseFee * 2n + medianPriority,
        maxPriorityFeePerGas: medianPriority,
        gasPrice: baseFee + medianPriority,
      };
    }
  } catch {
    // Fall back to legacy gas price
  }

  const gasPrice = await getGasPrice(chainId);
  return {
    maxFeePerGas: gasPrice,
    maxPriorityFeePerGas: gasPrice / 10n,
    gasPrice,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  MAX_UINT256,
  NATIVE_TOKEN_ADDRESS,
  ERC20_BALANCE_OF_SIG,
  ERC20_ALLOWANCE_SIG,
  ERC20_APPROVE_SIG,
  ERC20_TRANSFER_SIG,
};
