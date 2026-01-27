/**
 * @fileoverview Streaming conversion tool for MCP server
 * Provides streaming progress updates via SSE
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { TextContent, Tool } from '@modelcontextprotocol/sdk/types.js';
import { GithubToMcpGenerator, GenerationResult } from '@nirholas/github-to-mcp';

/**
 * Progress event types
 */
export type ProgressEventType = 
  | 'start'
  | 'analyzing'
  | 'extracting'
  | 'generating'
  | 'validating'
  | 'complete'
  | 'error';

/**
 * Progress event structure
 */
export interface ProgressEvent {
  type: ProgressEventType;
  message: string;
  progress: number; // 0-100
  details?: {
    step?: string;
    filesProcessed?: number;
    totalFiles?: number;
    toolsFound?: number;
    currentSource?: string;
  };
  timestamp: number;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Tool definition for streaming conversion
 */
export const streamConvertTool: Tool = {
  name: 'stream_convert',
  description: `Convert a GitHub repository with streaming progress updates.

Similar to convert_repo but provides real-time progress events during the conversion process.

Progress events include:
- start: Conversion initiated
- analyzing: Analyzing repository structure
- extracting: Extracting tools from sources
- generating: Generating MCP server code
- validating: Validating generated code
- complete: Conversion finished
- error: An error occurred

Each event includes a progress percentage and detailed status information.

Note: In MCP context, progress is reported via tool output. For SSE streaming, use the HTTP API endpoint.`,
  inputSchema: {
    type: 'object',
    properties: {
      github_url: {
        type: 'string',
        description: 'The GitHub repository URL to convert',
      },
      output_language: {
        type: 'string',
        enum: ['typescript', 'python'],
        default: 'typescript',
        description: 'Target language for generated code',
      },
      sources: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['readme', 'openapi', 'code', 'graphql'],
        },
        description: 'Which extraction sources to use',
      },
      github_token: {
        type: 'string',
        description: 'GitHub token for private repos',
      },
      include_progress: {
        type: 'boolean',
        default: true,
        description: 'Include detailed progress in output',
      },
    },
    required: ['github_url'],
  },
};

/**
 * Convert repository with progress tracking
 */
export async function convertWithProgress(
  args: {
    github_url: string;
    output_language?: 'typescript' | 'python';
    sources?: string[];
    github_token?: string;
  },
  onProgress?: ProgressCallback
): Promise<GenerationResult> {
  const emitProgress = (
    type: ProgressEventType,
    message: string,
    progress: number,
    details?: ProgressEvent['details']
  ) => {
    if (onProgress) {
      onProgress({
        type,
        message,
        progress,
        details,
        timestamp: Date.now(),
      });
    }
  };

  emitProgress('start', 'Starting conversion...', 0, {
    step: 'initialization',
  });

  const generator = new GithubToMcpGenerator({
    githubToken: args.github_token,
    sources: args.sources as any,
    outputLanguage: args.output_language || 'typescript',
  });

  emitProgress('analyzing', 'Analyzing repository structure...', 10, {
    step: 'analysis',
  });

  // The actual generation
  const result = await generator.generate(args.github_url);

  emitProgress('extracting', `Extracting tools from ${result.sources.length} sources...`, 40, {
    step: 'extraction',
    toolsFound: result.tools.length,
  });

  emitProgress('generating', 'Generating MCP server code...', 70, {
    step: 'generation',
    toolsFound: result.tools.length,
  });

  emitProgress('validating', 'Validating generated code...', 90, {
    step: 'validation',
  });

  emitProgress('complete', 'Conversion complete!', 100, {
    toolsFound: result.tools.length,
  });

  return result;
}

/**
 * Handler for stream_convert tool
 */
export async function handleStreamConvert(args: {
  github_url: string;
  output_language?: 'typescript' | 'python';
  sources?: string[];
  github_token?: string;
  include_progress?: boolean;
}): Promise<TextContent> {
  try {
    const progressEvents: ProgressEvent[] = [];
    
    const onProgress = args.include_progress !== false 
      ? (event: ProgressEvent) => progressEvents.push(event)
      : undefined;

    const result = await convertWithProgress(args, onProgress);

    // Generate code
    const code = args.output_language === 'python' 
      ? result.generatePython()
      : result.generate();

    // Format progress log
    const progressLog = progressEvents.length > 0
      ? `## Progress Log

${progressEvents.map(e => 
  `- [${new Date(e.timestamp).toISOString()}] **${e.type}** (${e.progress}%): ${e.message}`
).join('\n')}

`
      : '';

    return {
      type: 'text',
      text: `# MCP Server Generated Successfully

${progressLog}## Summary

- **Repository:** ${args.github_url}
- **Language:** ${args.output_language || 'typescript'}
- **Tools Extracted:** ${result.tools.length}
- **Sources Used:** ${result.sources.map(s => s.type).join(', ')}

## Tools

${result.tools.map((t, i) => `${i + 1}. **${t.name}** - ${t.description}`).join('\n')}

## Generated Code

\`\`\`${args.output_language || 'typescript'}
${code}
\`\`\`
`,
    };
  } catch (error) {
    return {
      type: 'text',
      text: `Error during conversion: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Create an SSE stream from progress events
 */
export function createProgressStream(
  onProgress: ProgressCallback
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  
  return new ReadableStream({
    start(controller) {
      const wrappedCallback: ProgressCallback = (event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
        onProgress(event);
        
        if (event.type === 'complete' || event.type === 'error') {
          controller.close();
        }
      };
      
      // Return the callback for the caller to use
      (controller as any).progressCallback = wrappedCallback;
    },
  });
}

/**
 * Supported AI providers for integration
 */
export const SUPPORTED_PROVIDERS = [
  {
    name: 'Claude Desktop',
    id: 'claude-desktop',
    description: 'Anthropic Claude Desktop application',
    configFormat: 'json',
    configPath: {
      mac: '~/Library/Application Support/Claude/claude_desktop_config.json',
      windows: '%APPDATA%\\Claude\\claude_desktop_config.json',
      linux: '~/.config/Claude/claude_desktop_config.json',
    },
  },
  {
    name: 'Cursor',
    id: 'cursor',
    description: 'Cursor AI-powered IDE',
    configFormat: 'json',
    configPath: {
      all: '.cursor/mcp.json',
    },
  },
  {
    name: 'VS Code Copilot',
    id: 'vscode-copilot',
    description: 'GitHub Copilot in VS Code',
    configFormat: 'json',
    configPath: {
      all: '.vscode/mcp.json',
    },
  },
  {
    name: 'Windsurf',
    id: 'windsurf',
    description: 'Codeium Windsurf IDE',
    configFormat: 'json',
    configPath: {
      all: '.windsurf/mcp.json',
    },
  },
  {
    name: 'Cline',
    id: 'cline',
    description: 'Cline VS Code extension',
    configFormat: 'json',
    configPath: {
      all: '.cline/mcp_settings.json',
    },
  },
] as const;

/**
 * Tool definition for listing providers
 */
export const listProvidersTool: Tool = {
  name: 'list_providers',
  description: `List all supported AI providers and their MCP configuration details.

Returns information about:
- Provider name and description
- Configuration file format
- Configuration file paths for different operating systems
- Example configuration snippets`,
  inputSchema: {
    type: 'object',
    properties: {
      include_examples: {
        type: 'boolean',
        default: true,
        description: 'Include example configurations',
      },
    },
  },
};

/**
 * Handler for list_providers tool
 */
export async function handleListProviders(args: {
  include_examples?: boolean;
}): Promise<TextContent> {
  const includeExamples = args.include_examples !== false;

  let output = `# Supported AI Providers

The following AI applications support MCP server integration:

`;

  for (const provider of SUPPORTED_PROVIDERS) {
    output += `## ${provider.name}

**ID:** \`${provider.id}\`
**Description:** ${provider.description}
**Config Format:** ${provider.configFormat}

### Configuration Paths

`;

    if ('all' in provider.configPath) {
      output += `- All platforms: \`${provider.configPath.all}\`\n`;
    } else {
      output += `- macOS: \`${provider.configPath.mac}\`\n`;
      output += `- Windows: \`${provider.configPath.windows}\`\n`;
      output += `- Linux: \`${provider.configPath.linux}\`\n`;
    }

    if (includeExamples) {
      const exampleConfig = {
        mcpServers: {
          'my-server': {
            command: provider.id === 'claude-desktop' ? 'npx' : 'node',
            args: provider.id === 'claude-desktop' 
              ? ['tsx', 'path/to/server.ts']
              : ['path/to/server.js'],
          },
        },
      };

      output += `
### Example Configuration

\`\`\`json
${JSON.stringify(exampleConfig, null, 2)}
\`\`\`

`;
    }

    output += '\n---\n\n';
  }

  return {
    type: 'text',
    text: output,
  };
}
