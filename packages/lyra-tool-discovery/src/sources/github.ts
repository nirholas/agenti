import type { DiscoveredTool } from '../types.js';

const GITHUB_API = 'https://api.github.com';

interface GitHubSearchResult {
  total_count: number;
  items: Array<{
    id: number;
    full_name: string;
    name: string;
    description: string;
    html_url: string;
    homepage: string;
    license: { spdx_id: string } | null;
    owner: { login: string };
    stargazers_count: number;
    topics: string[];
  }>;
}

interface GitHubContent {
  name: string;
  content: string;
  encoding: string;
}

export class GitHubSource {
  private token?: string;
  
  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN;
  }
  
  private get headers(): HeadersInit {
    const h: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'lyra-tool-discovery'
    };
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`;
    }
    return h;
  }
  
  /**
   * Search GitHub for MCP servers (crypto/DeFi/blockchain/web3 focused)
   */
  async searchMCPServers(limit = 10, maxAgeMonths = 12): Promise<DiscoveredTool[]> {
    // Calculate date filter (default: 1 year ago)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - maxAgeMonths);
    const dateFilter = `pushed:>${cutoffDate.toISOString().split('T')[0]}`;
    
    // Crypto/DeFi/blockchain/web3 focused MCP tool queries
    const cryptoTerms = ['crypto', 'defi', 'blockchain', 'web3', 'ethereum', 'solana', 'bitcoin', 'wallet', 'token', 'nft', 'dex', 'swap', 'staking', 'yield', 'bridge', 'chain'];
    
    const queries = [
      // MCP servers with crypto focus
      ...cryptoTerms.map(term => `mcp ${term} in:name,description,readme ${dateFilter}`),
      ...cryptoTerms.map(term => `modelcontextprotocol ${term} in:name,description ${dateFilter}`),
      // Crypto MCP specific
      `mcp-server crypto in:name ${dateFilter}`,
      `mcp-server defi in:name ${dateFilter}`,
      `mcp-server blockchain in:name ${dateFilter}`,
      `mcp-server web3 in:name ${dateFilter}`,
      // Topic-based searches
      `topic:mcp topic:crypto ${dateFilter}`,
      `topic:mcp topic:defi ${dateFilter}`,
      `topic:mcp topic:blockchain ${dateFilter}`,
      `topic:mcp topic:web3 ${dateFilter}`
    ];
    
    const tools: DiscoveredTool[] = [];
    const seen = new Set<string>();
    
    for (const query of queries) {
      if (tools.length >= limit) break;
      
      try {
        const results = await this.searchRepos(query, limit - tools.length);
        for (const tool of results) {
          if (!seen.has(tool.id)) {
            seen.add(tool.id);
            tools.push(tool);
          }
        }
      } catch (error) {
        console.error(`Search failed for "${query}":`, error);
      }
    }
    
    return tools.slice(0, limit);
  }
  
  /**
   * Search for OpenAPI/Swagger specs
   */
  async searchOpenAPISpecs(limit = 10): Promise<DiscoveredTool[]> {
    const queries = [
      'openapi spec in:name,description',
      'swagger api in:name,description',
      'openapi.json in:path'
    ];
    
    const tools: DiscoveredTool[] = [];
    const seen = new Set<string>();
    
    for (const query of queries) {
      if (tools.length >= limit) break;
      
      try {
        const results = await this.searchRepos(query, limit - tools.length);
        for (const tool of results) {
          if (!seen.has(tool.id)) {
            seen.add(tool.id);
            tool.hasOpenAPI = true;
            tools.push(tool);
          }
        }
      } catch (error) {
        console.error(`Search failed for "${query}":`, error);
      }
    }
    
    return tools.slice(0, limit);
  }
  
  private async searchRepos(query: string, perPage = 10): Promise<DiscoveredTool[]> {
    const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`;
    
    const response = await fetch(url, { headers: this.headers });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${text}`);
    }
    
    const data = await response.json() as GitHubSearchResult;
    
    return Promise.all(data.items.map(async (item) => {
      const tool: DiscoveredTool = {
        id: `github:${item.full_name}`,
        name: item.name,
        description: item.description || '',
        source: 'github',
        sourceUrl: item.html_url,
        license: item.license?.spdx_id,
        author: item.owner.login,
        homepage: item.homepage || undefined,
        repository: item.html_url,
        hasMCPSupport: item.topics.includes('mcp') || 
                       item.name.includes('mcp') ||
                       item.description?.toLowerCase().includes('mcp'),
        hasNpmPackage: item.topics.includes('npm') ||
                       item.topics.includes('nodejs')
      };
      
      // Try to fetch README and package.json
      try {
        const [readme, packageJson] = await Promise.all([
          this.getFileContent(item.full_name, 'README.md').catch(() => null),
          this.getFileContent(item.full_name, 'package.json').catch(() => null)
        ]);
        
        if (readme) {
          tool.readme = readme;
        }
        
        if (packageJson) {
          try {
            tool.packageJson = JSON.parse(packageJson);
            tool.hasNpmPackage = true;
            
            // Check for MCP indicators in package.json
            const pkg = tool.packageJson as Record<string, unknown>;
            const deps = { 
              ...(pkg.dependencies as Record<string, string> || {}),
              ...(pkg.devDependencies as Record<string, string> || {})
            };
            
            if (deps['@modelcontextprotocol/sdk']) {
              tool.hasMCPSupport = true;
            }
          } catch {
            // Ignore parse errors
          }
        }
      } catch {
        // Continue without extra info
      }
      
      return tool;
    }));
  }
  
  private async getFileContent(repo: string, path: string): Promise<string | null> {
    const url = `${GITHUB_API}/repos/${repo}/contents/${path}`;
    
    const response = await fetch(url, { headers: this.headers });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as GitHubContent;
    
    if (data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    
    return null;
  }
  
  /**
   * Get a specific repo as a discovered tool
   */
  async getRepo(owner: string, repo: string): Promise<DiscoveredTool | null> {
    const url = `${GITHUB_API}/repos/${owner}/${repo}`;
    
    const response = await fetch(url, { headers: this.headers });
    
    if (!response.ok) {
      return null;
    }
    
    const item = await response.json();
    
    const tool: DiscoveredTool = {
      id: `github:${item.full_name}`,
      name: item.name,
      description: item.description || '',
      source: 'github',
      sourceUrl: item.html_url,
      license: item.license?.spdx_id,
      author: item.owner.login,
      homepage: item.homepage || undefined,
      repository: item.html_url,
    };
    
    // Fetch README and package.json
    const [readme, packageJson] = await Promise.all([
      this.getFileContent(item.full_name, 'README.md').catch(() => null),
      this.getFileContent(item.full_name, 'package.json').catch(() => null)
    ]);
    
    if (readme) {
      tool.readme = readme;
      tool.hasMCPSupport = readme.toLowerCase().includes('mcp') ||
                           readme.includes('@modelcontextprotocol');
    }
    
    if (packageJson) {
      try {
        tool.packageJson = JSON.parse(packageJson);
        tool.hasNpmPackage = true;
      } catch {
        // Ignore
      }
    }
    
    return tool;
  }
}
