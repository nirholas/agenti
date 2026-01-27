/**
 * Sperax X402 MCP Server
 * 
 * Standalone MCP server for AI agents to interact with X402 payments.
 * Supports Claude, GPT, and other MCP-compatible AI assistants.
 */

import { SperaxX402Tools, speraxToolDefinitions } from './x402-tools';

// Initialize tools with environment config
const tools = new SperaxX402Tools({
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: process.env.ARBITRUM_RPC_URL || process.env.BSC_RPC_URL,
  network: (process.env.NETWORK as 'mainnet' | 'sepolia' | 'bsc') || 'bsc',
  facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:3002',
});

// Simple JSON-RPC style handler for MCP
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function handleRequest(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: Object.values(speraxToolDefinitions).map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            })),
          },
        };

      case 'tools/call':
        const toolName = params?.name as string;
        const toolArgs = params?.arguments as Record<string, unknown> || {};
        
        const result = await tools.executeTool(toolName, toolArgs);
        
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };

      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'sperax-x402',
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
            },
          },
        };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// Read from stdin, write to stdout
async function main() {
  console.error('Starting Sperax X402 MCP Server...');
  console.error('Available tools:', Object.keys(speraxToolDefinitions).join(', '));

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line: string) => {
    try {
      const request = JSON.parse(line) as MCPRequest;
      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      };
      console.log(JSON.stringify(errorResponse));
    }
  });

  console.error('Sperax X402 MCP Server running on stdio');
}

main().catch(console.error);
