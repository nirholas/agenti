/**
 * API Error Classes and Utilities
 *
 * Provides custom error classes for different API error scenarios
 * and a unified error handler for converting errors to NextResponse.
 */

import { NextResponse } from 'next/server';

/**
 * Base API Error class
 */
export abstract class ApiError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Validation Error - thrown when request validation fails
 * Status Code: 400 Bad Request
 */
export class ValidationError extends ApiError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.field && { field: this.field }),
    };
  }
}

/**
 * Not Found Error - thrown when a requested resource doesn't exist
 * Status Code: 404 Not Found
 */
export class NotFoundError extends ApiError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
  readonly resource?: string;

  constructor(message: string, resource?: string) {
    super(message);
    this.resource = resource;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.resource && { resource: this.resource }),
    };
  }
}

/**
 * MCP Connection Error - thrown when connection to MCP server fails
 * Status Code: 502 Bad Gateway
 */
export class McpConnectionError extends ApiError {
  readonly statusCode = 502;
  readonly code = 'MCP_CONNECTION_ERROR';
  readonly transportType?: string;
  readonly cause?: string;

  constructor(message: string, options?: { transportType?: string; cause?: string }) {
    super(message);
    this.transportType = options?.transportType;
    this.cause = options?.cause;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.transportType && { transportType: this.transportType }),
      ...(this.cause && { cause: this.cause }),
    };
  }
}

/**
 * MCP Execution Error - thrown when tool/resource/prompt execution fails
 * Status Code: 422 Unprocessable Entity
 */
export class McpExecutionError extends ApiError {
  readonly statusCode = 422;
  readonly code = 'MCP_EXECUTION_ERROR';
  readonly executionType?: 'tool' | 'resource' | 'prompt';
  readonly entityName?: string;

  constructor(
    message: string,
    options?: { executionType?: 'tool' | 'resource' | 'prompt'; name?: string }
  ) {
    super(message);
    this.executionType = options?.executionType;
    this.entityName = options?.name;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.executionType && { executionType: this.executionType }),
      ...(this.entityName && { name: this.entityName }),
    };
  }
}

/**
 * Session Expired Error - thrown when a session has expired or is invalid
 * Status Code: 410 Gone
 */
export class SessionExpiredError extends ApiError {
  readonly statusCode = 410;
  readonly code = 'SESSION_EXPIRED';
  readonly sessionId?: string;

  constructor(message: string, sessionId?: string) {
    super(message);
    this.sessionId = sessionId;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.sessionId && { sessionId: this.sessionId }),
    };
  }
}

/**
 * Rate Limit Error - thrown when rate limit is exceeded
 * Status Code: 429 Too Many Requests
 */
export class RateLimitError extends ApiError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.retryAfter && { retryAfter: this.retryAfter }),
    };
  }
}

/**
 * Internal Server Error - thrown for unexpected errors
 * Status Code: 500 Internal Server Error
 */
export class InternalServerError extends ApiError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_SERVER_ERROR';

  constructor(message = 'An unexpected error occurred') {
    super(message);
  }
}

/**
 * Converts any error to an appropriate NextResponse
 */
export function handleApiError(error: unknown): NextResponse {
  // Log the error for debugging
  console.error('[API Error]', error);

  // Handle known API errors
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: error.toJSON(),
      },
      {
        status: error.statusCode,
        headers: getErrorHeaders(error),
      }
    );
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Check for specific error types by name or message
    if (
      error.name === 'AbortError' ||
      error.message.includes('aborted')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'REQUEST_ABORTED',
            message: 'Request was aborted',
            statusCode: 499,
          },
        },
        { status: 499 }
      );
    }

    if (
      error.name === 'TimeoutError' ||
      error.message.includes('timeout')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Request timed out',
            statusCode: 504,
          },
        },
        { status: 504 }
      );
    }

    // Generic error response - don't expose internal details in production
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: isDev ? error.message : 'An unexpected error occurred',
          statusCode: 500,
          ...(isDev && { stack: error.stack }),
        },
      },
      { status: 500 }
    );
  }

  // Handle unknown error types
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        statusCode: 500,
      },
    },
    { status: 500 }
  );
}

/**
 * Get additional headers for specific error types
 */
function getErrorHeaders(error: ApiError): HeadersInit {
  const headers: HeadersInit = {};

  if (error instanceof RateLimitError && error.retryAfter) {
    headers['Retry-After'] = String(error.retryAfter);
  }

  return headers;
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  status = 200,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
      headers,
    }
  );
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number,
  additionalData?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        statusCode: status,
        ...additionalData,
      },
    },
    { status }
  );
}

/**
 * Wraps an async handler with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Type guard to check if an error is a specific ApiError type
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isMcpConnectionError(
  error: unknown
): error is McpConnectionError {
  return error instanceof McpConnectionError;
}

export function isMcpExecutionError(
  error: unknown
): error is McpExecutionError {
  return error instanceof McpExecutionError;
}

export function isSessionExpiredError(
  error: unknown
): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}
