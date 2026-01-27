/**
 * @fileoverview Module exports and initialization
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * Main Generator
 * Orchestrates the entire GitHub to MCP conversion process
 */

import { GithubClient } from './github-client';
import { ReadmeExtractor } from './readme-extractor';
import { CodeExtractor } from './code-extractor';
import { GraphQLExtractor } from './graphql-extractor';
import { McpIntrospector } from './mcp-introspector';
import { PythonGenerator } from './python-generator';
import { GoGenerator } from './go-generator';
import { convertOpenApiToMcp } from '@github-to-mcp/openapi-parser';
import {
  GithubToMcpOptions,
  GenerationResult,
  ExtractedTool,
  SourceBreakdown,
  RepoClassification,
  RepoType,
  OutputLanguage
} from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class GithubToMcpGenerator {
  private github: GithubClient;
  private readmeExtractor: ReadmeExtractor;
  private codeExtractor: CodeExtractor;
  private graphqlExtractor: GraphQLExtractor;
  private mcpIntrospector: McpIntrospector;
  private pythonGenerator: PythonGenerator;
  private goGenerator: GoGenerator;

  constructor(private options: GithubToMcpOptions = {}) {
    this.github = new GithubClient(options.githubToken);
    this.readmeExtractor = new ReadmeExtractor();
    this.codeExtractor = new CodeExtractor();
    this.graphqlExtractor = new GraphQLExtractor();
    this.mcpIntrospector = new McpIntrospector();
    this.pythonGenerator = new PythonGenerator();
    this.goGenerator = new GoGenerator();
  }

  /**
   * Generate MCP tools from GitHub repository
   */
  async generate(githubUrl: string): Promise<GenerationResult> {
    // Parse GitHub URL
    const repoMeta = this.github.parseGithubUrl(githubUrl);

    // Get repository metadata
    const metadata = await this.github.getRepoMetadata(repoMeta.owner, repoMeta.repo);

    // Get README for classification
    const readme = await this.github.getReadme(repoMeta.owner, repoMeta.repo);

    // Classify the repository
    const classification = await this.classifyRepo(repoMeta.owner, repoMeta.repo, readme, metadata);

    // Extract tools from all sources
    const tools: ExtractedTool[] = [];
    const sources: SourceBreakdown[] = [];

    const enabledSources = this.options.sources || ['readme', 'openapi', 'code'];

    // 1. Extract from OpenAPI specs
    if (enabledSources.includes('openapi')) {
      const openapiTools = await this.extractFromOpenApi(repoMeta.owner, repoMeta.repo);
      tools.push(...openapiTools);
      
      if (openapiTools.length > 0) {
        sources.push({
          type: 'openapi',
          count: openapiTools.length,
          files: openapiTools.map(t => t.source.file)
        });
      }
    }

    // 2. Extract from README
    if (enabledSources.includes('readme')) {
      const readmeTools = await this.extractFromReadme(repoMeta.owner, repoMeta.repo);
      tools.push(...readmeTools);
      
      if (readmeTools.length > 0) {
        sources.push({
          type: 'readme',
          count: readmeTools.length,
          files: ['README.md']
        });
      }
    }

    // 3. Extract from code
    if (enabledSources.includes('code')) {
      const codeTools = await this.extractFromCode(repoMeta.owner, repoMeta.repo);
      tools.push(...codeTools);
      
      if (codeTools.length > 0) {
        sources.push({
          type: 'code',
          count: codeTools.length,
          files: [...new Set(codeTools.map(t => t.source.file))]
        });
      }
    }

    // 4. Extract from GraphQL schemas
    const graphqlTools = await this.extractFromGraphQL(repoMeta.owner, repoMeta.repo);
    tools.push(...graphqlTools);
    if (graphqlTools.length > 0) {
      sources.push({
        type: 'graphql',
        count: graphqlTools.length,
        files: graphqlTools.map(t => t.source.file).filter((f, i, a) => a.indexOf(f) === i)
      });
    }

    // 5. Introspect existing MCP servers
    if (classification.type === 'mcp-server') {
      const mcpTools = await this.introspectMcpServer(repoMeta.owner, repoMeta.repo);
      tools.push(...mcpTools);
      if (mcpTools.length > 0) {
        sources.push({
          type: 'mcp-introspect',
          count: mcpTools.length,
          files: mcpTools.map(t => t.source.file).filter((f, i, a) => a.indexOf(f) === i)
        });
      }
    }

    // 6. Add universal fallback tools (always included)
    const universalTools = this.generateUniversalTools(repoMeta.owner, repoMeta.repo);
    tools.push(...universalTools);
    sources.push({
      type: 'universal',
      count: universalTools.length,
      files: []
    });

    // Deduplicate tools
    const uniqueTools = this.deduplicateTools(tools);

    // Determine output language
    const outputLanguage = this.options.outputLanguage || 'typescript';

    // Build result
    const result: GenerationResult = {
      repo: githubUrl,
      name: repoMeta.repo,
      tools: uniqueTools,
      sources,
      classification,
      metadata,
      generate: () => this.generateCode(uniqueTools, repoMeta.repo, repoMeta.owner, outputLanguage),
      generatePython: () => this.pythonGenerator.generateServer(uniqueTools, repoMeta.repo, repoMeta.owner),
      save: async (outputDir: string) => this.saveToFiles(uniqueTools, repoMeta.repo, repoMeta.owner, outputDir),
      download: () => this.downloadZip(uniqueTools, repoMeta.repo)
    };

    return result;
  }

  /**
   * Classify the repository type
   */
  private async classifyRepo(
    owner: string, 
    repo: string, 
    readme: string | null,
    metadata: any
  ): Promise<RepoClassification> {
    const indicators: string[] = [];
    let type: RepoType = 'unknown';
    let confidence = 0.3;

    const readmeLower = (readme || '').toLowerCase();

    // Check for MCP server indicators
    if (
      readmeLower.includes('mcp') || 
      readmeLower.includes('model context protocol') ||
      readmeLower.includes('@modelcontextprotocol')
    ) {
      type = 'mcp-server';
      confidence = 0.9;
      indicators.push('MCP keywords in README');
    }
    // Check for API/SDK indicators
    else if (
      readmeLower.includes('api') ||
      readmeLower.includes('sdk') ||
      readmeLower.includes('client library') ||
      readmeLower.includes('openapi') ||
      readmeLower.includes('swagger')
    ) {
      type = 'api-sdk';
      confidence = 0.8;
      indicators.push('API/SDK keywords in README');
    }
    // Check for CLI indicators
    else if (
      readmeLower.includes('cli') ||
      readmeLower.includes('command line') ||
      readmeLower.includes('usage:') ||
      readmeLower.includes('npx ') ||
      readmeLower.includes('$ ')
    ) {
      type = 'cli-tool';
      confidence = 0.7;
      indicators.push('CLI patterns in README');
    }
    // Check for library indicators
    else if (
      readmeLower.includes('npm install') ||
      readmeLower.includes('yarn add') ||
      readmeLower.includes('pip install') ||
      readmeLower.includes('import ') ||
      readmeLower.includes('require(')
    ) {
      type = 'library';
      confidence = 0.6;
      indicators.push('Package installation patterns');
    }
    // Check for documentation
    else if (
      readmeLower.includes('documentation') ||
      readmeLower.includes('tutorial') ||
      readmeLower.includes('guide') ||
      readmeLower.includes('learn ')
    ) {
      type = 'documentation';
      confidence = 0.5;
      indicators.push('Documentation keywords');
    }

    // Boost confidence based on language
    if (metadata.language) {
      indicators.push(`Primary language: ${metadata.language}`);
      if (['TypeScript', 'JavaScript', 'Python'].includes(metadata.language)) {
        confidence = Math.min(1, confidence + 0.1);
      }
    }

    // Boost confidence based on stars
    if (metadata.stars > 1000) {
      indicators.push(`Popular repo (${metadata.stars} stars)`);
      confidence = Math.min(1, confidence + 0.05);
    }

    return { type, confidence, indicators };
  }

  /**
   * Generate universal fallback tools that work for any repo
   */
  private generateUniversalTools(owner: string, repo: string): ExtractedTool[] {
    return [
      {
        name: 'get_readme',
        description: `Get the README content from ${owner}/${repo}`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        implementation: `async function get_readme() {
  const response = await fetch('https://api.github.com/repos/${owner}/${repo}/readme', {
    headers: { 'Accept': 'application/vnd.github.raw' }
  });
  if (!response.ok) {
    if (response.status === 404) {
      return { content: [{ type: 'text', text: 'No README found in this repository.' }] };
    }
    throw new Error(\`Failed to fetch README (HTTP \${response.status})\`);
  }
  return { content: [{ type: 'text', text: await response.text() }] };
}`,
        source: { type: 'universal', file: 'generated' }
      },
      {
        name: 'list_files',
        description: `List files and directories in ${owner}/${repo}`,
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path (empty for root)',
              default: ''
            }
          },
          required: []
        },
        implementation: `async function list_files(args: { path?: string }) {
  const path = args.path || '';
  const response = await fetch(\`https://api.github.com/repos/${owner}/${repo}/contents/\${path}\`);
  if (!response.ok) {
    if (response.status === 404) {
      return { content: [{ type: 'text', text: \`Directory not found: \${path || '/'}\` }] };
    }
    throw new Error(\`Failed to list files (HTTP \${response.status})\`);
  }
  const data = await response.json();
  const files = Array.isArray(data) ? data.map((f: any) => ({ name: f.name, type: f.type, path: f.path })) : [data];
  return { content: [{ type: 'text', text: JSON.stringify(files, null, 2) }] };
}`,
        source: { type: 'universal', file: 'generated' }
      },
      {
        name: 'read_file',
        description: `Read a file from ${owner}/${repo}`,
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path to read'
            }
          },
          required: ['path']
        },
        implementation: `async function read_file(args: { path: string }) {
  const response = await fetch(\`https://api.github.com/repos/${owner}/${repo}/contents/\${args.path}\`, {
    headers: { 'Accept': 'application/vnd.github.raw' }
  });
  if (!response.ok) {
    if (response.status === 404) {
      return { content: [{ type: 'text', text: \`File not found: \${args.path}. Use list_files to see available files.\` }] };
    }
    throw new Error(\`Failed to read file (HTTP \${response.status}): \${args.path}\`);
  }
  return { content: [{ type: 'text', text: await response.text() }] };
}`,
        source: { type: 'universal', file: 'generated' }
      },
      {
        name: 'search_code',
        description: `Search for code in ${owner}/${repo}`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            }
          },
          required: ['query']
        },
        implementation: `async function search_code(args: { query: string }) {
  const response = await fetch(\`https://api.github.com/search/code?q=\${encodeURIComponent(args.query)}+repo:${owner}/${repo}\`);
  if (!response.ok) {
    if (response.status === 403) {
      return { content: [{ type: 'text', text: 'GitHub API rate limit exceeded. Try again later or use a GitHub token.' }] };
    }
    if (response.status === 422) {
      return { content: [{ type: 'text', text: 'Search query invalid. Try a simpler search term.' }] };
    }
    throw new Error(\`Search failed (HTTP \${response.status})\`);
  }
  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    return { content: [{ type: 'text', text: \`No results found for: \${args.query}\` }] };
  }
  const results = data.items.slice(0, 10).map((item: any) => ({
    file: item.path,
    url: item.html_url
  }));
  return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
}`,
        source: { type: 'universal', file: 'generated' }
      }
    ];
  }

  /**
   * Extract tools from OpenAPI specs
   */
  private async extractFromOpenApi(owner: string, repo: string): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];

    const specs = await this.github.findApiSpecs(owner, repo);

    for (const spec of specs) {
      try {
        // Use OpenAPI converter
        const converted = await convertOpenApiToMcp(spec.spec);
        
        // Convert to our format
        for (const tool of converted.tools) {
          tools.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            source: {
              type: 'openapi',
              file: spec.path
            }
          });
        }
      } catch (error) {
        console.error(`Failed to convert OpenAPI spec: ${spec.path}`);
      }
    }

    return tools;
  }

  /**
   * Extract tools from README
   */
  private async extractFromReadme(owner: string, repo: string): Promise<ExtractedTool[]> {
    const readme = await this.github.getReadme(owner, repo);
    
    if (!readme) {
      return [];
    }

    return this.readmeExtractor.extract(readme);
  }

  /**
   * Extract tools from code
   */
  private async extractFromCode(owner: string, repo: string): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];

    // Search for SDK files (TypeScript, JavaScript, and Python)
    const sdkFiles = await this.github.searchFiles(
      owner,
      repo,
      /\.(ts|js|py)$/,
      2 // Max depth
    );

    for (const file of sdkFiles) {
      // Skip test files, config files, etc.
      if (this.shouldSkipFile(file.path)) {
        continue;
      }

      const extracted = await this.codeExtractor.extract(file.content, file.path);
      tools.push(...extracted);
    }

    return tools;
  }

  /**
   * Check if file should be skipped
   */
  private shouldSkipFile(filepath: string): boolean {
    const skipPatterns = [
      /test/i,
      /spec/i,
      /\.config\./,
      /\.setup\./,
      /node_modules/,
      /dist/,
      /build/
    ];

    return skipPatterns.some(pattern => pattern.test(filepath));
  }

  /**
   * Extract tools from GraphQL schemas
   */
  private async extractFromGraphQL(owner: string, repo: string): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];

    try {
      // Search for GraphQL schema files
      const graphqlFiles = await this.github.searchFiles(
        owner,
        repo,
        /\.(graphql|gql)$/,
        3 // Max depth
      );

      for (const file of graphqlFiles) {
        if (file.path.includes('node_modules')) continue;
        
        try {
          const schema = this.graphqlExtractor.parseSchema(file.content);
          
          // Determine GraphQL endpoint (guess based on common patterns)
          const endpoint = `https://api.github.com/repos/${owner}/${repo}/graphql`;
          
          const schemaTools = this.graphqlExtractor.schemaToTools(schema, endpoint, owner, repo);
          tools.push(...schemaTools);
        } catch (error) {
          console.error(`Failed to parse GraphQL schema: ${file.path}`);
        }
      }
    } catch (error) {
      // No GraphQL files found
    }

    return tools;
  }

  /**
   * Introspect existing MCP server to extract tool definitions
   */
  private async introspectMcpServer(owner: string, repo: string): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];

    try {
      // Search for likely MCP server files
      const serverFiles = await this.github.searchFiles(
        owner,
        repo,
        /\.(ts|js|py)$/,
        3
      );

      for (const file of serverFiles) {
        // Check if this file looks like an MCP server
        if (!this.mcpIntrospector.isLikelyMcpServer(file.content)) {
          continue;
        }

        let extracted: ExtractedTool[] = [];
        
        if (file.path.endsWith('.py')) {
          extracted = this.mcpIntrospector.extractFromPython(file.content, file.path);
        } else {
          extracted = this.mcpIntrospector.extractFromTypeScript(file.content, file.path);
        }

        tools.push(...extracted);
      }
    } catch (error) {
      console.error('Failed to introspect MCP server:', error);
    }

    return tools;
  }

  /**
   * Deduplicate tools by name
   */
  private deduplicateTools(tools: ExtractedTool[]): ExtractedTool[] {
    const seen = new Map<string, ExtractedTool>();

    for (const tool of tools) {
      if (!seen.has(tool.name)) {
        seen.set(tool.name, tool);
      } else {
        // Prefer MCP introspect > OpenAPI > GraphQL > Code > README > universal > others
        const existing = seen.get(tool.name)!;
        const priority: Record<string, number> = { 
          'mcp-introspect': 8,
          openapi: 7, 
          graphql: 6,
          code: 5, 
          tests: 4, 
          docs: 3, 
          examples: 2, 
          readme: 1,
          universal: 0
        };
        
        if ((priority[tool.source.type] || 0) > (priority[existing.source.type] || 0)) {
          seen.set(tool.name, tool);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Generate TypeScript MCP server code
   */
  private generateCode(tools: ExtractedTool[], repoName: string, owner?: string, language: OutputLanguage = 'typescript'): string {
    // If Python output requested, use Python generator
    if (language === 'python') {
      return this.pythonGenerator.generateServer(tools, repoName, owner || 'unknown');
    }

    const toolDefinitions = tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }));

    const toolCases = tools.map(t => `
    case '${t.name}':
      return await ${t.name}(args);`
    ).join('\n');

    const implementations = tools.map(t => t.implementation || '').join('\n\n');

    return `/**
 * Auto-generated MCP server for ${repoName}
 * Generated by @nirholas/github-to-mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: '${repoName}-mcp',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ${JSON.stringify(toolDefinitions, null, 2)}
}));

// Tool implementations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {${toolCases}
    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
});

// Tool functions
${implementations}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${repoName} MCP server running on stdio');
}

main().catch(console.error);
`;
  }

  /**
   * Save generated code to files
   */
  private async saveToFiles(tools: ExtractedTool[], repoName: string, owner: string, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    // Generate main server file
    const serverCode = this.generateCode(tools, repoName, owner);
    await fs.writeFile(path.join(outputDir, 'index.ts'), serverCode);

    // Generate package.json
    const packageJson = {
      name: `${repoName}-mcp`,
      version: '1.0.0',
      type: 'module',
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0'
      }
    };
    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Generate README
    const readme = this.generateReadme(tools, repoName);
    await fs.writeFile(path.join(outputDir, 'README.md'), readme);
  }

  /**
   * Generate README for the MCP server
   */
  private generateReadme(tools: ExtractedTool[], repoName: string): string {
    const toolsList = tools.map(t => `- \`${t.name}\`: ${t.description}`).join('\n');

    return `# ${repoName} MCP Server

Auto-generated MCP server with ${tools.length} tools.

## Tools

${toolsList}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
node index.ts
\`\`\`
`;
  }

  /**
   * Download as ZIP (browser only)
   */
  private downloadZip(tools: ExtractedTool[], repoName: string): void {
    // This would require a ZIP library in browser context
    console.log('Download functionality requires browser environment');
  }
}

/**
 * Convenience function for single repo
 */
export async function generateFromGithub(
  url: string,
  options?: GithubToMcpOptions
): Promise<GenerationResult> {
  const generator = new GithubToMcpGenerator(options);
  return generator.generate(url);
}

/**
 * Batch processing
 */
export async function generateFromGithubBatch(
  urls: string[],
  options?: GithubToMcpOptions
): Promise<GenerationResult[]> {
  const generator = new GithubToMcpGenerator(options);
  return Promise.all(urls.map(url => generator.generate(url)));
}

// Export all types
export * from './types';

// Export streaming module
export {
  StreamingGenerator,
  streamGenerate,
  collectStreamEvents,
  streamToResult,
  type StreamEvent,
  type StreamOptions,
  type StreamEventType,
  type StartEvent,
  type MetadataEvent,
  type ClassifyingEvent,
  type ClassifiedEvent,
  type ExtractingEvent,
  type ToolFoundEvent,
  type SourceCompleteEvent,
  type GeneratingEvent,
  type CompleteEvent,
  type ErrorEvent,
  type ProgressEvent
} from './streaming';

// Export plugin system
export {
  PluginManager,
  PluginRegistry,
  defaultPluginManager,
  defaultRegistry,
  registerPlugin,
  unregisterPlugin,
  listPlugins,
  loadPlugin,
  loadPluginFromFile,
  type ExtractorPlugin,
  type PluginRepoContext,
  type PluginExtractionResult,
  type PluginDetectionResult,
  type PluginManagerConfig,
  type PluginLoadResult,
  type PluginEvent,
  type PluginEventHandler,
  type PluginMetadata,
  type PluginConfigSchema,
  type PluginHooks
} from './plugins';

// Export language-specific extractors
export { RustExtractor } from './extractors/rust-extractor';
export { GoExtractor } from './extractors/go-extractor';
export { JavaExtractor } from './extractors/java-extractor';

// Export language-specific generators
export { PythonGenerator } from './python-generator';
export { GoGenerator } from './go-generator';
