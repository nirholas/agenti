/**
 * Cloud MCP Server Endpoint - HTTP/SSE Transport
 * @copyright 2024-2026 nirholas
 * @license MIT
 * 
 * This is the actual MCP server that runs in the cloud.
 * It receives MCP protocol messages via HTTP POST and returns responses.
 * 
 * Supports:
 * - tools/list - List available tools
 * - tools/call - Execute a tool
 * - initialize - Initialize connection
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// In production, this would load from database
// For demo, we'll parse from request headers or mock data
async function getServerConfig(serverId: string, apiKey?: string): Promise<{
  name: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: object;
  }>;
} | null> {
  // Demo: Return mock tools for testing
  // In production: Load from database, verify API key
  
  return {
    name: `mcp-server-${serverId}`,
    tools: [
      {
        name: 'echo',
        description: 'Echo back the input message',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message to echo' },
          },
          required: ['message'],
        },
      },
      {
        name: 'get_time',
        description: 'Get the current server time',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
}

// Execute a tool (in production, this would run sandboxed code)
async function executeTool(
  toolName: string, 
  args: Record<string, unknown>,
  serverId: string
): Promise<{ result?: unknown; error?: string }> {
  // Demo implementations
  switch (toolName) {
    case 'echo':
      return { result: { message: args.message, echoed: true } };
    
    case 'get_time':
      return { 
        result: { 
          time: new Date().toISOString(),
          timezone: 'UTC',
          serverId,
        } 
      };
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/**
 * POST /api/mcp/[serverId] - Handle MCP protocol requests
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
): Promise<NextResponse<McpResponse>> {
  const { serverId } = await params;
  const startTime = Date.now();

  try {
    // Get API key from header
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    // Load server config
    const config = await getServerConfig(serverId, apiKey);
    if (!config) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: -32001,
          message: 'Server not found or unauthorized',
        },
      }, { status: 404 });
    }

    // Parse MCP request
    const body = await request.json() as McpRequest;
    
    // Handle different MCP methods
    switch (body.method) {
      case 'initialize': {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: config.name,
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
            },
          },
        });
      }

      case 'tools/list': {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            tools: config.tools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
        });
      }

      case 'tools/call': {
        const toolParams = body.params as { name: string; arguments: Record<string, unknown> } | undefined;
        if (!toolParams?.name) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: body.id,
            error: {
              code: -32602,
              message: 'Missing tool name',
            },
          }, { status: 400 });
        }

        const { result, error } = await executeTool(
          toolParams.name, 
          toolParams.arguments || {},
          serverId
        );

        if (error) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{ type: 'text', text: `Error: ${error}` }],
              isError: true,
            },
          });
        }

        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2),
            }],
          },
        });
      }

      case 'notifications/initialized': {
        // Acknowledgment, no response needed
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {},
        });
      }

      default: {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          error: {
            code: -32601,
            message: `Method not found: ${body.method}`,
          },
        }, { status: 400 });
      }
    }
  } catch (error) {
    console.error(`MCP error for server ${serverId}:`, error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: 0,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    }, { status: 500 });
  }
}

/**
 * GET /api/mcp/[serverId] - Server info endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
): Promise<NextResponse> {
  const { serverId } = await params;
  const config = await getServerConfig(serverId);
  
  if (!config) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  return NextResponse.json({
    name: config.name,
    serverId,
    status: 'active',
    toolCount: config.tools.length,
    tools: config.tools.map(t => t.name),
    endpoint: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/mcp/${serverId}`,
    protocol: 'MCP 2024-11-05',
    transport: 'HTTP/POST',
  });
}
