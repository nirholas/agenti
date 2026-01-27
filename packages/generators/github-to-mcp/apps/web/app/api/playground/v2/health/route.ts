/**
 * Health API Route
 *
 * GET /api/playground/v2/health - Get API health status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleApiError,
  createSuccessResponse,
  corsPreflightResponse,
  createLogContext,
  SessionManager,
  withRequestId,
  NO_RATE_LIMIT,
  applyMiddleware,
} from '@/lib/api';
import type { HealthResponseData } from '@/lib/api';

const PATH = '/api/playground/v2/health';
const startTime = Date.now();

/**
 * Handle CORS preflight request
 */
export async function OPTIONS(): Promise<NextResponse> {
  return corsPreflightResponse({ methods: ['GET', 'OPTIONS'] });
}

/**
 * GET /api/playground/v2/health
 *
 * Returns health status of the playground API.
 *
 * Response:
 * - success: boolean
 * - data: { status: string, version: string, uptime: number, sessions: { active: number } }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const middleware = await applyMiddleware(request, { rateLimit: NO_RATE_LIMIT });
  if ('response' in middleware) {
    return middleware.response;
  }

  const { context } = middleware;
  const log = createLogContext('GET', PATH, context.requestId, context.clientId);

  try {
    const sessionManager = SessionManager.getInstance();
    const sessions = await sessionManager.listSessions();
    const activeSessions = sessions.length;

    const uptime = Math.floor((Date.now() - startTime) / 1000);

    const responseData: HealthResponseData = {
      status: 'healthy',
      version: '2.0.0',
      uptime,
      sessions: {
        active: activeSessions,
      },
      timestamp: new Date().toISOString(),
    };

    log.log(200, undefined, undefined, { activeSessions, uptime });

    return createSuccessResponse(responseData, 200, {
      ...withRequestId({}, context.requestId),
      'Access-Control-Allow-Origin': '*',
      // Don't cache health checks
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
  } catch (error) {
    const status = error instanceof Error && 'statusCode' in error
      ? (error as { statusCode: number }).statusCode
      : 500;
    log.log(status, undefined, error instanceof Error ? error.message : 'Unknown error');
    return handleApiError(error);
  }
}
