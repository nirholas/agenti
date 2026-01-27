/**
 * XActions Premium MCP Tools
 * 
 * MCP (Model Context Protocol) tools for AI agents to access
 * XActions premium features via x402 micropayments.
 * 
 * Tools:
 * - xactions_premium_sentiment: Analyze tweet sentiment
 * - xactions_premium_predict: Predict engagement
 * - xactions_premium_rate_limit: Purchase rate limit bypass
 * - xactions_subscribe_bot: Subscribe to auto-engagement
 * - xactions_subscription_status: Check subscription status
 * 
 * @author nich (@nichxbt)
 * @license MIT
 */

import { XActionsPaymentClient, PREMIUM_PRICING, BULK_DISCOUNTS } from './client.js';

// =============================================================================
// Types
// =============================================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      items?: { type: string };
      default?: any;
      minimum?: number;
      maximum?: number;
    }>;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const PREMIUM_TOOLS: MCPTool[] = [
  {
    name: 'xactions_premium_sentiment',
    description: `Analyze sentiment of tweets using AI. Returns positive/negative/neutral classification with confidence scores.
    
💰 Pricing: ${PREMIUM_PRICING.sentimentAnalysis}/tweet
📊 Bulk discounts: 10% off 100+ tweets, 20% off 500+, 30% off 1000+

Perfect for:
- Monitoring brand mentions
- Analyzing competitor sentiment
- Understanding audience reactions`,
    inputSchema: {
      type: 'object',
      properties: {
        tweets: {
          type: 'array',
          description: 'Array of tweet texts to analyze',
          items: { type: 'string' },
        },
        username: {
          type: 'string',
          description: 'Or analyze recent tweets from a username (without @)',
        },
        tweetCount: {
          type: 'number',
          description: 'Number of tweets to analyze if using username (default: 50)',
          default: 50,
          minimum: 1,
          maximum: 500,
        },
      },
      required: [],
    },
  },
  {
    name: 'xactions_premium_predict',
    description: `Predict engagement metrics before posting a tweet. Get predicted likes, retweets, optimal posting time, and viral potential.
    
💰 Pricing: ${PREMIUM_PRICING.engagementPrediction}/prediction

Features:
- Predicted likes/retweets/replies
- Optimal posting time
- Audience match score
- Viral potential rating`,
    inputSchema: {
      type: 'object',
      properties: {
        tweet: {
          type: 'string',
          description: 'Tweet content to analyze',
        },
        postTime: {
          type: 'string',
          description: 'Optional ISO datetime for scheduled post time',
        },
      },
      required: ['tweet'],
    },
  },
  {
    name: 'xactions_premium_optimal_times',
    description: `Get optimal posting times based on your audience activity patterns.
    
💰 Pricing: $0.01/analysis

Returns:
- Best days/hours to post
- Worst times to avoid
- Audience activity windows`,
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Your Twitter username (without @)',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'xactions_premium_audience',
    description: `Deep audience analysis - understand who follows you and engages with your content.
    
💰 Pricing: $0.02/analysis

Returns:
- Follower demographics (tech, crypto, developers, investors)
- Top interests
- Engagement metrics
- Top engagers list`,
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Twitter username to analyze (without @)',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'xactions_premium_rate_limit',
    description: `Purchase rate limit bypass credits. Uses proxy network for higher throughput with less detection.
    
💰 Pricing: ${PREMIUM_PRICING.rateLimitBypass}/100 requests

Benefits:
- Higher request throughput
- Reduced detection risk
- Proxy network routing`,
    inputSchema: {
      type: 'object',
      properties: {
        requestCount: {
          type: 'number',
          description: 'Number of requests to purchase (minimum 100)',
          minimum: 100,
          default: 100,
        },
      },
      required: [],
    },
  },
  {
    name: 'xactions_subscribe_bot',
    description: `Subscribe to the auto-engagement bot for hands-free growth hacking.
    
💰 Pricing: ${PREMIUM_PRICING.autoEngagementBot}/day

Features:
- Auto-like relevant tweets
- Smart follow/unfollow
- Growth hacking automation
- Hashtag targeting
- Engagement boosting`,
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to subscribe (default: 1)',
          minimum: 1,
          maximum: 30,
          default: 1,
        },
        targetHashtags: {
          type: 'array',
          description: 'Hashtags to target for engagement',
          items: { type: 'string' },
        },
        targetAccounts: {
          type: 'array',
          description: 'Accounts whose followers to target',
          items: { type: 'string' },
        },
      },
      required: [],
    },
  },
  {
    name: 'xactions_configure_bot',
    description: `Configure auto-engagement bot settings. Free for subscribers.

Settings:
- Target hashtags
- Target accounts
- Max actions per hour
- Enable/disable features
- Filter keywords`,
    inputSchema: {
      type: 'object',
      properties: {
        targetHashtags: {
          type: 'array',
          description: 'Hashtags to target',
          items: { type: 'string' },
        },
        targetAccounts: {
          type: 'array',
          description: 'Accounts to target',
          items: { type: 'string' },
        },
        maxActionsPerHour: {
          type: 'number',
          description: 'Maximum actions per hour (default: 30)',
          minimum: 1,
          maximum: 100,
          default: 30,
        },
        enableAutoLike: {
          type: 'boolean',
          description: 'Enable auto-liking (default: true)',
        },
        enableAutoFollow: {
          type: 'boolean',
          description: 'Enable auto-following (default: true)',
        },
        filterKeywords: {
          type: 'array',
          description: 'Keywords to filter out',
          items: { type: 'string' },
        },
      },
      required: [],
    },
  },
  {
    name: 'xactions_subscription_status',
    description: 'Check your current subscription status and features.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'xactions_premium_pricing',
    description: 'Get current pricing for all premium features.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// =============================================================================
// Tool Executor
// =============================================================================

export class XActionsPremiumToolExecutor {
  private client: XActionsPaymentClient;

  constructor(client: XActionsPaymentClient) {
    this.client = client;
  }

  /**
   * Execute a premium tool
   */
  async execute(toolName: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result: any;

      switch (toolName) {
        case 'xactions_premium_sentiment':
          result = await this.executeSentiment(args);
          break;

        case 'xactions_premium_predict':
          result = await this.client.predictEngagement(args.tweet, args.postTime ? new Date(args.postTime) : undefined);
          break;

        case 'xactions_premium_optimal_times':
          result = await this.client.getOptimalPostingTimes(args.username);
          break;

        case 'xactions_premium_audience':
          result = await this.client.analyzeAudience(args.username);
          break;

        case 'xactions_premium_rate_limit':
          result = await this.client.purchaseRateLimitBypass(args.requestCount || 100);
          break;

        case 'xactions_subscribe_bot':
          result = await this.executeSubscription(args);
          break;

        case 'xactions_configure_bot':
          result = await this.client.configureAutoEngagement({
            targetHashtags: args.targetHashtags,
            targetAccounts: args.targetAccounts,
            maxActionsPerHour: args.maxActionsPerHour,
            enableAutoLike: args.enableAutoLike,
            enableAutoFollow: args.enableAutoFollow,
            filterKeywords: args.filterKeywords,
          });
          break;

        case 'xactions_subscription_status':
          result = await this.client.getSubscriptionStatus();
          break;

        case 'xactions_premium_pricing':
          result = this.getPricingInfo();
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              hint: error.message.includes('Payment required')
                ? 'Set X402_PRIVATE_KEY with a funded wallet. Get testnet USDC: https://faucet.circle.com/'
                : undefined,
            }),
          },
        ],
        isError: true,
      };
    }
  }

  private async executeSentiment(args: Record<string, any>) {
    if (args.tweets && args.tweets.length > 0) {
      return await this.client.analyzeSentiment(args.tweets);
    } else if (args.username) {
      return await this.client.analyzeAccountSentiment(args.username, args.tweetCount || 50);
    } else {
      throw new Error('Either tweets array or username is required');
    }
  }

  private async executeSubscription(args: Record<string, any>) {
    const subscription = await this.client.subscribeAutoEngagement(args.days || 1);

    // Configure if settings provided
    if (args.targetHashtags || args.targetAccounts) {
      await this.client.configureAutoEngagement({
        targetHashtags: args.targetHashtags,
        targetAccounts: args.targetAccounts,
      });
    }

    return subscription;
  }

  private getPricingInfo() {
    return {
      pricing: PREMIUM_PRICING,
      bulkDiscounts: BULK_DISCOUNTS,
      freeTier: {
        description: 'Basic scraping, 100 requests/day',
        features: ['x_get_profile', 'x_get_followers', 'x_get_tweets', 'x_search_tweets'],
      },
      payAsYouGo: {
        description: 'Pay per operation, no minimums',
        range: '$0.001 - $0.01 per operation',
      },
      subscription: {
        description: 'Auto-engagement bot',
        price: '$0.10/day',
        features: [
          'Unlimited premium requests',
          'Auto-like relevant tweets',
          'Smart follow/unfollow',
          'Growth automation',
        ],
      },
      networks: [
        { name: 'Base Sepolia (Testnet)', recommended: true, gasCost: 'Free' },
        { name: 'Base Mainnet', gasCost: '~$0.01' },
        { name: 'Ethereum Mainnet', gasCost: '~$5-50' },
        { name: 'Arbitrum One', gasCost: '~$0.10' },
      ],
      faucet: 'https://faucet.circle.com/',
    };
  }
}

// =============================================================================
// MCP Server Integration Helper
// =============================================================================

/**
 * Register premium tools with an MCP server
 * 
 * @example
 * ```typescript
 * import { Server } from '@modelcontextprotocol/sdk/server/index.js';
 * import { registerPremiumTools } from '@nirholas/xactions-premium/mcp';
 * 
 * const server = new Server({ name: 'xactions', version: '1.0' });
 * const client = await createXActionsPaymentClient({ privateKey: '...' });
 * 
 * registerPremiumTools(server, client);
 * ```
 */
export function registerPremiumTools(
  server: any, // MCP Server instance
  client: XActionsPaymentClient
): void {
  const executor = new XActionsPremiumToolExecutor(client);

  // Register list tools handler
  server.setRequestHandler({ method: 'tools/list' }, async () => {
    return { tools: PREMIUM_TOOLS };
  });

  // Register call tool handler
  server.setRequestHandler({ method: 'tools/call' }, async (request: any) => {
    const { name, arguments: args } = request.params;
    return await executor.execute(name, args || {});
  });
}

export default {
  PREMIUM_TOOLS,
  XActionsPremiumToolExecutor,
  registerPremiumTools,
};
