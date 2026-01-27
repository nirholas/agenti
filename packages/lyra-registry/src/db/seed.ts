/**
 * Seed script to populate the registry from a Lyra MCP server
 * 
 * Usage:
 *   DATABASE_URL=... LYRA_MCP_URL=http://localhost:3001/mcp bun run db:seed
 * 
 * This script:
 * 1. Connects to a running Lyra MCP server
 * 2. Fetches all tool definitions via tools/list
 * 3. Categorizes tools automatically
 * 4. Calculates trust scores
 * 5. Inserts into the registry database
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { calculateToolScore } from '../lib/calculateScore';

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const LYRA_MCP_URL = process.env.LYRA_MCP_URL || 'http://localhost:3001/mcp';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create database connection
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

// Category mapping based on tool name patterns
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  'market': [/price/i, /market/i, /chart/i, /ohlc/i, /volume/i, /trending/i],
  'portfolio': [/portfolio/i, /balance/i, /asset/i, /holding/i, /allocation/i],
  'defi': [/defi/i, /yield/i, /farm/i, /stake/i, /lend/i, /borrow/i, /apy/i, /tvl/i, /protocol/i],
  'trading': [/trade/i, /swap/i, /order/i, /exchange/i, /dex/i, /limit/i, /slippage/i],
  'security': [/security/i, /audit/i, /scan/i, /risk/i, /goplus/i, /honeypot/i, /rug/i],
  'nft': [/nft/i, /collection/i, /mint/i, /opensea/i],
  'wallet': [/wallet/i, /address/i, /transaction/i, /transfer/i, /send/i],
  'analytics': [/analytics/i, /history/i, /report/i, /summary/i, /stats/i],
  'bridge': [/bridge/i, /cross.?chain/i, /layerzero/i, /wormhole/i],
  'oracle': [/oracle/i, /chainlink/i, /price.?feed/i],
  'gas': [/gas/i, /fee/i, /gwei/i],
  'token': [/token/i, /erc20/i, /coin/i, /supply/i],
  'governance': [/governance/i, /dao/i, /vote/i, /proposal/i],
  'lending': [/venus/i, /aave/i, /compound/i, /lend/i, /borrow/i, /collateral/i],
  'social': [/social/i, /twitter/i, /sentiment/i, /news/i],
};

// Chain detection patterns
const CHAIN_PATTERNS: Record<string, RegExp[]> = {
  'bsc': [/bsc/i, /binance/i, /bnb/i, /pancake/i, /venus/i],
  'ethereum': [/eth/i, /ethereum/i, /uniswap/i, /aave/i, /compound/i],
  'solana': [/sol/i, /solana/i, /raydium/i, /jupiter/i],
  'polygon': [/polygon/i, /matic/i, /quickswap/i],
  'arbitrum': [/arbitrum/i, /arb/i, /gmx/i],
  'avalanche': [/avax/i, /avalanche/i, /traderjoe/i],
  'optimism': [/optimism/i, /op/i],
  'base': [/base/i],
};

// Protocol detection patterns
const PROTOCOL_PATTERNS: Record<string, RegExp[]> = {
  'pancakeswap': [/pancake/i],
  'uniswap': [/uniswap/i],
  'venus': [/venus/i],
  'aave': [/aave/i],
  'compound': [/compound/i],
  'curve': [/curve/i],
  'chainlink': [/chainlink/i],
  'debank': [/debank/i],
  'coingecko': [/coingecko/i, /gecko/i],
  'defillama': [/defillama/i, /llama/i],
  '1inch': [/1inch/i, /oneinch/i],
  'binance': [/binance/i],
};

/**
 * Detect category from tool name and description
 */
function detectCategory(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(text))) {
      return category;
    }
  }
  
  return 'other';
}

/**
 * Detect chains from tool name and description
 */
function detectChains(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase();
  const chains: string[] = [];
  
  for (const [chain, patterns] of Object.entries(CHAIN_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(text))) {
      chains.push(chain);
    }
  }
  
  return chains.length > 0 ? chains : ['multi-chain'];
}

/**
 * Detect protocols from tool name and description
 */
function detectProtocols(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase();
  const protocols: string[] = [];
  
  for (const [protocol, patterns] of Object.entries(PROTOCOL_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(text))) {
      protocols.push(protocol);
    }
  }
  
  return protocols;
}

/**
 * Check if tool requires API key based on name/description
 */
function requiresApiKey(name: string, description: string): { required: boolean; keyName?: string } {
  const text = `${name} ${description}`.toLowerCase();
  
  const apiKeyPatterns: Record<string, RegExp[]> = {
    'COINGECKO_API_KEY': [/coingecko/i],
    'DEBANK_API_KEY': [/debank/i],
    'GOPLUS_API_KEY': [/goplus/i],
    'BINANCE_API_KEY': [/binance.*(trade|order)/i],
    'ETHERSCAN_API_KEY': [/etherscan/i, /bscscan/i],
  };
  
  for (const [keyName, patterns] of Object.entries(apiKeyPatterns)) {
    if (patterns.some(pattern => pattern.test(text))) {
      return { required: true, keyName };
    }
  }
  
  return { required: false };
}

/**
 * Extract tags from tool name and description
 */
function extractTags(name: string, description: string, category: string): string[] {
  const tags = new Set<string>([category]);
  
  const text = `${name} ${description}`.toLowerCase();
  
  const tagPatterns: Record<string, RegExp> = {
    'real-time': /real.?time/i,
    'historical': /historical|history/i,
    'portfolio': /portfolio/i,
    'defi': /defi/i,
    'trading': /trade|trading|swap/i,
    'analytics': /analytics|analyze/i,
    'security': /security|audit|scan/i,
    'yield': /yield|apy|apr/i,
    'lending': /lend|borrow|collateral/i,
    'staking': /stake|staking/i,
    'nft': /nft/i,
    'gas': /gas|fee/i,
    'price': /price/i,
    'token': /token/i,
    'wallet': /wallet/i,
  };
  
  for (const [tag, pattern] of Object.entries(tagPatterns)) {
    if (pattern.test(text)) {
      tags.add(tag);
    }
  }
  
  return Array.from(tags);
}

/**
 * Fetch tools from Lyra MCP server
 */
async function fetchLyraTools(): Promise<LyraTool[]> {
  console.log(`🔌 Connecting to Lyra MCP server at ${LYRA_MCP_URL}...`);
  
  try {
    const response = await fetch(LYRA_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(`MCP Error: ${result.error.message}`);
    }
    
    const tools = result.result?.tools || [];
    console.log(`✅ Fetched ${tools.length} tools from Lyra`);
    
    return tools;
  } catch (error) {
    console.error(`❌ Failed to fetch from Lyra MCP server:`, error);
    console.log('📝 Using sample tools for seeding...');
    return getSampleTools();
  }
}

interface LyraTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Sample tools to use if Lyra server is not available
 */
function getSampleTools(): LyraTool[] {
  return [
    {
      name: 'market_get_token_price',
      description: 'Get the current price of a token from CoinGecko',
      inputSchema: {
        type: 'object',
        properties: {
          tokenId: { type: 'string', description: 'CoinGecko token ID' },
          currency: { type: 'string', default: 'usd' },
        },
        required: ['tokenId'],
      },
    },
    {
      name: 'bsc_get_portfolio_value',
      description: 'Get total portfolio value from DeBank for a wallet address',
      inputSchema: {
        type: 'object',
        properties: {
          walletAddress: { type: 'string', description: 'Wallet address' },
        },
        required: ['walletAddress'],
      },
    },
    {
      name: 'goplus_check_token',
      description: 'Security scan a token using GoPlus API',
      inputSchema: {
        type: 'object',
        properties: {
          tokenAddress: { type: 'string' },
          chainId: { type: 'string', default: '56' },
        },
        required: ['tokenAddress'],
      },
    },
    {
      name: 'defi_get_protocol_tvl',
      description: 'Get Total Value Locked for a DeFi protocol from DeFiLlama',
      inputSchema: {
        type: 'object',
        properties: {
          protocol: { type: 'string' },
        },
        required: ['protocol'],
      },
    },
    {
      name: 'pancakeswap_get_swap_quote',
      description: 'Get a swap quote from PancakeSwap DEX',
      inputSchema: {
        type: 'object',
        properties: {
          tokenIn: { type: 'string' },
          tokenOut: { type: 'string' },
          amountIn: { type: 'string' },
        },
        required: ['tokenIn', 'tokenOut', 'amountIn'],
      },
    },
    {
      name: 'venus_get_lending_rates',
      description: 'Get current lending and borrowing rates from Venus Protocol',
      inputSchema: {
        type: 'object',
        properties: {
          asset: { type: 'string', description: 'Asset symbol like BNB, USDT' },
        },
        required: ['asset'],
      },
    },
    {
      name: 'chainlink_get_price_feed',
      description: 'Get price data from Chainlink oracle',
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Price pair like ETH/USD' },
        },
        required: ['pair'],
      },
    },
  ];
}

/**
 * Seed default categories
 */
async function seedCategories(): Promise<void> {
  console.log('📁 Seeding categories...');
  
  const categories = [
    { name: 'Market Data', slug: 'market', description: 'Price, charts, and market information', icon: '📊' },
    { name: 'Portfolio', slug: 'portfolio', description: 'Portfolio tracking and management', icon: '💼' },
    { name: 'DeFi', slug: 'defi', description: 'Decentralized finance protocols', icon: '🏦' },
    { name: 'Trading', slug: 'trading', description: 'DEX and CEX trading tools', icon: '📈' },
    { name: 'Security', slug: 'security', description: 'Security scanning and audits', icon: '🔒' },
    { name: 'NFT', slug: 'nft', description: 'NFT collections and marketplaces', icon: '🖼️' },
    { name: 'Wallet', slug: 'wallet', description: 'Wallet and transaction tools', icon: '👛' },
    { name: 'Analytics', slug: 'analytics', description: 'Data analytics and reporting', icon: '📉' },
    { name: 'Bridge', slug: 'bridge', description: 'Cross-chain bridging', icon: '🌉' },
    { name: 'Oracle', slug: 'oracle', description: 'Price feeds and oracles', icon: '🔮' },
    { name: 'Gas', slug: 'gas', description: 'Gas estimation and optimization', icon: '⛽' },
    { name: 'Token', slug: 'token', description: 'Token information and metadata', icon: '🪙' },
    { name: 'Governance', slug: 'governance', description: 'DAO and governance tools', icon: '🗳️' },
    { name: 'Lending', slug: 'lending', description: 'Lending and borrowing protocols', icon: '💰' },
    { name: 'Social', slug: 'social', description: 'Social and sentiment analysis', icon: '💬' },
    { name: 'Other', slug: 'other', description: 'Miscellaneous tools', icon: '🔧' },
  ];
  
  for (const cat of categories) {
    const existing = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.slug, cat.slug))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(schema.categories).values(cat);
      console.log(`  ✅ Created category: ${cat.name}`);
    } else {
      console.log(`  ⏭️ Category exists: ${cat.name}`);
    }
  }
}

/**
 * Main seed function
 */
async function seed(): Promise<void> {
  console.log('🌱 Starting Lyra Registry seed...\n');
  
  // Seed categories first
  await seedCategories();
  console.log('');
  
  // Fetch tools from Lyra
  const lyraTools = await fetchLyraTools();
  console.log('');
  
  console.log('🔧 Processing and inserting tools...');
  let inserted = 0;
  let skipped = 0;
  
  for (const tool of lyraTools) {
    // Check if tool exists
    const existing = await db
      .select({ id: schema.tools.id })
      .from(schema.tools)
      .where(eq(schema.tools.name, tool.name))
      .limit(1);
    
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    
    // Detect metadata
    const category = detectCategory(tool.name, tool.description);
    const chains = detectChains(tool.name, tool.description);
    const protocols = detectProtocols(tool.name, tool.description);
    const apiKey = requiresApiKey(tool.name, tool.description);
    const tags = extractTags(tool.name, tool.description, category);
    
    // Calculate score (basic flags for seed)
    const scoreFlags = {
      isValidated: false, // Will be validated later
      hasTools: true,
      hasDeployment: true, // Part of Lyra server
      hasDeployMoreThanManual: true,
      hasReadme: true,
      hasLicense: true,
      hasPrompts: false,
      hasResources: false,
      isClaimed: false,
    };
    
    const scoreResult = calculateToolScore(scoreFlags);
    
    // Insert tool
    await db.insert(schema.tools).values({
      name: tool.name,
      description: tool.description,
      category,
      version: '1.0.0',
      sourceType: 'manual',
      sourceUrl: 'https://github.com/nirholas/Lyra',
      mcpServerUrl: LYRA_MCP_URL,
      inputSchema: tool.inputSchema,
      tags,
      chains,
      protocols,
      requiresApiKey: apiKey.required,
      apiKeyName: apiKey.keyName,
      isValidated: scoreFlags.isValidated,
      hasTools: scoreFlags.hasTools,
      hasReadme: scoreFlags.hasReadme,
      hasLicense: scoreFlags.hasLicense,
      hasDeployment: scoreFlags.hasDeployment,
      hasDeployMoreThanManual: scoreFlags.hasDeployMoreThanManual,
      totalScore: scoreResult.totalScore,
      maxScore: scoreResult.maxScore,
      percentage: scoreResult.percentage,
      grade: scoreResult.grade,
      scoreData: {
        hasValidated: scoreFlags.isValidated,
        hasTools: scoreFlags.hasTools,
        hasDeployment: scoreFlags.hasDeployment,
        hasDeployMoreThanManual: scoreFlags.hasDeployMoreThanManual,
        hasReadme: scoreFlags.hasReadme,
        hasLicense: scoreFlags.hasLicense,
        hasPrompts: scoreFlags.hasPrompts,
        hasResources: scoreFlags.hasResources,
        hasClaimed: scoreFlags.isClaimed,
      },
    });
    
    inserted++;
    console.log(`  ✅ ${tool.name} (${category}, grade: ${scoreResult.grade.toUpperCase()})`);
  }
  
  // Update category counts
  console.log('\n📊 Updating category counts...');
  const categorySet = new Set(lyraTools.map(t => detectCategory(t.name, t.description)));
  const categorySlugs = Array.from(categorySet);
  
  for (const slug of categorySlugs) {
    const count = lyraTools.filter(t => detectCategory(t.name, t.description) === slug).length;
    await db
      .update(schema.categories)
      .set({ toolCount: count })
      .where(eq(schema.categories.slug, slug));
  }
  
  console.log('\n✨ Seed completed!');
  console.log(`   📥 Inserted: ${inserted} tools`);
  console.log(`   ⏭️ Skipped: ${skipped} (already exist)`);
  console.log(`   📁 Categories updated`);
}

// Run seed
seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
