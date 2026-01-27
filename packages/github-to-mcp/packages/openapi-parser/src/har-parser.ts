/**
 * @fileoverview HAR (HTTP Archive) file parser
 * Reverse-engineers API definitions from captured HTTP traffic
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/** Maximum length for a numeric ID segment to be considered a path parameter */
const MAX_NUMERIC_ID_LENGTH = 20;

/** Maximum length for Base64-like ID segments to be considered path parameters */
const MAX_BASE64_ID_LENGTH = 50;

export interface HarFile {
  log: {
    version: string;
    creator: HarCreator;
    browser?: HarBrowser;
    pages?: HarPage[];
    entries: HarEntry[];
  };
}

export interface HarCreator {
  name: string;
  version: string;
}

export interface HarBrowser {
  name: string;
  version: string;
}

export interface HarPage {
  id: string;
  startedDateTime: string;
  title: string;
  pageTimings?: any;
}

export interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache?: any;
  timings?: any;
  serverIPAddress?: string;
  connection?: string;
  pageref?: string;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  queryString: HarQueryParam[];
  postData?: HarPostData;
  headersSize: number;
  bodySize: number;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
}

export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface HarHeader {
  name: string;
  value: string;
}

export interface HarQueryParam {
  name: string;
  value: string;
}

export interface HarPostData {
  mimeType: string;
  text?: string;
  params?: Array<{ name: string; value?: string; fileName?: string; contentType?: string }>;
}

export interface HarContent {
  size: number;
  mimeType: string;
  text?: string;
  encoding?: string;
  compression?: number;
}

export interface HarEndpointGroup {
  pattern: string;
  method: string;
  entries: HarEntry[];
  pathParams: string[];
  queryParams: Set<string>;
  requestBodyExamples: any[];
  responseBodyExamples: any[];
  headers: Map<string, Set<string>>;
  authPatterns: Set<string>;
  statusCodes: Set<number>;
}

export interface HarToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  metadata: {
    endpoint: {
      path: string;
      method: string;
    };
    confidence: 'high' | 'medium' | 'low';
    sampleCount: number;
    statusCodes: number[];
    auth?: {
      type: string;
      envVar?: string;
    };
  };
  examples?: Array<{ input?: any; output?: any }>;
}

export interface HarParseResult {
  format: 'har';
  info: {
    creator: string;
    browser?: string;
    entryCount: number;
    endpointCount: number;
  };
  tools: HarToolDefinition[];
}

/**
 * Parser for HAR (HTTP Archive) files
 * Reverse-engineers APIs from captured traffic
 */
export class HarParser {
  private har: HarFile | null = null;
  private endpoints: Map<string, HarEndpointGroup> = new Map();

  /**
   * Parse HAR file from JSON string
   */
  parse(input: string): HarFile {
    try {
      this.har = JSON.parse(input);
    } catch (error) {
      throw new Error(`Failed to parse HAR file: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }

    if (!this.isValidHar(this.har)) {
      throw new Error('Invalid HAR file: missing required fields');
    }

    this.analyzeEntries(this.har.log.entries);
    return this.har;
  }

  /**
   * Parse from object (already loaded)
   */
  parseObject(har: HarFile): HarFile {
    if (!this.isValidHar(har)) {
      throw new Error('Invalid HAR file: missing required fields');
    }

    this.har = har;
    this.analyzeEntries(har.log.entries);
    return har;
  }

  /**
   * Validate HAR structure
   */
  private isValidHar(har: any): har is HarFile {
    return (
      har &&
      typeof har.log === 'object' &&
      typeof har.log.version === 'string' &&
      Array.isArray(har.log.entries)
    );
  }

  /**
   * Analyze entries and group by endpoint pattern
   */
  private analyzeEntries(entries: HarEntry[]): void {
    this.endpoints.clear();

    for (const entry of entries) {
      // Skip non-API requests
      if (!this.isApiRequest(entry)) continue;

      const { pattern, pathParams } = this.extractEndpointPattern(entry.request.url);
      const key = `${entry.request.method}:${pattern}`;

      if (!this.endpoints.has(key)) {
        this.endpoints.set(key, {
          pattern,
          method: entry.request.method,
          entries: [],
          pathParams,
          queryParams: new Set(),
          requestBodyExamples: [],
          responseBodyExamples: [],
          headers: new Map(),
          authPatterns: new Set(),
          statusCodes: new Set(),
        });
      }

      const group = this.endpoints.get(key)!;
      group.entries.push(entry);
      group.statusCodes.add(entry.response.status);

      // Collect query parameters
      for (const param of entry.request.queryString) {
        group.queryParams.add(param.name);
      }

      // Collect headers
      for (const header of entry.request.headers) {
        const lowerName = header.name.toLowerCase();
        if (!group.headers.has(lowerName)) {
          group.headers.set(lowerName, new Set());
        }
        group.headers.get(lowerName)!.add(header.value);
      }

      // Detect auth patterns
      this.detectAuthPattern(entry, group);

      // Collect request body examples
      if (entry.request.postData?.text) {
        try {
          const body = JSON.parse(entry.request.postData.text);
          group.requestBodyExamples.push(body);
        } catch {
          // Ignore non-JSON
        }
      }

      // Collect response body examples
      if (entry.response.content.text) {
        try {
          const body = JSON.parse(entry.response.content.text);
          group.responseBodyExamples.push(body);
        } catch {
          // Ignore non-JSON
        }
      }
    }
  }

  /**
   * Check if entry is likely an API request
   */
  private isApiRequest(entry: HarEntry): boolean {
    const contentType = entry.response.content.mimeType || '';
    const url = entry.request.url;

    // Include JSON/XML responses
    if (contentType.includes('json') || contentType.includes('xml')) {
      return true;
    }

    // Exclude common static assets
    const staticExtensions = ['.js', '.css', '.html', '.png', '.jpg', '.gif', '.ico', '.svg', '.woff', '.ttf'];
    if (staticExtensions.some(ext => url.toLowerCase().endsWith(ext))) {
      return false;
    }

    // Include if URL contains common API patterns
    const apiPatterns = ['/api/', '/v1/', '/v2/', '/v3/', '/rest/', '/graphql'];
    if (apiPatterns.some(pattern => url.includes(pattern))) {
      return true;
    }

    // Include POST, PUT, PATCH, DELETE by default
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(entry.request.method)) {
      return true;
    }

    return false;
  }

  /**
   * Extract endpoint pattern from URL (detect path parameters)
   */
  private extractEndpointPattern(urlString: string): { pattern: string; pathParams: string[] } {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return { pattern: urlString, pathParams: [] };
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    const pathParams: string[] = [];
    const patternParts: string[] = [];

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      // Detect path parameters (UUIDs, numeric IDs, etc.)
      if (this.isLikelyPathParam(part)) {
        const paramName = this.guessParamName(pathParts, i);
        pathParams.push(paramName);
        patternParts.push(`{${paramName}}`);
      } else {
        patternParts.push(part);
      }
    }

    return {
      pattern: '/' + patternParts.join('/'),
      pathParams,
    };
  }

  /**
   * Check if path segment is likely a parameter
   */
  private isLikelyPathParam(segment: string): boolean {
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
      return true;
    }

    // Numeric ID
    if (/^\d+$/.test(segment) && segment.length <= MAX_NUMERIC_ID_LENGTH) {
      return true;
    }

    // Short alphanumeric ID (like GitHub's short SHA)
    if (/^[a-f0-9]{7,40}$/i.test(segment)) {
      return true;
    }

    // Base64-like strings (common for encoded IDs)
    if (/^[A-Za-z0-9_-]{20,}$/.test(segment) && segment.length <= MAX_BASE64_ID_LENGTH) {
      return true;
    }

    return false;
  }

  /**
   * Guess parameter name from context
   */
  private guessParamName(pathParts: string[], index: number): string {
    // Use previous segment as hint
    if (index > 0) {
      const prev = pathParts[index - 1];
      // Common patterns: /users/123, /posts/abc
      if (prev.endsWith('s')) {
        return prev.slice(0, -1) + '_id';
      }
      return prev + '_id';
    }
    return 'id';
  }

  /**
   * Detect authentication pattern from entry
   */
  private detectAuthPattern(entry: HarEntry, group: HarEndpointGroup): void {
    const headers = entry.request.headers;

    for (const header of headers) {
      const name = header.name.toLowerCase();
      const value = header.value;

      if (name === 'authorization') {
        if (value.toLowerCase().startsWith('bearer ')) {
          group.authPatterns.add('bearer');
        } else if (value.toLowerCase().startsWith('basic ')) {
          group.authPatterns.add('basic');
        } else if (value.toLowerCase().startsWith('apikey ')) {
          group.authPatterns.add('apikey');
        }
      } else if (name === 'x-api-key' || name === 'api-key') {
        group.authPatterns.add('apikey');
      }
    }

    // Check cookies for session tokens
    if (entry.request.cookies.length > 0) {
      const sessionCookies = entry.request.cookies.filter(c => 
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('auth')
      );
      if (sessionCookies.length > 0) {
        group.authPatterns.add('cookie');
      }
    }
  }

  /**
   * Convert to MCP tool definitions
   */
  toMcpTools(): HarToolDefinition[] {
    const tools: HarToolDefinition[] = [];

    for (const group of this.endpoints.values()) {
      // Skip endpoints with too few samples
      if (group.entries.length < 1) continue;

      const tool = this.groupToTool(group);
      tools.push(tool);
    }

    return tools;
  }

  /**
   * Convert endpoint group to MCP tool
   */
  private groupToTool(group: HarEndpointGroup): HarToolDefinition {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add path parameters
    for (const param of group.pathParams) {
      properties[param] = {
        type: 'string',
        description: `Path parameter: ${param}`,
      };
      required.push(param);
    }

    // Add query parameters (infer from all samples)
    for (const param of group.queryParams) {
      properties[param] = {
        type: 'string',
        description: `Query parameter: ${param}`,
      };
    }

    // Infer body schema from examples
    if (group.requestBodyExamples.length > 0) {
      const bodySchema = this.mergeSchemas(
        group.requestBodyExamples.map(ex => this.inferSchemaFromExample(ex))
      );
      
      if (bodySchema.properties && Object.keys(bodySchema.properties).length <= 5) {
        Object.assign(properties, bodySchema.properties);
      } else {
        properties.body = bodySchema;
        required.push('body');
      }
    }

    // Determine confidence level
    const confidence = this.calculateConfidence(group);

    // Determine auth
    const auth = this.extractAuth(group.authPatterns);

    // Extract examples
    const examples = this.extractExamples(group);

    return {
      name: this.generateToolName(group.method, group.pattern),
      description: this.generateDescription(group),
      inputSchema: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      },
      metadata: {
        endpoint: {
          path: group.pattern,
          method: group.method,
        },
        confidence,
        sampleCount: group.entries.length,
        statusCodes: Array.from(group.statusCodes),
        auth,
      },
      examples: examples.length > 0 ? examples : undefined,
    };
  }

  /**
   * Infer JSON Schema from example value
   */
  private inferSchemaFromExample(value: any): any {
    if (value === null) {
      return { type: 'null' };
    }

    if (Array.isArray(value)) {
      return {
        type: 'array',
        items: value.length > 0 ? this.inferSchemaFromExample(value[0]) : {},
      };
    }

    if (typeof value === 'object') {
      const properties: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        properties[key] = this.inferSchemaFromExample(val);
      }
      return { type: 'object', properties };
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
    }

    if (typeof value === 'boolean') {
      return { type: 'boolean' };
    }

    return { type: 'string' };
  }

  /**
   * Merge multiple schemas into one
   */
  private mergeSchemas(schemas: any[]): any {
    if (schemas.length === 0) return { type: 'object', properties: {} };
    if (schemas.length === 1) return schemas[0];

    const merged: any = { type: 'object', properties: {} };

    for (const schema of schemas) {
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          if (!merged.properties[key]) {
            merged.properties[key] = value;
          }
          // Could merge types here for more accuracy
        }
      }
    }

    return merged;
  }

  /**
   * Calculate confidence level based on data quality
   */
  private calculateConfidence(group: HarEndpointGroup): 'high' | 'medium' | 'low' {
    let score = 0;

    // More samples = higher confidence
    if (group.entries.length >= 10) score += 3;
    else if (group.entries.length >= 5) score += 2;
    else if (group.entries.length >= 2) score += 1;

    // Has successful responses
    if (group.statusCodes.has(200) || group.statusCodes.has(201)) score += 2;

    // Has consistent structure
    if (group.requestBodyExamples.length >= 2) score += 1;
    if (group.responseBodyExamples.length >= 2) score += 1;

    // Clear auth pattern
    if (group.authPatterns.size > 0) score += 1;

    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Extract auth info
   */
  private extractAuth(patterns: Set<string>): { type: string; envVar?: string } | undefined {
    if (patterns.size === 0) return undefined;

    const pattern = patterns.values().next().value as string;
    const authMappings: Record<string, { type: string; envVar: string }> = {
      bearer: { type: 'bearer', envVar: 'API_TOKEN' },
      basic: { type: 'basic', envVar: 'API_BASIC_AUTH' },
      apikey: { type: 'apiKey', envVar: 'API_KEY' },
      cookie: { type: 'cookie', envVar: 'SESSION_COOKIE' },
    };

    return authMappings[pattern] || { type: pattern };
  }

  /**
   * Extract examples from group
   */
  private extractExamples(group: HarEndpointGroup): Array<{ input?: any; output?: any }> {
    const examples: Array<{ input?: any; output?: any }> = [];

    // Take up to 3 examples
    const count = Math.min(3, group.entries.length);
    for (let i = 0; i < count; i++) {
      const entry = group.entries[i];
      const example: { input?: any; output?: any } = {};

      if (group.requestBodyExamples[i]) {
        example.input = group.requestBodyExamples[i];
      }
      if (group.responseBodyExamples[i]) {
        example.output = group.responseBodyExamples[i];
      }

      if (example.input || example.output) {
        examples.push(example);
      }
    }

    return examples;
  }

  /**
   * Generate tool name from method and pattern
   */
  private generateToolName(method: string, pattern: string): string {
    const pathParts = pattern
      .split('/')
      .filter(Boolean)
      .filter(part => !part.startsWith('{'))
      .join('_');

    return this.toSnakeCase(`${method.toLowerCase()}_${pathParts}`);
  }

  /**
   * Generate description from group data
   */
  private generateDescription(group: HarEndpointGroup): string {
    const actionWords: Record<string, string> = {
      GET: 'Get',
      POST: 'Create',
      PUT: 'Update',
      PATCH: 'Modify',
      DELETE: 'Delete',
    };

    const action = actionWords[group.method] || group.method;
    const resource = group.pattern
      .split('/')
      .filter(Boolean)
      .filter(part => !part.startsWith('{'))
      .pop() || 'resource';

    return `${action} ${resource} (inferred from ${group.entries.length} captured request${group.entries.length > 1 ? 's' : ''})`;
  }

  /**
   * Convert string to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/[_]+/g, '_')
      .replace(/^_/, '')
      .replace(/_$/, '');
  }

  /**
   * Get complete parse result
   */
  getParseResult(): HarParseResult {
    if (!this.har) {
      throw new Error('No HAR file parsed. Call parse() first.');
    }

    return {
      format: 'har',
      info: {
        creator: `${this.har.log.creator.name} ${this.har.log.creator.version}`,
        browser: this.har.log.browser 
          ? `${this.har.log.browser.name} ${this.har.log.browser.version}` 
          : undefined,
        entryCount: this.har.log.entries.length,
        endpointCount: this.endpoints.size,
      },
      tools: this.toMcpTools(),
    };
  }
}

/**
 * Convenience function to parse HAR file
 */
export function parseHAR(input: string | object): HarParseResult {
  const parser = new HarParser();

  if (typeof input === 'string') {
    parser.parse(input);
  } else {
    parser.parseObject(input as HarFile);
  }

  return parser.getParseResult();
}
