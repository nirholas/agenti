/**
 * @fileoverview File generator for MCP server files in workspace
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ConversionResult } from './storage';

export interface GeneratedFiles {
  serverFile: string;
  packageJsonFile: string;
  readmeFile: string;
  configSnippet: string;
}

export interface GeneratorOptions {
  outputDir?: string;
  runtime?: 'node' | 'typescript' | 'python';
  includeTypes?: boolean;
  includeDocs?: boolean;
}

/**
 * Generate MCP server files from conversion result
 */
export async function generateMcpServerFiles(
  result: ConversionResult,
  options: GeneratorOptions = {}
): Promise<GeneratedFiles> {
  const serverName = result.repoName.replace('/', '-').toLowerCase();
  const outputDir = options.outputDir || await selectOutputDirectory(serverName);
  
  if (!outputDir) {
    throw new Error('No output directory selected');
  }

  const serverDir = path.join(outputDir, `${serverName}-mcp`);
  
  // Create directory
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(serverDir));

  // Generate files based on runtime
  const runtime = options.runtime || 'node';
  
  let serverFile: string;
  let packageJsonFile: string;
  let readmeFile: string;

  if (runtime === 'node' || runtime === 'typescript') {
    serverFile = await generateNodeServer(result, serverDir, runtime === 'typescript');
    packageJsonFile = await generatePackageJson(result, serverDir, runtime === 'typescript');
  } else {
    serverFile = await generatePythonServer(result, serverDir);
    packageJsonFile = ''; // Python doesn't use package.json
    await generatePythonRequirements(result, serverDir);
  }

  if (options.includeDocs !== false) {
    readmeFile = await generateReadme(result, serverDir);
  } else {
    readmeFile = '';
  }

  // Generate config snippet
  const configSnippet = generateConfigSnippet(serverName, serverFile);

  // Open the main server file
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(serverFile));
  await vscode.window.showTextDocument(doc);

  return {
    serverFile,
    packageJsonFile,
    readmeFile,
    configSnippet
  };
}

/**
 * Generate Node.js MCP server file
 */
async function generateNodeServer(
  result: ConversionResult,
  serverDir: string,
  typescript: boolean
): Promise<string> {
  const ext = typescript ? 'ts' : 'js';
  const serverPath = path.join(serverDir, `index.${ext}`);
  
  // Use the generated code if available
  let serverCode = result.code;
  
  if (!serverCode) {
    // Generate a basic template
    serverCode = generateServerTemplate(result, typescript);
  }

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(serverPath),
    Buffer.from(serverCode, 'utf-8')
  );

  return serverPath;
}

/**
 * Generate server template
 */
function generateServerTemplate(result: ConversionResult, typescript: boolean): string {
  const tools = result.tools || [];
  const serverName = result.repoName.split('/')[1] || result.repoName;

  const toolDefinitions = tools.map(tool => `
  {
    name: "${tool.name}",
    description: "${escapeString(tool.description)}",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }`).join(',');

  const toolHandlers = tools.map(tool => `
    case "${tool.name}":
      // TODO: Implement ${tool.name}
      return {
        content: [{ type: "text", text: "Tool ${tool.name} not yet implemented" }]
      };`).join('\n');

  if (typescript) {
    return `/**
 * MCP Server: ${serverName}
 * Generated from ${result.repoUrl}
 * Tools: ${result.toolCount}
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "${serverName}-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const tools = [${toolDefinitions}
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
${toolHandlers}
    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("${serverName} MCP server running on stdio");
}

main().catch(console.error);
`;
  }

  // JavaScript version
  return `/**
 * MCP Server: ${serverName}
 * Generated from ${result.repoUrl}
 * Tools: ${result.toolCount}
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "${serverName}-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const tools = [${toolDefinitions}
];

// List available tools
server.setRequestHandler("tools/list", async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
${toolHandlers}
    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("${serverName} MCP server running on stdio");
}

main().catch(console.error);
`;
}

/**
 * Generate Python MCP server file
 */
async function generatePythonServer(
  result: ConversionResult,
  serverDir: string
): Promise<string> {
  const serverPath = path.join(serverDir, 'server.py');
  const serverName = result.repoName.split('/')[1] || result.repoName;
  const tools = result.tools || [];

  const toolDefinitions = tools.map(tool => `
    Tool(
        name="${tool.name}",
        description="${escapeString(tool.description)}",
        inputSchema={"type": "object", "properties": {}}
    )`).join(',');

  const toolHandlers = tools.map(tool => `
        elif name == "${tool.name}":
            # TODO: Implement ${tool.name}
            return [TextContent(type="text", text="Tool ${tool.name} not yet implemented")]`).join('');

  const serverCode = `"""
MCP Server: ${serverName}
Generated from ${result.repoUrl}
Tools: ${result.toolCount}
"""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Initialize server
app = Server("${serverName}-mcp")

# Tool definitions
TOOLS = [${toolDefinitions}
]

@app.list_tools()
async def list_tools():
    return TOOLS

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if False:
        pass${toolHandlers}
    else:
        raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
`;

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(serverPath),
    Buffer.from(serverCode, 'utf-8')
  );

  return serverPath;
}

/**
 * Generate package.json for Node.js server
 */
async function generatePackageJson(
  result: ConversionResult,
  serverDir: string,
  typescript: boolean
): Promise<string> {
  const packageJsonPath = path.join(serverDir, 'package.json');
  const serverName = result.repoName.replace('/', '-').toLowerCase();

  const packageJson = {
    name: `${serverName}-mcp`,
    version: '1.0.0',
    description: `MCP server generated from ${result.repoName}`,
    main: typescript ? 'dist/index.js' : 'index.js',
    type: 'module',
    scripts: {
      ...(typescript ? {
        build: 'tsc',
        start: 'node dist/index.js',
        dev: 'ts-node src/index.ts'
      } : {
        start: 'node index.js'
      })
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^0.5.0'
    },
    ...(typescript ? {
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'ts-node': '^10.0.0'
      }
    } : {})
  };

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(packageJsonPath),
    Buffer.from(JSON.stringify(packageJson, null, 2), 'utf-8')
  );

  return packageJsonPath;
}

/**
 * Generate requirements.txt for Python server
 */
async function generatePythonRequirements(
  result: ConversionResult,
  serverDir: string
): Promise<string> {
  const requirementsPath = path.join(serverDir, 'requirements.txt');

  const requirements = `# MCP Server: ${result.repoName}
mcp>=0.5.0
`;

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(requirementsPath),
    Buffer.from(requirements, 'utf-8')
  );

  return requirementsPath;
}

/**
 * Generate README for the server
 */
async function generateReadme(
  result: ConversionResult,
  serverDir: string
): Promise<string> {
  const readmePath = path.join(serverDir, 'README.md');
  const serverName = result.repoName.split('/')[1] || result.repoName;

  const toolsList = (result.tools || [])
    .map(t => `- **${t.name}**: ${t.description}`)
    .join('\n');

  const readme = `# ${serverName} MCP Server

MCP server generated from [${result.repoName}](${result.repoUrl}).

## Tools

${toolsList || 'No tools defined.'}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

### With Claude Desktop

Add to your \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "${serverName}": {
      "command": "node",
      "args": ["${serverDir}/index.js"]
    }
  }
}
\`\`\`

### Standalone

\`\`\`bash
npm start
\`\`\`

## Development

Generated on ${new Date().toISOString().split('T')[0]}.

## License

MIT
`;

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(readmePath),
    Buffer.from(readme, 'utf-8')
  );

  return readmePath;
}

/**
 * Generate config snippet for clipboard
 */
function generateConfigSnippet(serverName: string, serverPath: string): string {
  return JSON.stringify({
    mcpServers: {
      [serverName]: {
        command: 'node',
        args: [serverPath]
      }
    }
  }, null, 2);
}

/**
 * Select output directory
 */
async function selectOutputDirectory(suggestedName: string): Promise<string | null> {
  const options: vscode.QuickPickItem[] = [];

  // Add workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      options.push({
        label: `$(folder) ${folder.name}`,
        description: folder.uri.fsPath,
        detail: 'Create in workspace folder'
      });
    }
  }

  // Add home directory option
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  options.push({
    label: '$(home) Home Directory',
    description: path.join(homeDir, '.mcp-servers'),
    detail: 'Create in ~/.mcp-servers'
  });

  // Add custom option
  options.push({
    label: '$(folder-opened) Choose Location...',
    description: '',
    detail: 'Select a custom directory'
  });

  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: `Where should ${suggestedName} server be created?`,
    title: 'Select Output Directory'
  });

  if (!selection) {
    return null;
  }

  if (selection.label === '$(folder-opened) Choose Location...') {
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: 'Select output directory'
    });

    if (!folders || folders.length === 0) {
      return null;
    }

    return folders[0].fsPath;
  }

  return selection.description || null;
}

/**
 * Escape string for use in generated code
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
