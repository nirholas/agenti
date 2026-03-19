/**
 * Mock fetch helper for testing
 */

export interface MockFetchOptions {
  status?: number;
  statusText?: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Create a mock fetch function for testing
 */
export function createMockFetch(options: MockFetchOptions) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const { status = 200, statusText = 'OK', result, error } = options;

    const body = {
      jsonrpc: '2.0',
      id: 1,
      ...(result !== undefined && { result }),
      ...(error !== undefined && { error }),
    };

    return new Response(JSON.stringify(body), {
      status,
      statusText,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };
}
