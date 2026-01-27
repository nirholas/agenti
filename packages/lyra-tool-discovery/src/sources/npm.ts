import type { DiscoveredTool } from '../types.js';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search';

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description: string;
      keywords?: string[];
      author?: { name: string } | string;
      links: {
        npm: string;
        homepage?: string;
        repository?: string;
      };
      publisher: { username: string };
    };
  }>;
}

interface NpmPackage {
  name: string;
  description: string;
  version: string;
  license?: string;
  author?: { name: string } | string;
  homepage?: string;
  repository?: { url: string } | string;
  keywords?: string[];
  bin?: Record<string, string> | string;
  dependencies?: Record<string, string>;
  readme?: string;
}

export class NpmSource {
  /**
   * Search npm for MCP servers (crypto/DeFi/blockchain/web3 focused)
   */
  async searchMCPServers(limit = 10): Promise<DiscoveredTool[]> {
    // Crypto/DeFi/blockchain/web3 focused MCP package queries
    const cryptoTerms = ['crypto', 'defi', 'blockchain', 'web3', 'ethereum', 'solana', 'bitcoin', 'wallet', 'token', 'nft', 'dex', 'swap', 'staking'];
    
    const queries = [
      // MCP packages with crypto focus
      ...cryptoTerms.map(term => `mcp ${term}`),
      ...cryptoTerms.map(term => `mcp-server ${term}`),
      // Direct crypto MCP searches
      'mcp crypto',
      'mcp defi',
      'mcp blockchain',
      'mcp web3',
      '@modelcontextprotocol crypto',
      '@modelcontextprotocol defi'
    ];
    
    const tools: DiscoveredTool[] = [];
    const seen = new Set<string>();
    
    for (const query of queries) {
      if (tools.length >= limit) break;
      
      try {
        const results = await this.search(query, limit - tools.length);
        for (const tool of results) {
          if (!seen.has(tool.id)) {
            seen.add(tool.id);
            tools.push(tool);
          }
        }
      } catch (error) {
        console.error(`NPM search failed for "${query}":`, error);
      }
    }
    
    return tools.slice(0, limit);
  }
  
  private async search(query: string, size = 10): Promise<DiscoveredTool[]> {
    const url = `${NPM_SEARCH}?text=${encodeURIComponent(query)}&size=${size}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`NPM search error: ${response.status}`);
    }
    
    const data = await response.json() as NpmSearchResult;
    
    return Promise.all(data.objects.map(async (obj) => {
      const pkg = obj.package;
      
      // Fetch full package info for more details
      const fullPkg = await this.getPackage(pkg.name).catch(() => null);
      
      const tool: DiscoveredTool = {
        id: `npm:${pkg.name}`,
        name: pkg.name,
        description: pkg.description || '',
        source: 'npm',
        sourceUrl: pkg.links.npm,
        author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name,
        homepage: pkg.links.homepage,
        repository: pkg.links.repository,
        hasNpmPackage: true,
        hasMCPSupport: pkg.keywords?.includes('mcp') || 
                       pkg.name.includes('mcp') ||
                       pkg.description?.toLowerCase().includes('mcp')
      };
      
      if (fullPkg) {
        tool.license = fullPkg.license;
        tool.packageJson = fullPkg as unknown as Record<string, unknown>;
        
        if (fullPkg.readme) {
          tool.readme = fullPkg.readme;
        }
        
        // Check for MCP SDK dependency
        if (fullPkg.dependencies?.['@modelcontextprotocol/sdk']) {
          tool.hasMCPSupport = true;
        }
        
        // If it has a bin, it's likely a CLI tool (STDIO MCP)
        if (fullPkg.bin) {
          const binName = typeof fullPkg.bin === 'string' 
            ? fullPkg.name 
            : Object.keys(fullPkg.bin)[0];
          
          tool.mcpConfig = {
            type: 'stdio',
            command: 'npx',
            args: ['-y', fullPkg.name],
            env: {}
          };
        }
      }
      
      return tool;
    }));
  }
  
  private async getPackage(name: string): Promise<NpmPackage | null> {
    const url = `${NPM_REGISTRY}/${encodeURIComponent(name)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Get latest version
    const latest = data['dist-tags']?.latest;
    if (latest && data.versions?.[latest]) {
      return {
        ...data.versions[latest],
        readme: data.readme
      };
    }
    
    return data;
  }
  
  /**
   * Get a specific package as a discovered tool
   */
  async getPackageAsTool(name: string): Promise<DiscoveredTool | null> {
    const pkg = await this.getPackage(name);
    
    if (!pkg) {
      return null;
    }
    
    const repoUrl = typeof pkg.repository === 'string' 
      ? pkg.repository 
      : pkg.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '');
    
    const tool: DiscoveredTool = {
      id: `npm:${pkg.name}`,
      name: pkg.name,
      description: pkg.description || '',
      source: 'npm',
      sourceUrl: `https://www.npmjs.com/package/${pkg.name}`,
      license: pkg.license,
      author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name,
      homepage: pkg.homepage,
      repository: repoUrl,
      hasNpmPackage: true,
      hasMCPSupport: pkg.keywords?.includes('mcp') ||
                     pkg.name.includes('mcp') ||
                     pkg.dependencies?.['@modelcontextprotocol/sdk'] !== undefined,
      packageJson: pkg as unknown as Record<string, unknown>,
      readme: pkg.readme
    };
    
    // If it has a bin, suggest STDIO config
    if (pkg.bin) {
      tool.mcpConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', pkg.name],
        env: {}
      };
    }
    
    return tool;
  }
}
