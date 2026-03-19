/**
 * MCP Server Mode - Expose all Clodds skills as MCP tools via stdio
 *
 * Reads JSON-RPC from stdin, writes to stdout, logs to stderr.
 * Protocol version: 2024-11-05
 */

import { createInterface } from 'readline';
import type { JsonRpcRequest, JsonRpcResponse, McpTool } from './index.js';
import {
  loadSecurityConfig,
  isToolAllowed,
  filterTools,
  checkRateLimit,
  sanitizeToolArgs,
  logAudit,
  type McpSecurityConfig,
} from './security.js';

// =============================================================================
// TYPES
// =============================================================================

interface McpServerCapabilities {
  tools?: Record<string, never>;
}

interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpServerCapabilities;
  serverInfo: { name: string; version: string };
}

// =============================================================================
// HELPERS
// =============================================================================

function sendResponse(res: JsonRpcResponse): void {
  const json = JSON.stringify(res);
  process.stdout.write(json + '\n');
}

function errorResponse(id: string | number | undefined, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// =============================================================================
// SKILL LOADER (lazy)
// =============================================================================

let securityConfig: McpSecurityConfig;
let skillManifest: string[] | null = null;
let executeSkill: ((msg: string) => Promise<{ handled: boolean; response?: string; error?: string }>) | null = null;

async function ensureSkills(): Promise<void> {
  if (skillManifest && executeSkill) return;
  const executor = await import('../skills/executor.js');
  skillManifest = executor.getSkillManifest();
  executeSkill = executor.executeSkillCommand;
}

// =============================================================================
// TOOL MAPPING
// =============================================================================

async function listTools(): Promise<McpTool[]> {
  await ensureSkills();
  return skillManifest!.map((name) => ({
    name: `clodds_${name.replace(/-/g, '_')}`,
    description: `Clodds skill: ${name}`,
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'string', description: 'Arguments to pass to the skill command' },
      },
    },
  }));
}

async function callTool(toolName: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  await ensureSkills();

  // clodds_trading_polymarket → trading-polymarket
  const skillName = toolName.replace(/^clodds_/, '').replace(/_/g, '-');
  const skillArgs = typeof args.args === 'string' ? args.args : '';

  // Build command string like "/trading-polymarket balance"
  const command = `/${skillName} ${skillArgs}`.trim();

  const result = await executeSkill!(command);

  if (!result.handled) {
    return {
      content: [{ type: 'text', text: `Unknown skill: ${skillName}` }],
      isError: true,
    };
  }

  if (result.error) {
    return {
      content: [{ type: 'text', text: result.error }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: result.response || '(no output)' }],
  };
}

// =============================================================================
// REQUEST HANDLER
// =============================================================================

async function handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  switch (req.method) {
    case 'initialize': {
      const result: McpInitializeResult = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'clodds', version: '0.1.0' },
      };
      return { jsonrpc: '2.0', id: req.id, result };
    }

    case 'notifications/initialized':
      // No response for notifications (no id)
      return null;

    case 'tools/list': {
      const tools = await listTools();
      const filtered = filterTools(tools, securityConfig);
      return { jsonrpc: '2.0', id: req.id, result: { tools: filtered } };
    }

    case 'tools/call': {
      const params = req.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      if (!params?.name) {
        return errorResponse(req.id, -32602, 'Missing tool name');
      }

      const toolName = params.name;
      const toolArgs = params.arguments ?? {};
      const clientId = 'stdio'; // single client for stdio transport
      const start = Date.now();

      // Security pipeline
      if (!isToolAllowed(toolName, securityConfig)) {
        logAudit({ tool: toolName, clientId, timestamp: start, durationMs: 0, success: false, error: 'blocked' }, securityConfig);
        return errorResponse(req.id, -32600, `Tool not allowed: ${toolName}`);
      }

      const rateLimitMsg = checkRateLimit(clientId, securityConfig);
      if (rateLimitMsg) {
        logAudit({ tool: toolName, clientId, timestamp: start, durationMs: 0, success: false, error: 'rate_limited' }, securityConfig);
        return errorResponse(req.id, -32000, rateLimitMsg);
      }

      const injectionMsg = sanitizeToolArgs(toolArgs);
      if (injectionMsg) {
        logAudit({ tool: toolName, clientId, timestamp: start, durationMs: 0, success: false, error: 'injection' }, securityConfig);
        return errorResponse(req.id, -32602, injectionMsg);
      }

      const TOOL_TIMEOUT_MS = Number(process.env.CLODDS_MCP_TOOL_TIMEOUT_MS || 30000);
      let toolResult: Awaited<ReturnType<typeof callTool>>;
      try {
        toolResult = await Promise.race([
          callTool(toolName, toolArgs),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Tool execution timed out after ${TOOL_TIMEOUT_MS}ms`)), TOOL_TIMEOUT_MS)
          ),
        ]);
      } catch (err: any) {
        const durationMs = Date.now() - start;
        logAudit({ tool: toolName, clientId, timestamp: start, durationMs, success: false, error: err.message }, securityConfig);
        return errorResponse(req.id, -32603, err.message || 'Tool execution failed');
      }
      const durationMs = Date.now() - start;
      logAudit({ tool: toolName, clientId, timestamp: start, durationMs, success: !toolResult.isError }, securityConfig);
      return { jsonrpc: '2.0', id: req.id, result: toolResult };
    }

    default:
      return errorResponse(req.id, -32601, `Method not found: ${req.method}`);
  }
}

// =============================================================================
// STDIO TRANSPORT
// =============================================================================

export async function startMcpServer(): Promise<void> {
  securityConfig = loadSecurityConfig();

  // Redirect log output to stderr so stdout is clean for JSON-RPC
  process.env.LOG_LEVEL = 'silent';

  const rl = createInterface({ input: process.stdin, terminal: false });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      sendResponse(errorResponse(undefined, -32700, 'Parse error'));
      return;
    }

    // Validate JSON-RPC 2.0 envelope
    if (parsed.jsonrpc !== '2.0' || typeof parsed.method !== 'string') {
      sendResponse(errorResponse(parsed.id, -32600, 'Invalid Request: missing jsonrpc "2.0" or method'));
      return;
    }

    const req: JsonRpcRequest = parsed;

    try {
      const response = await handleRequest(req);
      if (response) sendResponse(response);
    } catch (err: any) {
      sendResponse(errorResponse(req.id, -32603, err.message || 'Internal error'));
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });

  // Signal readiness via stderr
  process.stderr.write('Clodds MCP server started (stdio)\n');
}
