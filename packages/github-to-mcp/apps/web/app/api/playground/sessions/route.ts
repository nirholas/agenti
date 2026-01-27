/**
 * Playground Sessions API Route - Manage MCP sandbox sessions
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { NextRequest, NextResponse } from 'next/server';
import { McpSandbox } from '@/lib/mcp-sandbox';

// Response types
interface SessionInfo {
  id: string;
  createdAt: string;
  lastUsed: string;
  initialized: boolean;
}

interface ListSessionsResponse {
  sessions: SessionInfo[];
  count: number;
}

interface DeleteSessionResponse {
  success: boolean;
  message: string;
  deletedCount?: number;
}

/**
 * GET /api/playground/sessions
 * List all active sessions
 */
export async function GET(): Promise<NextResponse<ListSessionsResponse>> {
  const sessions = McpSandbox.getAllSessions();
  
  return NextResponse.json({
    sessions: sessions.map(session => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      lastUsed: session.lastUsed.toISOString(),
      initialized: session.initialized,
    })),
    count: sessions.length,
  });
}

/**
 * DELETE /api/playground/sessions
 * Delete one or all sessions
 * 
 * Query params:
 *   - id: Session ID to delete (optional, if not provided deletes all)
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<DeleteSessionResponse>> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');
  
  if (sessionId) {
    // Delete specific session
    const deleted = McpSandbox.deleteSession(sessionId);
    
    if (deleted) {
      return NextResponse.json({
        success: true,
        message: `Session ${sessionId} deleted successfully`,
        deletedCount: 1,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: `Session ${sessionId} not found`,
          deletedCount: 0,
        },
        { status: 404 }
      );
    }
  } else {
    // Delete all sessions
    const count = McpSandbox.deleteAllSessions();
    
    return NextResponse.json({
      success: true,
      message: `All sessions deleted successfully`,
      deletedCount: count,
    });
  }
}

/**
 * OPTIONS /api/playground/sessions
 * Handle CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
