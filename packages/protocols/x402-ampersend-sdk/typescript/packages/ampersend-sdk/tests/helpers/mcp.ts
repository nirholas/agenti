import { vi } from "vitest"
import type { PaymentRequirements } from "x402/types"

export interface CapturedRequest {
  url: string | URL
  method?: string
  headers?: Record<string, string>
  body?: string
}

export interface MockResponse {
  status: number
  body: any
  headers?: Record<string, string>
}

export interface MockFetchOptions {
  responses?: Array<MockResponse>
  captureRequests?: boolean
}

/**
 * Sets up fetch mocking with request capture and configurable responses
 */
export function setupMockFetch(options: MockFetchOptions = {}) {
  const { captureRequests = true, responses = [] } = options
  const captured: Array<CapturedRequest> = []
  let responseIndex = 0

  const mockFetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
    if (captureRequests) {
      captured.push({
        url: input,
        method: init?.method || "GET",
        headers: init?.headers as Record<string, string>,
        body: init?.body as string,
      })
    }

    const response = responses[responseIndex] || { status: 200, body: { result: null } }
    responseIndex = Math.min(responseIndex + 1, responses.length - 1)

    if (response.status === 402) {
      // Simulate JSON-RPC error for 402
      const error = {
        code: 402,
        message: "Payment Required",
        data: response.body,
      }
      throw error
    }

    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        ...response.headers,
      },
    })
  })

  // @ts-expect-error - Mocking global fetch
  global.fetch = mockFetch

  return {
    captured,
    mockFetch,
    reset: () => {
      captured.length = 0
      responseIndex = 0
    },
  }
}

/**
 * Creates a valid JSON-RPC 2.0 response
 */
export function createJsonRpcResponse(id: number | string, result: any) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  }
}

/**
 * Creates a valid JSON-RPC 2.0 error response
 */
export function createJsonRpcError(id: number | string, code: number, message: string, data?: any) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data,
    },
  }
}

/**
 * Creates x402 payment requirements for 402 errors
 */
export function createX402Requirements(): { x402Version: number; accepts: Array<PaymentRequirements> } {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact" as const,
        amount: "1000000000000000000",
        recipient: "0x1234567890123456789012345678901234567890",
        chainId: 1,
      },
    ],
  }
}

/**
 * Creates a 402 error with x402 payment requirements
 */
export function create402Error(): MockResponse {
  return {
    status: 402,
    body: createX402Requirements(),
  }
}

/**
 * Creates a malformed 402 error (missing required x402 fields)
 */
export function createMalformed402Error(): MockResponse {
  return {
    status: 402,
    body: {
      // Missing x402Version and accepts
      error: "Payment required but malformed",
    },
  }
}

/**
 * Helper to assert that a request has no payment headers or _meta.x402Payment
 */
export function assertNoPaymentInfo(request: CapturedRequest) {
  // No X-PAYMENT header
  expect(request.headers?.["X-PAYMENT"]).toBeUndefined()

  // If body is JSON, check for _meta.x402Payment
  if (request.body) {
    try {
      const parsed = JSON.parse(request.body)
      expect(parsed.params?._meta?.x402Payment).toBeUndefined()
    } catch {
      // Not JSON, skip _meta check
    }
  }
}

/**
 * Helper to assert that a request has valid payment header
 */
export function assertPaymentHeader(request: CapturedRequest) {
  expect(request.headers?.["X-PAYMENT"]).toBeDefined()
  expect(typeof request.headers?.["X-PAYMENT"]).toBe("string")

  // Should be valid base64
  const header = request.headers!["X-PAYMENT"]
  expect(() => atob(header)).not.toThrow()
}

/**
 * Helper to assert that _meta field is clean (no x402Payment)
 */
export function assertCleanMeta(request: CapturedRequest, expectedMetaFields?: Record<string, any>) {
  if (!request.body) return

  const parsed = JSON.parse(request.body)

  if (expectedMetaFields) {
    // Should have expected fields but no x402Payment
    expect(parsed.params?._meta).toEqual(expectedMetaFields)
  } else {
    // Should have no _meta at all
    expect(parsed.params?._meta).toBeUndefined()
  }
}

/**
 * Helper to create a valid exact payment payload
 */
export function createExactPayment() {
  return {
    scheme: "exact" as const,
    amount: "1000000000000000000",
    recipient: "0x1234567890123456789012345678901234567890",
    signature: "0xabcdef123456789",
    chainId: 1,
  }
}

/**
 * Helper to create a valid deferred payment payload
 */
export function createDeferredPayment() {
  return {
    scheme: "deferred" as const,
    amount: "1000000000000000000",
    recipient: "0x1234567890123456789012345678901234567890",
    escrowAddress: "0x9876543210987654321098765432109876543210",
    signature: "0xabcdef123456789",
    chainId: 1,
  }
}

/**
 * Helper to create an invalid payment payload
 */
export function createInvalidPayment() {
  return {
    scheme: "invalid" as any,
    amount: "1000000000000000000",
  }
}

/**
 * Mock MCP server responses for different scenarios
 */
export const MockResponses = {
  initialize: createJsonRpcResponse(1, {
    protocolVersion: "2024-11-05",
    capabilities: {},
    serverInfo: { name: "test-server", version: "1.0.0" },
  }),

  toolsList: createJsonRpcResponse(2, {
    tools: [
      {
        name: "test-tool",
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: {
            param: { type: "string" },
          },
        },
      },
    ],
  }),

  toolCall: createJsonRpcResponse(3, {
    content: [
      {
        type: "text",
        text: "Tool executed successfully",
      },
    ],
  }),

  resourcesList: createJsonRpcResponse(4, {
    resources: [
      {
        uri: "test://resource",
        name: "Test Resource",
        description: "A test resource",
      },
    ],
  }),

  resourceRead: createJsonRpcResponse(5, {
    contents: [
      {
        uri: "test://resource",
        mimeType: "text/plain",
        text: "Resource content",
      },
    ],
  }),
}

/**
 * Utility to wait for async operations to complete
 */
export function waitForAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Mock client request method for integration testing
 */
export function mockClientRequests(client: any, responses: Array<any>): ReturnType<typeof vi.spyOn> {
  const spy = vi.spyOn(client, "request")

  responses.forEach((response) => {
    spy.mockResolvedValueOnce(response)
  })

  return spy
}

/**
 * Set up a client with mocked transport for testing
 */
export function setupMockClient(
  ClientClass: any,
  TransportClass: any,
  options: { url?: string; onPaymentRequired?: any } = {},
) {
  const { onPaymentRequired, url = "https://example.com/mcp" } = options

  const transport = new TransportClass(new URL(url))
  const clientOptions = {
    mcpOptions: { transport },
    ...(onPaymentRequired && { onPaymentRequired }),
  }

  const client = new ClientClass({ name: "test-client", version: "1.0.0" }, clientOptions)

  // Set up client connection state
  ;(client as any)._transport = transport
  ;(client as any)._connected = true

  return { client, transport }
}

/**
 * Create captured request from client spy
 */
export function getCapturedRequests(clientSpy: ReturnType<typeof vi.spyOn>): Array<any> {
  return clientSpy.mock.calls.map((call) => call[0])
}

/**
 * Assert that a request has no payment-related data
 */
export function assertNoPaymentData(request: any) {
  // Check that request has no x402Payment in _meta
  if (request.params?._meta) {
    expect(request.params._meta.x402Payment).toBeUndefined()
  }

  // For transport-level requests, we don't have headers to check
  // as those are added by the transport's fetch wrapper
}

/**
 * Assert that _meta fields are preserved correctly
 */
export function assertMetaPreserved(request: any, expectedMeta: Record<string, any>) {
  if (Object.keys(expectedMeta).length === 0) {
    expect(request.params?._meta).toBeUndefined()
  } else {
    expect(request.params._meta).toEqual(expectedMeta)
  }
}

/**
 * Create MCP tool call response
 */
export function createToolCallResponse(content: Array<any> = [{ type: "text", text: "Success" }]) {
  return {
    jsonrpc: "2.0" as const,
    id: 1,
    result: { content },
  }
}

/**
 * Create MCP resource read response
 */
export function createResourceResponse(uri: string = "test://resource", content: string = "Resource content") {
  return {
    jsonrpc: "2.0" as const,
    id: 1,
    result: {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: content,
        },
      ],
    },
  }
}

/**
 * Create MCP initialization response
 */
export function createInitResponse() {
  return {
    jsonrpc: "2.0" as const,
    id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      serverInfo: { name: "test-server", version: "1.0.0" },
    },
  }
}
