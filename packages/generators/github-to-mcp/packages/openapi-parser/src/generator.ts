/**
 * @fileoverview generator module implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import Handlebars from 'handlebars';
import type { McpToolDefinition } from './transformer.js';
import type { OpenAPIV3 } from 'openapi-types';

export interface GeneratorOptions {
  format: 'typescript' | 'javascript' | 'json';
  serverName: string;
  serverVersion: string;
  baseUrl: string;
  auth?: {
    type: 'bearer' | 'basic' | 'apiKey' | 'oauth';
    envVar?: string;
    header?: string;
  };
  features?: {
    pagination?: boolean;
    retry?: boolean;
    cache?: boolean;
    validation?: boolean;
    types?: boolean;
  };
}

/**
 * Generates MCP server code from tool definitions
 */
export class CodeGenerator {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(private options: GeneratorOptions) {
    this.initializeTemplates();
  }

  /**
   * Initialize Handlebars templates
   */
  private initializeTemplates() {
    // Server template
    const serverTemplate = `
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
{{#if features.cache}}
import { Cache } from './utils/cache.js';
{{/if}}
{{#if features.retry}}
import { retryWithBackoff } from './utils/retry.js';
{{/if}}

// Import all tool handlers
{{#each toolGroups}}
import * as {{this.name}}Tools from './tools/{{this.name}}.js';
{{/each}}

const server = new Server(
  {
    name: '{{serverName}}',
    version: '{{serverVersion}}',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Collect all tools
const allTools = [
  {{#each toolGroups}}
  ...Object.values({{this.name}}Tools),
  {{/each}}
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = allTools.find(t => t.name === name);
  if (!tool) {
    throw new Error(\`Unknown tool: \${name}\`);
  }

  {{#if features.validation}}
  // Validate inputs (using Zod or JSON Schema)
  // ... validation logic
  {{/if}}

  try {
    const result = await tool.handler(args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: \`Error: \${error instanceof Error ? error.message : 'Unknown error'}\`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('{{serverName}} MCP server running on stdio');
}

main().catch(console.error);
`;

    // Tool template
    const toolTemplate = `
{{#if features.cache}}
const cache = new Cache({ ttl: 300000 }); // 5 minutes
{{/if}}

/**
 * {{description}}
 * @endpoint {{metadata.endpoint.method}} {{metadata.endpoint.path}}
 {{#if metadata.deprecated}}
 * @deprecated
 {{/if}}
 */
export const {{name}} = {
  name: '{{name}}',
  description: '{{description}}',
  inputSchema: {{{json inputSchema}}},
  
  handler: async (args: any) => {
    {{#if features.cache}}
    {{#if isGetMethod}}
    // Check cache for GET requests
    const cacheKey = '{{name}}:' + JSON.stringify(args);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    {{/if}}
    {{/if}}

    // Build URL
    let url = '{{baseUrl}}{{metadata.endpoint.path}}';
    
    {{#if hasPathParams}}
    // Replace path parameters
    {{#each pathParams}}
    url = url.replace('{{{this.name}}}', encodeURIComponent(args.{{this.name}}));
    {{/each}}
    {{/if}}
    
    {{#if hasQueryParams}}
    // Add query parameters
    const queryParams = new URLSearchParams();
    {{#each queryParams}}
    if (args.{{this.name}} !== undefined) {
      queryParams.append('{{this.name}}', String(args.{{this.name}}));
    }
    {{/each}}
    const queryString = queryParams.toString();
    if (queryString) {
      url += '?' + queryString;
    }
    {{/if}}

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      {{#if auth}}
      {{#if (eq auth.type 'bearer')}}
      'Authorization': \`Bearer \${process.env.{{auth.envVar}} || ''}\`,
      {{/if}}
      {{#if (eq auth.type 'apiKey')}}
      '{{auth.header}}': process.env.{{auth.envVar}} || '',
      {{/if}}
      {{/if}}
    };

    {{#if hasHeaderParams}}
    // Add custom headers
    {{#each headerParams}}
    if (args.{{this.name}} !== undefined) {
      headers['{{this.name}}'] = String(args.{{this.name}});
    }
    {{/each}}
    {{/if}}

    // Build request options
    const options: RequestInit = {
      method: '{{metadata.endpoint.method}}',
      headers,
      {{#if hasBody}}
      body: JSON.stringify(args.body || args),
      {{/if}}
    };

    {{#if features.retry}}
    // Execute with retry
    const executeRequest = async () => {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(\`HTTP \${response.status}: \${error}\`);
      }
      
      return await response.json();
    };
    
    const result = await retryWithBackoff(executeRequest, {
      maxRetries: 3,
      baseDelay: 1000,
    });
    {{else}}
    // Execute request
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`HTTP \${response.status}: \${error}\`);
    }
    
    const result = await response.json();
    {{/if}}

    {{#if features.cache}}
    {{#if isGetMethod}}
    // Cache result for GET requests
    cache.set(cacheKey, result);
    {{/if}}
    {{/if}}

    {{#if metadata.pagination}}
    // Handle pagination - automatically fetches all pages
    let allResults = Array.isArray(result) ? result : [result];
    let nextPageUrl = result.next || result.nextPage || result._links?.next?.href;
    let pageCount = 1;
    const maxPages = 100; // Safety limit
    
    while (nextPageUrl && pageCount < maxPages) {
      const pageResponse = await fetch(nextPageUrl, options);
      if (!pageResponse.ok) break;
      
      const pageResult = await pageResponse.json();
      const pageData = Array.isArray(pageResult) 
        ? pageResult 
        : (pageResult.data || pageResult.items || pageResult.results || []);
      
      allResults = allResults.concat(pageData);
      nextPageUrl = pageResult.next || pageResult.nextPage || pageResult._links?.next?.href;
      pageCount++;
    }
    
    return { data: allResults, totalPages: pageCount };
    {{/if}}

    return result;
  }
};
`;

    this.templates.set('server', Handlebars.compile(serverTemplate));
    this.templates.set('tool', Handlebars.compile(toolTemplate));

    // Register Handlebars helpers
    Handlebars.registerHelper('json', (context) => JSON.stringify(context, null, 2));
    Handlebars.registerHelper('eq', (a, b) => a === b);
  }

  /**
   * Generate complete MCP server
   */
  generateServer(
    tools: McpToolDefinition[],
    toolGroups: Map<string, McpToolDefinition[]>
  ): Map<string, string> {
    const files = new Map<string, string>();

    // Generate main server file
    const serverTemplate = this.templates.get('server')!;
    const serverCode = serverTemplate({
      serverName: this.options.serverName,
      serverVersion: this.options.serverVersion,
      features: this.options.features,
      toolGroups: Array.from(toolGroups.entries()).map(([name, tools]) => ({
        name,
        count: tools.length,
      })),
    });
    files.set('index.ts', serverCode);

    // Generate tool files (grouped)
    for (const [groupName, groupTools] of toolGroups.entries()) {
      const toolsCode = this.generateToolsFile(groupTools);
      files.set(`tools/${groupName}.ts`, toolsCode);
    }

    // Generate utility files
    if (this.options.features?.cache) {
      files.set('utils/cache.ts', this.generateCacheUtil());
    }
    if (this.options.features?.retry) {
      files.set('utils/retry.ts', this.generateRetryUtil());
    }

    // Generate package.json
    files.set('package.json', this.generatePackageJson());

    // Generate tsconfig.json
    if (this.options.format === 'typescript') {
      files.set('tsconfig.json', this.generateTsConfig());
    }

    // Generate README.md
    files.set('README.md', this.generateReadme(tools));

    return files;
  }

  /**
   * Generate tools file for a group
   */
  private generateToolsFile(tools: McpToolDefinition[]): string {
    const toolTemplate = this.templates.get('tool')!;
    const toolsCode = tools.map(tool => {
      return toolTemplate({
        ...tool,
        baseUrl: this.options.baseUrl,
        auth: this.options.auth,
        features: this.options.features,
        isGetMethod: tool.metadata.endpoint.method === 'GET',
        hasPathParams: this.hasPathParams(tool),
        hasQueryParams: this.hasQueryParams(tool),
        hasHeaderParams: this.hasHeaderParams(tool),
        hasBody: this.hasBody(tool),
        pathParams: this.getPathParams(tool),
        queryParams: this.getQueryParams(tool),
        headerParams: this.getHeaderParams(tool),
      });
    });

    return toolsCode.join('\n\n');
  }

  /**
   * Check if tool has path parameters
   */
  private hasPathParams(tool: McpToolDefinition): boolean {
    return tool.metadata.endpoint.path.includes('{');
  }

  /**
   * Check if tool has query parameters
   */
  private hasQueryParams(tool: McpToolDefinition): boolean {
    return Object.keys(tool.inputSchema.properties || {}).some(
      key => !tool.metadata.endpoint.path.includes(`{${key}}`)
    );
  }

  /**
   * Check if tool has header parameters
   */
  private hasHeaderParams(tool: McpToolDefinition): boolean {
    // Simplified - would need to track parameter locations
    return false;
  }

  /**
   * Check if tool has body
   */
  private hasBody(tool: McpToolDefinition): boolean {
    return ['POST', 'PUT', 'PATCH'].includes(tool.metadata.endpoint.method);
  }

  /**
   * Get path parameters
   */
  private getPathParams(tool: McpToolDefinition): Array<{ name: string }> {
    const matches = tool.metadata.endpoint.path.matchAll(/\{([^}]+)\}/g);
    return Array.from(matches).map(m => ({ name: m[1] }));
  }

  /**
   * Get query parameters
   */
  private getQueryParams(tool: McpToolDefinition): Array<{ name: string }> {
    const pathParams = new Set(this.getPathParams(tool).map(p => p.name));
    return Object.keys(tool.inputSchema.properties || {})
      .filter(key => !pathParams.has(key) && key !== 'body')
      .map(name => ({ name }));
  }

  /**
   * Get header parameters
   */
  private getHeaderParams(tool: McpToolDefinition): Array<{ name: string }> {
    return [];
  }

  /**
   * Generate cache utility
   */
  private generateCacheUtil(): string {
    return `
export class Cache {
  private store: Map<string, { data: any; timestamp: number }> = new Map();
  private ttl: number;

  constructor(options: { ttl: number }) {
    this.ttl = options.ttl;
  }

  get(key: string): any | null {
    const cached = this.store.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.store.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key: string, data: any): void {
    this.store.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.store.clear();
  }
}
`;
  }

  /**
   * Generate retry utility
   */
  private generateRetryUtil(): string {
    return `
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelay: number;
  }
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i <= options.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < options.maxRetries) {
        const delay = options.baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
`;
  }

  /**
   * Generate package.json
   */
  private generatePackageJson(): string {
    return JSON.stringify({
      name: this.options.serverName.toLowerCase().replace(/\s+/g, '-'),
      version: this.options.serverVersion,
      type: 'module',
      main: './dist/index.js',
      scripts: {
        build: 'tsc',
        start: 'node dist/index.js',
        dev: 'tsx src/index.ts',
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0',
      },
      devDependencies: {
        '@types/node': '^20.10.0',
        typescript: '^5.3.3',
        tsx: '^4.7.0',
      },
    }, null, 2);
  }

  /**
   * Generate tsconfig.json
   */
  private generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'node',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    }, null, 2);
  }

  /**
   * Generate README
   */
  private generateReadme(tools: McpToolDefinition[]): string {
    const toolsByGroup = new Map<string, McpToolDefinition[]>();
    
    for (const tool of tools) {
      const group = tool.metadata.tags?.[0] || 'default';
      if (!toolsByGroup.has(group)) {
        toolsByGroup.set(group, []);
      }
      toolsByGroup.get(group)!.push(tool);
    }

    let readme = `# ${this.options.serverName}\n\n`;
    readme += `Auto-generated MCP server with ${tools.length} tools.\n\n`;
    readme += `## Installation\n\n\`\`\`bash\nnpm install\nnpm run build\nnpm start\n\`\`\`\n\n`;
    readme += `## Tools\n\n`;

    for (const [group, groupTools] of toolsByGroup.entries()) {
      readme += `### ${group} (${groupTools.length} tools)\n\n`;
      for (const tool of groupTools) {
        readme += `- **${tool.name}**: ${tool.description}\n`;
      }
      readme += `\n`;
    }

    return readme;
  }
}
