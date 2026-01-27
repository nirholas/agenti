/**
 * OpenAPI Documentation for Playground API v2
 *
 * This module provides OpenAPI 3.1 specification for the playground API.
 */

// OpenAPI 3.1 Document type (simplified definition to avoid external dependency)
interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    requestBodies?: Record<string, unknown>;
    responses?: Record<string, unknown>;
  };
}

export const openApiSpec: OpenAPIDocument = {
  openapi: '3.1.0',
  info: {
    title: 'MCP Playground API',
    description: `
The MCP Playground API provides endpoints for connecting to and interacting with
Model Context Protocol (MCP) servers. It supports multiple transport types including
stdio, SSE, and HTTP.

## Features

- **Session Management**: Create, list, and delete MCP server sessions
- **Tool Execution**: Discover and execute MCP tools
- **Resource Access**: Browse and read MCP resources
- **Prompt Templates**: Use and customize MCP prompts
- **Health Monitoring**: Check API health and session status

## Rate Limiting

All endpoints are rate-limited. Check the following headers in responses:
- \`X-RateLimit-Limit\`: Maximum requests per window
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Seconds until the window resets

## Request Tracking

All requests include an \`X-Request-ID\` header for tracing. You can provide your own
request ID or let the server generate one.
    `,
    version: '2.0.0',
    contact: {
      name: 'MCP Playground Support',
      url: 'https://github.com/nirholas/github-to-mcp',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api/playground/v2',
      description: 'Playground API v2',
    },
  ],
  tags: [
    { name: 'Connection', description: 'Session connection management' },
    { name: 'Tools', description: 'MCP tool discovery and execution' },
    { name: 'Resources', description: 'MCP resource browsing and reading' },
    { name: 'Prompts', description: 'MCP prompt discovery and execution' },
    { name: 'Sessions', description: 'Session management' },
    { name: 'Health', description: 'Health and status monitoring' },
  ],
  paths: {
    '/connect': {
      post: {
        tags: ['Connection'],
        summary: 'Connect to MCP server',
        description: 'Establishes a new connection to an MCP server using the specified transport configuration.',
        operationId: 'connect',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ConnectRequest' },
              examples: {
                stdio: {
                  summary: 'Stdio transport',
                  value: {
                    transport: {
                      type: 'stdio',
                      command: 'npx',
                      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
                    },
                  },
                },
                sse: {
                  summary: 'SSE transport',
                  value: {
                    transport: {
                      type: 'sse',
                      url: 'http://localhost:3001/sse',
                    },
                  },
                },
                http: {
                  summary: 'HTTP transport',
                  value: {
                    transport: {
                      type: 'http',
                      url: 'http://localhost:3001/mcp',
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successfully connected',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ConnectResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '502': { $ref: '#/components/responses/ConnectionError' },
        },
      },
      options: {
        tags: ['Connection'],
        summary: 'CORS preflight',
        responses: { '204': { description: 'CORS preflight response' } },
      },
    },
    '/disconnect': {
      post: {
        tags: ['Connection'],
        summary: 'Disconnect from MCP server',
        description: 'Closes an existing MCP server connection and cleans up the session.',
        operationId: 'disconnect',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DisconnectRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successfully disconnected',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DisconnectResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '410': { $ref: '#/components/responses/SessionExpiredError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/tools': {
      get: {
        tags: ['Tools'],
        summary: 'List available tools',
        description: 'Returns a list of all tools available from the connected MCP server.',
        operationId: 'listTools',
        parameters: [{ $ref: '#/components/parameters/SessionId' }],
        responses: {
          '200': {
            description: 'List of tools',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ToolsListResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '410': { $ref: '#/components/responses/SessionExpiredError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
      post: {
        tags: ['Tools'],
        summary: 'Execute a tool',
        description: 'Executes a tool with the provided parameters and returns the result.',
        operationId: 'executeTool',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ToolCallRequest' },
              examples: {
                echo: {
                  summary: 'Echo tool',
                  value: {
                    sessionId: 'session_123',
                    toolName: 'echo',
                    params: { message: 'Hello, World!' },
                  },
                },
                add: {
                  summary: 'Add tool',
                  value: {
                    sessionId: 'session_123',
                    toolName: 'add',
                    params: { a: 5, b: 3 },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tool execution result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ToolCallResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '410': { $ref: '#/components/responses/SessionExpiredError' },
          '422': { $ref: '#/components/responses/ExecutionError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/resources': {
      get: {
        tags: ['Resources'],
        summary: 'List available resources',
        description: 'Returns a list of all resources and resource templates available from the MCP server.',
        operationId: 'listResources',
        parameters: [{ $ref: '#/components/parameters/SessionId' }],
        responses: {
          '200': {
            description: 'List of resources',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ResourcesListResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '410': { $ref: '#/components/responses/SessionExpiredError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
      post: {
        tags: ['Resources'],
        summary: 'Read a resource',
        description: 'Reads the contents of a resource identified by its URI.',
        operationId: 'readResource',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ResourceReadRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Resource contents',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ResourceReadResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '410': { $ref: '#/components/responses/SessionExpiredError' },
          '422': { $ref: '#/components/responses/ExecutionError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/prompts': {
      get: {
        tags: ['Prompts'],
        summary: 'List available prompts',
        description: 'Returns a list of all prompts available from the MCP server.',
        operationId: 'listPrompts',
        parameters: [{ $ref: '#/components/parameters/SessionId' }],
        responses: {
          '200': {
            description: 'List of prompts',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PromptsListResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '410': { $ref: '#/components/responses/SessionExpiredError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
      post: {
        tags: ['Prompts'],
        summary: 'Get a prompt',
        description: 'Gets a prompt with the provided arguments rendered into messages.',
        operationId: 'getPrompt',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PromptGetRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Prompt messages',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PromptGetResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
          '410': { $ref: '#/components/responses/SessionExpiredError' },
          '422': { $ref: '#/components/responses/ExecutionError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/sessions': {
      get: {
        tags: ['Sessions'],
        summary: 'List all sessions',
        description: 'Returns a list of all active sessions.',
        operationId: 'listSessions',
        responses: {
          '200': {
            description: 'List of sessions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionsListResponse' },
              },
            },
          },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
      delete: {
        tags: ['Sessions'],
        summary: 'Delete sessions',
        description: 'Deletes one or all sessions. If sessionId is provided, deletes that session. Otherwise, deletes all sessions.',
        operationId: 'deleteSessions',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SessionsDeleteRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Deletion result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionsDeleteResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns the health status of the API including active session count and uptime.',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Health status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
  },
  components: {
    parameters: {
      SessionId: {
        name: 'sessionId',
        in: 'query',
        required: true,
        description: 'The session ID',
        schema: { type: 'string' },
      },
    },
    schemas: {
      // Transport schemas
      StdioTransportConfig: {
        type: 'object',
        required: ['type', 'command'],
        properties: {
          type: { type: 'string', enum: ['stdio'] },
          command: { type: 'string', description: 'Command to execute' },
          args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
          env: { type: 'object', additionalProperties: { type: 'string' }, description: 'Environment variables' },
          cwd: { type: 'string', description: 'Working directory' },
        },
      },
      SseTransportConfig: {
        type: 'object',
        required: ['type', 'url'],
        properties: {
          type: { type: 'string', enum: ['sse'] },
          url: { type: 'string', format: 'uri', description: 'SSE endpoint URL' },
          headers: { type: 'object', additionalProperties: { type: 'string' }, description: 'HTTP headers' },
        },
      },
      HttpTransportConfig: {
        type: 'object',
        required: ['type', 'url'],
        properties: {
          type: { type: 'string', enum: ['http'] },
          url: { type: 'string', format: 'uri', description: 'HTTP endpoint URL' },
          headers: { type: 'object', additionalProperties: { type: 'string' }, description: 'HTTP headers' },
        },
      },
      TransportConfig: {
        oneOf: [
          { $ref: '#/components/schemas/StdioTransportConfig' },
          { $ref: '#/components/schemas/SseTransportConfig' },
          { $ref: '#/components/schemas/HttpTransportConfig' },
        ],
        discriminator: {
          propertyName: 'type',
          mapping: {
            stdio: '#/components/schemas/StdioTransportConfig',
            sse: '#/components/schemas/SseTransportConfig',
            http: '#/components/schemas/HttpTransportConfig',
          },
        },
      },

      // MCP entity schemas
      McpCapabilities: {
        type: 'object',
        properties: {
          tools: {
            type: 'object',
            properties: { listChanged: { type: 'boolean' } },
          },
          resources: {
            type: 'object',
            properties: {
              subscribe: { type: 'boolean' },
              listChanged: { type: 'boolean' },
            },
          },
          prompts: {
            type: 'object',
            properties: { listChanged: { type: 'boolean' } },
          },
        },
      },
      McpServerInfo: {
        type: 'object',
        required: ['name', 'version'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          protocolVersion: { type: 'string' },
        },
      },
      McpTool: {
        type: 'object',
        required: ['name', 'inputSchema'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['object'] },
              properties: { type: 'object' },
              required: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      McpResource: {
        type: 'object',
        required: ['uri', 'name'],
        properties: {
          uri: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          mimeType: { type: 'string' },
        },
      },
      McpResourceTemplate: {
        type: 'object',
        required: ['uriTemplate', 'name'],
        properties: {
          uriTemplate: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          mimeType: { type: 'string' },
        },
      },
      McpResourceContents: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: { type: 'string' },
          mimeType: { type: 'string' },
          text: { type: 'string' },
          blob: { type: 'string', description: 'Base64 encoded binary content' },
        },
      },
      McpPrompt: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          arguments: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                required: { type: 'boolean' },
              },
            },
          },
        },
      },
      McpPromptMessage: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant'] },
          content: {
            type: 'object',
            required: ['type'],
            properties: {
              type: { type: 'string', enum: ['text', 'image', 'resource'] },
              text: { type: 'string' },
              data: { type: 'string' },
              mimeType: { type: 'string' },
            },
          },
        },
      },
      McpToolResult: {
        type: 'object',
        required: ['content'],
        properties: {
          content: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type'],
              properties: {
                type: { type: 'string', enum: ['text', 'image', 'resource'] },
                text: { type: 'string' },
                data: { type: 'string' },
                mimeType: { type: 'string' },
              },
            },
          },
          isError: { type: 'boolean' },
        },
      },
      SessionInfo: {
        type: 'object',
        required: ['id', 'transport', 'capabilities', 'serverInfo', 'createdAt', 'lastActivityAt', 'status'],
        properties: {
          id: { type: 'string' },
          transport: { $ref: '#/components/schemas/TransportConfig' },
          capabilities: { $ref: '#/components/schemas/McpCapabilities' },
          serverInfo: { $ref: '#/components/schemas/McpServerInfo' },
          createdAt: { type: 'string', format: 'date-time' },
          lastActivityAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['active', 'disconnected', 'error'] },
          toolCount: { type: 'integer' },
          resourceCount: { type: 'integer' },
          promptCount: { type: 'integer' },
        },
      },

      // Request schemas
      ConnectRequest: {
        type: 'object',
        required: ['transport'],
        properties: {
          transport: { $ref: '#/components/schemas/TransportConfig' },
          generatedCode: { type: 'string', description: 'Generated code to run as stdio server' },
        },
      },
      DisconnectRequest: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
        },
      },
      ToolCallRequest: {
        type: 'object',
        required: ['sessionId', 'toolName'],
        properties: {
          sessionId: { type: 'string' },
          toolName: { type: 'string' },
          params: { type: 'object', additionalProperties: true },
        },
      },
      ResourceReadRequest: {
        type: 'object',
        required: ['sessionId', 'uri'],
        properties: {
          sessionId: { type: 'string' },
          uri: { type: 'string' },
        },
      },
      PromptGetRequest: {
        type: 'object',
        required: ['sessionId', 'name'],
        properties: {
          sessionId: { type: 'string' },
          name: { type: 'string' },
          args: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
      SessionsDeleteRequest: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'If omitted, deletes all sessions' },
        },
      },

      // Response schemas
      ApiError: {
        type: 'object',
        required: ['code', 'message', 'statusCode'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer' },
        },
      },
      ConnectResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              capabilities: { $ref: '#/components/schemas/McpCapabilities' },
              serverInfo: { $ref: '#/components/schemas/McpServerInfo' },
              tools: { type: 'array', items: { $ref: '#/components/schemas/McpTool' } },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      DisconnectResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              disconnected: { type: 'boolean' },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      ToolsListResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              tools: { type: 'array', items: { $ref: '#/components/schemas/McpTool' } },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      ToolCallResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              result: { $ref: '#/components/schemas/McpToolResult' },
              executionTime: { type: 'integer', description: 'Execution time in milliseconds' },
              logs: { type: 'array', items: { type: 'string' } },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      ResourcesListResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              resources: { type: 'array', items: { $ref: '#/components/schemas/McpResource' } },
              resourceTemplates: { type: 'array', items: { $ref: '#/components/schemas/McpResourceTemplate' } },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      ResourceReadResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              contents: { type: 'array', items: { $ref: '#/components/schemas/McpResourceContents' } },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      PromptsListResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              prompts: { type: 'array', items: { $ref: '#/components/schemas/McpPrompt' } },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      PromptGetResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              messages: { type: 'array', items: { $ref: '#/components/schemas/McpPromptMessage' } },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      SessionsListResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              sessions: { type: 'array', items: { $ref: '#/components/schemas/SessionInfo' } },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      SessionsDeleteResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              deleted: { type: 'integer' },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
      HealthResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              activeSessions: { type: 'integer' },
              uptime: { type: 'integer', description: 'Uptime in seconds' },
              version: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
          error: { $ref: '#/components/schemas/ApiError' },
        },
      },
    },
    responses: {
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      SessionExpiredError: {
        description: 'Session expired or not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      ConnectionError: {
        description: 'Failed to connect to MCP server',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      ExecutionError: {
        description: 'Execution failed',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': {
            schema: { type: 'string' },
            description: 'Maximum requests per window',
          },
          'X-RateLimit-Remaining': {
            schema: { type: 'string' },
            description: 'Remaining requests',
          },
          'X-RateLimit-Reset': {
            schema: { type: 'string' },
            description: 'Seconds until reset',
          },
          'Retry-After': {
            schema: { type: 'string' },
            description: 'Seconds to wait before retrying',
          },
        },
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                error: { $ref: '#/components/schemas/ApiError' },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * Get the OpenAPI spec as JSON string
 */
export function getOpenApiJson(): string {
  return JSON.stringify(openApiSpec, null, 2);
}

/**
 * Get the OpenAPI spec as YAML string (requires js-yaml)
 */
export function getOpenApiYaml(): string {
  // Simple YAML-like output without external dependency
  return JSON.stringify(openApiSpec, null, 2)
    .replace(/"/g, '')
    .replace(/,$/gm, '');
}
