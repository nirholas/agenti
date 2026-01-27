/**
 * Connect API Route
 *
 * POST /api/playground/v2/connect
 * Establishes a connection to an MCP server using the specified transport.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleApiError,
  createSuccessResponse,
  McpConnectionError,
  validateConnectRequest,
  applyMiddleware,
  corsPreflightResponse,
  createLogContext,
  SessionManager,
  withRequestId,
} from '@/lib/api';
import type { ConnectResponseData } from '@/lib/api';

const PATH = '/api/playground/v2/connect';

/**
 * Handle CORS preflight request
 */
export async function OPTIONS(): Promise<NextResponse> {
  return corsPreflightResponse({ methods: ['POST', 'OPTIONS'] });
}

/**
 * POST /api/playground/v2/connect
 *
 * Establishes a connection to an MCP server.
 *
 * Request body:
 * - transport: TransportConfig (required) - The transport configuration
 * - generatedCode: string (optional) - Generated code to run as stdio server
 *
 * Response:
 * - success: boolean
 * - data: { sessionId, capabilities, serverInfo, tools }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply middleware (rate limiting, etc.)
  const middleware = await applyMiddleware(request);
  if ('response' in middleware) {
    return middleware.response;
  }

  const { context } = middleware;
  const log = createLogContext('POST', PATH, context.requestId, context.clientId);

  try {
    // Parse and validate request body
    const body = await request.json();
    const { transport, generatedCode } = validateConnectRequest(body);

    // Create session with MCP server
    const sessionManager = SessionManager.getInstance();

    let session;
    try {
      session = await sessionManager.createSession(transport, generatedCode);
    } catch (error) {
      throw new McpConnectionError(
        `Failed to connect to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          transportType: transport.type,
          cause: error instanceof Error ? error.message : undefined,
        }
      );
    }

    const responseData: ConnectResponseData = {
      sessionId: session.id,
      capabilities: session.capabilities,
      serverInfo: session.serverInfo,
      tools: session.tools,
    };

    log.log(200, session.id);

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
