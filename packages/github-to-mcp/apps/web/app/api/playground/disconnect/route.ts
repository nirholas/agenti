/**
 * Playground Disconnect API Route - Close MCP server session
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { NextRequest, NextResponse } from 'next/server';
import { McpSandbox } from '@/lib/mcp-sandbox';

interface DisconnectRequestBody {
  sessionId: string;
}

interface DisconnectResponse {
  success: boolean;
  message: string;
}

function validateRequest(body: unknown): body is DisconnectRequestBody {
  if (!body || typeof body !== 'object') return false;
  const req = body as Record<string, unknown>;
  return typeof req.sessionId === 'string' && req.sessionId.trim().length > 0;
}

/**
 * POST /api/playground/disconnect
 * Disconnect from an MCP server session
 */
export async function POST(request: NextRequest): Promise<NextResponse<DisconnectResponse>> {
  try {
    const body = await request.json().catch(() => null);

    if (!validateRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request body. Required: sessionId (string)',
        },
        { status: 400 }
      );
    }

    const deleted = McpSandbox.deleteSession(body.sessionId);

    return NextResponse.json({
      success: true,
      message: deleted 
        ? `Session ${body.sessionId} disconnected successfully`
        : `Session ${body.sessionId} not found (may have already expired)`,
    });
  } catch (error) {
    console.error('[Playground Disconnect] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/playground/disconnect
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
