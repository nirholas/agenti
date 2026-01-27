/**
 * Playground Tools API Route - List available tools from MCP server
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { NextRequest, NextResponse } from 'next/server';
import { McpSandbox, ListToolsResponse } from '@/lib/mcp-sandbox';

// Request body schema
interface ListToolsRequestBody {
  generatedCode: string;
  sessionId?: string;
}

// Validate request body
function validateRequest(body: unknown): body is ListToolsRequestBody {
  if (!body || typeof body !== 'object') return false;
  
  const req = body as Record<string, unknown>;
  
  if (typeof req.generatedCode !== 'string' || !req.generatedCode.trim()) {
    return false;
  }
  
  if (req.sessionId !== undefined && typeof req.sessionId !== 'string') {
    return false;
  }
  
  return true;
}

/**
 * POST /api/playground/tools
 * List available tools from the MCP server
 */
export async function POST(request: NextRequest): Promise<NextResponse<ListToolsResponse | { error: string }>> {
  try {
    // Parse request body
    const body = await request.json().catch(() => null);
    
    if (!validateRequest(body)) {
      return NextResponse.json(
        { error: 'Invalid request body. Required field: generatedCode (string)' },
        { status: 400 }
      );
    }

    // Basic security: Check code size (max 1MB)
    if (body.generatedCode.length > 1024 * 1024) {
      return NextResponse.json(
        { error: 'Generated code exceeds maximum size limit (1MB)' },
        { status: 400 }
      );
    }

    // Basic security: Check for obviously dangerous patterns
    const dangerousPatterns = [
      /require\s*\(\s*['"`]child_process['"`]\s*\)/i,
      /import\s+.*from\s+['"`]child_process['"`]/i,
      /execSync|spawnSync|exec\s*\(/i,
      /fs\.rm|fs\.unlink|fs\.rmdir/i,
      /process\.exit/i,
      /eval\s*\(/i,
      /Function\s*\(/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(body.generatedCode)) {
        return NextResponse.json(
          { error: 'Generated code contains potentially dangerous patterns' },
          { status: 400 }
        );
      }
    }

    // Create sandbox and list tools
    const sandbox = new McpSandbox();
    
    const result = await sandbox.listTools(body.generatedCode, body.sessionId);

    // Return appropriate status code based on success
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 422 });
    }
  } catch (error) {
    console.error('[Playground Tools] Unexpected error:', error);
    
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json(
      { 
        error: message,
        success: false,
        sessionId: '',
      } as ListToolsResponse,
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/playground/tools
 * Handle CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
