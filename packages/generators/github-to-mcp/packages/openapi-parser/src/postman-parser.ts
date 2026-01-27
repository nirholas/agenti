/**
 * @fileoverview Postman Collection parser (v2.1 format)
 * Converts Postman collections to MCP tool definitions
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/** Maximum number of properties to flatten from request body (larger bodies are kept as nested 'body' property) */
const MAX_FLATTEN_PROPERTIES = 5;

export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
    _postman_id?: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

export interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[]; // For folders
  request?: PostmanRequest;
  response?: PostmanResponse[];
  event?: PostmanEvent[];
}

export interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  url: PostmanUrl | string;
  auth?: PostmanAuth;
  description?: string;
}

export interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQueryParam[];
  variable?: PostmanPathVariable[];
}

export interface PostmanQueryParam {
  key: string;
  value?: string;
  description?: string;
  disabled?: boolean;
}

export interface PostmanPathVariable {
  key: string;
  value?: string;
  description?: string;
}

export interface PostmanHeader {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql';
  raw?: string;
  urlencoded?: Array<{ key: string; value: string; description?: string; disabled?: boolean }>;
  formdata?: Array<{ key: string; value?: string; type?: string; description?: string; disabled?: boolean }>;
  graphql?: { query: string; variables?: string };
  options?: {
    raw?: { language: string };
  };
}

export interface PostmanAuth {
  type: 'apikey' | 'awsv4' | 'basic' | 'bearer' | 'digest' | 'hawk' | 'noauth' | 'oauth1' | 'oauth2' | 'ntlm';
  apikey?: Array<{ key: string; value: string }>;
  basic?: Array<{ key: string; value: string }>;
  bearer?: Array<{ key: string; value: string }>;
  oauth2?: Array<{ key: string; value: string }>;
}

export interface PostmanResponse {
  name: string;
  originalRequest?: PostmanRequest;
  status?: string;
  code?: number;
  header?: PostmanHeader[];
  body?: string;
  _postman_previewlanguage?: string;
}

export interface PostmanEvent {
  listen: 'prerequest' | 'test';
  script: {
    exec: string[];
    type: string;
  };
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
  description?: string;
}

export interface PostmanToolDefinition {
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
    folder?: string;
    auth?: {
      type: string;
      envVar?: string;
    };
    headers?: Record<string, string>;
  };
  examples?: Array<{ input?: any; output?: any }>;
}

export interface PostmanParseResult {
  format: 'postman';
  info: {
    name: string;
    description?: string;
  };
  tools: PostmanToolDefinition[];
  variables: Record<string, string>;
  auth?: { type: string };
}

/**
 * Parser for Postman Collection v2.1 format
 */
export class PostmanParser {
  private collection: PostmanCollection | null = null;
  private variables: Map<string, string> = new Map();

  /**
   * Parse Postman Collection from JSON string
   */
  parse(input: string): PostmanCollection {
    try {
      this.collection = JSON.parse(input);
    } catch (error) {
      throw new Error(`Failed to parse Postman collection: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }

    if (!this.isValidCollection(this.collection)) {
      throw new Error('Invalid Postman collection: missing required fields');
    }

    // Extract collection variables
    if (this.collection.variable) {
      for (const v of this.collection.variable) {
        this.variables.set(v.key, v.value);
      }
    }

    return this.collection;
  }

  /**
   * Parse from object (already loaded)
   */
  parseObject(collection: PostmanCollection): PostmanCollection {
    if (!this.isValidCollection(collection)) {
      throw new Error('Invalid Postman collection: missing required fields');
    }
    this.collection = collection;

    if (collection.variable) {
      for (const v of collection.variable) {
        this.variables.set(v.key, v.value);
      }
    }

    return collection;
  }

  /**
   * Validate collection structure
   */
  private isValidCollection(collection: any): collection is PostmanCollection {
    return (
      collection &&
      typeof collection.info === 'object' &&
      typeof collection.info.name === 'string' &&
      Array.isArray(collection.item)
    );
  }

  /**
   * Extract all requests recursively
   */
  extractRequests(folderPath: string = ''): Array<{ item: PostmanItem; folder: string }> {
    if (!this.collection) {
      throw new Error('No collection parsed. Call parse() first.');
    }

    const requests: Array<{ item: PostmanItem; folder: string }> = [];
    this.extractRequestsRecursive(this.collection.item, folderPath, requests);
    return requests;
  }

  /**
   * Recursively extract requests from items
   */
  private extractRequestsRecursive(
    items: PostmanItem[],
    currentPath: string,
    results: Array<{ item: PostmanItem; folder: string }>
  ): void {
    for (const item of items) {
      if (item.item) {
        // This is a folder
        const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        this.extractRequestsRecursive(item.item, newPath, results);
      } else if (item.request) {
        // This is a request
        results.push({ item, folder: currentPath });
      }
    }
  }

  /**
   * Convert to MCP tool definitions
   */
  toMcpTools(): PostmanToolDefinition[] {
    const requests = this.extractRequests();
    const tools: PostmanToolDefinition[] = [];

    for (const { item, folder } of requests) {
      const tool = this.requestToTool(item, folder);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * Convert a Postman request to an MCP tool
   */
  private requestToTool(item: PostmanItem, folder: string): PostmanToolDefinition | null {
    const request = item.request;
    if (!request) return null;

    const { path, queryParams, pathVariables } = this.parseUrl(request.url);
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add path variables
    for (const variable of pathVariables) {
      properties[variable.key] = {
        type: 'string',
        description: variable.description || `Path variable: ${variable.key}`,
      };
      required.push(variable.key);
    }

    // Add query parameters
    for (const param of queryParams) {
      if (param.disabled) continue;
      properties[param.key] = {
        type: 'string',
        description: param.description || undefined,
        default: param.value || undefined,
      };
    }

    // Add body schema
    if (request.body) {
      const bodySchema = this.parseBodySchema(request.body);
      if (bodySchema) {
        if (bodySchema.properties && Object.keys(bodySchema.properties).length <= MAX_FLATTEN_PROPERTIES) {
          // Flatten small bodies
          Object.assign(properties, bodySchema.properties);
          if (bodySchema.required) {
            required.push(...bodySchema.required);
          }
        } else {
          properties.body = bodySchema;
          required.push('body');
        }
      }
    }

    // Extract examples from responses
    const examples = this.extractExamples(item.response);

    // Determine auth
    const auth = this.extractAuth(request.auth || this.collection?.auth);

    return {
      name: this.generateToolName(item.name, folder),
      description: request.description || item.description || item.name,
      inputSchema: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      },
      metadata: {
        endpoint: {
          path,
          method: request.method,
        },
        folder: folder || undefined,
        auth,
        headers: this.extractHeaders(request.header),
      },
      examples: examples.length > 0 ? examples : undefined,
    };
  }

  /**
   * Parse Postman URL object
   */
  private parseUrl(url: PostmanUrl | string): {
    path: string;
    queryParams: PostmanQueryParam[];
    pathVariables: PostmanPathVariable[];
  } {
    if (typeof url === 'string') {
      return {
        path: this.replaceVariables(url),
        queryParams: [],
        pathVariables: [],
      };
    }

    let path = '';
    if (url.path) {
      path = '/' + url.path.map(p => this.replaceVariables(p)).join('/');
    } else if (url.raw) {
      const rawUrl = this.replaceVariables(url.raw);
      try {
        const parsed = new URL(rawUrl);
        path = parsed.pathname;
      } catch {
        path = rawUrl;
      }
    }

    return {
      path,
      queryParams: url.query || [],
      pathVariables: url.variable || [],
    };
  }

  /**
   * Replace collection variables in string
   */
  private replaceVariables(str: string): string {
    return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      return this.variables.get(key) || `{${key}}`;
    });
  }

  /**
   * Parse body schema from Postman body
   */
  private parseBodySchema(body: PostmanBody): any {
    if (body.mode === 'raw' && body.raw) {
      const language = body.options?.raw?.language || 'json';
      if (language === 'json') {
        try {
          const example = JSON.parse(body.raw);
          return this.inferSchemaFromExample(example);
        } catch {
          return { type: 'string' };
        }
      }
      return { type: 'string' };
    }

    if (body.mode === 'urlencoded' && body.urlencoded) {
      const properties: Record<string, any> = {};
      for (const param of body.urlencoded) {
        if (!param.disabled) {
          properties[param.key] = {
            type: 'string',
            description: param.description || undefined,
          };
        }
      }
      return { type: 'object', properties };
    }

    if (body.mode === 'formdata' && body.formdata) {
      const properties: Record<string, any> = {};
      for (const param of body.formdata) {
        if (!param.disabled) {
          properties[param.key] = {
            type: param.type === 'file' ? 'string' : 'string',
            format: param.type === 'file' ? 'binary' : undefined,
            description: param.description || undefined,
          };
        }
      }
      return { type: 'object', properties };
    }

    if (body.mode === 'graphql' && body.graphql) {
      return {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'GraphQL query' },
          variables: { type: 'object', description: 'GraphQL variables' },
        },
        required: ['query'],
      };
    }

    return null;
  }

  /**
   * Infer JSON Schema from example value
   */
  private inferSchemaFromExample(value: any): any {
    if (value === null) {
      return { type: 'null' };
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { type: 'array', items: {} };
      }
      return {
        type: 'array',
        items: this.inferSchemaFromExample(value[0]),
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
   * Extract examples from Postman responses
   */
  private extractExamples(responses?: PostmanResponse[]): Array<{ input?: any; output?: any }> {
    if (!responses) return [];

    const examples: Array<{ input?: any; output?: any }> = [];

    for (const response of responses) {
      if (response.body) {
        try {
          const output = JSON.parse(response.body);
          let input: any;

          // Try to extract input from original request
          if (response.originalRequest?.body?.raw) {
            try {
              input = JSON.parse(response.originalRequest.body.raw);
            } catch {
              // Ignore
            }
          }

          examples.push({ input, output });
        } catch {
          // Ignore non-JSON responses
        }
      }
    }

    return examples;
  }

  /**
   * Extract auth information
   */
  private extractAuth(auth?: PostmanAuth): { type: string; envVar?: string } | undefined {
    if (!auth) return undefined;

    const authMappings: Record<string, { type: string; envVar: string }> = {
      bearer: { type: 'bearer', envVar: 'API_TOKEN' },
      basic: { type: 'basic', envVar: 'API_BASIC_AUTH' },
      apikey: { type: 'apiKey', envVar: 'API_KEY' },
      oauth2: { type: 'oauth2', envVar: 'OAUTH_TOKEN' },
    };

    return authMappings[auth.type] || { type: auth.type };
  }

  /**
   * Extract headers as a map
   */
  private extractHeaders(headers?: PostmanHeader[]): Record<string, string> | undefined {
    if (!headers) return undefined;

    const headerMap: Record<string, string> = {};
    for (const header of headers) {
      if (!header.disabled && !this.isAuthHeader(header.key)) {
        headerMap[header.key] = header.value;
      }
    }

    return Object.keys(headerMap).length > 0 ? headerMap : undefined;
  }

  /**
   * Check if header is an auth header
   */
  private isAuthHeader(name: string): boolean {
    const authHeaders = ['authorization', 'x-api-key', 'api-key'];
    return authHeaders.includes(name.toLowerCase());
  }

  /**
   * Generate tool name from request name and folder
   */
  private generateToolName(requestName: string, folder: string): string {
    let name = requestName;
    
    // Include folder as prefix if present
    if (folder) {
      const folderPrefix = folder
        .split('/')
        .map(s => this.toSnakeCase(s))
        .join('_');
      name = `${folderPrefix}_${requestName}`;
    }

    return this.toSnakeCase(name);
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
  getParseResult(): PostmanParseResult {
    if (!this.collection) {
      throw new Error('No collection parsed. Call parse() first.');
    }

    return {
      format: 'postman',
      info: {
        name: this.collection.info.name,
        description: this.collection.info.description,
      },
      tools: this.toMcpTools(),
      variables: Object.fromEntries(this.variables),
      auth: this.collection.auth ? { type: this.collection.auth.type } : undefined,
    };
  }
}

/**
 * Convenience function to parse Postman collection
 */
export function parsePostman(input: string | object): PostmanParseResult {
  const parser = new PostmanParser();

  if (typeof input === 'string') {
    parser.parse(input);
  } else {
    parser.parseObject(input as PostmanCollection);
  }

  return parser.getParseResult();
}
