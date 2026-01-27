/**
 * @fileoverview MCP Server for github-to-mcp
 * Exposes the github-to-mcp conversion functionality as MCP tools
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { GithubToMcpGenerator, ExtractedTool, GenerationResult } from '@nirholas/github-to-mcp';
import { z } from 'zod';

// Import new tools
import {
  generateOpenApiTool,
  handleGenerateOpenApi,
} from './tools/generate-openapi.js';
import {
  exportDockerTool,
  handleExportDocker,
} from './tools/export-docker.js';
import {
  streamConvertTool,
  listProvidersTool,
  handleStreamConvert,
  handleListProviders,
} from './tools/stream-convert.js';
import {
  testMcpToolTool,
  handleTestMcpTool,
} from './tools/test-mcp-tool.js';
import {
  monitorMcpServerTool,
  handleMonitorMcpServer,
} from './tools/monitor-mcp-server.js';

// Import prompts
import {
  PROMPTS,
  getPromptMessages,
} from './prompts/index.js';

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  {
    name: 'convert_repo',
    description: `Convert a GitHub repository into an MCP server implementation.
    
This tool analyzes a GitHub repository and generates a complete MCP server that exposes the repository's functionality as AI-usable tools.

Supported extraction sources:
- OpenAPI/Swagger specifications
- README documentation
- Source code (Python functions, TypeScript functions)
- GraphQL schemas
- Existing MCP server introspection

Returns the generated MCP server code with full type annotations and documentation.`,
    inputSchema: {
      type: 'object',
      properties: {
        github_url: {
          type: 'string',
          description: 'The GitHub repository URL (e.g., https://github.com/owner/repo)',
        },
        output_language: {
          type: 'string',
          enum: ['typescript', 'python'],
          default: 'typescript',
          description: 'The output language for the generated MCP server',
        },
        sources: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['readme', 'openapi', 'code', 'graphql'],
          },
          description: 'Which extraction sources to use (default: all)',
        },
        github_token: {
          type: 'string',
          description: 'GitHub personal access token for private repos or higher rate limits (optional)',
        },
      },
      required: ['github_url'],
    },
  },
  {
    name: 'list_extracted_tools',
    description: `Preview the tools that would be extracted from a GitHub repository without generating the full MCP server.
    
Useful for understanding what capabilities will be available before committing to a full conversion.

Returns a structured list of all detected tools with their names, descriptions, parameters, and source locations.`,
    inputSchema: {
      type: 'object',
      properties: {
        github_url: {
          type: 'string',
          description: 'The GitHub repository URL to analyze',
        },
        sources: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['readme', 'openapi', 'code', 'graphql'],
          },
          description: 'Which extraction sources to scan',
        },
        github_token: {
          type: 'string',
          description: 'GitHub personal access token (optional)',
        },
      },
      required: ['github_url'],
    },
  },
  {
    name: 'validate_mcp_server',
    description: `Validate MCP server code for correctness and best practices.
    
Checks:
- Tool definitions are well-formed
- Input schemas are valid JSON Schema
- Type annotations are consistent
- Required fields are present
- Description quality

Returns validation results with any warnings or errors found.`,
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The MCP server code to validate',
        },
        language: {
          type: 'string',
          enum: ['typescript', 'python'],
          description: 'The language of the code',
        },
      },
      required: ['code', 'language'],
    },
  },
  {
    name: 'generate_claude_config',
    description: `Generate a Claude Desktop configuration snippet for an MCP server.
    
Creates the JSON configuration that can be added to Claude Desktop's config file to register the generated MCP server.`,
    inputSchema: {
      type: 'object',
      properties: {
        server_name: {
          type: 'string',
          description: 'Name for the MCP server in the config',
        },
        server_path: {
          type: 'string',
          description: 'Path to the generated MCP server file',
        },
        language: {
          type: 'string',
          enum: ['typescript', 'python'],
          description: 'The language of the MCP server',
        },
        env_vars: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Environment variables to pass to the server',
        },
      },
      required: ['server_name', 'server_path', 'language'],
    },
  },
  {
    name: 'generate_cursor_config',
    description: `Generate a Cursor IDE configuration for an MCP server.
    
Creates the configuration format used by Cursor to integrate MCP servers.`,
    inputSchema: {
      type: 'object',
      properties: {
        server_name: {
          type: 'string',
          description: 'Name for the MCP server',
        },
        server_path: {
          type: 'string',
          description: 'Path to the generated MCP server file',
        },
        language: {
          type: 'string',
          enum: ['typescript', 'python'],
          description: 'The language of the MCP server',
        },
      },
      required: ['server_name', 'server_path', 'language'],
    },
  },
  {
    name: 'analyze_repo_structure',
    description: `Analyze a GitHub repository's structure to identify what extraction sources are available.
    
Scans for:
- OpenAPI/Swagger specs
- GraphQL schemas
- README files
- Python and TypeScript source files
- Existing MCP server implementations

Returns a detailed breakdown of the repository structure with recommendations for extraction.`,
    inputSchema: {
      type: 'object',
      properties: {
        github_url: {
          type: 'string',
          description: 'The GitHub repository URL to analyze',
        },
        github_token: {
          type: 'string',
          description: 'GitHub personal access token (optional)',
        },
      },
      required: ['github_url'],
    },
  },
  {
    name: 'convert_openapi_to_mcp',
    description: `Convert an OpenAPI specification directly to MCP tools.
    
Supports OpenAPI 3.x and Swagger 2.0 specifications. Can also handle:
- Postman collections
- Insomnia exports
- HAR files
- AsyncAPI specs
- GraphQL schemas

Returns MCP tool definitions extracted from the API specification.`,
    inputSchema: {
      type: 'object',
      properties: {
        spec: {
          type: 'string',
          description: 'The OpenAPI specification content (JSON or YAML)',
        },
        format: {
          type: 'string',
          enum: ['openapi', 'swagger', 'postman', 'insomnia', 'har', 'asyncapi', 'graphql'],
          default: 'openapi',
          description: 'The format of the specification',
        },
        base_url: {
          type: 'string',
          description: 'Override the base URL for API calls',
        },
      },
      required: ['spec'],
    },
  },
  {
    name: 'get_tool_template',
    description: `Get a template for creating a new MCP tool definition.
    
Returns a starter template in the requested language with best practices and documentation.`,
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'Name for the tool',
        },
        description: {
          type: 'string',
          description: 'Description of what the tool does',
        },
        parameters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              description: { type: 'string' },
              required: { type: 'boolean' },
            },
          },
          description: 'List of parameters for the tool',
        },
        language: {
          type: 'string',
          enum: ['typescript', 'python'],
          default: 'typescript',
          description: 'Target language for the template',
        },
      },
      required: ['tool_name', 'description'],
    },
  },
  // New tools added
  generateOpenApiTool,
  exportDockerTool,
  streamConvertTool,
  listProvidersTool,
  testMcpToolTool,
  monitorMcpServerTool,
];

// ============================================================================
// Tool Implementations
// ============================================================================

async function convertRepo(args: {
  github_url: string;
  output_language?: 'typescript' | 'python';
  sources?: string[];
  github_token?: string;
}): Promise<TextContent> {
  const generator = new GithubToMcpGenerator({
    githubToken: args.github_token,
    sources: args.sources as any,
    outputLanguage: args.output_language || 'typescript',
  });

  try {
    const result = await generator.generate(args.github_url);
    
    let code: string;
    if (args.output_language === 'python') {
      code = result.generatePython();
    } else {
      code = result.generate();
    }

    const summary = formatResultSummary(result);

    return {
      type: 'text',
      text: `# MCP Server Generated Successfully

${summary}

## Generated Code

\`\`\`${args.output_language || 'typescript'}
${code}
\`\`\`
`,
    };
  } catch (error) {
    return {
      type: 'text',
      text: `Error generating MCP server: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function listExtractedTools(args: {
  github_url: string;
  sources?: string[];
  github_token?: string;
}): Promise<TextContent> {
  const generator = new GithubToMcpGenerator({
    githubToken: args.github_token,
    sources: args.sources as any,
  });

  try {
    const result = await generator.generate(args.github_url);
    
    const toolsList = result.tools.map((tool: ExtractedTool, index: number) => {
      const params = Object.entries(tool.parameters || {})
        .map(([name, schema]) => {
          const s = schema as any;
          return `  - \`${name}\` (${s.type}${tool.required?.includes(name) ? ', required' : ''}): ${s.description || 'No description'}`;
        })
        .join('\n');
      
      return `### ${index + 1}. ${tool.name}

**Source:** ${tool.source.type} (${tool.source.file})
**Description:** ${tool.description}

**Parameters:**
${params || '  None'}
`;
    }).join('\n---\n\n');

    return {
      type: 'text',
      text: `# Extracted Tools from ${args.github_url}

**Total Tools:** ${result.tools.length}
**Sources Used:** ${result.sources.map(s => `${s.type} (${s.count} tools)`).join(', ')}

---

${toolsList}`,
    };
  } catch (error) {
    return {
      type: 'text',
      text: `Error analyzing repository: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function validateMcpServer(args: { code: string; language: string }): TextContent {
  const issues: string[] = [];
  const warnings: string[] = [];
  const code = args.code;

  // Check for tool definitions
  if (args.language === 'typescript') {
    if (!code.includes('ListToolsRequestSchema') && !code.includes('tools:')) {
      issues.push('Missing tool definitions - no ListToolsRequestSchema handler or tools array found');
    }
    if (!code.includes('CallToolRequestSchema')) {
      issues.push('Missing CallToolRequestSchema handler - tools cannot be executed');
    }
    if (!code.includes('@modelcontextprotocol/sdk')) {
      warnings.push('Not using official MCP SDK - consider using @modelcontextprotocol/sdk');
    }
    if (!code.includes('inputSchema')) {
      warnings.push('No inputSchema definitions found - tools may not have proper parameter validation');
    }
    if (!code.includes('description')) {
      warnings.push('Missing tool descriptions - AI assistants need descriptions to understand tool purpose');
    }
  } else if (args.language === 'python') {
    if (!code.includes('@mcp.tool') && !code.includes('list_tools')) {
      issues.push('Missing tool definitions');
    }
    if (!code.includes('description=')) {
      warnings.push('Missing tool descriptions');
    }
    if (!code.includes('def ') && !code.includes('async def ')) {
      issues.push('No function definitions found');
    }
  }

  // Check for common issues
  if (code.length < 100) {
    issues.push('Code appears too short to be a complete MCP server');
  }

  const status = issues.length === 0 ? '✅ Valid' : '❌ Invalid';

  return {
    type: 'text',
    text: `# MCP Server Validation

**Status:** ${status}

${issues.length > 0 ? `## Errors
${issues.map(i => `- ❌ ${i}`).join('\n')}
` : ''}

${warnings.length > 0 ? `## Warnings
${warnings.map(w => `- ⚠️ ${w}`).join('\n')}
` : ''}

${issues.length === 0 && warnings.length === 0 ? '✅ No issues found!' : ''}`,
  };
}

function generateClaudeConfig(args: {
  server_name: string;
  server_path: string;
  language: string;
  env_vars?: Record<string, string>;
}): TextContent {
  const command = args.language === 'python' ? 'python' : 'node';
  const config = {
    mcpServers: {
      [args.server_name]: {
        command,
        args: [args.server_path],
        ...(args.env_vars && { env: args.env_vars }),
      },
    },
  };

  return {
    type: 'text',
    text: `# Claude Desktop Configuration

Add the following to your Claude Desktop config file:

**macOS:** \`~/Library/Application Support/Claude/claude_desktop_config.json\`
**Windows:** \`%APPDATA%\\Claude\\claude_desktop_config.json\`
**Linux:** \`~/.config/Claude/claude_desktop_config.json\`

\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

## Full Config Example

If you have multiple servers, merge them like this:

\`\`\`json
{
  "mcpServers": {
    "${args.server_name}": ${JSON.stringify(config.mcpServers[args.server_name], null, 4).split('\n').join('\n    ')},
    "other-server": {
      "command": "...",
      "args": ["..."]
    }
  }
}
\`\`\`
`,
  };
}

function generateCursorConfig(args: {
  server_name: string;
  server_path: string;
  language: string;
}): TextContent {
  const command = args.language === 'python' ? 'python' : 'node';
  
  return {
    type: 'text',
    text: `# Cursor IDE Configuration

Add to your Cursor settings or \`.cursor/mcp.json\`:

\`\`\`json
{
  "mcpServers": {
    "${args.server_name}": {
      "command": "${command}",
      "args": ["${args.server_path}"]
    }
  }
}
\`\`\`

## Alternative: Using npx

If your MCP server is published to npm:

\`\`\`json
{
  "mcpServers": {
    "${args.server_name}": {
      "command": "npx",
      "args": ["-y", "${args.server_name}"]
    }
  }
}
\`\`\`
`,
  };
}

async function analyzeRepoStructure(args: {
  github_url: string;
  github_token?: string;
}): Promise<TextContent> {
  const generator = new GithubToMcpGenerator({
    githubToken: args.github_token,
  });

  try {
    const result = await generator.generate(args.github_url);
    
    const analysis = {
      classification: result.classification,
      sources: result.sources,
      metadata: {
        name: result.metadata.name,
        description: result.metadata.description,
        language: result.metadata.language,
        stars: result.metadata.stargazers_count,
        topics: result.metadata.topics,
      },
    };

    const recommendations: string[] = [];
    
    if (result.classification.type === 'api-sdk') {
      recommendations.push('This appears to be an API SDK - OpenAPI extraction will likely work well');
    }
    if (result.classification.type === 'mcp-server') {
      recommendations.push('This is already an MCP server - introspection mode recommended');
    }
    if (result.sources.some(s => s.type === 'openapi')) {
      recommendations.push('OpenAPI specs detected - these provide the most accurate tool definitions');
    }
    if (result.sources.some(s => s.type === 'code')) {
      recommendations.push('Source code parsed - consider reviewing auto-generated descriptions');
    }

    return {
      type: 'text',
      text: `# Repository Analysis: ${args.github_url}

## Classification
- **Type:** ${result.classification.type}
- **Confidence:** ${(result.classification.confidence * 100).toFixed(0)}%
- **Indicators:** ${result.classification.indicators.join(', ')}

## Repository Info
- **Language:** ${analysis.metadata.language || 'Unknown'}
- **Stars:** ${analysis.metadata.stars || 0}
- **Topics:** ${analysis.metadata.topics?.join(', ') || 'None'}

## Detected Sources
${result.sources.map(s => `- **${s.type}:** ${s.count} tools from ${s.files.length} files`).join('\n')}

## Files by Source
${result.sources.map(s => `### ${s.type}
${s.files.map(f => `- ${f}`).join('\n') || 'N/A'}`).join('\n\n')}

## Recommendations
${recommendations.map(r => `- ${r}`).join('\n')}

## Total Tools Available: ${result.tools.length}
`,
    };
  } catch (error) {
    return {
      type: 'text',
      text: `Error analyzing repository: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function convertOpenApiToMcpTool(args: {
  spec: string;
  format?: string;
  base_url?: string;
}): Promise<TextContent> {
  try {
    const { convertOpenApiToMcp } = await import('@github-to-mcp/openapi-parser');
    
    const result = await convertOpenApiToMcp(args.spec, {
      format: args.format as any,
      baseUrl: args.base_url,
    });

    return {
      type: 'text',
      text: `# OpenAPI to MCP Conversion

**Tools Extracted:** ${result.tools.length}
**API Title:** ${result.info?.title || 'Unknown'}
**Version:** ${result.info?.version || 'Unknown'}

## Tools

${result.tools.map((tool: any, i: number) => `### ${i + 1}. ${tool.name}
${tool.description}

**Parameters:**
${Object.entries(tool.inputSchema?.properties || {}).map(([name, schema]: [string, any]) => 
  `- \`${name}\` (${schema.type}): ${schema.description || 'No description'}`
).join('\n') || 'None'}
`).join('\n---\n')}`,
    };
  } catch (error) {
    return {
      type: 'text',
      text: `Error converting specification: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function getToolTemplate(args: {
  tool_name: string;
  description: string;
  parameters?: Array<{ name: string; type: string; description?: string; required?: boolean }>;
  language?: string;
}): TextContent {
  const params = args.parameters || [];
  
  if (args.language === 'python') {
    const pythonParams = params.map(p => {
      const pythonType = {
        string: 'str',
        number: 'float',
        integer: 'int',
        boolean: 'bool',
        array: 'list',
        object: 'dict',
      }[p.type] || 'Any';
      return `    ${p.name}: ${pythonType}${p.required ? '' : ' = None'}`;
    }).join('\n');

    const docParams = params.map(p => 
      `        ${p.name}: ${p.description || 'No description'}`
    ).join('\n');

    return {
      type: 'text',
      text: `# Python MCP Tool Template

\`\`\`python
from mcp.server import Server
from mcp.types import Tool, TextContent
import mcp.server.stdio

server = Server("${args.tool_name}-server")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="${args.tool_name}",
            description="""${args.description}""",
            inputSchema={
                "type": "object",
                "properties": {
${params.map(p => `                    "${p.name}": {
                        "type": "${p.type}",
                        "description": "${p.description || ''}"
                    }`).join(',\n')}
                },
                "required": [${params.filter(p => p.required).map(p => `"${p.name}"`).join(', ')}]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "${args.tool_name}":
        return await ${args.tool_name.replace(/-/g, '_')}(**arguments)
    raise ValueError(f"Unknown tool: {name}")

async def ${args.tool_name.replace(/-/g, '_')}(
${pythonParams || '    # No parameters'}
) -> list[TextContent]:
    """
    ${args.description}
    
    Args:
${docParams || '        None'}
    
    Returns:
        Tool execution result
    """
    # TODO: Implement tool logic
    result = f"Executed ${args.tool_name}"
    
    return [TextContent(type="text", text=result)]

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
\`\`\`
`,
    };
  }

  // TypeScript template (default)
  const tsParams = params.map(p => 
    `${p.name}${p.required ? '' : '?'}: ${p.type === 'integer' ? 'number' : p.type}`
  ).join('; ');

  return {
    type: 'text',
    text: `# TypeScript MCP Tool Template

\`\`\`typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: '${args.tool_name}-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Tool definitions
const TOOLS = [
  {
    name: '${args.tool_name}',
    description: \`${args.description}\`,
    inputSchema: {
      type: 'object',
      properties: {
${params.map(p => `        ${p.name}: {
          type: '${p.type}',
          description: '${p.description || ''}',
        }`).join(',\n')}
      },
      required: [${params.filter(p => p.required).map(p => `'${p.name}'`).join(', ')}],
    },
  },
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === '${args.tool_name}') {
    const { ${params.map(p => p.name).join(', ')} } = args as { ${tsParams || 'never?: never' } };
    
    // TODO: Implement tool logic
    const result = \`Executed ${args.tool_name}\`;
    
    return {
      content: [{ type: 'text', text: result }],
    };
  }
  
  throw new Error(\`Unknown tool: \${name}\`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server running on stdio');
}

main().catch(console.error);
\`\`\`
`,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatResultSummary(result: GenerationResult): string {
  return `## Conversion Summary

- **Repository:** ${result.repo}
- **Classification:** ${result.classification.type} (${(result.classification.confidence * 100).toFixed(0)}% confidence)
- **Total Tools:** ${result.tools.length}

### Sources Breakdown
${result.sources.map(s => `- **${s.type}:** ${s.count} tools`).join('\n')}

### Extracted Tools
${result.tools.slice(0, 10).map((t: ExtractedTool, i: number) => `${i + 1}. \`${t.name}\` - ${t.description?.slice(0, 60)}${(t.description?.length || 0) > 60 ? '...' : ''}`).join('\n')}
${result.tools.length > 10 ? `\n... and ${result.tools.length - 10} more tools` : ''}`;
}

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'github-to-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: TextContent;

    switch (name) {
      case 'convert_repo':
        result = await convertRepo(args as any);
        break;
      case 'list_extracted_tools':
        result = await listExtractedTools(args as any);
        break;
      case 'validate_mcp_server':
        result = validateMcpServer(args as any);
        break;
      case 'generate_claude_config':
        result = generateClaudeConfig(args as any);
        break;
      case 'generate_cursor_config':
        result = generateCursorConfig(args as any);
        break;
      case 'analyze_repo_structure':
        result = await analyzeRepoStructure(args as any);
        break;
      case 'convert_openapi_to_mcp':
        result = await convertOpenApiToMcpTool(args as any);
        break;
      case 'get_tool_template':
        result = getToolTemplate(args as any);
        break;
      // New tool handlers
      case 'generate_openapi_spec':
        result = await handleGenerateOpenApi(args as any);
        break;
      case 'export_docker':
        result = await handleExportDocker(args as any);
        break;
      case 'stream_convert':
        result = await handleStreamConvert(args as any);
        break;
      case 'list_providers':
        result = await handleListProviders(args as any);
        break;
      case 'test_mcp_tool':
        result = await handleTestMcpTool(args as any);
        break;
      case 'monitor_mcp_server':
        result = await handleMonitorMcpServer(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [result],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// List resources (documentation, examples)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'github-to-mcp://docs/quick-start',
        name: 'Quick Start Guide',
        description: 'Get started with github-to-mcp in 5 minutes',
        mimeType: 'text/markdown',
      },
      {
        uri: 'github-to-mcp://docs/extraction-sources',
        name: 'Extraction Sources',
        description: 'Learn about different extraction sources and their capabilities',
        mimeType: 'text/markdown',
      },
      {
        uri: 'github-to-mcp://examples/typescript',
        name: 'TypeScript MCP Server Example',
        description: 'Complete TypeScript MCP server example',
        mimeType: 'text/markdown',
      },
      {
        uri: 'github-to-mcp://examples/python',
        name: 'Python MCP Server Example',
        description: 'Complete Python MCP server example',
        mimeType: 'text/markdown',
      },
    ],
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  const resources: Record<string, string> = {
    'github-to-mcp://docs/quick-start': `# Quick Start Guide

## Installation

\`\`\`bash
npm install -g @nirholas/github-to-mcp
\`\`\`

## Basic Usage

\`\`\`bash
# Convert a GitHub repository to an MCP server
github-to-mcp https://github.com/owner/repo

# Save to a file
github-to-mcp https://github.com/owner/repo --output ./mcp-server.ts

# Generate Python output
github-to-mcp https://github.com/owner/repo --language python
\`\`\`

## Using with Claude Desktop

1. Generate your MCP server
2. Add to Claude Desktop config:

\`\`\`json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["./mcp-server.js"]
    }
  }
}
\`\`\`

3. Restart Claude Desktop
`,

    'github-to-mcp://docs/extraction-sources': `# Extraction Sources

github-to-mcp can extract tools from multiple sources:

## 1. OpenAPI Specifications
- Swagger 2.0 and OpenAPI 3.x
- Automatic endpoint to tool conversion
- Full parameter validation

## 2. README Documentation
- Parses code examples
- Extracts API descriptions
- Identifies endpoints and methods

## 3. Source Code
- Python function analysis
- TypeScript function analysis
- Docstring extraction
- Type annotation parsing

## 4. GraphQL Schemas
- Query and mutation extraction
- Type-safe parameter generation

## 5. MCP Server Introspection
- Analyzes existing MCP servers
- Extracts tool definitions
`,

    'github-to-mcp://examples/typescript': `# TypeScript MCP Server Example

\`\`\`typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'example-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'hello',
      description: 'Say hello',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name to greet' }
        },
        required: ['name']
      }
    }
  ]
}));

// Handle calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'hello') {
    return {
      content: [{
        type: 'text',
        text: \`Hello, \${request.params.arguments.name}!\`
      }]
    };
  }
});

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
\`\`\`
`,

    'github-to-mcp://examples/python': `# Python MCP Server Example

\`\`\`python
from mcp.server import Server
from mcp.types import Tool, TextContent
import mcp.server.stdio

server = Server("example-server")

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="hello",
            description="Say hello",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name to greet"}
                },
                "required": ["name"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "hello":
        return [TextContent(type="text", text=f"Hello, {arguments['name']}!")]

async def main():
    async with mcp.server.stdio.stdio_server() as (read, write):
        await server.run(read, write)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
\`\`\`
`,
  };

  const content = resources[uri];
  if (!content) {
    throw new Error(`Resource not found: ${uri}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text: content,
      },
    ],
  };
});

// List available prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: PROMPTS };
});

// Get prompt messages
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const messages = getPromptMessages(name, args || {});
    return {
      description: PROMPTS.find(p => p.name === name)?.description || '',
      messages,
    };
  } catch (error) {
    throw new Error(`Error getting prompt: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('github-to-mcp MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
