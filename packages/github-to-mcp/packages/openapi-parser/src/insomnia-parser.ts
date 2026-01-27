/**
 * @fileoverview Insomnia export parser (v4 format)
 * Converts Insomnia exports to MCP tool definitions
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import yaml from 'js-yaml';

/** Maximum number of properties to flatten from request body (larger bodies are kept as nested 'body' property) */
const MAX_FLATTEN_PROPERTIES = 5;

export interface InsomniaExport {
  _type: 'export';
  __export_format: number;
  __export_date: string;
  __export_source: string;
  resources: InsomniaResource[];
}

export type InsomniaResource = 
  | InsomniaWorkspace 
  | InsomniaRequestGroup 
  | InsomniaRequest 
  | InsomniaEnvironment;

export interface InsomniaWorkspace {
  _id: string;
  _type: 'workspace';
  name: string;
  description?: string;
  scope?: string;
}

export interface InsomniaRequestGroup {
  _id: string;
  _type: 'request_group';
  parentId: string;
  name: string;
  description?: string;
  environment?: Record<string, any>;
}

export interface InsomniaRequest {
  _id: string;
  _type: 'request';
  parentId: string;
  name: string;
  description?: string;
  method: string;
  url: string;
  body?: InsomniaBody;
  headers?: InsomniaHeader[];
  authentication?: InsomniaAuth;
  parameters?: InsomniaParameter[];
  settingFollowRedirects?: string;
}

export interface InsomniaBody {
  mimeType?: string;
  text?: string;
  params?: Array<{ name: string; value: string; description?: string; disabled?: boolean }>;
}

export interface InsomniaHeader {
  name: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface InsomniaParameter {
  name: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface InsomniaAuth {
  type: 'none' | 'basic' | 'bearer' | 'oauth2' | 'apikey' | 'aws-iam';
  disabled?: boolean;
  token?: string;
  prefix?: string;
  username?: string;
  password?: string;
  key?: string;
  value?: string;
  addTo?: string;
}

export interface InsomniaEnvironment {
  _id: string;
  _type: 'environment';
  parentId: string;
  name: string;
  data: Record<string, any>;
  isPrivate?: boolean;
}

export interface InsomniaToolDefinition {
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
    workspace?: string;
    auth?: {
      type: string;
      envVar?: string;
    };
    headers?: Record<string, string>;
  };
}

export interface InsomniaParseResult {
  format: 'insomnia';
  workspaces: Array<{ id: string; name: string; description?: string }>;
  tools: InsomniaToolDefinition[];
  environments: Record<string, Record<string, any>>;
}

/**
 * Parser for Insomnia export format (v4)
 */
export class InsomniaParser {
  private export: InsomniaExport | null = null;
  private workspaces: Map<string, InsomniaWorkspace> = new Map();
  private requestGroups: Map<string, InsomniaRequestGroup> = new Map();
  private requests: InsomniaRequest[] = [];
  private environments: Map<string, InsomniaEnvironment> = new Map();
  private envVariables: Map<string, any> = new Map();

  /**
   * Parse Insomnia export from string (JSON or YAML)
   */
  parse(input: string): InsomniaExport {
    let data: any;
    
    try {
      // Try JSON first
      data = JSON.parse(input);
    } catch {
      // Try YAML
      data = yaml.load(input);
    }

    if (!this.isValidExport(data)) {
      throw new Error('Invalid Insomnia export: missing required fields');
    }

    this.export = data;
    this.processResources(data.resources);
    return data;
  }

  /**
   * Parse from object (already loaded)
   */
  parseObject(data: InsomniaExport): InsomniaExport {
    if (!this.isValidExport(data)) {
      throw new Error('Invalid Insomnia export: missing required fields');
    }

    this.export = data;
    this.processResources(data.resources);
    return data;
  }

  /**
   * Validate export structure
   */
  private isValidExport(data: any): data is InsomniaExport {
    return (
      data &&
      data._type === 'export' &&
      typeof data.__export_format === 'number' &&
      Array.isArray(data.resources)
    );
  }

  /**
   * Process all resources in the export
   */
  private processResources(resources: InsomniaResource[]): void {
    this.workspaces.clear();
    this.requestGroups.clear();
    this.requests = [];
    this.environments.clear();

    for (const resource of resources) {
      switch (resource._type) {
        case 'workspace':
          this.workspaces.set(resource._id, resource);
          break;
        case 'request_group':
          this.requestGroups.set(resource._id, resource);
          break;
        case 'request':
          this.requests.push(resource);
          break;
        case 'environment':
          this.environments.set(resource._id, resource);
          // Merge environment variables
          if (resource.data) {
            for (const [key, value] of Object.entries(resource.data)) {
              this.envVariables.set(key, value);
            }
          }
          break;
      }
    }
  }

  /**
   * Get folder path for a resource
   */
  private getFolderPath(parentId: string): string {
    const parts: string[] = [];
    let currentId = parentId;

    while (currentId) {
      const group = this.requestGroups.get(currentId);
      if (group) {
        parts.unshift(group.name);
        currentId = group.parentId;
      } else {
        break;
      }
    }

    return parts.join('/');
  }

  /**
   * Get workspace name for a resource
   */
  private getWorkspaceName(parentId: string): string | undefined {
    let currentId = parentId;

    while (currentId) {
      const workspace = this.workspaces.get(currentId);
      if (workspace) {
        return workspace.name;
      }

      const group = this.requestGroups.get(currentId);
      if (group) {
        currentId = group.parentId;
      } else {
        break;
      }
    }

    return undefined;
  }

  /**
   * Convert to MCP tool definitions
   */
  toMcpTools(): InsomniaToolDefinition[] {
    const tools: InsomniaToolDefinition[] = [];

    for (const request of this.requests) {
      const tool = this.requestToTool(request);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * Convert an Insomnia request to an MCP tool
   */
  private requestToTool(request: InsomniaRequest): InsomniaToolDefinition | null {
    const url = this.replaceVariables(request.url);
    const { path, queryParams, pathVariables } = this.parseUrl(url);
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add path variables
    for (const variable of pathVariables) {
      properties[variable] = {
        type: 'string',
        description: `Path variable: ${variable}`,
      };
      required.push(variable);
    }

    // Add query parameters
    if (request.parameters) {
      for (const param of request.parameters) {
        if (param.disabled) continue;
        properties[param.name] = {
          type: 'string',
          description: param.description || undefined,
          default: this.replaceVariables(param.value) || undefined,
        };
      }
    }

    // Add body schema
    if (request.body) {
      const bodySchema = this.parseBodySchema(request.body);
      if (bodySchema) {
        if (bodySchema.properties && Object.keys(bodySchema.properties).length <= MAX_FLATTEN_PROPERTIES) {
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

    const folder = this.getFolderPath(request.parentId);
    const workspace = this.getWorkspaceName(request.parentId);
    const auth = this.extractAuth(request.authentication);

    return {
      name: this.generateToolName(request.name, folder),
      description: request.description || request.name,
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
        workspace,
        auth,
        headers: this.extractHeaders(request.headers),
      },
    };
  }

  /**
   * Parse URL to extract path, query params, and path variables
   */
  private parseUrl(url: string): {
    path: string;
    queryParams: string[];
    pathVariables: string[];
  } {
    let path = url;
    const queryParams: string[] = [];
    const pathVariables: string[] = [];

    try {
      // Try to parse as full URL
      const parsed = new URL(url);
      path = parsed.pathname;
      
      // Extract query params
      parsed.searchParams.forEach((_, key) => {
        queryParams.push(key);
      });
    } catch {
      // If not a valid URL, treat as path
      const queryIndex = url.indexOf('?');
      if (queryIndex !== -1) {
        path = url.substring(0, queryIndex);
      }
    }

    // Extract path variables (e.g., :id, {{ id }}, {id})
    const varPatterns = [
      /:([a-zA-Z_][a-zA-Z0-9_]*)/g,
      /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
      /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    ];

    for (const pattern of varPatterns) {
      let match;
      while ((match = pattern.exec(path)) !== null) {
        if (!pathVariables.includes(match[1])) {
          pathVariables.push(match[1]);
        }
      }
    }

    // Normalize path variables to {name} format
    path = path
      .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
      .replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, '{$1}');

    return { path, queryParams, pathVariables };
  }

  /**
   * Replace environment variables in string
   */
  private replaceVariables(str: string): string {
    if (!str) return str;
    
    return str.replace(/\{\{\s*_\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
      const value = this.envVariables.get(key);
      return value !== undefined ? String(value) : match;
    }).replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
      const value = this.envVariables.get(key);
      return value !== undefined ? String(value) : `{${key}}`;
    });
  }

  /**
   * Parse body schema from Insomnia body
   */
  private parseBodySchema(body: InsomniaBody): any {
    if (body.mimeType === 'application/json' && body.text) {
      try {
        const example = JSON.parse(this.replaceVariables(body.text));
        return this.inferSchemaFromExample(example);
      } catch {
        return { type: 'string' };
      }
    }

    if (body.mimeType === 'application/x-www-form-urlencoded' && body.params) {
      const properties: Record<string, any> = {};
      for (const param of body.params) {
        if (!param.disabled) {
          properties[param.name] = {
            type: 'string',
            description: param.description || undefined,
          };
        }
      }
      return { type: 'object', properties };
    }

    if (body.mimeType === 'multipart/form-data' && body.params) {
      const properties: Record<string, any> = {};
      for (const param of body.params) {
        if (!param.disabled) {
          properties[param.name] = {
            type: 'string',
            description: param.description || undefined,
          };
        }
      }
      return { type: 'object', properties };
    }

    if (body.text) {
      return { type: 'string' };
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
   * Extract auth information
   */
  private extractAuth(auth?: InsomniaAuth): { type: string; envVar?: string } | undefined {
    if (!auth || auth.disabled || auth.type === 'none') {
      return undefined;
    }

    const authMappings: Record<string, { type: string; envVar: string }> = {
      bearer: { type: 'bearer', envVar: 'API_TOKEN' },
      basic: { type: 'basic', envVar: 'API_BASIC_AUTH' },
      apikey: { type: 'apiKey', envVar: 'API_KEY' },
      oauth2: { type: 'oauth2', envVar: 'OAUTH_TOKEN' },
      'aws-iam': { type: 'awsv4', envVar: 'AWS_CREDENTIALS' },
    };

    return authMappings[auth.type] || { type: auth.type };
  }

  /**
   * Extract headers as a map
   */
  private extractHeaders(headers?: InsomniaHeader[]): Record<string, string> | undefined {
    if (!headers) return undefined;

    const headerMap: Record<string, string> = {};
    for (const header of headers) {
      if (!header.disabled && !this.isAuthHeader(header.name)) {
        headerMap[header.name] = this.replaceVariables(header.value);
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
  getParseResult(): InsomniaParseResult {
    if (!this.export) {
      throw new Error('No export parsed. Call parse() first.');
    }

    const workspaces = Array.from(this.workspaces.values()).map(w => ({
      id: w._id,
      name: w.name,
      description: w.description,
    }));

    const environments: Record<string, Record<string, any>> = {};
    for (const [id, env] of this.environments) {
      environments[env.name] = env.data;
    }

    return {
      format: 'insomnia',
      workspaces,
      tools: this.toMcpTools(),
      environments,
    };
  }
}

/**
 * Convenience function to parse Insomnia export
 */
export function parseInsomnia(input: string | object): InsomniaParseResult {
  const parser = new InsomniaParser();

  if (typeof input === 'string') {
    parser.parse(input);
  } else {
    parser.parseObject(input as InsomniaExport);
  }

  return parser.getParseResult();
}
