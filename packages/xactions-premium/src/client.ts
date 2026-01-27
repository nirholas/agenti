/**
 * XActions Premium - x402 Payment Client
 * 
 * Handles x402 micropayments for premium Twitter automation services.
 * Enables AI agents to pay for enhanced features like:
 * - Rate limit bypass via proxy networks
 * - Sentiment analysis
 * - Engagement prediction
 * - Auto-engagement bot subscriptions
 * 
 * @author nich (@nichxbt) - https://github.com/nirholas
 * @see https://x402.org for protocol documentation
 * @license MIT
 */

import crypto from 'crypto';

// Lazy-load viem to make it optional
let viem: typeof import('viem') | null = null;
let viemAccounts: typeof import('viem/accounts') | null = null;
let viemChains: typeof import('viem/chains') | null = null;

async function loadViem() {
  if (!viem) {
    try {
      viem = await import('viem');
      viemAccounts = await import('viem/accounts');
      viemChains = await import('viem/chains');
    } catch {
      throw new Error(
        'viem package not installed. Install with: npm install viem\n' +
        'This is required for x402 payment signing.'
      );
    }
  }
  return { viem, viemAccounts, viemChains };
}

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface NetworkConfig {
  chainId: number;
  networkId: string;
  name: string;
  usdc: string;
  rpc?: string;
  testnet?: boolean;
}

export interface XActionsPaymentClientConfig {
  apiUrl?: string;
  privateKey?: string;
  sessionCookie?: string;
  network?: string;
  autoSelectNetwork?: boolean;
}

export interface PremiumPricing {
  rateLimitBypass: string;      // $0.01/100 requests
  sentimentAnalysis: string;    // $0.001/tweet
  engagementPrediction: string; // $0.005/prediction
  autoEngagementBot: string;    // $0.10/day subscription
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  amount?: string;
  network?: string;
  error?: string;
}

export interface SentimentResult {
  tweet: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number; // -1 to 1
  confidence: number;
  keywords: string[];
}

export interface EngagementPrediction {
  tweet: string;
  predictedLikes: number;
  predictedRetweets: number;
  predictedReplies: number;
  optimalPostTime: string;
  audienceMatch: number; // 0-100%
  viralPotential: 'low' | 'medium' | 'high';
}

export interface SubscriptionStatus {
  active: boolean;
  type: 'auto_engagement';
  expiresAt?: Date;
  features: string[];
  dailyCost: string;
}

// =============================================================================
// Network Configuration
// =============================================================================

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  'base-sepolia': {
    chainId: 84532,
    networkId: 'eip155:84532',
    name: 'Base Sepolia (Testnet)',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    testnet: true,
  },
  'base': {
    chainId: 8453,
    networkId: 'eip155:8453',
    name: 'Base Mainnet',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  'ethereum': {
    chainId: 1,
    networkId: 'eip155:1',
    name: 'Ethereum Mainnet',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  'arbitrum': {
    chainId: 42161,
    networkId: 'eip155:42161',
    name: 'Arbitrum One',
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
};

// =============================================================================
// Pricing Configuration
// =============================================================================

export const PREMIUM_PRICING: PremiumPricing = {
  rateLimitBypass: '$0.01',       // Per 100 requests
  sentimentAnalysis: '$0.001',    // Per tweet analyzed
  engagementPrediction: '$0.005', // Per prediction
  autoEngagementBot: '$0.10',     // Per day subscription
};

// Bulk discount tiers
export const BULK_DISCOUNTS = {
  sentimentAnalysis: [
    { threshold: 100, discount: 0.10 },   // 10% off for 100+ tweets
    { threshold: 500, discount: 0.20 },   // 20% off for 500+ tweets
    { threshold: 1000, discount: 0.30 },  // 30% off for 1000+ tweets
  ],
  engagementPrediction: [
    { threshold: 50, discount: 0.10 },
    { threshold: 200, discount: 0.20 },
  ],
};

// =============================================================================
// Payment Client
// =============================================================================

export class XActionsPaymentClient {
  private apiUrl: string;
  private privateKey?: string;
  private sessionCookie?: string;
  private network: string;
  private autoSelectNetwork: boolean;
  private wallet: any = null;
  private account: any = null;

  constructor(config: XActionsPaymentClientConfig) {
    this.apiUrl = config.apiUrl || 'https://api.xactions.app';
    this.privateKey = config.privateKey;
    this.sessionCookie = config.sessionCookie;
    this.network = config.network || 'base-sepolia';
    this.autoSelectNetwork = config.autoSelectNetwork ?? true;

    if (!NETWORK_CONFIGS[this.network]) {
      console.warn(`Unknown network: ${this.network}. Defaulting to base-sepolia.`);
      this.network = 'base-sepolia';
    }
  }

  /**
   * Initialize wallet for payments
   */
  async initialize(): Promise<void> {
    if (!this.privateKey) {
      console.warn('⚠️  No private key set - premium features requiring payment will fail');
      console.warn('   Get testnet USDC: https://faucet.circle.com/');
      return;
    }

    const { viem, viemAccounts, viemChains } = await loadViem();
    
    const pk = this.privateKey.startsWith('0x') 
      ? this.privateKey as `0x${string}` 
      : `0x${this.privateKey}` as `0x${string}`;
    
    this.account = viemAccounts!.privateKeyToAccount(pk);
    
    const chain = this.getChainConfig();
    this.wallet = viem!.createWalletClient({
      account: this.account,
      chain,
      transport: viem!.http(),
    });

    console.log(`💰 XActions Premium initialized`);
    console.log(`   Wallet: ${this.account.address}`);
    console.log(`   Network: ${NETWORK_CONFIGS[this.network].name}`);
  }

  private getChainConfig() {
    const { viemChains } = { viemChains: viemChains! };
    const chainMap: Record<string, any> = {
      'base-sepolia': viemChains.baseSepolia,
      'base': viemChains.base,
      'ethereum': viemChains.mainnet,
      'arbitrum': viemChains.arbitrum,
    };
    return chainMap[this.network] || viemChains.baseSepolia;
  }

  // ===========================================================================
  // Premium Service: Rate Limit Bypass
  // ===========================================================================

  /**
   * Purchase rate limit bypass credits
   * Uses proxy network for higher throughput with less detection
   * 
   * @param requestCount - Number of requests to purchase (minimum 100)
   * @returns Payment result with credits added
   */
  async purchaseRateLimitBypass(requestCount: number = 100): Promise<PaymentResult & { creditsAdded: number }> {
    const batches = Math.ceil(requestCount / 100);
    const price = batches * 0.01; // $0.01 per 100 requests

    const result = await this.makePayment('/api/premium/rate-limit', {
      operation: 'purchase_rate_limit_bypass',
      requestCount,
      price: `$${price.toFixed(2)}`,
    });

    return {
      ...result,
      creditsAdded: requestCount,
    };
  }

  // ===========================================================================
  // Premium Service: Sentiment Analysis
  // ===========================================================================

  /**
   * Analyze sentiment of tweets
   * 
   * @param tweets - Array of tweets to analyze
   * @returns Array of sentiment results
   */
  async analyzeSentiment(tweets: string[]): Promise<SentimentResult[]> {
    const discount = this.calculateBulkDiscount('sentimentAnalysis', tweets.length);
    const basePrice = tweets.length * 0.001;
    const finalPrice = basePrice * (1 - discount);

    const response = await this.makePaymentRequest('/api/premium/sentiment', {
      operation: 'sentiment_analysis',
      tweets,
      price: `$${finalPrice.toFixed(4)}`,
      bulkDiscount: discount > 0 ? `${discount * 100}%` : undefined,
    });

    return response.results as SentimentResult[];
  }

  /**
   * Analyze historical sentiment for an account
   * 
   * @param username - Twitter username
   * @param tweetCount - Number of recent tweets to analyze
   */
  async analyzeAccountSentiment(username: string, tweetCount: number = 50): Promise<{
    username: string;
    averageSentiment: number;
    sentimentTrend: 'improving' | 'declining' | 'stable';
    mostPositive: SentimentResult;
    mostNegative: SentimentResult;
    breakdown: { positive: number; neutral: number; negative: number };
    history: SentimentResult[];
  }> {
    const discount = this.calculateBulkDiscount('sentimentAnalysis', tweetCount);
    const basePrice = tweetCount * 0.001;
    const finalPrice = basePrice * (1 - discount);

    return await this.makePaymentRequest('/api/premium/sentiment/account', {
      operation: 'account_sentiment_analysis',
      username,
      tweetCount,
      price: `$${finalPrice.toFixed(4)}`,
    });
  }

  // ===========================================================================
  // Premium Service: Engagement Prediction
  // ===========================================================================

  /**
   * Predict engagement for a tweet before posting
   * 
   * @param tweetText - The tweet content
   * @param postTime - Optional scheduled post time
   */
  async predictEngagement(tweetText: string, postTime?: Date): Promise<EngagementPrediction> {
    return await this.makePaymentRequest('/api/premium/predict/single', {
      operation: 'engagement_prediction',
      tweet: tweetText,
      postTime: postTime?.toISOString(),
      price: PREMIUM_PRICING.engagementPrediction,
    });
  }

  /**
   * Get optimal posting times based on your audience
   * 
   * @param username - Your Twitter username
   */
  async getOptimalPostingTimes(username: string): Promise<{
    optimal: { day: string; hour: number; timezone: string }[];
    worstTimes: { day: string; hour: number }[];
    audienceActive: { start: number; end: number; timezone: string };
  }> {
    return await this.makePaymentRequest('/api/premium/predict/optimal-times', {
      operation: 'optimal_posting_times',
      username,
      price: '$0.01', // Slightly higher for analysis
    });
  }

  /**
   * Analyze audience composition
   */
  async analyzeAudience(username: string): Promise<{
    totalFollowers: number;
    activeFollowers: number;
    topInterests: string[];
    demographics: {
      techInfluencers: number;
      cryptoEnthusiasts: number;
      developers: number;
      investors: number;
      other: number;
    };
    engagement: {
      avgLikesPerPost: number;
      avgRepliesPerPost: number;
      topEngagers: { username: string; interactions: number }[];
    };
  }> {
    return await this.makePaymentRequest('/api/premium/predict/audience', {
      operation: 'audience_analysis',
      username,
      price: '$0.02',
    });
  }

  // ===========================================================================
  // Premium Service: Auto-Engagement Bot (Subscription)
  // ===========================================================================

  /**
   * Subscribe to auto-engagement bot service
   * Automatically likes relevant tweets, smart follow/unfollow, growth hacking
   * 
   * @param days - Number of days to subscribe (default: 1)
   */
  async subscribeAutoEngagement(days: number = 1): Promise<SubscriptionStatus> {
    const price = days * 0.10;

    const response = await this.makePaymentRequest('/api/premium/subscribe/auto-engagement', {
      operation: 'auto_engagement_subscription',
      days,
      price: `$${price.toFixed(2)}`,
    });

    return {
      active: true,
      type: 'auto_engagement',
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      features: [
        'auto_like_relevant_tweets',
        'smart_follow_unfollow',
        'growth_hacking_automation',
        'engagement_boost',
        'hashtag_targeting',
      ],
      dailyCost: PREMIUM_PRICING.autoEngagementBot,
    };
  }

  /**
   * Configure auto-engagement settings
   */
  async configureAutoEngagement(settings: {
    targetHashtags?: string[];
    targetAccounts?: string[];
    maxActionsPerHour?: number;
    enableAutoLike?: boolean;
    enableAutoFollow?: boolean;
    enableAutoReply?: boolean;
    filterKeywords?: string[];
  }): Promise<{ configured: boolean; settings: typeof settings }> {
    // This is free once subscribed
    return await this.makeRequest('/api/premium/auto-engagement/configure', settings);
  }

  /**
   * Check subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    return await this.makeRequest('/api/premium/subscription/status', {});
  }

  // ===========================================================================
  // Payment Helpers
  // ===========================================================================

  private calculateBulkDiscount(service: 'sentimentAnalysis' | 'engagementPrediction', count: number): number {
    const tiers = BULK_DISCOUNTS[service];
    let discount = 0;
    
    for (const tier of tiers) {
      if (count >= tier.threshold) {
        discount = tier.discount;
      }
    }
    
    return discount;
  }

  /**
   * Make a request that requires payment
   */
  private async makePaymentRequest(endpoint: string, body: Record<string, any>): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'XActions-Premium/1.0 (x402)',
    };
    
    if (this.sessionCookie) {
      headers['X-Session-Cookie'] = this.sessionCookie;
    }

    // First request (may return 402)
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 402) {
      if (!this.wallet) {
        throw new Error(
          'Payment required but no wallet configured. ' +
          'Set X402_PRIVATE_KEY environment variable.'
        );
      }

      const paymentRequired = await this.extractPaymentRequirements(response);
      const payment = await this.signPayment(paymentRequired);

      // Retry with payment
      const paidResponse = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'X-Payment': Buffer.from(JSON.stringify(payment)).toString('base64'),
        },
        body: JSON.stringify(body),
      });

      if (!paidResponse.ok) {
        const error = await paidResponse.json().catch(() => ({}));
        throw new Error(error.message || `Payment failed: ${paidResponse.status}`);
      }

      return await paidResponse.json();
    }

    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Request failed: ${response.status}`);
  }

  private async makePayment(endpoint: string, body: Record<string, any>): Promise<PaymentResult> {
    try {
      const result = await this.makePaymentRequest(endpoint, body);
      return {
        success: true,
        transactionHash: result.transactionHash,
        amount: body.price,
        network: this.network,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        network: this.network,
      };
    }
  }

  private async makeRequest(endpoint: string, body: Record<string, any>): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'XActions-Premium/1.0',
    };
    
    if (this.sessionCookie) {
      headers['X-Session-Cookie'] = this.sessionCookie;
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return await response.json();
  }

  private async extractPaymentRequirements(response: Response): Promise<any> {
    const header = response.headers.get('X-Payment-Required') || 
                   response.headers.get('Payment-Required');
    
    if (!header) {
      const body = await response.json().catch(() => ({}));
      return body;
    }

    return JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
  }

  private async signPayment(paymentRequired: any): Promise<any> {
    const networkConfig = NETWORK_CONFIGS[this.network];
    const requirements = paymentRequired.accepts?.[0] || paymentRequired;
    
    const usdcAddress = requirements.asset || networkConfig.usdc;
    const nonce = `0x${crypto.randomBytes(32).toString('hex')}`;
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 3600;

    // Parse price to get amount in smallest unit (6 decimals for USDC)
    const priceStr = requirements.maxAmountRequired || requirements.price || '$0.001';
    const priceNum = parseFloat(priceStr.replace('$', ''));
    const amount = BigInt(Math.ceil(priceNum * 1_000_000)); // Convert to 6 decimal places

    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId: networkConfig.chainId,
      verifyingContract: usdcAddress as `0x${string}`,
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    const message = {
      from: this.account.address,
      to: requirements.payTo as `0x${string}`,
      value: amount,
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: nonce as `0x${string}`,
    };

    const signature = await this.wallet.signTypedData({
      domain,
      types,
      primaryType: 'TransferWithAuthorization',
      message,
    });

    return {
      x402Version: 2,
      scheme: 'exact',
      network: networkConfig.networkId,
      payload: {
        signature,
        authorization: {
          from: this.account.address,
          to: requirements.payTo,
          value: amount.toString(),
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce,
        },
        networkName: this.network,
        chainId: networkConfig.chainId,
      },
    };
  }

  /**
   * Get wallet address (if initialized)
   */
  getWalletAddress(): string | null {
    return this.account?.address || null;
  }

  /**
   * Get current network configuration
   */
  getNetworkConfig(): NetworkConfig {
    return NETWORK_CONFIGS[this.network];
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an XActions Premium client
 * 
 * @example
 * ```typescript
 * const client = await createXActionsPaymentClient({
 *   privateKey: process.env.X402_PRIVATE_KEY,
 *   sessionCookie: process.env.X_AUTH_TOKEN,
 *   network: 'base-sepolia', // Use testnet for development
 * });
 * 
 * // Analyze sentiment
 * const results = await client.analyzeSentiment([
 *   "This product is amazing!",
 *   "I'm really disappointed with the service"
 * ]);
 * 
 * // Predict engagement
 * const prediction = await client.predictEngagement(
 *   "🚀 Just launched our new feature! Check it out at..."
 * );
 * 
 * // Subscribe to auto-engagement
 * const subscription = await client.subscribeAutoEngagement(7); // 7 days
 * ```
 */
export async function createXActionsPaymentClient(
  config: XActionsPaymentClientConfig
): Promise<XActionsPaymentClient> {
  const client = new XActionsPaymentClient(config);
  await client.initialize();
  return client;
}

export default XActionsPaymentClient;
