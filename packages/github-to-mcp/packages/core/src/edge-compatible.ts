/**
 * @fileoverview Edge-compatible subset of github-to-mcp for serverless/edge environments
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * This module provides a lightweight version of the github-to-mcp generator
 * that works in edge environments like Vercel Edge Functions, Cloudflare Workers,
 * and Deno Deploy. It avoids Node.js-specific APIs and uses only Web APIs.
 */

import type {
  GithubToMcpOptions,
  ExtractedTool,
  RepoMetadata,
  RepoClassification,
  RepoType,
  SourceType
} from './types';

/**
 * Edge-compatible options (subset of full options)
 */
export interface EdgeOptions {
  /** GitHub personal access token */
  githubToken?: string;
  /** Sources to extract from */
  sources?: SourceType[];
  /** Output language */
  outputLanguage?: 'typescript' | 'python';
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Lightweight result for edge processing
 */
export interface EdgeResult {
  repo: string;
  name: string;
  tools: ExtractedTool[];
  classification: RepoClassification;
  metadata: {
    stars: number;
    language: string;
    license?: string;
    description?: string;
  };
  /** Generated TypeScript code */
  typescript?: string;
  /** Generated Python code */
  python?: string;
}

/**
 * Edge-compatible GitHub client using fetch API
 */
export class EdgeGitHubClient {
  private token?: string;
  private baseUrl = 'https://api.github.com';

  constructor(token?: string) {
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-to-mcp-edge'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Parse GitHub URL
   */
  parseUrl(url: string): RepoMetadata {
    const treeMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/(.+)/);
    if (treeMatch) {
      const owner = treeMatch[1];
      const repo = treeMatch[2].replace('.git', '');
      const parts = treeMatch[3].split('/');
      return {
        owner,
        repo,
        branch: parts[0],
        path: parts.length > 1 ? parts.slice(1).join('/') : undefined
      };
    }

    const simpleMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (simpleMatch) {
      return {
        owner: simpleMatch[1],
        repo: simpleMatch[2].replace('.git', ''),
        branch: 'main'
      };
    }

    throw new Error(`Invalid GitHub URL: ${url}`);
  }

  /**
   * Get repository metadata
   */
  async getRepoMetadata(owner: string, repo: string) {
    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json() as {
      stargazers_count: number;
      language: string | null;
      license: { spdx_id: string } | null;
      description: string | null;
      default_branch: string;
    };

    return {
      stars: data.stargazers_count,
      language: data.language || 'unknown',
      license: data.license?.spdx_id,
      description: data.description ?? undefined,
      defaultBranch: data.default_branch
    };
  }

  /**
   * Get file content
   */
  async getFileContent(owner: string, repo: string, path: string, branch?: string): Promise<string | null> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}${branch ? `?ref=${branch}` : ''}`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      if (!response.ok) return null;

      const data = await response.json() as {
        type: string;
        content?: string;
      };

      if (data.type === 'file' && data.content) {
        // Decode base64 content
        return atob(data.content.replace(/\n/g, ''));
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get README content
   */
  async getReadme(owner: string, repo: string, branch?: string): Promise<string | null> {
    const readmeFiles = ['README.md', 'README.MD', 'readme.md', 'Readme.md'];

    for (const filename of readmeFiles) {
      const content = await this.getFileContent(owner, repo, filename, branch);
      if (content) return content;
    }

    return null;
  }
}

/**
 * Edge-compatible tool extractor
 */
export class EdgeToolExtractor {
  /**
   * Extract tools from README content
   */
  extractFromReadme(readme: string, repoName: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Extract code blocks with function signatures
    const codeBlockRegex = /```(?:typescript|javascript|python|js|ts)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(readme)) !== null) {
      const code = match[1];

      // Extract function definitions
      const funcMatches = code.matchAll(
        /(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+)?(\w+)\s*(?:=\s*(?:async\s*)?\(|\()/g
      );

      for (const funcMatch of funcMatches) {
        const name = funcMatch[1];
        if (this.isValidToolName(name)) {
          tools.push({
            name,
            description: `Function extracted from README: ${name}`,
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            },
            source: {
              type: 'readme',
              file: 'README.md'
            },
            confidence: 0.5
          });
        }
      }
    }

    // Extract API endpoints from README
    const endpointRegex = /(?:GET|POST|PUT|DELETE|PATCH)\s+[`']?([\/\w\-\{\}:]+)[`']?/gi;
    while ((match = endpointRegex.exec(readme)) !== null) {
      const endpoint = match[1];
      const method = match[0].split(' ')[0].toUpperCase();
      const name = this.endpointToToolName(endpoint, method);

      tools.push({
        name,
        description: `${method} ${endpoint}`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        source: {
          type: 'readme',
          file: 'README.md'
        },
        confidence: 0.6
      });
    }

    return tools;
  }

  /**
   * Check if a name is a valid tool name
   */
  private isValidToolName(name: string): boolean {
    const reserved = ['if', 'else', 'for', 'while', 'function', 'const', 'let', 'var', 'return', 'async', 'await'];
    return name.length >= 2 && !reserved.includes(name.toLowerCase());
  }

  /**
   * Convert API endpoint to tool name
   */
  private endpointToToolName(endpoint: string, method: string): string {
    const parts = endpoint
      .replace(/[{}]/g, '')
      .split('/')
      .filter(p => p && !p.startsWith(':'))
      .map(p => p.charAt(0).toUpperCase() + p.slice(1));

    const prefix = method.toLowerCase();
    return prefix + parts.join('');
  }
}

/**
 * Classify repository type (edge-compatible)
 */
export function classifyRepo(readme: string | null, language: string): RepoClassification {
  let type: RepoType = 'unknown';
  let confidence = 0.3;
  const indicators: string[] = [];

  const readmeLower = readme?.toLowerCase() || '';

  // Check for MCP server
  if (readmeLower.includes('mcp') || readmeLower.includes('model context protocol')) {
    type = 'mcp-server';
    confidence = 0.9;
    indicators.push('Contains MCP references');
  }
  // Check for API/SDK
  else if (readmeLower.includes('api') || readmeLower.includes('sdk') || readmeLower.includes('client')) {
    type = 'api-sdk';
    confidence = 0.7;
    indicators.push('Contains API/SDK references');
  }
  // Check for CLI tool
  else if (readmeLower.includes('cli') || readmeLower.includes('command line') || readmeLower.includes('terminal')) {
    type = 'cli-tool';
    confidence = 0.7;
    indicators.push('Contains CLI references');
  }
  // Check for library
  else if (readmeLower.includes('library') || readmeLower.includes('package') || readmeLower.includes('module')) {
    type = 'library';
    confidence = 0.6;
    indicators.push('Contains library references');
  }

  indicators.push(`Language: ${language}`);

  return { type, confidence, indicators };
}

/**
 * Generate TypeScript MCP server code (edge-compatible)
 */
export function generateTypeScript(tools: ExtractedTool[], repoName: string, owner: string): string {
  const safeName = repoName.replace(/[^a-zA-Z0-9]/g, '_');

  const toolDefinitions = tools.map(tool => `
  {
    name: "${tool.name}",
    description: "${tool.description.replace(/"/g, '\\"')}",
    inputSchema: ${JSON.stringify(tool.inputSchema, null, 4).replace(/\n/g, '\n    ')}
  }`).join(',');

  const toolHandlers = tools.map((tool, i) => 
    `${i === 0 ? '' : ' else '}if (name === "${tool.name}") {
      // TODO: Implement ${tool.name}
      return { content: [{ type: "text", text: "Not implemented: ${tool.name}" }] };
    }`
  ).join('\n    ');

  return `/**
 * Auto-generated MCP Server for ${repoName}
 * Generated by @nirholas/github-to-mcp (Edge)
 * 
 * Repository: https://github.com/${owner}/${repoName}
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "${safeName}-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Tool definitions
const tools = [${toolDefinitions}
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  ${toolHandlers}
  
  throw new Error(\`Unknown tool: \${name}\`);
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
`;
}

/**
 * Generate Python MCP server code (edge-compatible)
 */
export function generatePython(tools: ExtractedTool[], repoName: string, owner: string): string {
  const safeName = repoName.replace(/[^a-zA-Z0-9]/g, '_');

  const toolDefinitions = tools.map(tool => `    Tool(
        name="${tool.name}",
        description="${tool.description.replace(/"/g, '\\"')}",
        inputSchema=${JSON.stringify(tool.inputSchema)}
    )`).join(',\n');

  const toolHandlers = tools.map((tool, i) =>
    `    ${i === 0 ? '' : 'el'}if name == "${tool.name}":
        # TODO: Implement ${tool.name}
        return [TextContent(type="text", text="Not implemented: ${tool.name}")]`
  ).join('\n');

  return `"""
Auto-generated MCP Server for ${repoName}
Generated by @nirholas/github-to-mcp (Edge)

Repository: https://github.com/${owner}/${repoName}
"""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

server = Server("${safeName}-mcp")

TOOLS = [
${toolDefinitions}
]

@server.list_tools()
async def list_tools() -> list[Tool]:
    return TOOLS

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
${toolHandlers}
    else:
        raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
`;
}

/**
 * Main edge-compatible generator
 */
export class EdgeGenerator {
  private github: EdgeGitHubClient;
  private extractor: EdgeToolExtractor;
  private options: EdgeOptions;

  constructor(options: EdgeOptions = {}) {
    this.options = options;
    this.github = new EdgeGitHubClient(options.githubToken);
    this.extractor = new EdgeToolExtractor();
  }

  /**
   * Generate MCP server from GitHub URL (edge-compatible)
   */
  async generate(githubUrl: string): Promise<EdgeResult> {
    // Parse URL
    const repoMeta = this.github.parseUrl(githubUrl);

    // Fetch metadata and README in parallel
    const [metadata, readme] = await Promise.all([
      this.github.getRepoMetadata(repoMeta.owner, repoMeta.repo),
      this.github.getReadme(repoMeta.owner, repoMeta.repo, repoMeta.branch)
    ]);

    // Classify repository
    const classification = classifyRepo(readme, metadata.language);

    // Extract tools from README
    const tools = readme ? this.extractor.extractFromReadme(readme, repoMeta.repo) : [];

    // Generate code
    const result: EdgeResult = {
      repo: `${repoMeta.owner}/${repoMeta.repo}`,
      name: repoMeta.repo,
      tools,
      classification,
      metadata
    };

    // Generate TypeScript if requested
    if (!this.options.outputLanguage || this.options.outputLanguage === 'typescript') {
      result.typescript = generateTypeScript(tools, repoMeta.repo, repoMeta.owner);
    }

    // Generate Python if requested
    if (this.options.outputLanguage === 'python') {
      result.python = generatePython(tools, repoMeta.repo, repoMeta.owner);
    }

    return result;
  }
}

/**
 * Quick generation function for edge use
 */
export async function generateFromUrl(githubUrl: string, options?: EdgeOptions): Promise<EdgeResult> {
  const generator = new EdgeGenerator(options);
  return generator.generate(githubUrl);
}

// Export everything for edge runtime
