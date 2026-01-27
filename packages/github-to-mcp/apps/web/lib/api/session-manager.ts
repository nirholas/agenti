/**
 * Mock Session Manager
 *
 * Temporary mock implementation for MCP session management.
 * TODO: Replace with actual MCP client integration when ready.
 */

import type {
  McpCapabilities,
  McpServerInfo,
  McpTool,
  McpResource,
  McpResourceTemplate,
  McpResourceContents,
  McpPrompt,
  McpPromptMessage,
  McpToolResult,
  SessionInfo,
} from './types';
import type { TransportConfig } from './validation';

// ============================================================================
// Types
// ============================================================================

interface InternalSession {
  id: string;
  transport: TransportConfig;
  capabilities: McpCapabilities;
  serverInfo: McpServerInfo;
  tools: McpTool[];
  resources: McpResource[];
  resourceTemplates: McpResourceTemplate[];
  prompts: McpPrompt[];
  createdAt: Date;
  lastActivityAt: Date;
  status: 'active' | 'disconnected' | 'error';
}

interface CreateSessionResult {
  id: string;
  capabilities: McpCapabilities;
  serverInfo: McpServerInfo;
  tools: McpTool[];
}

interface ToolExecutionResult {
  result: McpToolResult;
  logs: string[];
}

interface PromptResult {
  description?: string;
  messages: McpPromptMessage[];
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_TOOLS: McpTool[] = [
  {
    name: 'echo',
    description: 'Echoes the input message',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to echo',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'add',
    description: 'Adds two numbers together',
    inputSchema: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'First number',
        },
        b: {
          type: 'number',
          description: 'Second number',
        },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'get_weather',
    description: 'Gets the current weather for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or coordinates',
        },
        units: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Temperature units',
          default: 'celsius',
        },
      },
      required: ['location'],
    },
  },
];

const MOCK_RESOURCES: McpResource[] = [
  {
    uri: 'file:///config.json',
    name: 'Configuration',
    description: 'Application configuration file',
    mimeType: 'application/json',
  },
  {
    uri: 'file:///readme.md',
    name: 'README',
    description: 'Project documentation',
    mimeType: 'text/markdown',
  },
  {
    uri: 'db://users/schema',
    name: 'Users Schema',
    description: 'Database schema for users table',
    mimeType: 'application/json',
  },
];

const MOCK_RESOURCE_TEMPLATES: McpResourceTemplate[] = [
  {
    uriTemplate: 'file:///{path}',
    name: 'File',
    description: 'Read any file by path',
  },
  {
    uriTemplate: 'db://{table}/schema',
    name: 'Database Schema',
    description: 'Get schema for a database table',
  },
];

const MOCK_PROMPTS: McpPrompt[] = [
  {
    name: 'greeting',
    description: 'Generates a personalized greeting',
    arguments: [
      { name: 'name', description: 'The name of the person to greet', required: true },
      { name: 'style', description: 'Greeting style: formal or casual', required: false },
    ],
  },
  {
    name: 'summarize',
    description: 'Creates a summary of the provided text',
    arguments: [
      { name: 'text', description: 'The text to summarize', required: true },
      { name: 'maxLength', description: 'Maximum length in words', required: false },
    ],
  },
  {
    name: 'code_review',
    description: 'Reviews code and provides feedback',
    arguments: [
      { name: 'code', description: 'The code to review', required: true },
      { name: 'language', description: 'Programming language', required: false },
      { name: 'focus', description: 'Area to focus on', required: false },
    ],
  },
];

// ============================================================================
// Session Storage
// ============================================================================

const sessions = new Map<string, InternalSession>();
const serverStartTime = Date.now();

// Session cleanup interval (5 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupTimer(): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (now - session.lastActivityAt.getTime() > SESSION_TIMEOUT) {
        sessions.delete(id);
        console.log(`[SessionManager] Cleaned up expired session: ${id}`);
      }
    }
  }, CLEANUP_INTERVAL);

  // Don't block process exit
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

// ============================================================================
// Session Manager Implementation
// ============================================================================

class SessionManagerImpl {
  private static instance: SessionManagerImpl;

  private constructor() {
    startCleanupTimer();
  }

  static getInstance(): SessionManagerImpl {
    if (!SessionManagerImpl.instance) {
      SessionManagerImpl.instance = new SessionManagerImpl();
    }
    return SessionManagerImpl.instance;
  }

  /**
   * Creates a new session with the given transport configuration
   */
  async createSession(
    transport: TransportConfig,
    _generatedCode?: string
  ): Promise<CreateSessionResult> {
    // Simulate connection delay
    await this.delay(50 + Math.random() * 100);

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const capabilities: McpCapabilities = {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      prompts: { listChanged: true },
    };

    const serverInfo: McpServerInfo = {
      name: `mock-${transport.type}-server`,
      version: '1.0.0',
      protocolVersion: '2024-11-05',
    };

    const session: InternalSession = {
      id: sessionId,
      transport,
      capabilities,
      serverInfo,
      tools: MOCK_TOOLS,
      resources: MOCK_RESOURCES,
      resourceTemplates: MOCK_RESOURCE_TEMPLATES,
      prompts: MOCK_PROMPTS,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active',
    };

    sessions.set(sessionId, session);

    return {
      id: sessionId,
      capabilities,
      serverInfo,
      tools: MOCK_TOOLS,
    };
  }

  /**
   * Gets a session by ID
   */
  async getSession(sessionId: string): Promise<InternalSession | null> {
    const session = sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = new Date();
    }
    return session || null;
  }

  /**
   * Deletes a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    await this.delay(20);
    return sessions.delete(sessionId);
  }

  /**
   * Lists all active sessions
   */
  async listSessions(): Promise<SessionInfo[]> {
    await this.delay(20);
    return Array.from(sessions.values()).map((s) => ({
      id: s.id,
      transport: s.transport,
      capabilities: s.capabilities,
      serverInfo: s.serverInfo,
      createdAt: s.createdAt.toISOString(),
      lastActivityAt: s.lastActivityAt.toISOString(),
      status: s.status,
      toolCount: s.tools.length,
      resourceCount: s.resources.length,
      promptCount: s.prompts.length,
    }));
  }

  /**
   * Deletes all sessions
   */
  async deleteAllSessions(): Promise<number> {
    await this.delay(20);
    const count = sessions.size;
    sessions.clear();
    return count;
  }

  /**
   * Gets the number of active sessions
   */
  async getActiveSessionCount(): Promise<number> {
    return sessions.size;
  }

  /**
   * Lists tools for a session
   */
  async listTools(sessionId: string): Promise<McpTool[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    await this.delay(30);
    return session.tools;
  }

  /**
   * Executes a tool
   */
  async executeTool(
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const tool = session.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Simulate execution delay
    await this.delay(100 + Math.random() * 200);

    const logs: string[] = [
      `[${new Date().toISOString()}] Executing tool: ${toolName}`,
      `[${new Date().toISOString()}] Parameters: ${JSON.stringify(params)}`,
    ];

    let result: McpToolResult;

    switch (toolName) {
      case 'echo': {
        const message = String(params.message || '');
        logs.push(`[${new Date().toISOString()}] Echo complete`);
        result = { content: [{ type: 'text', text: message }] };
        break;
      }
      case 'add': {
        const a = Number(params.a) || 0;
        const b = Number(params.b) || 0;
        const sum = a + b;
        logs.push(`[${new Date().toISOString()}] Calculation: ${a} + ${b} = ${sum}`);
        result = { content: [{ type: 'text', text: String(sum) }] };
        break;
      }
      case 'get_weather': {
        const location = String(params.location || 'Unknown');
        const units = String(params.units || 'celsius');
        const temp = units === 'celsius' ? 22 : 72;
        logs.push(`[${new Date().toISOString()}] Fetched weather for: ${location}`);
        result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                location,
                temperature: temp,
                units,
                condition: 'Sunny',
                humidity: 45,
              }),
            },
          ],
        };
        break;
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    logs.push(`[${new Date().toISOString()}] Execution complete`);
    return { result, logs };
  }

  /**
   * Lists resources for a session
   */
  async listResources(
    sessionId: string
  ): Promise<{ resources: McpResource[]; resourceTemplates: McpResourceTemplate[] }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    await this.delay(30);
    return {
      resources: session.resources,
      resourceTemplates: session.resourceTemplates,
    };
  }

  /**
   * Reads a resource
   */
  async readResource(sessionId: string, uri: string): Promise<McpResourceContents[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.delay(50 + Math.random() * 100);

    switch (uri) {
      case 'file:///config.json':
        return [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                name: 'my-app',
                version: '1.0.0',
                settings: { debug: true, maxConnections: 100 },
              },
              null,
              2
            ),
          },
        ];
      case 'file:///readme.md':
        return [
          {
            uri,
            mimeType: 'text/markdown',
            text: '# My Application\n\nThis is a sample application.\n\n## Features\n\n- Feature 1\n- Feature 2\n- Feature 3\n',
          },
        ];
      case 'db://users/schema':
        return [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                table: 'users',
                columns: [
                  { name: 'id', type: 'integer', primaryKey: true },
                  { name: 'email', type: 'varchar(255)', unique: true },
                  { name: 'name', type: 'varchar(100)' },
                  { name: 'created_at', type: 'timestamp' },
                ],
              },
              null,
              2
            ),
          },
        ];
      default:
        throw new Error(`Resource not found: ${uri}`);
    }
  }

  /**
   * Lists prompts for a session
   */
  async listPrompts(sessionId: string): Promise<McpPrompt[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    await this.delay(30);
    return session.prompts;
  }

  /**
   * Gets a prompt with arguments
   */
  async getPrompt(
    sessionId: string,
    name: string,
    args?: Record<string, string>
  ): Promise<PromptResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const prompt = session.prompts.find((p) => p.name === name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    await this.delay(50 + Math.random() * 100);

    switch (name) {
      case 'greeting': {
        const personName = args?.name || 'Friend';
        const style = args?.style || 'casual';
        const greetingText =
          style === 'formal'
            ? `Good day, ${personName}. I hope this message finds you well.`
            : `Hey ${personName}! How's it going?`;

        return {
          description: 'A personalized greeting message',
          messages: [
            { role: 'user', content: { type: 'text', text: `Generate a ${style} greeting for ${personName}` } },
            { role: 'assistant', content: { type: 'text', text: greetingText } },
          ],
        };
      }
      case 'summarize': {
        const text = args?.text || 'No text provided';
        const maxLength = args?.maxLength || '100';
        return {
          description: 'Summarize the provided text',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please summarize the following text in at most ${maxLength} words:\n\n${text}`,
              },
            },
          ],
        };
      }
      case 'code_review': {
        const code = args?.code || '// No code provided';
        const language = args?.language || 'unknown';
        const focus = args?.focus || 'general';
        return {
          description: 'Code review prompt',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please review the following ${language} code with a focus on ${focus}:\n\n\`\`\`${language}\n${code}\n\`\`\``,
              },
            },
          ],
        };
      }
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  /**
   * Gets server uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - serverStartTime) / 1000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton
export const SessionManager = SessionManagerImpl;
export type { CreateSessionResult, ToolExecutionResult, PromptResult, InternalSession };
