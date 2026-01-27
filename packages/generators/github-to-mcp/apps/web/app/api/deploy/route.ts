/**
 * Deploy API - Create cloud-hosted MCP servers
 * @copyright 2024-2026 nirholas
 * @license MIT
 * 
 * POST /api/deploy - Deploy a new MCP server
 * GET /api/deploy - List user's deployed servers
 * DELETE /api/deploy?id=xxx - Delete a deployed server
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import type { 
  DeployRequest, 
  DeployResponse, 
  DeployedServer, 
  ServerListResponse 
} from '@/types/deploy';

// In production, this would be a database (Vercel KV, Planetscale, etc.)
// For now, we use in-memory storage with localStorage sync on client
const STORAGE_KEY = 'github-to-mcp-deployed-servers';

// Generate a secure API key
function generateApiKey(): string {
  return `mcp_${nanoid(32)}`;
}

// Hash API key for storage (simple hash for demo, use bcrypt in production)
function hashApiKey(key: string): string {
  // In production, use proper hashing
  return Buffer.from(key).toString('base64');
}

// Generate server endpoint URL
function generateEndpoint(serverId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://github-to-mcp.vercel.app';
  return `${baseUrl}/api/mcp/${serverId}`;
}

/**
 * POST /api/deploy - Deploy a new MCP server
 */
export async function POST(request: NextRequest): Promise<NextResponse<DeployResponse>> {
  try {
    const body = await request.json() as DeployRequest;
    
    // Validate request
    if (!body.name || !body.code || !body.tools?.length) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: name, code, and tools are required',
      }, { status: 400 });
    }

    // Generate IDs and keys
    const serverId = nanoid(12);
    const apiKey = generateApiKey();
    const endpoint = generateEndpoint(serverId);

    // Create deployed server record
    const server: DeployedServer = {
      id: serverId,
      name: body.name,
      description: body.description || `MCP server for ${body.name}`,
      
      tools: body.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        enabled: true,
        callCount: 0,
      })),
      code: body.code,
      language: 'typescript',
      
      endpoint,
      status: 'active',
      region: 'us-east-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      sourceRepo: body.sourceRepo,
      
      apiKeyHash: hashApiKey(apiKey),
      rateLimit: {
        requestsPerMinute: body.rateLimit?.requestsPerMinute || 60,
        requestsPerDay: body.rateLimit?.requestsPerDay || 10000,
        enabled: true,
      },
      
      usage: {
        totalCalls: 0,
        totalCallsToday: 0,
        totalCallsThisMonth: 0,
        successRate: 100,
        avgLatencyMs: 0,
        callsByTool: {},
        callsByDay: [],
        errors: [],
      },
    };

    // In production: Save to database
    // For demo: Return the server data (client will store in localStorage)

    return NextResponse.json({
      success: true,
      server,
      endpoint,
      apiKey, // Only returned on creation!
    });
  } catch (error) {
    console.error('Deploy error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Deployment failed',
    }, { status: 500 });
  }
}

/**
 * GET /api/deploy - List deployed servers
 * In production, this would fetch from database based on authenticated user
 */
export async function GET(request: NextRequest): Promise<NextResponse<ServerListResponse>> {
  // In production: Fetch from database with auth
  // For demo: Client manages storage, this is a placeholder
  
  return NextResponse.json({
    servers: [],
    total: 0,
    hasMore: false,
  });
}

/**
 * DELETE /api/deploy?id=xxx - Delete a deployed server
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get('id');

  if (!serverId) {
    return NextResponse.json({
      success: false,
      error: 'Server ID is required',
    }, { status: 400 });
  }

  // In production: Delete from database with auth verification
  
  return NextResponse.json({
    success: true,
    message: `Server ${serverId} deleted`,
  });
}
