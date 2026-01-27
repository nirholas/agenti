/**
 * Tools API Route
 *
 * GET /api/playground/v2/tools - List all tools
 * POST /api/playground/v2/tools - Execute a tool
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleApiError,
  createSuccessResponse,
  SessionExpiredError,
  McpExecutionError,
  NotFoundError,
  validateToolCall,
  validateSessionIdFromQuery,
  applyMiddleware,
  corsPreflightResponse,
  createLogContext,
  SessionManager,
  withRequestId,
  RELAXED_RATE_LIMIT,
} from '@/lib/api';
import type { ToolsListResponseData, ToolCallResponseData } from '@/lib/api';

const PATH = '/api/playground/v2/tools';

/**
 * Handle CORS preflight request
 */
export async function OPTIONS(): Promise<NextResponse> {
  return corsPreflightResponse({ methods: ['GET', 'POST', 'OPTIONS'] });
}

/**
 * GET /api/playground/v2/tools
 *
 * Lists all available tools for a session.
 *
 * Query parameters:
 * - sessionId: string (required) - The session ID
 *
 * Response:
 * - success: boolean
 * - data: { tools: McpTool[] }
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

    const tools = await sessionManager.listTools(sessionId);

    const responseData: ToolsListResponseData = { tools };

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
 * POST /api/playground/v2/tools
 *
 * Executes a tool.
 *
 * Request body:
 * - sessionId: string (required) - The session ID
 * - toolName: string (required) - Name of the tool to execute
 * - params: object (optional) - Tool parameters
 *
 * Response:
 * - success: boolean
 * - data: { result: McpToolResult, executionTime: number, logs: string[] }
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
    const { sessionId, toolName, params } = validateToolCall(body);

    const sessionManager = SessionManager.getInstance();

    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new SessionExpiredError(
        `Session not found or expired: ${sessionId}`,
        sessionId
      );
    }

    const executionStart = Date.now();
    let result;
    let logs: string[];

    try {
      const execution = await sessionManager.executeTool(sessionId, toolName, params);
      result = execution.result;
      logs = execution.logs;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundError(`Tool not found: ${toolName}`, 'tool');
      }
      throw new McpExecutionError(
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { executionType: 'tool', name: toolName }
      );
    }

    const executionTime = Date.now() - executionStart;

    const responseData: ToolCallResponseData = {
      result,
      executionTime,
      logs,
    };

    log.log(200, sessionId, undefined, { toolName, executionTime });

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
