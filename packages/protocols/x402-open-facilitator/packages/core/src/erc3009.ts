/**
 * ERC-3009 (transferWithAuthorization / receiveWithAuthorization) implementation
 *
 * This is used for gasless USDC transfers where the payer signs an authorization
 * and the facilitator submits the transaction.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type Chain,
  encodeFunctionData,
  parseSignature,
  defineChain,
} from 'viem';

/**
 * In-memory nonce deduplication cache
 * Tracks nonces that are currently being processed to prevent double-submissions
 * Key: `${chainId}:${from}:${nonce}` - Value: timestamp when added
 */
const processingNonces = new Map<string, number>();

// Clean up old entries every 5 minutes (nonces older than 10 minutes are removed)
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processingNonces.entries()) {
    if (now - timestamp > NONCE_TTL_MS) {
      processingNonces.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a nonce is already being processed and mark it if not
 * Returns true if nonce is new (not a duplicate), false if duplicate
 */
function tryAcquireNonce(chainId: number, from: string, nonce: string): boolean {
  const key = `${chainId}:${from.toLowerCase()}:${nonce.toLowerCase()}`;
  if (processingNonces.has(key)) {
    return false; // Duplicate
  }
  processingNonces.set(key, Date.now());
  return true;
}

/**
 * Release a nonce from the processing cache (call after tx completes or fails)
 */
function releaseNonce(chainId: number, from: string, nonce: string): void {
  const key = `${chainId}:${from.toLowerCase()}:${nonce.toLowerCase()}`;
  processingNonces.delete(key);
}

/**
 * EVM Account Nonce Manager
 *
 * Manages EVM transaction nonces to prevent race conditions when multiple
 * settlement requests are processed concurrently. Without this, concurrent
 * requests would all read the same nonce from the chain, causing all but one
 * to fail with "nonce too low" errors.
 *
 * The manager:
 * 1. Tracks the next nonce to use per (chainId, address) pair
 * 2. Uses a mutex to ensure atomic nonce allocation
 * 3. Syncs with the blockchain on first use and after gaps
 * 4. Releases nonces back if transactions fail before broadcast
 */
class NonceManager {
  // Current nonce per chain:address
  private nonces: Map<string, number> = new Map();
  // Pending nonce acquisitions waiting for lock
  private locks: Map<string, Promise<void>> = new Map();
  // Release callbacks for pending nonces
  private resolvers: Map<string, () => void> = new Map();

  private getKey(chainId: number, address: string): string {
    return `${chainId}:${address.toLowerCase()}`;
  }

  /**
   * Acquire the next nonce for a given chain and address.
   * This is atomic - concurrent calls will queue and get sequential nonces.
   *
   * @returns Object with the nonce and a release function to call if tx fails
   */
  async acquireNonce(
    chainId: number,
    address: string,
    getOnChainNonce: () => Promise<number>
  ): Promise<{ nonce: number; release: () => void }> {
    const key = this.getKey(chainId, address);

    // Wait for any pending acquisition on this key
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    // Create a new lock that others will wait on
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      // Get or initialize the nonce
      let nonce = this.nonces.get(key);

      if (nonce === undefined) {
        // First time for this chain:address - sync from chain
        nonce = await getOnChainNonce();
        console.log(`[NonceManager] Initialized nonce for ${key}: ${nonce}`);
      }

      // Store the next nonce for subsequent requests
      const currentNonce = nonce;
      this.nonces.set(key, nonce + 1);

      console.log(`[NonceManager] Acquired nonce ${currentNonce} for ${key}, next will be ${nonce + 1}`);

      // Return the nonce with a release function for failed txs
      return {
        nonce: currentNonce,
        release: () => {
          // If tx fails before broadcast, we might want to reuse this nonce
          // However, we should NOT decrement as another tx may have already
          // used a higher nonce. Instead, just log - the nonce will be skipped
          // and the chain will handle it (tx will fail with nonce too high,
          // but that's recoverable on next sync)
          console.log(`[NonceManager] Nonce ${currentNonce} released (tx failed)`);
        },
      };
    } finally {
      // Release the lock
      this.locks.delete(key);
      releaseLock!();
    }
  }

  /**
   * Sync nonce from chain - call this after a failed transaction to recover
   * from potential nonce gaps or mismatches
   */
  async syncNonce(
    chainId: number,
    address: string,
    getOnChainNonce: () => Promise<number>
  ): Promise<void> {
    const key = this.getKey(chainId, address);

    // Wait for any pending acquisition
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    const onChainNonce = await getOnChainNonce();
    const currentNonce = this.nonces.get(key);

    // Only update if chain nonce is higher (txs may have confirmed)
    if (currentNonce === undefined || onChainNonce > currentNonce) {
      this.nonces.set(key, onChainNonce);
      console.log(`[NonceManager] Synced nonce for ${key}: ${currentNonce} -> ${onChainNonce}`);
    }
  }

  /**
   * Force reset nonce from chain - use after persistent errors
   */
  async resetNonce(
    chainId: number,
    address: string,
    getOnChainNonce: () => Promise<number>
  ): Promise<void> {
    const key = this.getKey(chainId, address);

    // Wait for any pending acquisition
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    const onChainNonce = await getOnChainNonce();
    this.nonces.set(key, onChainNonce);
    console.log(`[NonceManager] Force reset nonce for ${key} to ${onChainNonce}`);
  }
}

// Global nonce manager instance
const nonceManager = new NonceManager();

import { privateKeyToAccount } from 'viem/accounts';
import { 
  avalanche, 
  avalancheFuji,
  base, 
  baseSepolia, 
  mainnet, 
  polygon,
  polygonAmoy,
  sepolia,
} from 'viem/chains';

/**
 * ERC-3009 transferWithAuthorization ABI
 * Note: We use transferWithAuthorization instead of receiveWithAuthorization
 * because receiveWithAuthorization requires the caller to be the payee,
 * but we want the facilitator to be able to call it.
 */
const TRANSFER_WITH_AUTHORIZATION_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

/**
 * Custom chain definitions for chains not in viem
 */
const iotex = defineChain({
  id: 4689,
  name: 'IoTeX',
  nativeCurrency: { name: 'IOTX', symbol: 'IOTX', decimals: 18 },
  rpcUrls: { default: { http: ['https://babel-api.mainnet.iotex.io'] } },
  blockExplorers: { default: { name: 'IoTeXScan', url: 'https://iotexscan.io' } },
});

const peaq = defineChain({
  id: 3338,
  name: 'Peaq',
  nativeCurrency: { name: 'PEAQ', symbol: 'PEAQ', decimals: 18 },
  rpcUrls: { default: { http: ['https://peaq.api.onfinality.io/public'] } },
  blockExplorers: { default: { name: 'Subscan', url: 'https://peaq.subscan.io' } },
});

const sei = defineChain({
  id: 1329,
  name: 'Sei',
  nativeCurrency: { name: 'SEI', symbol: 'SEI', decimals: 18 },
  rpcUrls: { default: { http: ['https://evm-rpc.sei-apis.com'] } },
  blockExplorers: { default: { name: 'SeiTrace', url: 'https://seitrace.com' } },
});

const seiTestnet = defineChain({
  id: 1328,
  name: 'Sei Testnet',
  nativeCurrency: { name: 'SEI', symbol: 'SEI', decimals: 18 },
  rpcUrls: { default: { http: ['https://evm-rpc-testnet.sei-apis.com'] } },
  blockExplorers: { default: { name: 'SeiTrace Testnet', url: 'https://testnet.seitrace.com' } },
  testnet: true,
});

const xlayer = defineChain({
  id: 196,
  name: 'XLayer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.xlayer.tech'] } },
  blockExplorers: { default: { name: 'OKX Explorer', url: 'https://www.okx.com/explorer/xlayer' } },
});

const xlayerTestnet = defineChain({
  id: 195,
  name: 'XLayer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://testrpc.xlayer.tech'] } },
  blockExplorers: { default: { name: 'OKX Explorer', url: 'https://www.okx.com/explorer/xlayer-test' } },
  testnet: true,
});

/**
 * Chain configuration for settlement
 */
const chainConfigs: Record<number, { chain: Chain; rpcUrl: string }> = {
  // Mainnets
  43114: { chain: avalanche, rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc' },
  8453: { chain: base, rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org' },
  1: { chain: mainnet, rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com' },
  4689: { chain: iotex, rpcUrl: process.env.IOTEX_RPC_URL || 'https://babel-api.mainnet.iotex.io' },
  3338: { chain: peaq, rpcUrl: process.env.PEAQ_RPC_URL || 'https://peaq.api.onfinality.io/public' },
  137: { chain: polygon, rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com' },
  1329: { chain: sei, rpcUrl: process.env.SEI_RPC_URL || 'https://evm-rpc.sei-apis.com' },
  196: { chain: xlayer, rpcUrl: process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech' },
  // Testnets
  43113: { chain: avalancheFuji, rpcUrl: process.env.AVALANCHE_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc' },
  84532: { chain: baseSepolia, rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org' },
  80002: { chain: polygonAmoy, rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology' },
  1328: { chain: seiTestnet, rpcUrl: process.env.SEI_TESTNET_RPC_URL || 'https://evm-rpc-testnet.sei-apis.com' },
  11155111: { chain: sepolia, rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org' },
  195: { chain: xlayerTestnet, rpcUrl: process.env.XLAYER_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech' },
};

export interface ERC3009Authorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: Hex;
}

export interface SettlementParams {
  chainId: number;
  tokenAddress: Address;
  authorization: ERC3009Authorization;
  signature: Hex;
  facilitatorPrivateKey: Hex;
}

export interface SettlementResult {
  success: boolean;
  transactionHash?: Hex;
  errorMessage?: string;
  gasUsed?: bigint;
}

/**
 * Execute an ERC-3009 receiveWithAuthorization transaction
 */
export async function executeERC3009Settlement(
  params: SettlementParams
): Promise<SettlementResult> {
  const { chainId, tokenAddress, authorization, signature, facilitatorPrivateKey } = params;

  console.log('[ERC3009Settlement] Starting settlement:', {
    chainId,
    tokenAddress,
    from: authorization.from,
    to: authorization.to,
    value: authorization.value,
    nonce: authorization.nonce,
    validAfter: authorization.validAfter,
    validBefore: authorization.validBefore,
  });

  // Deduplication: prevent double-submission of same nonce
  if (!tryAcquireNonce(chainId, authorization.from, authorization.nonce)) {
    console.warn('[ERC3009Settlement] DUPLICATE BLOCKED: Nonce already being processed:', authorization.nonce);
    return {
      success: false,
      errorMessage: 'Duplicate submission: this authorization is already being processed',
    };
  }

  // Get chain config
  const config = chainConfigs[chainId];
  if (!config) {
    releaseNonce(chainId, authorization.from, authorization.nonce);
    return {
      success: false,
      errorMessage: `Unsupported chain ID: ${chainId}`,
    };
  }

  try {
    // Create account from private key
    const account = privateKeyToAccount(facilitatorPrivateKey);
    console.log('[ERC3009Settlement] Facilitator wallet:', account.address);

    // Create clients
    // Use shorter polling interval for L2s with fast block times
    const publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
      pollingInterval: 2_000,
    });

    const walletClient = createWalletClient({
      account,
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    // Parse signature into v, r, s
    console.log('[ERC3009Settlement] Raw signature:', signature);
    console.log('[ERC3009Settlement] Signature length:', signature.length);
    const { v, r, s } = parseSignature(signature);
    console.log('[ERC3009Settlement] Parsed signature: v=%d, r=%s, s=%s', Number(v), r, s);

    // Encode function data - using transferWithAuthorization (can be called by anyone)
    const data = encodeFunctionData({
      abi: TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        authorization.from,
        authorization.to,
        BigInt(authorization.value),
        BigInt(authorization.validAfter),
        BigInt(authorization.validBefore),
        authorization.nonce,
        Number(v),
        r,
        s,
      ],
    });

    // Get current gas prices - use EIP-1559 for Base and other L2s
    // Legacy gasPrice transactions can be deprioritized or dropped on OP Stack chains
    const [baseFee, priorityFee] = await Promise.all([
      publicClient.getGasPrice(),
      publicClient.estimateMaxPriorityFeePerGas().catch(() => 1_000_000n), // fallback 1 gwei
    ]);
    // Add 20% buffer to base fee and 50% buffer to priority fee for reliability
    const maxPriorityFeePerGas = (priorityFee * 150n) / 100n;
    const maxFeePerGas = (baseFee * 120n) / 100n + maxPriorityFeePerGas;
    console.log('[ERC3009Settlement] Gas prices: baseFee=%s, priorityFee=%s, maxFee=%s',
      baseFee.toString(), maxPriorityFeePerGas.toString(), maxFeePerGas.toString());

    // Check facilitator ETH balance
    const ethBalance = await publicClient.getBalance({ address: account.address });
    console.log('[ERC3009Settlement] Facilitator ETH balance:', ethBalance.toString());

    if (ethBalance < 100000n * maxFeePerGas) {
      console.error('[ERC3009Settlement] Insufficient ETH for gas!');
      releaseNonce(chainId, authorization.from, authorization.nonce);
      return {
        success: false,
        errorMessage: 'Facilitator has insufficient ETH for gas',
      };
    }

    // Acquire nonce from the NonceManager - this prevents race conditions
    // when multiple settlements are processed concurrently
    const getOnChainNonce = async () => {
      return publicClient.getTransactionCount({
        address: account.address,
        blockTag: 'pending',
      });
    };

    const { nonce, release: releaseEvmNonce } = await nonceManager.acquireNonce(
      chainId,
      account.address,
      getOnChainNonce
    );
    console.log('[ERC3009Settlement] Using nonce from NonceManager:', nonce);

    // Send transaction with explicit nonce and retry logic for errors
    // Using EIP-1559 (maxFeePerGas + maxPriorityFeePerGas) for better inclusion on L2s
    console.log('[ERC3009Settlement] Sending transaction...');
    let hash: Hex;
    let attempts = 0;
    const maxAttempts = 3;
    let currentMaxFeePerGas = maxFeePerGas;
    let currentMaxPriorityFeePerGas = maxPriorityFeePerGas;
    let currentNonce = nonce;
    let txSent = false;

    while (attempts < maxAttempts) {
      try {
        hash = await walletClient.sendTransaction({
          to: tokenAddress,
          data,
          gas: 100000n, // ERC-3009 transfers use ~65k gas, 100k is safe
          maxFeePerGas: currentMaxFeePerGas,
          maxPriorityFeePerGas: currentMaxPriorityFeePerGas,
          nonce: currentNonce,
        });
        txSent = true;
        console.log('[ERC3009Settlement] Transaction sent! Hash:', hash);
        break;
      } catch (sendError: unknown) {
        const errMsg = sendError instanceof Error ? sendError.message : String(sendError);
        const errMsgLower = errMsg.toLowerCase();
        attempts++;

        // Check for nonce too low error - sync and get new nonce
        if (errMsgLower.includes('nonce too low') || errMsgLower.includes('nonce has already been used')) {
          if (attempts < maxAttempts) {
            console.warn(`[ERC3009Settlement] Retry ${attempts}/${maxAttempts}: Nonce too low, syncing from chain...`);
            // Sync nonce manager with chain and get fresh nonce
            await nonceManager.resetNonce(chainId, account.address, getOnChainNonce);
            const { nonce: newNonce } = await nonceManager.acquireNonce(chainId, account.address, getOnChainNonce);
            currentNonce = newNonce;
            continue;
          }
        }

        // Check if it's an underpriced error (replacement tx needed)
        if (errMsgLower.includes('underpriced') || errMsgLower.includes('replacement')) {
          if (attempts < maxAttempts) {
            // Bump gas prices by 25% and retry with same nonce
            currentMaxFeePerGas = (currentMaxFeePerGas * 125n) / 100n;
            currentMaxPriorityFeePerGas = (currentMaxPriorityFeePerGas * 125n) / 100n;
            console.warn(`[ERC3009Settlement] Retry ${attempts}/${maxAttempts}: Underpriced, bumping maxFee to ${currentMaxFeePerGas}`);
            continue;
          }
        }

        // If tx was never sent, release the nonce for potential reuse
        if (!txSent) {
          releaseEvmNonce();
        }

        // Not a recoverable error or max attempts reached
        throw sendError;
      }
    }

    // TypeScript: hash is definitely assigned if we get here
    hash = hash!;

    // Wait for confirmation with explicit timeout
    // Base has 2-second blocks, so 120s is generous but avoids false timeouts
    // under RPC latency or temporary congestion
    console.log('[ERC3009Settlement] Waiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: 120_000,
    });
    console.log('[ERC3009Settlement] Receipt received:', {
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber.toString(),
    });

    if (receipt.status === 'success') {
      console.log('[ERC3009Settlement] SUCCESS!');
      return {
        success: true,
        transactionHash: hash,
        gasUsed: receipt.gasUsed,
      };
    } else {
      // Transaction was mined but reverted - try to get revert reason
      console.error('[ERC3009Settlement] Transaction REVERTED! Hash:', hash);

      let revertReason = 'Unknown';
      try {
        // Simulate the call to get the revert reason
        await publicClient.call({
          to: tokenAddress,
          data,
          account: account.address,
        });
      } catch (simError: unknown) {
        const errMessage = simError instanceof Error ? simError.message : String(simError);
        // Extract revert reason from error message
        const match = errMessage.match(/reverted with.*?["']([^"']+)["']/i)
          || errMessage.match(/reason:\s*([^\n,]+)/i)
          || errMessage.match(/FiatToken[^:]*:\s*([^\n]+)/i);
        revertReason = match?.[1] || errMessage.slice(0, 200);
        console.error('[ERC3009Settlement] Revert reason:', revertReason);
      }

      console.error('[ERC3009Settlement] Possible causes:');
      console.error('  1. Nonce already used (authorization was already executed)');
      console.error('  2. Insufficient USDC balance in payer wallet:', authorization.from);
      console.error('  3. validAfter/validBefore time constraints not met');
      console.error('  4. Invalid signature');
      return {
        success: false,
        transactionHash: hash,
        errorMessage: `Transaction reverted: ${revertReason}. TX: ${hash}`,
      };
    }
  } catch (error) {
    console.error('[ERC3009Settlement] Error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error during settlement';

    // If this was a receipt timeout, check if tx actually made it to the chain
    // or was dropped. Reset nonce accordingly to prevent gaps.
    const isReceiptTimeout = errMsg.includes('Timed out while waiting for transaction');
    if (isReceiptTimeout) {
      console.warn('[ERC3009Settlement] Receipt timeout — checking if tx exists on chain');
      try {
        const account = privateKeyToAccount(facilitatorPrivateKey);
        const cfg = chainConfigs[chainId];
        if (cfg) {
          const pc = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });

          // Check if the transaction actually exists in mempool/chain
          const txHash = (error as { hash?: Hex }).hash;
          let txExists = false;
          if (txHash) {
            const tx = await pc.getTransaction({ hash: txHash }).catch(() => null);
            txExists = tx !== null;
            console.log(`[ERC3009Settlement] Transaction ${txHash} exists: ${txExists}`);
          }

          // Get both latest (confirmed) and pending nonces
          const [latestNonce, pendingNonce] = await Promise.all([
            pc.getTransactionCount({ address: account.address, blockTag: 'latest' }),
            pc.getTransactionCount({ address: account.address, blockTag: 'pending' }),
          ]);
          console.log(`[ERC3009Settlement] Chain nonces - latest: ${latestNonce}, pending: ${pendingNonce}`);

          // If tx doesn't exist OR latest === pending (nothing pending), reset to latest
          // This prevents nonce gaps from dropped transactions
          if (!txExists || latestNonce === pendingNonce) {
            console.warn('[ERC3009Settlement] TX was dropped or no pending txs, resetting to latest nonce');
            await nonceManager.resetNonce(chainId, account.address, () => Promise.resolve(latestNonce));
          } else {
            // TX exists in mempool, sync to pending
            await nonceManager.resetNonce(chainId, account.address, () => Promise.resolve(pendingNonce));
          }
        }
      } catch (syncErr) {
        console.error('[ERC3009Settlement] Failed to sync nonce after timeout:', syncErr);
      }
      // Don't release the ERC-3009 dedup nonce — the tx may still land on-chain
      return {
        success: false,
        transactionHash: (error as { hash?: Hex }).hash,
        errorMessage: `Transaction broadcast but confirmation timed out. It may still settle. ${errMsg}`,
      };
    }

    // For all other errors the tx was NOT broadcast, safe to release the dedup nonce
    releaseNonce(chainId, authorization.from, authorization.nonce);
    return {
      success: false,
      errorMessage: errMsg,
    };
  }
}

/**
 * Get the facilitator wallet address from private key
 */
export function getWalletAddress(privateKey: Hex): Address {
  const account = privateKeyToAccount(privateKey);
  return account.address;
}

/**
 * Get the ETH balance for a wallet on a chain
 */
export async function getWalletBalance(
  chainId: number,
  address: Address
): Promise<{ balance: bigint; formatted: string }> {
  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const balance = await publicClient.getBalance({ address });
  const formatted = (Number(balance) / 1e18).toFixed(6);

  return { balance, formatted };
}

/**
 * Get nonce status for a wallet on a chain (for debugging/admin)
 */
export async function getNonceStatus(
  chainId: number,
  address: Address
): Promise<{
  latestNonce: number;
  pendingNonce: number;
  managerNonce: number | undefined;
  hasPendingTxs: boolean;
  gap: number;
}> {
  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const [latestNonce, pendingNonce] = await Promise.all([
    publicClient.getTransactionCount({ address, blockTag: 'latest' }),
    publicClient.getTransactionCount({ address, blockTag: 'pending' }),
  ]);

  // Access the internal nonce from manager (for debugging)
  const key = `${chainId}:${address.toLowerCase()}`;
  const managerNonce = (nonceManager as unknown as { nonces: Map<string, number> }).nonces.get(key);

  return {
    latestNonce,
    pendingNonce,
    managerNonce,
    hasPendingTxs: pendingNonce > latestNonce,
    gap: managerNonce !== undefined ? managerNonce - latestNonce : 0,
  };
}

/**
 * Force reset the nonce manager to sync with chain state (admin function)
 */
export async function forceResetNonce(
  chainId: number,
  address: Address
): Promise<{ previousNonce: number | undefined; newNonce: number }> {
  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const key = `${chainId}:${address.toLowerCase()}`;
  const previousNonce = (nonceManager as unknown as { nonces: Map<string, number> }).nonces.get(key);

  const latestNonce = await publicClient.getTransactionCount({ address, blockTag: 'latest' });

  await nonceManager.resetNonce(chainId, address, () => Promise.resolve(latestNonce));

  console.log(`[NonceManager] Admin force reset: ${previousNonce} -> ${latestNonce}`);

  return { previousNonce, newNonce: latestNonce };
}

