/**
 * Edge API Route for github-to-mcp
 * 
 * This route runs on Vercel Edge Runtime for fast, globally distributed processing.
 * It provides a lightweight version of the MCP generation that works in edge environments.
 */

import { NextRequest, NextResponse } from 'next/server';

// Tell Next.js to use edge runtime
export const runtime = 'edge';

// Edge-compatible types
interface EdgeResult {
  repo: string;
  name: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: object;
    source: { type: string; file: string };
    confidence?: number;
  }>;
  classification: {
    type: string;
    confidence: number;
    indicators: string[];
  };
  metadata: {
    stars: number;
    language: string;
    license?: string;
    description?: string;
  };
  typescript?: string;
  python?: string;
}

/**
 * Parse GitHub URL
 */
function parseGithubUrl(url: string): { owner: string; repo: string; branch?: string } {
  const treeMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)/);
  if (treeMatch) {
    return {
      owner: treeMatch[1],
      repo: treeMatch[2].replace('.git', ''),
      branch: treeMatch[3]
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
 * Fetch repository metadata from GitHub API
 */
async function fetchRepoMetadata(owner: string, repo: string, token?: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'github-to-mcp-edge'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    stars: data.stargazers_count,
    language: data.language || 'unknown',
    license: data.license?.spdx_id,
    description: data.description,
    defaultBranch: data.default_branch
  };
}

/**
 * Fetch README content
 */
async function fetchReadme(owner: string, repo: string, branch?: string, token?: string): Promise<string | null> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'github-to-mcp-edge'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const readmeFiles = ['README.md', 'README.MD', 'readme.md'];

  for (const filename of readmeFiles) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}${branch ? `?ref=${branch}` : ''}`;
      const response = await fetch(url, { headers });

      if (response.ok) {
        const data = await response.json();
        if (data.type === 'file' && data.content) {
          return atob(data.content.replace(/\n/g, ''));
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Classify repository type
 */
function classifyRepo(readme: string | null, language: string) {
  let type = 'unknown';
  let confidence = 0.3;
  const indicators: string[] = [];

  const readmeLower = readme?.toLowerCase() || '';

  if (readmeLower.includes('mcp') || readmeLower.includes('model context protocol')) {
    type = 'mcp-server';
    confidence = 0.9;
    indicators.push('Contains MCP references');
  } else if (readmeLower.includes('api') || readmeLower.includes('sdk')) {
    type = 'api-sdk';
    confidence = 0.7;
    indicators.push('Contains API/SDK references');
  } else if (readmeLower.includes('cli') || readmeLower.includes('command line')) {
    type = 'cli-tool';
    confidence = 0.7;
    indicators.push('Contains CLI references');
  } else if (readmeLower.includes('library') || readmeLower.includes('package')) {
    type = 'library';
    confidence = 0.6;
    indicators.push('Contains library references');
  }

  indicators.push(`Language: ${language}`);

  return { type, confidence, indicators };
}

/**
 * Extract tools from README
 */
function extractToolsFromReadme(readme: string): EdgeResult['tools'] {
  const tools: EdgeResult['tools'] = [];

  // Extract API endpoints
  const endpointRegex = /(?:GET|POST|PUT|DELETE|PATCH)\s+[`']?([\/\w\-\{\}:]+)[`']?/gi;
  let match;

  while ((match = endpointRegex.exec(readme)) !== null) {
    const endpoint = match[1];
    const method = match[0].split(' ')[0].toUpperCase();
    const name = endpoint
      .replace(/[{}]/g, '')
      .split('/')
      .filter(p => p && !p.startsWith(':'))
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');

    tools.push({
      name: method.toLowerCase() + name,
      description: `${method} ${endpoint}`,
      inputSchema: { type: 'object', properties: {}, required: [] },
      source: { type: 'readme', file: 'README.md' },
      confidence: 0.6
    });
  }

  return tools;
}

/**
 * Generate TypeScript code
 */
function generateTypeScript(tools: EdgeResult['tools'], repoName: string, owner: string): string {
  const safeName = repoName.replace(/[^a-zA-Z0-9]/g, '_');

  const toolDefs = tools.map(t => `  {
    name: "${t.name}",
    description: "${t.description.replace(/"/g, '\\"')}",
    inputSchema: ${JSON.stringify(t.inputSchema)}
  }`).join(',\n');

  const handlers = tools.map((t, i) =>
    `${i === 0 ? '' : ' else '}if (name === "${t.name}") {
      return { content: [{ type: "text", text: "Not implemented: ${t.name}" }] };
    }`
  ).join('\n    ');

  return `/**
 * Auto-generated MCP Server for ${repoName}
 * Generated by @nirholas/github-to-mcp (Edge)
 * Repository: https://github.com/${owner}/${repoName}
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "${safeName}-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const tools = [
${toolDefs}
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  ${handlers}
  throw new Error(\`Unknown tool: \${name}\`);
});

const transport = new StdioServerTransport();
server.connect(transport);
`;
}

/**
 * POST handler for edge generation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, language = 'typescript' } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Missing required field: url' },
        { status: 400 }
      );
    }

    // Get GitHub token from environment or request
    const token = process.env.GITHUB_TOKEN || body.token;

    // Parse URL
    const { owner, repo, branch } = parseGithubUrl(url);

    // Fetch data in parallel
    const [metadata, readme] = await Promise.all([
      fetchRepoMetadata(owner, repo, token),
      fetchReadme(owner, repo, branch, token)
    ]);

    // Classify and extract
    const classification = classifyRepo(readme, metadata.language);
    const tools = readme ? extractToolsFromReadme(readme) : [];

    // Build result
    const result: EdgeResult = {
      repo: `${owner}/${repo}`,
      name: repo,
      tools,
      classification,
      metadata
    };

    // Generate code
    if (language === 'typescript' || language === 'both') {
      result.typescript = generateTypeScript(tools, repo, owner);
    }

    return NextResponse.json(result);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * GET handler for health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    runtime: 'edge',
    timestamp: new Date().toISOString()
  });
}
