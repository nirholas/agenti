/**
 * MCP Sandbox Runtime - Spawn and manage MCP server processes
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface McpSession {
  id: string;
  process: ChildProcess;
  tempFile: string;
  createdAt: Date;
  lastUsed: Date;
  cleanupTimer: NodeJS.Timeout;
  requestId: number;
  pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
  buffer: string;
  initialized: boolean;
}

export interface ExecuteToolRequest {
  generatedCode: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  sessionId?: string;
}

export interface ExecuteToolResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  errorDetails?: {
    code?: number;
    stack?: string;
    data?: unknown;
  };
  sessionId: string;
  executionTime: number;
  logs?: string[];
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface ListToolsResponse {
  success: boolean;
  tools?: McpTool[];
  error?: string;
  sessionId: string;
}

// MCP JSON-RPC Types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 30 * 1000; // 30 seconds
const INIT_TIMEOUT_MS = 10 * 1000; // 10 seconds for initialization
const MAX_SESSIONS = 100;

// ============================================================================
// Session Store
// ============================================================================

const sessions = new Map<string, McpSession>();

/**
 * Clean up expired sessions
 */
function cleanupSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    clearTimeout(session.cleanupTimer);
    
    // Reject all pending requests
    Array.from(session.pendingRequests.values()).forEach(pending => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Session closed'));
    });
    
    // Kill the process
    if (!session.process.killed) {
      session.process.kill('SIGTERM');
      setTimeout(() => {
        if (!session.process.killed) {
          session.process.kill('SIGKILL');
        }
      }, 1000);
    }
    
    // Remove temp file
    fs.unlink(session.tempFile).catch(() => {
      // Ignore errors - file may already be deleted
    });
    
    sessions.delete(sessionId);
    console.log(`[MCP Sandbox] Session ${sessionId} cleaned up`);
  }
}

/**
 * Reset session timeout
 */
function resetSessionTimeout(session: McpSession): void {
  clearTimeout(session.cleanupTimer);
  session.lastUsed = new Date();
  session.cleanupTimer = setTimeout(() => {
    cleanupSession(session.id);
  }, SESSION_TIMEOUT_MS);
}

// ============================================================================
// MCP Sandbox Class
// ============================================================================

export class McpSandbox {
  private logs: string[] = [];

  /**
   * Get or create a session for the given code
   */
  async getOrCreateSession(generatedCode: string, sessionId?: string): Promise<McpSession> {
    // If sessionId provided, try to get existing session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      resetSessionTimeout(session);
      return session;
    }

    // Check max sessions limit
    if (sessions.size >= MAX_SESSIONS) {
      // Clean up oldest session
      const allSessions = Array.from(sessions.values());
      let oldestSession: McpSession | null = null;
      for (let i = 0; i < allSessions.length; i++) {
        const session = allSessions[i];
        if (!oldestSession || session.lastUsed < oldestSession.lastUsed) {
          oldestSession = session;
        }
      }
      if (oldestSession) {
        cleanupSession(oldestSession.id);
      }
    }

    // Create new session
    return this.createSession(generatedCode);
  }

  /**
   * Create a new MCP server session
   */
  private async createSession(generatedCode: string): Promise<McpSession> {
    const sessionId = randomUUID();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-sandbox-'));
    const tempFile = path.join(tempDir, 'server.ts');

    // Write the generated code to temp file
    await fs.writeFile(tempFile, generatedCode, 'utf-8');
    this.logs.push(`[${new Date().toISOString()}] Created temp file: ${tempFile}`);

    // Spawn the MCP server process using tsx
    const process = spawn('npx', ['tsx', tempFile], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...globalThis.process.env,
        NODE_ENV: 'production',
        // Limit resources
        NODE_OPTIONS: '--max-old-space-size=256',
      },
      cwd: tempDir,
    });

    const session: McpSession = {
      id: sessionId,
      process,
      tempFile,
      createdAt: new Date(),
      lastUsed: new Date(),
      cleanupTimer: setTimeout(() => cleanupSession(sessionId), SESSION_TIMEOUT_MS),
      requestId: 0,
      pendingRequests: new Map(),
      buffer: '',
      initialized: false,
    };

    // Handle stdout - parse JSON-RPC responses
    process.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      session.buffer += chunk;
      this.logs.push(`[${new Date().toISOString()}] stdout: ${chunk}`);

      // Try to parse complete JSON-RPC messages
      this.processBuffer(session);
    });

    // Handle stderr
    process.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      this.logs.push(`[${new Date().toISOString()}] stderr: ${message}`);
    });

    // Handle process exit
    process.on('exit', (code, signal) => {
      this.logs.push(`[${new Date().toISOString()}] Process exited with code ${code}, signal ${signal}`);
      
      // Reject all pending requests
      Array.from(session.pendingRequests.values()).forEach(pending => {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`Process exited with code ${code}`));
      });
      session.pendingRequests.clear();
    });

    process.on('error', (error) => {
      this.logs.push(`[${new Date().toISOString()}] Process error: ${error.message}`);
    });

    sessions.set(sessionId, session);

    // Initialize the MCP connection
    await this.initializeSession(session);

    return session;
  }

  /**
   * Process the buffer for complete JSON-RPC messages
   */
  private processBuffer(session: McpSession): void {
    // MCP uses newline-delimited JSON
    const lines = session.buffer.split('\n');
    
    // Keep the last incomplete line in the buffer
    session.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const response = JSON.parse(trimmed) as JsonRpcResponse;
        
        if (response.id !== undefined) {
          const pending = session.pendingRequests.get(response.id);
          if (pending) {
            clearTimeout(pending.timeout);
            session.pendingRequests.delete(response.id);

            if (response.error) {
              pending.reject(new McpRpcError(
                response.error.message,
                response.error.code,
                response.error.data
              ));
            } else {
              pending.resolve(response.result);
            }
          }
        }
      } catch {
        // Not valid JSON, might be regular log output
        this.logs.push(`[${new Date().toISOString()}] Non-JSON output: ${trimmed}`);
      }
    }
  }

  /**
   * Initialize MCP session with initialize/initialized handshake
   */
  private async initializeSession(session: McpSession): Promise<void> {
    // Send initialize request
    const initResult = await this.sendRequest<{ capabilities: unknown }>(session, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: false },
        sampling: {},
      },
      clientInfo: {
        name: 'github-to-mcp-playground',
        version: '1.0.0',
      },
    }, INIT_TIMEOUT_MS);

    this.logs.push(`[${new Date().toISOString()}] Initialize response: ${JSON.stringify(initResult)}`);

    // Send initialized notification
    this.sendNotification(session, 'notifications/initialized', {});

    session.initialized = true;
    this.logs.push(`[${new Date().toISOString()}] Session initialized successfully`);
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private sendRequest<T>(
    session: McpSession,
    method: string,
    params?: Record<string, unknown>,
    timeout: number = REQUEST_TIMEOUT_MS
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++session.requestId;
      
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const timeoutHandle = setTimeout(() => {
        session.pendingRequests.delete(id);
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);

      session.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });

      const message = JSON.stringify(request) + '\n';
      this.logs.push(`[${new Date().toISOString()}] Sending: ${message.trim()}`);
      
      session.process.stdin?.write(message, (error) => {
        if (error) {
          session.pendingRequests.delete(id);
          clearTimeout(timeoutHandle);
          reject(new Error(`Failed to send request: ${error.message}`));
        }
      });
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private sendNotification(
    session: McpSession,
    method: string,
    params?: Record<string, unknown>
  ): void {
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const message = JSON.stringify(notification) + '\n';
    this.logs.push(`[${new Date().toISOString()}] Sending notification: ${message.trim()}`);
    session.process.stdin?.write(message);
  }

  /**
   * Connect to MCP server and return session with tools
   * This creates a persistent session that can be reused for tool execution
   */
  async connect(generatedCode: string): Promise<{
    success: boolean;
    sessionId: string;
    tools?: McpTool[];
    error?: string;
  }> {
    try {
      const session = await this.getOrCreateSession(generatedCode);
      resetSessionTimeout(session);

      // List available tools
      const result = await this.sendRequest<{ tools: McpTool[] }>(
        session,
        'tools/list',
        {}
      );

      return {
        success: true,
        sessionId: session.id,
        tools: result.tools || [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      return {
        success: false,
        sessionId: '',
        error: message,
      };
    }
  }

  /**
   * List tools available in the MCP server
   */
  async listTools(generatedCode: string, sessionId?: string): Promise<ListToolsResponse> {
    const startTime = Date.now();

    try {
      const session = await this.getOrCreateSession(generatedCode, sessionId);
      resetSessionTimeout(session);

      const result = await this.sendRequest<{ tools: McpTool[] }>(
        session,
        'tools/list',
        {}
      );

      return {
        success: true,
        tools: result.tools || [],
        sessionId: session.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: message,
        sessionId: sessionId || '',
      };
    }
  }

  /**
   * Execute a tool in the MCP server
   */
  async executeTool(request: ExecuteToolRequest): Promise<ExecuteToolResponse> {
    const startTime = Date.now();
    this.logs = []; // Reset logs for this execution

    try {
      const session = await this.getOrCreateSession(request.generatedCode, request.sessionId);
      resetSessionTimeout(session);

      const result = await this.sendRequest<{ content: unknown[] }>(
        session,
        'tools/call',
        {
          name: request.toolName,
          arguments: request.toolParams,
        }
      );

      return {
        success: true,
        result: result.content,
        sessionId: session.id,
        executionTime: Date.now() - startTime,
        logs: this.logs,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof McpRpcError) {
        return {
          success: false,
          error: error.message,
          errorDetails: {
            code: error.code,
            data: error.data,
          },
          sessionId: request.sessionId || '',
          executionTime,
          logs: this.logs,
        };
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;

      return {
        success: false,
        error: message,
        errorDetails: { stack },
        sessionId: request.sessionId || '',
        executionTime,
        logs: this.logs,
      };
    }
  }

  /**
   * Get all active sessions
   */
  static getAllSessions(): Array<{
    id: string;
    createdAt: Date;
    lastUsed: Date;
    initialized: boolean;
  }> {
    return Array.from(sessions.values()).map(session => ({
      id: session.id,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
      initialized: session.initialized,
    }));
  }

  /**
   * Delete a specific session
   */
  static deleteSession(sessionId: string): boolean {
    if (sessions.has(sessionId)) {
      cleanupSession(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Delete all sessions
   */
  static deleteAllSessions(): number {
    const count = sessions.size;
    Array.from(sessions.keys()).forEach(sessionId => {
      cleanupSession(sessionId);
    });
    return count;
  }
}

// ============================================================================
// Custom Error Classes
// ============================================================================

export class McpRpcError extends Error {
  code: number;
  data?: unknown;

  constructor(message: string, code: number, data?: unknown) {
    super(message);
    this.name = 'McpRpcError';
    this.code = code;
    this.data = data;
  }
}

export class McpTimeoutError extends Error {
  constructor(message: string = 'MCP request timed out') {
    super(message);
    this.name = 'McpTimeoutError';
  }
}

export class McpProcessError extends Error {
  exitCode?: number;
  signal?: string;

  constructor(message: string, exitCode?: number, signal?: string) {
    super(message);
    this.name = 'McpProcessError';
    this.exitCode = exitCode;
    this.signal = signal;
  }
}
