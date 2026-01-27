/**
 * Sessions API Route
 *
 * GET /api/playground/v2/sessions - List active sessions
 * DELETE /api/playground/v2/sessions - Remove a session
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleApiError,
  createSuccessResponse,
  ValidationError,
  SessionExpiredError,
  applyMiddleware,
  corsPreflightResponse,
  createLogContext,
  SessionManager,
  withRequestId,
  DEFAULT_RATE_LIMIT,
  RELAXED_RATE_LIMIT,
} from '@/lib/api';
import type { SessionsListResponseData, DisconnectResponseData } from '@/lib/api';

const PATH = '/api/playground/v2/sessions';

/**
 * Handle CORS preflight request
 */
export async function OPTIONS(): Promise<NextResponse> {
  return corsPreflightResponse({ methods: ['GET', 'DELETE', 'OPTIONS'] });
}

/**
 * GET /api/playground/v2/sessions
 *
 * Lists all active sessions.
 *
 * Query parameters:
 * - clientId: string (optional) - Filter by client ID
 *
 * Response:
 * - success: boolean
 * - data: { sessions: SessionInfo[], count: number }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const middleware = await applyMiddleware(request, { rateLimit: RELAXED_RATE_LIMIT });
  if ('response' in middleware) {
    return middleware.response;
  }

  const { context } = middleware;
  const log = createLogContext('GET', PATH, context.requestId, context.clientId);

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    const sessionManager = SessionManager.getInstance();
    let sessions = await sessionManager.listSessions();

    // Filter by clientId if provided
    if (clientId) {
      sessions = sessions.filter((s) => s.clientId === clientId);
    }

    const responseData: SessionsListResponseData = {
      sessions,
      count: sessions.length,
    };

    log.log(200, undefined, undefined, { sessionCount: sessions.length });

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

/**
 * DELETE /api/playground/v2/sessions
 *
 * Removes a session by ID or all sessions for a client.
 *
 * Query parameters:
 * - sessionId: string (optional) - Specific session to remove
 * - clientId: string (optional) - Remove all sessions for this client
 *
 * At least one of sessionId or clientId must be provided.
 *
 * Response:
 * - success: boolean
 * - data: { disconnected: boolean, sessionId?: string, removedCount?: number }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const middleware = await applyMiddleware(request, { rateLimit: DEFAULT_RATE_LIMIT });
  if ('response' in middleware) {
    return middleware.response;
  }

  const { context } = middleware;
  const log = createLogContext('DELETE', PATH, context.requestId, context.clientId);

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const clientId = searchParams.get('clientId');

    if (!sessionId && !clientId) {
      throw new ValidationError(
        'Either sessionId or clientId is required',
        'query'
      );
    }

    const sessionManager = SessionManager.getInstance();

    if (sessionId) {
      // Remove specific session
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        throw new SessionExpiredError(
          `Session not found or expired: ${sessionId}`,
          sessionId
        );
      }

      const success = await sessionManager.deleteSession(sessionId);

      const responseData: DisconnectResponseData = {
        disconnected: success,
        sessionId,
      };

      log.log(200, sessionId);

      return createSuccessResponse(responseData, 200, {
        ...context.rateLimitHeaders,
        ...withRequestId({}, context.requestId),
        'Access-Control-Allow-Origin': '*',
      });
    } else if (clientId) {
      // Remove all sessions for this client
      const allSessions = await sessionManager.listSessions();
      const sessions = allSessions.filter((s) => s.clientId === clientId);
      let removedCount = 0;

      for (const session of sessions) {
        const success = await sessionManager.deleteSession(session.id);
        if (success) removedCount++;
      }

      const responseData = {
        disconnected: removedCount > 0,
        removedCount,
        clientId,
      };

      log.log(200, undefined, undefined, { removedCount });

      return createSuccessResponse(responseData, 200, {
        ...context.rateLimitHeaders,
        ...withRequestId({}, context.requestId),
        'Access-Control-Allow-Origin': '*',
      });
    }

    // Should never reach here due to validation above
    throw new ValidationError('Invalid request parameters', 'query');
  } catch (error) {
    const status = error instanceof Error && 'statusCode' in error
      ? (error as { statusCode: number }).statusCode
      : 500;
    log.log(status, undefined, error instanceof Error ? error.message : 'Unknown error');
    return handleApiError(error);
  }
}
