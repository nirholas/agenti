/**
 * API Validation Utilities
 *
 * Provides validation functions for playground API routes.
 * All validators throw ValidationError with descriptive messages.
 */

import { ValidationError } from './errors';

// Transport configuration types
export type TransportType = 'stdio' | 'sse' | 'http';

export interface StdioTransportConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface SseTransportConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export interface HttpTransportConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export type TransportConfig =
  | StdioTransportConfig
  | SseTransportConfig
  | HttpTransportConfig;

/**
 * Validates and returns a typed transport configuration
 */
export function validateTransportConfig(body: unknown): TransportConfig {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const data = body as Record<string, unknown>;

  if (!data.transport || typeof data.transport !== 'object') {
    throw new ValidationError('Missing or invalid transport configuration');
  }

  const transport = data.transport as Record<string, unknown>;

  if (!transport.type || typeof transport.type !== 'string') {
    throw new ValidationError('Transport type is required');
  }

  const transportType = transport.type as string;

  if (!['stdio', 'sse', 'http'].includes(transportType)) {
    throw new ValidationError(
      `Invalid transport type: ${transportType}. Must be one of: stdio, sse, http`
    );
  }

  switch (transportType) {
    case 'stdio':
      return validateStdioTransport(transport);
    case 'sse':
      return validateSseTransport(transport);
    case 'http':
      return validateHttpTransport(transport);
    default:
      throw new ValidationError(`Unknown transport type: ${transportType}`);
  }
}

function validateStdioTransport(
  transport: Record<string, unknown>
): StdioTransportConfig {
  if (!transport.command || typeof transport.command !== 'string') {
    throw new ValidationError(
      'stdio transport requires a command string'
    );
  }

  const config: StdioTransportConfig = {
    type: 'stdio',
    command: transport.command,
  };

  if (transport.args !== undefined) {
    if (
      !Array.isArray(transport.args) ||
      !transport.args.every((a) => typeof a === 'string')
    ) {
      throw new ValidationError('args must be an array of strings');
    }
    config.args = transport.args;
  }

  if (transport.env !== undefined) {
    if (
      typeof transport.env !== 'object' ||
      transport.env === null ||
      Array.isArray(transport.env)
    ) {
      throw new ValidationError('env must be an object');
    }
    const env = transport.env as Record<string, unknown>;
    for (const [key, value] of Object.entries(env)) {
      if (typeof value !== 'string') {
        throw new ValidationError(`env.${key} must be a string`);
      }
    }
    config.env = env as Record<string, string>;
  }

  if (transport.cwd !== undefined) {
    if (typeof transport.cwd !== 'string') {
      throw new ValidationError('cwd must be a string');
    }
    config.cwd = transport.cwd;
  }

  return config;
}

function validateSseTransport(
  transport: Record<string, unknown>
): SseTransportConfig {
  if (!transport.url || typeof transport.url !== 'string') {
    throw new ValidationError('sse transport requires a url string');
  }

  if (!isValidUrl(transport.url)) {
    throw new ValidationError('sse transport url must be a valid URL');
  }

  const config: SseTransportConfig = {
    type: 'sse',
    url: transport.url,
  };

  if (transport.headers !== undefined) {
    config.headers = validateHeaders(transport.headers);
  }

  return config;
}

function validateHttpTransport(
  transport: Record<string, unknown>
): HttpTransportConfig {
  if (!transport.url || typeof transport.url !== 'string') {
    throw new ValidationError('http transport requires a url string');
  }

  if (!isValidUrl(transport.url)) {
    throw new ValidationError('http transport url must be a valid URL');
  }

  const config: HttpTransportConfig = {
    type: 'http',
    url: transport.url,
  };

  if (transport.headers !== undefined) {
    config.headers = validateHeaders(transport.headers);
  }

  return config;
}

function validateHeaders(headers: unknown): Record<string, string> {
  if (
    typeof headers !== 'object' ||
    headers === null ||
    Array.isArray(headers)
  ) {
    throw new ValidationError('headers must be an object');
  }

  const headersObj = headers as Record<string, unknown>;
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headersObj)) {
    if (typeof value !== 'string') {
      throw new ValidationError(`header "${key}" must be a string`);
    }
    result[key] = value;
  }

  return result;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validates a tool call request
 */
export function validateToolCall(body: unknown): {
  toolName: string;
  params: Record<string, unknown>;
  sessionId: string;
} {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const data = body as Record<string, unknown>;

  if (!data.sessionId || typeof data.sessionId !== 'string') {
    throw new ValidationError('sessionId is required and must be a string');
  }

  if (!data.toolName || typeof data.toolName !== 'string') {
    throw new ValidationError('toolName is required and must be a string');
  }

  if (data.toolName.length === 0) {
    throw new ValidationError('toolName cannot be empty');
  }

  // Validate tool name format (alphanumeric, underscores, hyphens)
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(data.toolName)) {
    throw new ValidationError(
      'toolName must start with a letter and contain only alphanumeric characters, underscores, and hyphens'
    );
  }

  let params: Record<string, unknown> = {};
  if (data.params !== undefined) {
    if (
      typeof data.params !== 'object' ||
      data.params === null ||
      Array.isArray(data.params)
    ) {
      throw new ValidationError('params must be an object');
    }
    params = data.params as Record<string, unknown>;
  }

  return {
    sessionId: data.sessionId,
    toolName: data.toolName,
    params,
  };
}

/**
 * Validates a resource read request
 */
export function validateResourceRead(body: unknown): {
  uri: string;
  sessionId: string;
} {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const data = body as Record<string, unknown>;

  if (!data.sessionId || typeof data.sessionId !== 'string') {
    throw new ValidationError('sessionId is required and must be a string');
  }

  if (!data.uri || typeof data.uri !== 'string') {
    throw new ValidationError('uri is required and must be a string');
  }

  if (data.uri.length === 0) {
    throw new ValidationError('uri cannot be empty');
  }

  // Basic URI validation - should have a scheme
  if (!data.uri.includes(':')) {
    throw new ValidationError('uri must be a valid URI with a scheme');
  }

  return {
    sessionId: data.sessionId,
    uri: data.uri,
  };
}

/**
 * Validates a prompt get request
 */
export function validatePromptGet(body: unknown): {
  name: string;
  args?: Record<string, string>;
  sessionId: string;
} {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const data = body as Record<string, unknown>;

  if (!data.sessionId || typeof data.sessionId !== 'string') {
    throw new ValidationError('sessionId is required and must be a string');
  }

  if (!data.name || typeof data.name !== 'string') {
    throw new ValidationError('name is required and must be a string');
  }

  if (data.name.length === 0) {
    throw new ValidationError('name cannot be empty');
  }

  // Validate prompt name format
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(data.name)) {
    throw new ValidationError(
      'name must start with a letter and contain only alphanumeric characters, underscores, and hyphens'
    );
  }

  const result: {
    name: string;
    args?: Record<string, string>;
    sessionId: string;
  } = {
    sessionId: data.sessionId,
    name: data.name,
  };

  if (data.args !== undefined) {
    if (
      typeof data.args !== 'object' ||
      data.args === null ||
      Array.isArray(data.args)
    ) {
      throw new ValidationError('args must be an object');
    }

    const args = data.args as Record<string, unknown>;
    const validatedArgs: Record<string, string> = {};

    for (const [key, value] of Object.entries(args)) {
      if (typeof value !== 'string') {
        throw new ValidationError(`args.${key} must be a string`);
      }
      validatedArgs[key] = value;
    }

    result.args = validatedArgs;
  }

  return result;
}

/**
 * Validates and extracts session ID from request
 */
export function validateSessionId(body: unknown): string {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const data = body as Record<string, unknown>;

  if (!data.sessionId || typeof data.sessionId !== 'string') {
    throw new ValidationError('sessionId is required and must be a string');
  }

  if (data.sessionId.length === 0) {
    throw new ValidationError('sessionId cannot be empty');
  }

  return data.sessionId;
}

/**
 * Validates session ID from query parameters
 */
export function validateSessionIdFromQuery(
  searchParams: URLSearchParams
): string {
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    throw new ValidationError('sessionId query parameter is required');
  }

  if (sessionId.length === 0) {
    throw new ValidationError('sessionId cannot be empty');
  }

  return sessionId;
}

// Dangerous patterns to detect in code
const DANGEROUS_PATTERNS = [
  // Shell injection
  /\$\(.*\)/,
  /`[^`]*`/,
  /;\s*(rm|mv|cp|chmod|chown|kill|pkill|shutdown|reboot)\b/i,
  // File system access outside sandbox
  /\.\.\//,
  /\/etc\//,
  /\/root\//,
  /\/home\/(?!sandbox)/,
  // Network attacks
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /child_process/,
  // Process manipulation
  /process\.exit/,
  /process\.kill/,
  // Dangerous imports (for TypeScript/JavaScript)
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /from\s+['"]fs['"]/,
  /import\s+.*\s+from\s+['"]child_process['"]/,
  // Environment variable access
  /process\.env\./,
  // Infinite loops (basic detection)
  /while\s*\(\s*true\s*\)/,
  /for\s*\(\s*;\s*;\s*\)/,
];

// Allowed patterns that might look dangerous but are safe
const ALLOWED_PATTERNS = [
  // Common safe patterns
  /console\.log/,
  /JSON\.parse/,
  /JSON\.stringify/,
];

/**
 * Sanitizes code by removing dangerous patterns
 * Throws ValidationError if code contains unsafe constructs that cannot be sanitized
 */
export function sanitizeCode(code: string): string {
  if (typeof code !== 'string') {
    throw new ValidationError('Code must be a string');
  }

  // Check for truly dangerous patterns that cannot be sanitized
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      // Check if it's actually an allowed pattern
      let isAllowed = false;
      for (const allowedPattern of ALLOWED_PATTERNS) {
        if (allowedPattern.test(code)) {
          // More specific check - the dangerous pattern might be a false positive
          const match = code.match(pattern);
          if (match) {
            const matchStr = match[0];
            // If the match is part of an allowed pattern, skip
            for (const ap of ALLOWED_PATTERNS) {
              if (ap.test(matchStr)) {
                isAllowed = true;
                break;
              }
            }
          }
        }
      }

      if (!isAllowed) {
        throw new ValidationError(
          `Code contains potentially dangerous pattern: ${pattern.toString()}. ` +
            'This operation is not allowed for security reasons.'
        );
      }
    }
  }

  // Remove any null bytes
  let sanitized = code.replace(/\0/g, '');

  // Normalize line endings
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Limit code length
  const MAX_CODE_LENGTH = 100000; // 100KB
  if (sanitized.length > MAX_CODE_LENGTH) {
    throw new ValidationError(
      `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`
    );
  }

  return sanitized;
}

/**
 * Validates connect request body
 */
export function validateConnectRequest(body: unknown): {
  transport: TransportConfig;
  generatedCode?: string;
} {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const data = body as Record<string, unknown>;
  const transport = validateTransportConfig(body);

  const result: {
    transport: TransportConfig;
    generatedCode?: string;
  } = { transport };

  if (data.generatedCode !== undefined) {
    if (typeof data.generatedCode !== 'string') {
      throw new ValidationError('generatedCode must be a string');
    }
    result.generatedCode = sanitizeCode(data.generatedCode);
  }

  return result;
}
