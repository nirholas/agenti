# Custom Sources

Lyra Tool Discovery has an extensible architecture that allows you to create custom sources for discovering MCP tools and APIs.

## Source Interface

All sources must implement the search interface:

```typescript
import type { DiscoveredTool } from '@nirholas/lyra-tool-discovery';

interface DiscoverySource {
  /**
   * Search for MCP servers and tools
   * @param limit Maximum number of results to return
   * @returns Array of discovered tools
   */
  searchMCPServers(limit: number): Promise<DiscoveredTool[]>;
}
```

## DiscoveredTool Type

Each source returns `DiscoveredTool` objects:

```typescript
interface DiscoveredTool {
  // Required fields
  id: string;              // Unique identifier (e.g., "reddit:post-123")
  name: string;            // Display name
  description: string;     // Brief description
  source: DiscoverySource; // Source identifier
  sourceUrl: string;       // URL to original source
  
  // Optional metadata
  license?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  
  // Type hints for AI
  hasOpenAPI?: boolean;
  hasMCPSupport?: boolean;
  hasNpmPackage?: boolean;
  
  // Raw data for AI analysis
  readme?: string;
  packageJson?: Record<string, unknown>;
  manifestUrl?: string;
  mcpConfig?: MCPConnection;
}
```

## Example: Reddit Source

Here's a complete example of a custom source that discovers MCP tools from Reddit:

```typescript
// src/sources/reddit.ts
import type { DiscoveredTool } from '../types.js';

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    url: string;
    author: string;
    score: number;
    permalink: string;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

export class RedditSource {
  private subreddits = ['mcp', 'LocalLLaMA', 'MachineLearning'];
  
  /**
   * Search Reddit for MCP-related posts
   */
  async searchMCPServers(limit = 10): Promise<DiscoveredTool[]> {
    const tools: DiscoveredTool[] = [];
    
    for (const subreddit of this.subreddits) {
      if (tools.length >= limit) break;
      
      try {
        const posts = await this.searchSubreddit(subreddit, limit - tools.length);
        tools.push(...posts);
      } catch (error) {
        console.error(`Reddit search failed for r/${subreddit}:`, error);
      }
    }
    
    return tools.slice(0, limit);
  }
  
  private async searchSubreddit(
    subreddit: string, 
    limit: number
  ): Promise<DiscoveredTool[]> {
    const query = encodeURIComponent('mcp server OR modelcontextprotocol');
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${query}&restrict_sr=1&limit=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'lyra-tool-discovery/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }
    
    const data = await response.json() as RedditResponse;
    
    return data.data.children
      .filter(post => this.isMCPRelated(post.data))
      .map(post => this.postToTool(post.data, subreddit));
  }
  
  private isMCPRelated(post: RedditPost['data']): boolean {
    const text = `${post.title} ${post.selftext}`.toLowerCase();
    return (
      text.includes('mcp') ||
      text.includes('model context protocol') ||
      text.includes('modelcontextprotocol')
    );
  }
  
  private postToTool(post: RedditPost['data'], subreddit: string): DiscoveredTool {
    // Extract GitHub links from post
    const githubMatch = post.selftext.match(
      /https?:\/\/github\.com\/[\w-]+\/[\w-]+/
    );
    
    return {
      id: `reddit:${post.id}`,
      name: this.extractName(post.title),
      description: post.title,
      source: 'reddit' as any, // Custom source type
      sourceUrl: `https://reddit.com${post.permalink}`,
      author: post.author,
      repository: githubMatch?.[0],
      hasMCPSupport: true,
      readme: post.selftext
    };
  }
  
  private extractName(title: string): string {
    // Try to extract a tool name from the title
    const match = title.match(/\[([^\]]+)\]|"([^"]+)"|'([^']+)'/);
    if (match) {
      return match[1] || match[2] || match[3];
    }
    // Fallback: use first few words
    return title.split(/\s+/).slice(0, 3).join('-').toLowerCase();
  }
}
```

## Registering Custom Sources

Currently, custom sources require modifying the main `ToolDiscovery` class:

```typescript
// src/index.ts
import { RedditSource } from './sources/reddit.js';

export class ToolDiscovery {
  private reddit: RedditSource;
  
  constructor(aiConfig?: AIConfig) {
    // ... existing initialization
    this.reddit = new RedditSource();
  }
  
  private async discoverFromSource(
    source: DiscoverySource, 
    limit: number
  ): Promise<DiscoveredTool[]> {
    switch (source) {
      case 'github':
        return this.github.searchMCPServers(limit);
      case 'npm':
        return this.npm.searchMCPServers(limit);
      case 'reddit':
        return this.reddit.searchMCPServers(limit);
      default:
        console.warn(`Source "${source}" not implemented`);
        return [];
    }
  }
}
```

Update the types:

```typescript
// src/types.ts
export type DiscoverySource = 
  | 'github'
  | 'npm' 
  | 'reddit'  // Add custom source
  | 'smithery'
  | 'mcp-directory';
```

## Using Your Custom Source

```bash
# Use Reddit source
lyra-discover discover --sources reddit --limit 10

# Combine with other sources
lyra-discover discover --sources github,npm,reddit --limit 20
```

## Best Practices

### 1. Provide Rich Context

The more data you provide, the better the AI analysis:

```typescript
return {
  // Minimum fields
  id: `source:${uniqueId}`,
  name: toolName,
  description: shortDescription,
  source: 'mysource',
  sourceUrl: url,
  
  // Rich context for AI
  readme: fullDocumentation,        // AI reads this!
  packageJson: configData,          // Helps detect MCP SDK
  hasMCPSupport: detectedMCP,       // Speeds up filtering
  repository: githubUrl             // Can fetch more data
};
```

### 2. Handle Errors Gracefully

```typescript
async searchMCPServers(limit: number): Promise<DiscoveredTool[]> {
  try {
    return await this.fetchTools(limit);
  } catch (error) {
    console.error(`Source error:`, error);
    return []; // Return empty, don't crash
  }
}
```

### 3. Implement Caching

```typescript
class CachedSource {
  private cache = new Map<string, { data: DiscoveredTool[], expires: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes
  
  async searchMCPServers(limit: number): Promise<DiscoveredTool[]> {
    const key = `search:${limit}`;
    const cached = this.cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    const data = await this.fetchTools(limit);
    this.cache.set(key, { data, expires: Date.now() + this.ttl });
    return data;
  }
}
```

### 4. Respect Rate Limits

```typescript
class RateLimitedSource {
  private lastRequest = 0;
  private minInterval = 1000; // 1 second between requests
  
  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const wait = Math.max(0, this.minInterval - (now - this.lastRequest));
    
    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }
    
    this.lastRequest = Date.now();
    return fetch(url);
  }
}
```

### 5. Deduplicate Results

```typescript
const seen = new Set<string>();
const unique: DiscoveredTool[] = [];

for (const tool of results) {
  // Dedupe by repository URL
  const key = tool.repository || tool.sourceUrl;
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(tool);
  }
}
```

## Example: Discord Source

Another example for discovering MCP tools from Discord:

```typescript
export class DiscordSource {
  private webhookUrl: string;
  
  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL || '';
  }
  
  async searchMCPServers(limit: number): Promise<DiscoveredTool[]> {
    // Implementation using Discord API
    // to search specific channels for MCP mentions
    throw new Error('Not implemented');
  }
}
```

## Future: Plugin Architecture

We're planning a plugin architecture for sources:

```typescript
// Future API (not yet implemented)
import { registerSource } from '@nirholas/lyra-tool-discovery';

registerSource('reddit', new RedditSource());
registerSource('discord', new DiscordSource());

// CLI would automatically discover registered sources
lyra-discover discover --sources reddit,discord
```

## Next Steps

- [Pipeline Integration](/guide/pipeline) - Build discovery pipelines
- [GitHub Actions](/guide/github-actions) - Automate discovery
- [API Reference](/api/) - Full API documentation
