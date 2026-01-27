/**
 * Prompts API Route
 *
 * GET /api/playground/v2/prompts - List all prompts
 * POST /api/playground/v2/prompts - Get a prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleApiError,
  createSuccessResponse,
  SessionExpiredError,
  McpExecutionError,
  NotFoundError,
  validatePromptGet,
  validateSessionIdFromQuery,
  applyMiddleware,
  corsPreflightResponse,
  createLogContext,
  SessionManager,
  withRequestId,
  RELAXED_RATE_LIMIT,
} from '@/lib/api';
import type { PromptsListResponseData, PromptGetResponseData } from '@/lib/api';

const PATH = '/api/playground/v2/prompts';

/**
 * Handle CORS preflight request
 */
export async function OPTIONS(): Promise<NextResponse> {
  return corsPreflightResponse({ methods: ['GET', 'POST', 'OPTIONS'] });
}

/**
 * GET /api/playground/v2/prompts
 *
 * Lists all available prompts for a session.
 *
 * Query parameters:
 * - sessionId: string (required) - The session ID
 *
 * Response:
 * - success: boolean
 * - data: { prompts: McpPrompt[] }
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

    const prompts = await sessionManager.listPrompts(sessionId);

    const responseData: PromptsListResponseData = { prompts };

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
 * POST /api/playground/v2/prompts
 *
 * Gets a prompt with optional arguments.
 *
 * Request body:
 * - sessionId: string (required) - The session ID
 * - name: string (required) - Name of the prompt to get
 * - args: object (optional) - Prompt arguments
 *
 * Response:
 * - success: boolean
 * - data: { description?: string, messages: McpPromptMessage[] }
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
    const { sessionId, name, args } = validatePromptGet(body);

    const sessionManager = SessionManager.getInstance();

    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new SessionExpiredError(
        `Session not found or expired: ${sessionId}`,
        sessionId
      );
    }

    let result;

    try {
      result = await sessionManager.getPrompt(sessionId, name, args);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundError(`Prompt not found: ${name}`, 'prompt');
      }
      throw new McpExecutionError(
        `Prompt retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { executionType: 'prompt', name }
      );
    }

    const responseData: PromptGetResponseData = {
      description: result.description,
      messages: result.messages,
    };

    log.log(200, sessionId, undefined, { promptName: name });

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
