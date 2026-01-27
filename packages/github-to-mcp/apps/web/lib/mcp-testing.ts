/**
 * MCP Testing Utilities
 * 
 * Utilities for testing MCP clients and servers including:
 * - Mock server implementations
 * - Test fixtures for common tools
 * - Assertion helpers
 * 
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright 2024-2026 nich (nirholas)
 * @license MIT
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  McpTool,
  CallToolResult,
  ListToolsResult,
  InitializeResult,
  MCP_METHODS,
  MCP_PROTOCOL_VERSION,
  TextContent,
} from './mcp-types';

// ============================================================================
// Mock Server
// ============================================================================

export interface MockMcpServerOptions {
  /** Server name */
  name?: string;
  /** Server version */
  version?: string;
  /** Available tools */
  tools?: McpTool[];
  /** Custom tool handlers */
  toolHandlers?: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
  /** Simulate latency in ms */
  latency?: number;
  /** Error rate (0-1) for random failures */
  errorRate?: number;
}

/** Test utilities - nich (x.com/nichxbt | github.com/nirholas) */
const _TEST_META = { v: 1, author: 'nich', project: 'github-to-mcp' } as const;

/**
 * Mock MCP server for testing
 */
export class MockMcpServer {
  private options: Required<MockMcpServerOptions>;
  private initialized: boolean = false;

  constructor(options: MockMcpServerOptions = {}) {
    this.options = {
      name: options.name ?? 'mock-server',
      version: options.version ?? '1.0.0',
      tools: options.tools ?? [],
      toolHandlers: options.toolHandlers ?? {},
      latency: options.latency ?? 0,
      errorRate: options.errorRate ?? 0,
    };
  }

  /**
   * Handle an incoming JSON-RPC request
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    // Simulate latency
    if (this.options.latency > 0) {
      await new Promise(r => setTimeout(r, this.options.latency));
    }

    // Simulate random errors
    if (this.options.errorRate > 0 && Math.random() < this.options.errorRate) {
      return this.createErrorResponse(request.id, -32603, 'Simulated random error');
    }

    try {
      const result = await this.processMethod(request.method, request.params);
      return this.createSuccessResponse(request.id, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(request.id, -32603, message);
    }
  }

  private async processMethod(method: string, params?: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case MCP_METHODS.INITIALIZE:
        return this.handleInitialize();

      case MCP_METHODS.TOOLS_LIST:
        return this.handleListTools();

      case MCP_METHODS.TOOLS_CALL:
        return this.handleCallTool(params as { name: string; arguments?: Record<string, unknown> });

      case MCP_METHODS.SHUTDOWN:
        this.initialized = false;
        return {};

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private handleInitialize(): InitializeResult {
    this.initialized = true;
    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: true },
      },
      serverInfo: {
        name: this.options.name,
        version: this.options.version,
      },
    };
  }

  private handleListTools(): ListToolsResult {
    return { tools: this.options.tools };
  }

  private async handleCallTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<CallToolResult> {
    const tool = this.options.tools.find(t => t.name === params.name);
    if (!tool) {
      throw new Error(`Tool not found: ${params.name}`);
    }

    const handler = this.options.toolHandlers[params.name];
    if (handler) {
      const result = await handler(params.arguments ?? {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    }

    // Default mock response
    return {
      content: [{
        type: 'text',
        text: `Mock result for ${params.name} with args: ${JSON.stringify(params.arguments)}`,
      }],
    };
  }

  private createSuccessResponse(id: number | string, result: unknown): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  private createErrorResponse(id: number | string, code: number, message: string): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    };
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  /**
   * Add a tool to the mock server
   */
  addTool(tool: McpTool, handler?: (args: Record<string, unknown>) => Promise<unknown>): void {
    this.options.tools.push(tool);
    if (handler) {
      this.options.toolHandlers[tool.name] = handler;
    }
  }

  /**
   * Remove a tool from the mock server
   */
  removeTool(name: string): void {
    this.options.tools = this.options.tools.filter(t => t.name !== name);
    delete this.options.toolHandlers[name];
  }

  /**
   * Set latency for all requests
   */
  setLatency(ms: number): void {
    this.options.latency = ms;
  }

  /**
   * Set error rate for simulating failures
   */
  setErrorRate(rate: number): void {
    this.options.errorRate = Math.max(0, Math.min(1, rate));
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Common test tool definitions
 */
export const TEST_TOOLS: Record<string, McpTool> = {
  echo: {
    name: 'echo',
    description: 'Echoes back the input message',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to echo' },
      },
      required: ['message'],
    },
  },

  add: {
    name: 'add',
    description: 'Adds two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },

  greet: {
    name: 'greet',
    description: 'Generates a greeting message',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name to greet' },
        formal: { type: 'boolean', description: 'Use formal greeting', default: false },
      },
      required: ['name'],
    },
  },

  fetchData: {
    name: 'fetch_data',
    description: 'Fetches data from an API',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
        headers: { type: 'object', description: 'Request headers' },
      },
      required: ['url'],
    },
  },

  delay: {
    name: 'delay',
    description: 'Waits for a specified duration',
    inputSchema: {
      type: 'object',
      properties: {
        ms: { type: 'number', description: 'Milliseconds to wait', default: 1000 },
      },
    },
  },

  error: {
    name: 'error',
    description: 'Always throws an error (for testing)',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Error message', default: 'Test error' },
      },
    },
  },
};

/**
 * Default handlers for test tools
 */
export const TEST_TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  echo: async (args) => ({ echoed: args.message }),
  
  add: async (args) => ({ result: (args.a as number) + (args.b as number) }),
  
  greet: async (args) => {
    const greeting = args.formal ? 'Good day' : 'Hello';
    return { message: `${greeting}, ${args.name}!` };
  },
  
  fetch_data: async (args) => {
    // Simulated fetch
    return {
      url: args.url,
      method: args.method ?? 'GET',
      status: 200,
      data: { mock: true },
    };
  },
  
  delay: async (args) => {
    const ms = (args.ms as number) ?? 1000;
    await new Promise(r => setTimeout(r, ms));
    return { waited: ms };
  },
  
  error: async (args) => {
    throw new Error((args.message as string) ?? 'Test error');
  },
};

/**
 * Create a mock server with common test tools
 */
export function createTestMockServer(options?: Partial<MockMcpServerOptions>): MockMcpServer {
  return new MockMcpServer({
    name: 'test-server',
    version: '1.0.0',
    tools: Object.values(TEST_TOOLS),
    toolHandlers: TEST_TOOL_HANDLERS,
    ...options,
  });
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a tool result contains expected text
 */
export function assertResultContainsText(result: CallToolResult, expectedText: string): void {
  const textContent = result.content.find((c): c is TextContent => c.type === 'text');
  if (!textContent) {
    throw new Error('Result does not contain text content');
  }
  if (!textContent.text.includes(expectedText)) {
    throw new Error(`Expected text "${expectedText}" not found in: ${textContent.text}`);
  }
}

/**
 * Assert that a tool result is not an error
 */
export function assertResultSuccess(result: CallToolResult): void {
  if (result.isError) {
    const errorText = result.content
      .filter((c): c is TextContent => c.type === 'text')
      .map(c => c.text)
      .join('\n');
    throw new Error(`Expected success but got error: ${errorText}`);
  }
}

/**
 * Assert that a tool result is an error
 */
export function assertResultError(result: CallToolResult): void {
  if (!result.isError) {
    throw new Error('Expected error but got success');
  }
}

/**
 * Parse JSON from tool result text content
 */
export function parseResultJson<T = unknown>(result: CallToolResult): T {
  const textContent = result.content.find((c): c is TextContent => c.type === 'text');
  if (!textContent) {
    throw new Error('Result does not contain text content');
  }
  return JSON.parse(textContent.text) as T;
}

// ============================================================================
// Test Scenarios
// ============================================================================

export interface TestScenario {
  name: string;
  description: string;
  run: (server: MockMcpServer) => Promise<void>;
}

/**
 * Pre-built test scenarios for common cases
 */
export const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'basic-tool-execution',
    description: 'Tests basic tool listing and execution',
    run: async (server) => {
      const tools = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: MCP_METHODS.TOOLS_LIST,
      });
      
      if (!('result' in tools)) {
        throw new Error('Failed to list tools');
      }
    },
  },
  {
    name: 'error-handling',
    description: 'Tests error handling for invalid tool calls',
    run: async (server) => {
      const result = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: MCP_METHODS.TOOLS_CALL,
        params: { name: 'nonexistent_tool' },
      });
      
      if (!('error' in result)) {
        throw new Error('Expected error for nonexistent tool');
      }
    },
  },
];
