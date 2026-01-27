import { GitHubSource } from './sources/github.js';
import { NpmSource } from './sources/npm.js';
import { AIAnalyzer, type AIConfig } from './ai.js';
import type { 
  DiscoveredTool, 
  DiscoveryResult, 
  DiscoverySource,
  CustomPlugin,
  PluginIndexEntry
} from './types.js';

export interface DiscoveryOptions {
  sources?: DiscoverySource[];
  limit?: number;
  dryRun?: boolean;
  outputDir?: string;
  maxAgeMonths?: number;
}

// Crypto/DeFi/blockchain/web3 keywords for filtering
const CRYPTO_KEYWORDS = [
  'crypto', 'cryptocurrency', 'defi', 'blockchain', 'web3',
  'ethereum', 'eth', 'solana', 'sol', 'bitcoin', 'btc',
  'wallet', 'token', 'nft', 'dex', 'swap', 'staking',
  'yield', 'bridge', 'chain', 'smart contract', 'erc20',
  'erc721', 'uniswap', 'aave', 'compound', 'lending',
  'liquidity', 'vault', 'protocol', 'onchain', 'on-chain',
  'web3.js', 'ethers', 'viem', 'wagmi', 'rainbowkit'
];

export class ToolDiscovery {
  private github: GitHubSource;
  private npm: NpmSource;
  private ai: AIAnalyzer;
  
  constructor(aiConfig?: AIConfig) {
    this.github = new GitHubSource();
    this.npm = new NpmSource();
    this.ai = new AIAnalyzer(aiConfig);
  }
  
  /**
   * Discover crypto/DeFi/blockchain/web3 tools from configured sources
   */
  async discover(options: DiscoveryOptions = {}): Promise<DiscoveryResult[]> {
    const {
      sources = ['github', 'npm'],
      limit = 10,
      dryRun = false,
      maxAgeMonths = 12
    } = options;
    
    console.log(`🔍 Discovering crypto/DeFi/web3 tools from: ${sources.join(', ')}`);
    console.log(`📅 Max age: ${maxAgeMonths} months`);
    
    const tools: DiscoveredTool[] = [];
    
    // Collect from each source
    for (const source of sources) {
      try {
        const discovered = await this.discoverFromSource(source, limit, maxAgeMonths);
        console.log(`  Found ${discovered.length} from ${source}`);
        tools.push(...discovered);
      } catch (error) {
        console.error(`  Error from ${source}:`, error);
      }
    }
    
    console.log(`\n📊 Total discovered: ${tools.length} tools`);
    
    if (tools.length === 0) {
      return [];
    }
    
    // Filter to only crypto-related tools
    const cryptoTools = tools.filter(t => this.isCryptoRelated(t));
    console.log(`🪙 Crypto-related: ${cryptoTools.length} tools`);
    
    // Filter to only tools with MCP support
    const mcpTools = cryptoTools.filter(t => t.hasMCPSupport);
    console.log(`🔌 MCP-compatible: ${mcpTools.length} tools`);
    
    // Analyze each tool with AI
    const results: DiscoveryResult[] = [];
    
    for (const tool of mcpTools.slice(0, limit)) {
      if (dryRun) {
        console.log(`\n[DRY RUN] Would analyze: ${tool.name}`);
        console.log(`  Source: ${tool.source}`);
        console.log(`  URL: ${tool.sourceUrl}`);
        console.log(`  MCP: ${tool.hasMCPSupport ? 'Yes' : 'No'}`);
        continue;
      }
      
      console.log(`\n🤖 Analyzing: ${tool.name}...`);
      
      try {
        const decision = await this.ai.analyzeAndDecide(tool);
        
        console.log(`  Template: ${decision.template}`);
        console.log(`  Reasoning: ${decision.reasoning}`);
        
        const quickImport = this.ai.generateQuickImport(decision);
        if (quickImport) {
          console.log(`  Quick Import:\n${quickImport}`);
        }
        
        results.push({
          tool,
          decision,
          generated: {
            pluginConfig: decision.config
          }
        });
      } catch (error) {
        console.error(`  Failed to analyze: ${error}`);
      }
    }
    
    return results;
  }
  
  private async discoverFromSource(
    source: DiscoverySource, 
    limit: number,
    maxAgeMonths: number
  ): Promise<DiscoveredTool[]> {
    switch (source) {
      case 'github':
        return this.github.searchMCPServers(limit, maxAgeMonths);
      case 'npm':
        return this.npm.searchMCPServers(limit);
      default:
        console.warn(`Source "${source}" not yet implemented`);
        return [];
    }
  }
  
  /**
   * Check if a tool is crypto/DeFi/blockchain/web3 related
   */
  private isCryptoRelated(tool: DiscoveredTool): boolean {
    const searchText = [
      tool.name,
      tool.description,
      tool.readme?.slice(0, 5000) || ''
    ].join(' ').toLowerCase();
    
    return CRYPTO_KEYWORDS.some(keyword => searchText.includes(keyword.toLowerCase()));
  }
  
  /**
   * Analyze a specific GitHub repo
   */
  async analyzeGitHubRepo(owner: string, repo: string): Promise<DiscoveryResult | null> {
    console.log(`🔍 Fetching ${owner}/${repo}...`);
    
    const tool = await this.github.getRepo(owner, repo);
    if (!tool) {
      console.error('Repository not found');
      return null;
    }
    
    console.log(`🤖 Analyzing...`);
    const decision = await this.ai.analyzeAndDecide(tool);
    
    console.log(`\n✅ Analysis complete:`);
    console.log(`  Template: ${decision.template}`);
    console.log(`  Reasoning: ${decision.reasoning}`);
    
    const quickImport = this.ai.generateQuickImport(decision);
    if (quickImport) {
      console.log(`\n📋 Quick Import JSON:\n${quickImport}`);
    }
    
    return {
      tool,
      decision,
      generated: {
        pluginConfig: decision.config
      }
    };
  }
  
  /**
   * Analyze a specific npm package
   */
  async analyzeNpmPackage(name: string): Promise<DiscoveryResult | null> {
    console.log(`🔍 Fetching ${name}...`);
    
    const tool = await this.npm.getPackageAsTool(name);
    if (!tool) {
      console.error('Package not found');
      return null;
    }
    
    console.log(`🤖 Analyzing...`);
    const decision = await this.ai.analyzeAndDecide(tool);
    
    console.log(`\n✅ Analysis complete:`);
    console.log(`  Template: ${decision.template}`);
    console.log(`  Reasoning: ${decision.reasoning}`);
    
    const quickImport = this.ai.generateQuickImport(decision);
    if (quickImport) {
      console.log(`\n📋 Quick Import JSON:\n${quickImport}`);
    }
    
    return {
      tool,
      decision,
      generated: {
        pluginConfig: decision.config
      }
    };
  }
}

// Export all types
export * from './types.js';
export { AIAnalyzer } from './ai.js';
export { GitHubSource } from './sources/github.js';
export { NpmSource } from './sources/npm.js';

// Export error classes
export * from './errors.js';

// Export schemas for validation
export * from './schemas.js';

// Export utilities
export { withRetry, fetchWithRetry, sleep, calculateBackoff } from './utils/retry.js';
