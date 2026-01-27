/**
 * Playground Execute API Route - Execute tools in MCP sandbox
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { NextRequest, NextResponse } from 'next/server';
import { McpSandbox, ExecuteToolRequest, ExecuteToolResponse } from '@/lib/mcp-sandbox';

// Request body schema
interface ExecuteRequestBody {
  generatedCode: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  sessionId?: string;
}

// Validate request body
function validateRequest(body: unknown): body is ExecuteRequestBody {
  if (!body || typeof body !== 'object') return false;
  
  const req = body as Record<string, unknown>;
  
  if (typeof req.generatedCode !== 'string' || !req.generatedCode.trim()) {
    return false;
  }
  
  if (typeof req.toolName !== 'string' || !req.toolName.trim()) {
    return false;
  }
  
  if (typeof req.toolParams !== 'object' || req.toolParams === null) {
    return false;
  }
  
  if (req.sessionId !== undefined && typeof req.sessionId !== 'string') {
    return false;
  }
  
  return true;
}

/**
 * POST /api/playground/execute
 * Execute a tool in the MCP sandbox
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExecuteToolResponse | { error: string }>> {
  try {
    // Parse request body
    const body = await request.json().catch(() => null);
    
    if (!validateRequest(body)) {
      return NextResponse.json(
        { error: 'Invalid request body. Required fields: generatedCode (string), toolName (string), toolParams (object)' },
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

    // Create sandbox and execute
    const sandbox = new McpSandbox();
    
    const executeRequest: ExecuteToolRequest = {
      generatedCode: body.generatedCode,
      toolName: body.toolName,
      toolParams: body.toolParams,
      sessionId: body.sessionId,
    };

    const result = await sandbox.executeTool(executeRequest);

    // Return appropriate status code based on success
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 422 });
    }
  } catch (error) {
    console.error('[Playground Execute] Unexpected error:', error);
    
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json(
      { 
        error: message,
        success: false,
        sessionId: '',
        executionTime: 0,
      } as ExecuteToolResponse,
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/playground/execute
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
