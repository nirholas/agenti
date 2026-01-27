/**
 * Playground Connect API Route - Establish MCP server connection
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { NextRequest, NextResponse } from 'next/server';
import { McpSandbox } from '@/lib/mcp-sandbox';

interface ConnectRequestBody {
  generatedCode: string;
}

interface ConnectResponse {
  success: boolean;
  sessionId: string;
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
  }>;
  error?: string;
}

function validateRequest(body: unknown): body is ConnectRequestBody {
  if (!body || typeof body !== 'object') return false;
  const req = body as Record<string, unknown>;
  return typeof req.generatedCode === 'string' && req.generatedCode.trim().length > 0;
}

/**
 * POST /api/playground/connect
 * Connect to an MCP server and return available tools
 */
export async function POST(request: NextRequest): Promise<NextResponse<ConnectResponse>> {
  try {
    const body = await request.json().catch(() => null);

    if (!validateRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          sessionId: '',
          tools: [],
          error: 'Invalid request body. Required: generatedCode (string)',
        },
        { status: 400 }
      );
    }

    // Basic security: Check code size (max 1MB)
    if (body.generatedCode.length > 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          sessionId: '',
          tools: [],
          error: 'Generated code exceeds maximum size limit (1MB)',
        },
        { status: 400 }
      );
    }

    // Basic security: Check for dangerous patterns
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
          {
            success: false,
            sessionId: '',
            tools: [],
            error: 'Generated code contains potentially dangerous patterns',
          },
          { status: 400 }
        );
      }
    }

    // Create sandbox and connect
    const sandbox = new McpSandbox();
    const result = await sandbox.connect(body.generatedCode);

    if (result.success) {
      return NextResponse.json({
        success: true,
        sessionId: result.sessionId,
        tools: result.tools || [],
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          sessionId: '',
          tools: [],
          error: result.error || 'Failed to connect',
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error('[Playground Connect] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      {
        success: false,
        sessionId: '',
        tools: [],
        error: message,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/playground/connect
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
