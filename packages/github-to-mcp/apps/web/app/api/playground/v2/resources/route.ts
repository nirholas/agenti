/**
 * Resources API Route
 *
 * GET /api/playground/v2/resources - List all resources
 * POST /api/playground/v2/resources - Read a resource
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleApiError,
  createSuccessResponse,
  SessionExpiredError,
  McpExecutionError,
  NotFoundError,
  validateResourceRead,
  validateSessionIdFromQuery,
  applyMiddleware,
  corsPreflightResponse,
  createLogContext,
  SessionManager,
  withRequestId,
  RELAXED_RATE_LIMIT,
} from '@/lib/api';
import type { ResourcesListResponseData, ResourceReadResponseData } from '@/lib/api';

const PATH = '/api/playground/v2/resources';

/**
 * Handle CORS preflight request
 */
export async function OPTIONS(): Promise<NextResponse> {
  return corsPreflightResponse({ methods: ['GET', 'POST', 'OPTIONS'] });
}

/**
 * GET /api/playground/v2/resources
 *
 * Lists all available resources for a session.
 *
 * Query parameters:
 * - sessionId: string (required) - The session ID
 *
 * Response:
 * - success: boolean
 * - data: { resources: McpResource[], resourceTemplates?: McpResourceTemplate[] }
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
    const sessionId = validateSessionIdFromQuery(searchParams);

    const sessionManager = SessionManager.getInstance();

    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new SessionExpiredError(
        `Session not found or expired: ${sessionId}`,
        sessionId
      );
    }

    const { resources, resourceTemplates } = await sessionManager.listResources(sessionId);

    const responseData: ResourcesListResponseData = {
      resources,
      resourceTemplates,
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

/**
 * POST /api/playground/v2/resources
 *
 * Reads a resource.
 *
 * Request body:
 * - sessionId: string (required) - The session ID
 * - uri: string (required) - URI of the resource to read
 *
 * Response:
 * - success: boolean
 * - data: { contents: McpResourceContents[] }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const middleware = await applyMiddleware(request, { rateLimit: RELAXED_RATE_LIMIT });
  if ('response' in middleware) {
    return middleware.response;
  }

  const { context } = middleware;
  const log = createLogContext('POST', PATH, context.requestId, context.clientId);

  try {
    const body = await request.json();
    const { sessionId, uri } = validateResourceRead(body);

    const sessionManager = SessionManager.getInstance();

    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new SessionExpiredError(
        `Session not found or expired: ${sessionId}`,
        sessionId
      );
    }

    let contents;

    try {
      contents = await sessionManager.readResource(sessionId, uri);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundError(`Resource not found: ${uri}`, 'resource');
      }
      throw new McpExecutionError(
        `Resource read failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { executionType: 'resource', name: uri }
      );
    }

    const responseData: ResourceReadResponseData = { contents };

    log.log(200, sessionId, undefined, { uri });

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
