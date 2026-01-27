#!/usr/bin/env node
/**
 * XActions Premium MCP Server
 * 
 * Complete MCP server combining free XActions tools with premium paid features.
 * AI agents can use both free and paid tools seamlessly.
 * 
 * Free Tools (from base XActions):
 * - x_get_profile, x_get_followers, x_get_tweets, etc.
 * 
 * Premium Tools (x402 payments):
 * - xactions_premium_sentiment ($0.001/tweet)
 * - xactions_premium_predict ($0.005/prediction)
 * - xactions_subscribe_bot ($0.10/day)
 * 
 * Usage:
 *   node examples/mcp-server.js
 * 
 * Environment Variables:
 *   X402_PRIVATE_KEY     - Wallet private key for payments
 *   X_AUTH_TOKEN         - Twitter session cookie
 *   X402_NETWORK         - Network (base-sepolia, base, ethereum, arbitrum)
 *   XACTIONS_API_URL     - API URL (default: https://api.xactions.app)
 * 
 * @author nich (@nichxbt)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { 
  createXActionsPaymentClient,
  XActionsPremiumToolExecutor,
  PREMIUM_TOOLS,
  PREMIUM_PRICING,
} from '../src/index.js';

// =============================================================================
// Configuration
// =============================================================================

const X402_PRIVATE_KEY = process.env.X402_PRIVATE_KEY;
const X_AUTH_TOKEN = process.env.X_AUTH_TOKEN || process.env.XACTIONS_SESSION_COOKIE;
const X402_NETWORK = process.env.X402_NETWORK || 'base-sepolia';
const API_URL = process.env.XACTIONS_API_URL || 'https://api.xactions.app';

// =============================================================================
// Free Tools (Basic XActions functionality)
// =============================================================================

const FREE_TOOLS = [
  {
    name: 'x_get_profile',
    description: '🆓 FREE - Get profile information for any X/Twitter user.',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Username without @',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'x_get_followers',
    description: '🆓 FREE - Scrape followers for an account (100/day limit).',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Username without @',
        },
        limit: {
          type: 'number',
          description: 'Maximum followers to scrape (default: 100)',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'x_get_tweets',
    description: '🆓 FREE - Scrape recent tweets from a user.',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Username without @',
        },
        limit: {
          type: 'number',
          description: 'Maximum tweets (default: 50)',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'x_search_tweets',
    description: '🆓 FREE - Search for tweets matching a query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (supports operators like from:, to:, #hashtag)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)',
        },
      },
      required: ['query'],
    },
  },
];

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: 'xactions-premium-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Premium client and tool executor
let premiumClient = null;
let premiumExecutor = null;

// =============================================================================
// Initialization
// =============================================================================

async function initialize() {
  console.error('');
  console.error('⚡ XActions Premium MCP Server v1.0.0');
  console.error('   https://github.com/nirholas/XActions');
  console.error('');
  
  // Initialize premium client
  if (X402_PRIVATE_KEY) {
    try {
      premiumClient = await createXActionsPaymentClient({
        apiUrl: API_URL,
        privateKey: X402_PRIVATE_KEY,
        sessionCookie: X_AUTH_TOKEN,
        network: X402_NETWORK,
      });
      
      premiumExecutor = new XActionsPremiumToolExecutor(premiumClient);
      
      console.error('💰 Premium features enabled');
      console.error(`   Wallet: ${premiumClient.getWalletAddress()}`);
      console.error(`   Network: ${premiumClient.getNetworkConfig().name}`);
    } catch (error) {
      console.error('⚠️  Failed to initialize premium client:', error.message);
    }
  } else {
    console.error('⚠️  X402_PRIVATE_KEY not set - premium features disabled');
    console.error('   Get testnet USDC: https://faucet.circle.com/');
  }
  
  console.error('');
  console.error('📋 Tools available:');
  console.error(`   🆓 Free: ${FREE_TOOLS.length} tools`);
  console.error(`   💎 Premium: ${PREMIUM_TOOLS.length} tools`);
  console.error('');
  
  // Log pricing
  console.error('💵 Premium Pricing:');
  Object.entries(PREMIUM_PRICING).forEach(([feature, price]) => {
    console.error(`   ${feature}: ${price}`);
  });
  console.error('');
}

// =============================================================================
// Tool Handlers
// =============================================================================

// List all tools (free + premium)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    ...FREE_TOOLS,
    ...PREMIUM_TOOLS.map(tool => ({
      ...tool,
      description: `💎 PREMIUM - ${tool.description}`,
    })),
  ];
  
  return { tools };
});

// Execute tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    // Check if it's a premium tool
    const isPremium = PREMIUM_TOOLS.some(t => t.name === name);
    
    if (isPremium) {
      if (!premiumExecutor) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Premium features not available',
              message: 'Set X402_PRIVATE_KEY environment variable to enable premium features',
              faucet: 'https://faucet.circle.com/',
              pricing: PREMIUM_PRICING,
            }, null, 2),
          }],
          isError: true,
        };
      }
      
      return await premiumExecutor.execute(name, args || {});
    }
    
    // Free tool execution (simplified - in production, connect to actual XActions)
    const result = await executeFreeToolMock(name, args || {});
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: error.message }),
      }],
      isError: true,
    };
  }
});

// =============================================================================
// Free Tool Execution (Mock - connect to actual XActions in production)
// =============================================================================

async function executeFreeToolMock(name, args) {
  switch (name) {
    case 'x_get_profile':
      return {
        username: args.username,
        displayName: `User ${args.username}`,
        bio: 'Mock profile bio',
        followers: 1234,
        following: 567,
        tweets: 890,
        note: '🆓 Free tier - 100 requests/day',
      };
      
    case 'x_get_followers':
      return {
        username: args.username,
        followers: Array(Math.min(args.limit || 10, 10)).fill(null).map((_, i) => ({
          username: `follower_${i + 1}`,
          displayName: `Follower ${i + 1}`,
        })),
        note: '🆓 Free tier - limited results',
      };
      
    case 'x_get_tweets':
      return {
        username: args.username,
        tweets: Array(Math.min(args.limit || 5, 5)).fill(null).map((_, i) => ({
          id: `${Date.now()}_${i}`,
          text: `Mock tweet ${i + 1} from @${args.username}`,
          likes: Math.floor(Math.random() * 100),
          retweets: Math.floor(Math.random() * 20),
        })),
        note: '🆓 Free tier - limited results',
      };
      
    case 'x_search_tweets':
      return {
        query: args.query,
        results: Array(Math.min(args.limit || 5, 5)).fill(null).map((_, i) => ({
          id: `search_${Date.now()}_${i}`,
          text: `Tweet matching "${args.query}" #${i + 1}`,
          author: `user_${i + 1}`,
        })),
        note: '🆓 Free tier - limited results',
      };
      
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// =============================================================================
// Start Server
// =============================================================================

async function main() {
  await initialize();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('✅ Server running on stdio');
  console.error('   Ready for AI agent connections');
  console.error('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
