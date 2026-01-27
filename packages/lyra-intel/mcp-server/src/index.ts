#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequest,
  GetPromptRequest,
  Tool,
  Prompt,
  GetPromptResult,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

import {
  getToolDefinitions,
  getPromptDefinitions,
  executeTool,
  toolExists,
} from "./tools/registry.js";

const server = new Server(
  {
    name: "lyra-intel-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      notifications: {},
      logging: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = getToolDefinitions();
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })) as Tool[],
  };
});

// Execute tool
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  if (!toolExists(name)) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    let output = "";
    const result = await executeTool(
      name,
      args || {},
      (newOutput: string) => {
        output += newOutput + "\n";
        // Send progress notification
        server.notification({
          method: "notifications/progress",
          params: {
            progressToken: request.params.name,
            progress: 50,
            total: 100,
          },
        }).catch(() => {
          // Silently ignore if notification fails
        });
      }
    );

    return {
      content: [
        {
          type: "text",
          text: output ? `${output}\n${result}` : result,
        },
      ],
    } as CallToolResult;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    } as unknown as CallToolResult;
  }
});

// List available prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts = getPromptDefinitions();
  return {
    prompts: prompts.map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: Object.entries(prompt.arguments || {}).map(([name, value]) => ({
        name,
        description: String(value) || '',
        required: false,
      })),
    })) as Prompt[],
  };
});

// Get prompt
server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
  const { name } = request.params;

  // Map tool names to helpful prompt messages
  const promptMessages: Record<string, string> = {
    "analyze-codebase": `Analyze this codebase to understand its structure, identify complexity hotspots, dependencies, and potential security issues.`,
    "search-code": `Search the codebase for code patterns, functions, or implementations matching a specific query.`,
    "get-complexity": `Check code complexity metrics to identify functions that might be too complex or hard to maintain.`,
    "get-security-issues": `Scan for security vulnerabilities, hardcoded secrets, and compliance issues in the codebase.`,
  };

  const message = promptMessages[name] || `Execute the ${name} tool.`;

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: message,
        },
      },
    ],
  } as GetPromptResult;
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Lyra Intel MCP server is running...");
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
