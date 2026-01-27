/**
 * Disconnect API Route
 *
 * POST /api/playground/v2/disconnect
 * Closes an MCP server connection and cleans up the session.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleApiError,
  createSuccessResponse,
  SessionExpiredError,
  validateSessionId,
  applyMiddleware,
  corsPreflightResponse,
  createLogContext,
  SessionManager,
  withRequestId,
} from '@/lib/api';
import type { DisconnectResponseData } from '@/lib/api';

const PATH = '/api/playground/v2/disconnect';

/**
 * Handle CORS preflight request
 */
export async function OPTIONS(): Promise<NextResponse> {
  return corsPreflightResponse({ methods: ['POST', 'OPTIONS'] });
}

/**
 * POST /api/playground/v2/disconnect
 *
 * Closes an MCP server connection.
 *
 * Request body:
 * - sessionId: string (required) - The session ID to disconnect
 *
 * Response:
 * - success: boolean
 * - data: { disconnected: boolean }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const middleware = await applyMiddleware(request);
  if ('response' in middleware) {
    return middleware.response;
  }

  const { context } = middleware;
  const log = createLogContext('POST', PATH, context.requestId, context.clientId);

  try {
    const body = await request.json();
    const sessionId = validateSessionId(body);

    const sessionManager = SessionManager.getInstance();

    // Check if session exists
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new SessionExpiredError(
        `Session not found or already expired: ${sessionId}`,
        sessionId
      );
    }

    // Delete the session
    const deleted = await sessionManager.deleteSession(sessionId);

    const responseData: DisconnectResponseData = {
      disconnected: deleted,
    };

    log.log(200, sessionId);

    return createSuccessResponse(responseData, 200, {
      ...context.rateLimitHeaders,
      ...withRequestId({}, context.requestId),
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error) {
    const status = error instanceof Error && 'statusCode' in error
      ? (error as { statusCode: number }).statusCode
      : 500;
    log.log(status, undefined, error instanceof Error ? error.message : 'Unknown error');
    return handleApiError(error);
  }
}
