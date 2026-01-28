/**
 * QR Pay - MEGA Swap Aggregator
 * 
 * The most comprehensive DEX aggregator in crypto.
 * 50+ DEXs, 10+ chains, cross-chain support.
 * 
 * We beat competitors by:
 * 1. More sources = better rates
 * 2. Parallel queries = faster quotes  
 * 3. Gas-adjusted comparisons = true best rate
 * 4. Native cross-chain support
 */

// ============= TYPES =============

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  name?: string;
}

export interface SwapQuote {
  id: string;
  aggregator: string;
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  outputAmount: string;
  outputAmountUsd: number;
  gas: string;
  gasCostUsd: number;
  priceImpact: number;
  route: RouteStep[];
  estimatedTime: number;
  netOutput: number; // outputAmountUsd - gasCostUsd
  savings?: number; // vs next best quote
  txData?: TransactionData;
}

export interface RouteStep {
  protocol: string;
  protocolLogo?: string;
  action: 'swap' | 'bridge' | 'wrap' | 'unwrap';
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  chainId: number;
  fee?: number;
}

export interface TransactionData {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  chainId: number;
}

// ============= AGGREGATOR REGISTRY =============

export interface Aggregator {
  name: string;
  logo?: string;
  type: 'dex-aggregator' | 'dex' | 'bridge' | 'bridge-aggregator';
  chains: number[];
  features: string[];
  avgResponseTime: number; // ms
  reliability: number; // 0-1
}

export const AGGREGATOR_REGISTRY: Aggregator[] = [
  // ========== TIER 1: Major DEX Aggregators ==========
  { name: '1inch', type: 'dex-aggregator', chains: [1, 10, 56, 137, 42161, 43114, 8453, 324, 250, 100], features: ['limit-orders', 'fusion'], avgResponseTime: 800, reliability: 0.98 },
  { name: '0x', type: 'dex-aggregator', chains: [1, 10, 56, 137, 42161, 43114, 8453, 324, 250, 1101], features: ['rfq', 'gasless'], avgResponseTime: 600, reliability: 0.97 },
  { name: 'Paraswap', type: 'dex-aggregator', chains: [1, 10, 56, 137, 42161, 43114, 8453, 250], features: ['delta', 'limit-orders'], avgResponseTime: 700, reliability: 0.96 },
  { name: 'Odos', type: 'dex-aggregator', chains: [1, 10, 56, 137, 42161, 43114, 8453, 324, 250, 1101, 59144], features: ['multi-input', 'path-optimization'], avgResponseTime: 900, reliability: 0.95 },
  { name: 'KyberSwap', type: 'dex-aggregator', chains: [1, 10, 56, 137, 42161, 43114, 8453, 250, 1101, 59144, 534352], features: ['dynamic-fees', 'limit-orders'], avgResponseTime: 750, reliability: 0.94 },
  { name: 'OpenOcean', type: 'dex-aggregator', chains: [1, 10, 56, 137, 42161, 43114, 8453, 250, 324, 1101], features: ['cross-chain', 'limit-orders'], avgResponseTime: 850, reliability: 0.93 },
  { name: 'Matcha', type: 'dex-aggregator', chains: [1, 10, 56, 137, 42161, 8453, 43114], features: ['gasless'], avgResponseTime: 650, reliability: 0.95 },
  { name: 'CowSwap', type: 'dex-aggregator', chains: [1, 100, 42161], features: ['mev-protection', 'batch-auctions'], avgResponseTime: 1200, reliability: 0.92 },

  // ========== TIER 2: Chain-Native DEXs ==========
  // Ethereum
  { name: 'Uniswap', type: 'dex', chains: [1, 10, 137, 42161, 8453, 324, 43114, 56], features: ['v2', 'v3', 'v4'], avgResponseTime: 400, reliability: 0.99 },
  { name: 'SushiSwap', type: 'dex', chains: [1, 137, 42161, 43114, 250, 56], features: ['v2', 'trident'], avgResponseTime: 500, reliability: 0.95 },
  { name: 'Curve', type: 'dex', chains: [1, 137, 42161, 10, 43114, 250, 100], features: ['stableswap', 'tricrypto'], avgResponseTime: 600, reliability: 0.97 },
  { name: 'Balancer', type: 'dex', chains: [1, 137, 42161, 10, 43114, 100, 8453], features: ['weighted', 'composable', 'gyro'], avgResponseTime: 550, reliability: 0.96 },
  
  // Arbitrum
  { name: 'Camelot', type: 'dex', chains: [42161], features: ['v2', 'v3', 'launchpad'], avgResponseTime: 400, reliability: 0.95 },
  { name: 'GMX', type: 'dex', chains: [42161, 43114], features: ['perpetuals', 'spot'], avgResponseTime: 500, reliability: 0.97 },
  { name: 'Ramses', type: 'dex', chains: [42161], features: ['ve33', 'concentrated'], avgResponseTime: 450, reliability: 0.93 },
  
  // Base
  { name: 'Aerodrome', type: 'dex', chains: [8453], features: ['ve33', 'slipstream'], avgResponseTime: 400, reliability: 0.96 },
  { name: 'BaseSwap', type: 'dex', chains: [8453], features: ['v2', 'v3'], avgResponseTime: 450, reliability: 0.93 },
  
  // Optimism
  { name: 'Velodrome', type: 'dex', chains: [10], features: ['ve33', 'slipstream'], avgResponseTime: 400, reliability: 0.96 },
  { name: 'Synthetix', type: 'dex', chains: [1, 10, 8453], features: ['perpetuals', 'synths'], avgResponseTime: 600, reliability: 0.95 },
  
  // BSC
  { name: 'PancakeSwap', type: 'dex', chains: [56, 1, 42161, 324, 8453, 59144], features: ['v2', 'v3', 'stableswap'], avgResponseTime: 400, reliability: 0.97 },
  { name: 'Biswap', type: 'dex', chains: [56], features: ['v2', 'v3'], avgResponseTime: 450, reliability: 0.93 },
  { name: 'ApeSwap', type: 'dex', chains: [56, 137, 1], features: ['bonds', 'farms'], avgResponseTime: 500, reliability: 0.92 },
  
  // Avalanche
  { name: 'TraderJoe', type: 'dex', chains: [43114, 42161, 56], features: ['v2', 'v2.1', 'liquidity-book'], avgResponseTime: 450, reliability: 0.95 },
  { name: 'Pangolin', type: 'dex', chains: [43114], features: ['v2'], avgResponseTime: 500, reliability: 0.92 },
  { name: 'Platypus', type: 'dex', chains: [43114], features: ['stableswap'], avgResponseTime: 550, reliability: 0.91 },
  
  // Polygon
  { name: 'QuickSwap', type: 'dex', chains: [137, 1101], features: ['v2', 'v3', 'dragon-lair'], avgResponseTime: 450, reliability: 0.94 },
  { name: 'Retro', type: 'dex', chains: [137], features: ['ve33'], avgResponseTime: 500, reliability: 0.91 },
  
  // Fantom
  { name: 'SpookySwap', type: 'dex', chains: [250], features: ['v2', 'v3'], avgResponseTime: 450, reliability: 0.93 },
  { name: 'Beethoven X', type: 'dex', chains: [250, 10], features: ['weighted', 'composable'], avgResponseTime: 500, reliability: 0.92 },
  
  // zkSync
  { name: 'SyncSwap', type: 'dex', chains: [324], features: ['classic', 'stable'], avgResponseTime: 450, reliability: 0.94 },
  { name: 'Mute', type: 'dex', chains: [324], features: ['amplified'], avgResponseTime: 500, reliability: 0.92 },
  { name: 'Maverick', type: 'dex', chains: [1, 324, 8453], features: ['directional-lp'], avgResponseTime: 550, reliability: 0.93 },
  
  // Other EVM
  { name: 'DODO', type: 'dex', chains: [1, 56, 137, 42161, 10, 43114, 8453], features: ['pmm', 'crowdpooling'], avgResponseTime: 600, reliability: 0.93 },
  { name: 'Hashflow', type: 'dex', chains: [1, 56, 137, 42161, 10, 43114], features: ['rfq', 'cross-chain'], avgResponseTime: 700, reliability: 0.94 },
  { name: 'WOOFi', type: 'dex', chains: [1, 56, 137, 42161, 10, 43114, 8453, 250], features: ['synthetic-proactive-mm'], avgResponseTime: 550, reliability: 0.93 },
  { name: 'Bancor', type: 'dex', chains: [1], features: ['impermanent-loss-protection'], avgResponseTime: 650, reliability: 0.91 },
  { name: 'Fraxswap', type: 'dex', chains: [1, 42161, 137, 10, 56], features: ['twamm'], avgResponseTime: 500, reliability: 0.92 },
  { name: 'Ambient', type: 'dex', chains: [1, 534352], features: ['zero-fee-tiers'], avgResponseTime: 600, reliability: 0.91 },
  { name: 'iZUMi', type: 'dex', chains: [1, 56, 137, 42161, 324, 59144, 534352], features: ['discretized-liquidity'], avgResponseTime: 550, reliability: 0.92 },
  
  // Solana
  { name: 'Jupiter', type: 'dex-aggregator', chains: [101], features: ['limit-orders', 'dca', 'perpetuals'], avgResponseTime: 500, reliability: 0.98 },
  { name: 'Raydium', type: 'dex', chains: [101], features: ['concentrated', 'cpmm'], avgResponseTime: 400, reliability: 0.96 },
  { name: 'Orca', type: 'dex', chains: [101], features: ['whirlpools'], avgResponseTime: 400, reliability: 0.96 },
  { name: 'Meteora', type: 'dex', chains: [101], features: ['dlmm'], avgResponseTime: 450, reliability: 0.94 },
  { name: 'Phoenix', type: 'dex', chains: [101], features: ['orderbook'], avgResponseTime: 350, reliability: 0.95 },
  { name: 'Lifinity', type: 'dex', chains: [101], features: ['proactive-mm'], avgResponseTime: 450, reliability: 0.93 },
  { name: 'Marinade', type: 'dex', chains: [101], features: ['liquid-staking'], avgResponseTime: 500, reliability: 0.95 },
  
  // ========== TIER 3: Bridge Aggregators ==========
  { name: 'Socket', type: 'bridge-aggregator', chains: [1, 10, 56, 137, 42161, 43114, 8453, 324, 250, 1101, 59144, 534352], features: ['multi-bridge', 'refuel'], avgResponseTime: 2000, reliability: 0.94 },
  { name: 'LiFi', type: 'bridge-aggregator', chains: [1, 10, 56, 137, 42161, 43114, 8453, 324, 250, 1101, 59144], features: ['multi-bridge', 'split-routes'], avgResponseTime: 2500, reliability: 0.93 },
  { name: 'Squid', type: 'bridge-aggregator', chains: [1, 10, 56, 137, 42161, 43114, 8453], features: ['axelar-powered', 'any-to-any'], avgResponseTime: 2000, reliability: 0.92 },
  
  // ========== TIER 4: Individual Bridges ==========
  { name: 'Stargate', type: 'bridge', chains: [1, 10, 56, 137, 42161, 43114, 8453, 250, 59144], features: ['unified-liquidity', 'instant-finality'], avgResponseTime: 1500, reliability: 0.96 },
  { name: 'Across', type: 'bridge', chains: [1, 10, 137, 42161, 8453, 324, 59144], features: ['intent-based', 'fast'], avgResponseTime: 1200, reliability: 0.97 },
  { name: 'Hop', type: 'bridge', chains: [1, 10, 137, 42161, 100], features: ['bonder-network'], avgResponseTime: 1800, reliability: 0.95 },
  { name: 'Synapse', type: 'bridge', chains: [1, 10, 56, 137, 42161, 43114, 8453, 250], features: ['amm-bridge', 'neth'], avgResponseTime: 2000, reliability: 0.94 },
  { name: 'Celer', type: 'bridge', chains: [1, 10, 56, 137, 42161, 43114, 250], features: ['im', 'sgn'], avgResponseTime: 1500, reliability: 0.93 },
  { name: 'Connext', type: 'bridge', chains: [1, 10, 137, 42161, 100, 56], features: ['xcall', 'fast-path'], avgResponseTime: 1800, reliability: 0.92 },
  { name: 'Wormhole', type: 'bridge', chains: [1, 10, 56, 137, 42161, 43114, 101], features: ['guardian-network', 'cctp'], avgResponseTime: 3000, reliability: 0.94 },
];

// ============= CHAIN CONFIGS =============

export const CHAIN_CONFIGS: Record<number, {
  name: string;
  shortName: string;
  nativeCurrency: { symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorer: string;
  avgBlockTime: number; // seconds
  color: string;
}> = {
  1: { name: 'Ethereum', shortName: 'ETH', nativeCurrency: { symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'], blockExplorer: 'https://etherscan.io', avgBlockTime: 12, color: '#627EEA' },
  10: { name: 'Optimism', shortName: 'OP', nativeCurrency: { symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://optimism.llamarpc.com', 'https://rpc.ankr.com/optimism'], blockExplorer: 'https://optimistic.etherscan.io', avgBlockTime: 2, color: '#FF0420' },
  56: { name: 'BNB Chain', shortName: 'BSC', nativeCurrency: { symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://bsc.llamarpc.com', 'https://rpc.ankr.com/bsc'], blockExplorer: 'https://bscscan.com', avgBlockTime: 3, color: '#F0B90B' },
  137: { name: 'Polygon', shortName: 'MATIC', nativeCurrency: { symbol: 'MATIC', decimals: 18 }, rpcUrls: ['https://polygon.llamarpc.com', 'https://rpc.ankr.com/polygon'], blockExplorer: 'https://polygonscan.com', avgBlockTime: 2, color: '#8247E5' },
  250: { name: 'Fantom', shortName: 'FTM', nativeCurrency: { symbol: 'FTM', decimals: 18 }, rpcUrls: ['https://rpc.ftm.tools', 'https://rpc.ankr.com/fantom'], blockExplorer: 'https://ftmscan.com', avgBlockTime: 1, color: '#1969FF' },
  324: { name: 'zkSync Era', shortName: 'zkSync', nativeCurrency: { symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.era.zksync.io'], blockExplorer: 'https://explorer.zksync.io', avgBlockTime: 1, color: '#8B8DFC' },
  8453: { name: 'Base', shortName: 'Base', nativeCurrency: { symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://base.llamarpc.com', 'https://mainnet.base.org'], blockExplorer: 'https://basescan.org', avgBlockTime: 2, color: '#0052FF' },
  42161: { name: 'Arbitrum', shortName: 'ARB', nativeCurrency: { symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://arbitrum.llamarpc.com', 'https://arb1.arbitrum.io/rpc'], blockExplorer: 'https://arbiscan.io', avgBlockTime: 0.25, color: '#28A0F0' },
  43114: { name: 'Avalanche', shortName: 'AVAX', nativeCurrency: { symbol: 'AVAX', decimals: 18 }, rpcUrls: ['https://avalanche.llamarpc.com', 'https://api.avax.network/ext/bc/C/rpc'], blockExplorer: 'https://snowtrace.io', avgBlockTime: 2, color: '#E84142' },
  59144: { name: 'Linea', shortName: 'Linea', nativeCurrency: { symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.linea.build'], blockExplorer: 'https://lineascan.build', avgBlockTime: 2, color: '#61DFFF' },
  534352: { name: 'Scroll', shortName: 'Scroll', nativeCurrency: { symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.scroll.io'], blockExplorer: 'https://scrollscan.com', avgBlockTime: 3, color: '#FFEEDA' },
  1101: { name: 'Polygon zkEVM', shortName: 'zkEVM', nativeCurrency: { symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://zkevm-rpc.com'], blockExplorer: 'https://zkevm.polygonscan.com', avgBlockTime: 2, color: '#8247E5' },
  100: { name: 'Gnosis', shortName: 'GNO', nativeCurrency: { symbol: 'xDAI', decimals: 18 }, rpcUrls: ['https://rpc.gnosischain.com'], blockExplorer: 'https://gnosisscan.io', avgBlockTime: 5, color: '#04795B' },
  101: { name: 'Solana', shortName: 'SOL', nativeCurrency: { symbol: 'SOL', decimals: 9 }, rpcUrls: ['https://api.mainnet-beta.solana.com'], blockExplorer: 'https://solscan.io', avgBlockTime: 0.4, color: '#9945FF' },
};

// ============= TOKEN REGISTRIES =============

export const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  324: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',
  250: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
  59144: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
  534352: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
  1101: '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035',
  100: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
  101: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Solana USDC
};

export const NATIVE_ADDRESSES: Record<number, string> = {
  1: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  10: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  56: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  137: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  8453: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  42161: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  43114: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  324: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  250: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  59144: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  534352: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  1101: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  100: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  101: 'So11111111111111111111111111111111111111112', // Solana wrapped SOL
};

// ============= MEGA AGGREGATOR CLASS =============

class MegaAggregator {
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private quoteCache: Map<string, { quotes: SwapQuote[]; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 60000; // 1 minute
  private readonly QUOTE_CACHE_TTL = 10000; // 10 seconds
  
  /**
   * Get quotes from ALL relevant aggregators in parallel
   */
  async getQuotes(params: {
    inputToken: Token;
    outputToken: Token;
    amount: string;
    slippage?: number;
    userAddress?: string;
  }): Promise<SwapQuote[]> {
    const { inputToken, outputToken, amount, slippage = 0.5, userAddress } = params;
    const cacheKey = `${inputToken.chainId}-${inputToken.address}-${outputToken.chainId}-${outputToken.address}-${amount}`;
    
    // Check cache
    const cached = this.quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.QUOTE_CACHE_TTL) {
      return cached.quotes;
    }
    
    const isCrossChain = inputToken.chainId !== outputToken.chainId;
    
    // Select aggregators based on chains and cross-chain status
    const eligibleAggregators = AGGREGATOR_REGISTRY.filter(agg => {
      if (isCrossChain) {
        return (agg.type === 'bridge' || agg.type === 'bridge-aggregator') &&
               agg.chains.includes(inputToken.chainId) &&
               agg.chains.includes(outputToken.chainId);
      }
      return agg.chains.includes(inputToken.chainId);
    });
    
    console.log(`[MegaAggregator] Querying ${eligibleAggregators.length} aggregators for ${inputToken.symbol} → ${outputToken.symbol}`);
    
    // Query all in parallel with individual timeouts
    const quotePromises = eligibleAggregators.map(async (agg) => {
      const timeout = agg.avgResponseTime * 3; // 3x avg as timeout
      try {
        const quote = await Promise.race([
          this.queryAggregator(agg, { inputToken, outputToken, amount, slippage, userAddress }),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
        return quote;
      } catch (error) {
        console.warn(`[${agg.name}] Failed:`, (error as Error).message);
        return null;
      }
    });
    
    const results = await Promise.allSettled(quotePromises);
    
    // Filter and sort quotes
    let quotes = results
      .filter((r): r is PromiseFulfilledResult<SwapQuote | null> => 
        r.status === 'fulfilled' && r.value !== null
      )
      .map(r => r.value as SwapQuote);
    
    // Calculate net output and sort
    quotes = quotes.map(q => ({
      ...q,
      netOutput: q.outputAmountUsd - q.gasCostUsd,
    }));
    
    quotes.sort((a, b) => b.netOutput - a.netOutput);
    
    // Calculate savings vs next best
    if (quotes.length > 1) {
      quotes[0].savings = quotes[0].netOutput - quotes[1].netOutput;
    }
    
    // Cache results
    this.quoteCache.set(cacheKey, { quotes, timestamp: Date.now() });
    
    console.log(`[MegaAggregator] Got ${quotes.length} valid quotes. Best: ${quotes[0]?.aggregator} @ ${quotes[0]?.netOutput.toFixed(2)} USD net`);
    
    return quotes;
  }
  
  /**
   * Get the single best quote
   */
  async getBestQuote(params: {
    inputToken: Token;
    outputToken: Token;
    amount: string;
    slippage?: number;
    userAddress?: string;
  }): Promise<SwapQuote | null> {
    const quotes = await this.getQuotes(params);
    return quotes[0] || null;
  }
  
  /**
   * Query a specific aggregator
   */
  private async queryAggregator(
    agg: Aggregator,
    params: {
      inputToken: Token;
      outputToken: Token;
      amount: string;
      slippage: number;
      userAddress?: string;
    }
  ): Promise<SwapQuote> {
    // In production, this would call real APIs
    // For now, simulate with realistic mock data
    return this.createSimulatedQuote(agg, params);
  }
  
  /**
   * Create simulated quote (development mode)
   */
  private createSimulatedQuote(
    agg: Aggregator,
    params: {
      inputToken: Token;
      outputToken: Token;
      amount: string;
      slippage: number;
    }
  ): SwapQuote {
    const { inputToken, outputToken, amount } = params;
    
    // Simulate rate variance between aggregators (±2%)
    const baseRate = 1.0;
    const variance = 0.98 + Math.random() * 0.04;
    const inputAmountNum = parseFloat(amount) / Math.pow(10, inputToken.decimals);
    const outputAmountNum = inputAmountNum * baseRate * variance;
    const outputAmount = Math.floor(outputAmountNum * Math.pow(10, outputToken.decimals)).toString();
    
    // Simulate gas costs based on chain
    const chainGasCosts: Record<number, number> = {
      1: 5 + Math.random() * 15, // Ethereum: $5-20
      10: 0.01 + Math.random() * 0.05, // Optimism: $0.01-0.06
      56: 0.05 + Math.random() * 0.1, // BSC: $0.05-0.15
      137: 0.01 + Math.random() * 0.03, // Polygon: $0.01-0.04
      8453: 0.01 + Math.random() * 0.05, // Base: $0.01-0.06
      42161: 0.05 + Math.random() * 0.15, // Arbitrum: $0.05-0.20
      43114: 0.02 + Math.random() * 0.08, // Avalanche: $0.02-0.10
      324: 0.02 + Math.random() * 0.05, // zkSync: $0.02-0.07
      250: 0.001 + Math.random() * 0.005, // Fantom: very cheap
      101: 0.0001 + Math.random() * 0.001, // Solana: very cheap
    };
    
    const gasCostUsd = chainGasCosts[inputToken.chainId] || 0.1;
    const isCrossChain = inputToken.chainId !== outputToken.chainId;
    
    return {
      id: `${agg.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      aggregator: agg.name,
      inputToken,
      outputToken,
      inputAmount: amount,
      outputAmount,
      outputAmountUsd: outputAmountNum, // Assuming USDC output = USD
      gas: '200000',
      gasCostUsd: isCrossChain ? gasCostUsd * 3 : gasCostUsd, // Cross-chain is more expensive
      priceImpact: Math.random() * 0.5, // 0-0.5%
      route: [
        {
          protocol: agg.name,
          action: isCrossChain ? 'bridge' : 'swap',
          tokenIn: inputToken,
          tokenOut: outputToken,
          amountIn: amount,
          amountOut: outputAmount,
          chainId: inputToken.chainId,
        },
      ],
      estimatedTime: isCrossChain ? 60 + Math.floor(Math.random() * 120) : 15 + Math.floor(Math.random() * 30),
      netOutput: outputAmountNum - gasCostUsd,
    };
  }
  
  /**
   * Get list of supported chains
   */
  getSupportedChains(): number[] {
    return Object.keys(CHAIN_CONFIGS).map(Number);
  }
  
  /**
   * Get aggregators for a specific chain
   */
  getAggregatorsForChain(chainId: number): Aggregator[] {
    return AGGREGATOR_REGISTRY.filter(a => a.chains.includes(chainId));
  }
  
  /**
   * Get total aggregator count
   */
  getAggregatorCount(): number {
    return AGGREGATOR_REGISTRY.length;
  }
  
  /**
   * Get aggregator names for display
   */
  getAggregatorNames(): string[] {
    return AGGREGATOR_REGISTRY.map(a => a.name);
  }
}

// Export singleton
export const megaAggregator = new MegaAggregator();

// Export registry for UI
export const AGGREGATOR_NAMES = AGGREGATOR_REGISTRY.map(a => a.name);
export const AGGREGATOR_COUNT = AGGREGATOR_REGISTRY.length;
export const CHAIN_COUNT = Object.keys(CHAIN_CONFIGS).length;
