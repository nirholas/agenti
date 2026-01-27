/**
 * @fileoverview AsyncAPI parser for event-driven APIs
 * Supports AsyncAPI 2.x and 3.x specifications
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import yaml from 'js-yaml';

export interface AsyncAPIChannel {
  name: string;
  address?: string;
  description?: string;
  subscribe?: AsyncAPIOperation;
  publish?: AsyncAPIOperation;
  messages?: Record<string, AsyncAPIMessage>;
  bindings?: Record<string, any>;
}

export interface AsyncAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  message?: AsyncAPIMessage | { oneOf: AsyncAPIMessage[] };
  bindings?: Record<string, any>;
  security?: Array<Record<string, string[]>>;
  tags?: Array<{ name: string; description?: string }>;
}

export interface AsyncAPIMessage {
  name?: string;
  title?: string;
  summary?: string;
  description?: string;
  contentType?: string;
  payload?: any;
  headers?: any;
  correlationId?: { location: string };
  schemaFormat?: string;
  examples?: Array<{ name?: string; summary?: string; payload?: any }>;
}

export interface AsyncAPIServer {
  host?: string;
  url?: string;
  protocol: string;
  protocolVersion?: string;
  description?: string;
  security?: Array<Record<string, string[]>>;
  bindings?: Record<string, any>;
}

export interface AsyncAPISpec {
  asyncapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Record<string, AsyncAPIServer>;
  channels?: Record<string, any>;
  operations?: Record<string, any>; // AsyncAPI 3.x
  components?: {
    schemas?: Record<string, any>;
    messages?: Record<string, AsyncAPIMessage>;
    securitySchemes?: Record<string, any>;
    channels?: Record<string, any>;
  };
}

export interface AsyncAPIToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  metadata: {
    channel: string;
    operation: 'subscribe' | 'publish';
    protocol?: string;
    bindings?: Record<string, any>;
    security?: Array<{ name: string; scopes?: string[] }>;
    tags?: string[];
  };
  examples?: Array<{ input?: any; output?: any }>;
}

export interface AsyncAPIParseResult {
  format: 'asyncapi';
  version: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  tools: AsyncAPIToolDefinition[];
  servers: Record<string, AsyncAPIServer>;
  securitySchemes: Record<string, any>;
}

/**
 * Parser for AsyncAPI specifications (2.x and 3.x)
 */
export class AsyncAPIParser {
  private spec: AsyncAPISpec | null = null;

  /**
   * Parse AsyncAPI spec from string (JSON or YAML)
   */
  parse(input: string): AsyncAPISpec {
    try {
      // Try JSON first
      this.spec = JSON.parse(input);
    } catch {
      // Try YAML
      this.spec = yaml.load(input) as AsyncAPISpec;
    }

    if (!this.spec?.asyncapi) {
      throw new Error('Invalid AsyncAPI specification: missing asyncapi version field');
    }

    return this.spec;
  }

  /**
   * Parse from object (already loaded)
   */
  parseObject(spec: AsyncAPISpec): AsyncAPISpec {
    if (!spec.asyncapi) {
      throw new Error('Invalid AsyncAPI specification: missing asyncapi version field');
    }
    this.spec = spec;
    return spec;
  }

  /**
   * Get AsyncAPI version (2.x or 3.x)
   */
  getVersion(): string {
    if (!this.spec) {
      throw new Error('No spec parsed. Call parse() first.');
    }
    return this.spec.asyncapi;
  }

  /**
   * Check if this is AsyncAPI 3.x
   */
  isVersion3(): boolean {
    return this.getVersion().startsWith('3.');
  }

  /**
   * Extract all channels and their operations
   */
  extractChannels(): AsyncAPIChannel[] {
    if (!this.spec) {
      throw new Error('No spec parsed. Call parse() first.');
    }

    const channels: AsyncAPIChannel[] = [];

    if (this.isVersion3()) {
      // AsyncAPI 3.x structure
      for (const [name, channel] of Object.entries(this.spec.channels || {})) {
        channels.push(this.extractChannelV3(name, channel));
      }
    } else {
      // AsyncAPI 2.x structure
      for (const [name, channel] of Object.entries(this.spec.channels || {})) {
        channels.push(this.extractChannelV2(name, channel));
      }
    }

    return channels;
  }

  /**
   * Extract channel info for AsyncAPI 2.x
   */
  private extractChannelV2(name: string, channel: any): AsyncAPIChannel {
    return {
      name,
      description: channel.description,
      subscribe: channel.subscribe ? this.extractOperation(channel.subscribe) : undefined,
      publish: channel.publish ? this.extractOperation(channel.publish) : undefined,
      bindings: channel.bindings,
    };
  }

  /**
   * Extract channel info for AsyncAPI 3.x
   */
  private extractChannelV3(name: string, channel: any): AsyncAPIChannel {
    // In v3, operations are separate from channels
    const operations = this.spec?.operations || {};
    const channelOps: AsyncAPIChannel = {
      name,
      address: channel.address,
      description: channel.description,
      messages: channel.messages,
      bindings: channel.bindings,
    };

    // Find operations that reference this channel
    for (const [opId, operation] of Object.entries(operations)) {
      const opChannel = (operation as any).channel?.$ref || (operation as any).channel;
      if (opChannel === `#/channels/${name}` || opChannel === name) {
        const action = (operation as any).action;
        if (action === 'receive' || action === 'subscribe') {
          channelOps.subscribe = this.extractOperationV3(opId, operation);
        } else if (action === 'send' || action === 'publish') {
          channelOps.publish = this.extractOperationV3(opId, operation);
        }
      }
    }

    return channelOps;
  }

  /**
   * Extract operation info (v2)
   */
  private extractOperation(operation: any): AsyncAPIOperation {
    return {
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      message: operation.message,
      bindings: operation.bindings,
      security: operation.security,
      tags: operation.tags,
    };
  }

  /**
   * Extract operation info (v3)
   */
  private extractOperationV3(operationId: string, operation: any): AsyncAPIOperation {
    return {
      operationId: operationId,
      summary: operation.summary,
      description: operation.description,
      message: operation.messages,
      bindings: operation.bindings,
      security: operation.security,
      tags: operation.tags,
    };
  }

  /**
   * Convert to MCP tool definitions
   */
  toMcpTools(): AsyncAPIToolDefinition[] {
    const channels = this.extractChannels();
    const tools: AsyncAPIToolDefinition[] = [];

    for (const channel of channels) {
      if (channel.subscribe) {
        tools.push(this.createSubscribeTool(channel));
      }
      if (channel.publish) {
        tools.push(this.createPublishTool(channel));
      }
    }

    return tools;
  }

  /**
   * Create subscribe tool from channel
   */
  private createSubscribeTool(channel: AsyncAPIChannel): AsyncAPIToolDefinition {
    const op = channel.subscribe!;
    const message = this.getFirstMessage(op.message);

    return {
      name: this.generateToolName('subscribe_to', channel.name, op.operationId),
      description: op.description || op.summary || `Subscribe to ${channel.name}`,
      inputSchema: this.generateInputSchema(message),
      metadata: {
        channel: channel.name,
        operation: 'subscribe',
        bindings: { ...channel.bindings, ...op.bindings },
        security: this.extractSecurity(op.security),
        tags: op.tags?.map(t => t.name),
      },
      examples: message?.examples?.map(ex => ({ output: ex.payload })),
    };
  }

  /**
   * Create publish tool from channel
   */
  private createPublishTool(channel: AsyncAPIChannel): AsyncAPIToolDefinition {
    const op = channel.publish!;
    const message = this.getFirstMessage(op.message);

    return {
      name: this.generateToolName('publish_to', channel.name, op.operationId),
      description: op.description || op.summary || `Publish to ${channel.name}`,
      inputSchema: this.generateInputSchema(message),
      metadata: {
        channel: channel.name,
        operation: 'publish',
        bindings: { ...channel.bindings, ...op.bindings },
        security: this.extractSecurity(op.security),
        tags: op.tags?.map(t => t.name),
      },
      examples: message?.examples?.map(ex => ({ input: ex.payload })),
    };
  }

  /**
   * Get first message from message definition (handles oneOf)
   */
  private getFirstMessage(message: any): AsyncAPIMessage | undefined {
    if (!message) return undefined;
    if ('oneOf' in message) return message.oneOf[0];
    return message;
  }

  /**
   * Generate tool name from channel and operation
   */
  private generateToolName(prefix: string, channelName: string, operationId?: string): string {
    if (operationId) {
      return this.toSnakeCase(operationId);
    }
    
    const cleanName = channelName
      .replace(/[{}]/g, '')
      .replace(/\//g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '_');
    
    return `${prefix}_${this.toSnakeCase(cleanName)}`;
  }

  /**
   * Generate JSON Schema for tool inputs from message
   */
  private generateInputSchema(message?: AsyncAPIMessage): AsyncAPIToolDefinition['inputSchema'] {
    if (!message?.payload) {
      return { type: 'object', properties: {} };
    }

    return {
      type: 'object',
      properties: this.convertSchemaProperties(message.payload),
      required: message.payload.required,
    };
  }

  /**
   * Convert schema properties to JSON Schema
   */
  private convertSchemaProperties(schema: any): Record<string, any> {
    if (!schema || typeof schema !== 'object') {
      return {};
    }

    if (schema.properties) {
      const properties: Record<string, any> = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        properties[key] = this.convertSchemaToJsonSchema(value as any);
      }
      return properties;
    }

    // If schema is a primitive type or already JSON Schema-like
    return { payload: this.convertSchemaToJsonSchema(schema) };
  }

  /**
   * Convert AsyncAPI schema to JSON Schema
   */
  private convertSchemaToJsonSchema(schema: any): any {
    if (!schema) return { type: 'string' };
    if ('$ref' in schema) return { type: 'object' };

    const jsonSchema: any = {
      type: schema.type,
      description: schema.description,
    };

    if (schema.format) jsonSchema.format = schema.format;
    if (schema.enum) jsonSchema.enum = schema.enum;
    if (schema.default !== undefined) jsonSchema.default = schema.default;
    if (schema.example !== undefined) jsonSchema.example = schema.example;
    if (schema.const !== undefined) jsonSchema.const = schema.const;

    // Handle object type
    if (schema.type === 'object' && schema.properties) {
      jsonSchema.properties = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        jsonSchema.properties[key] = this.convertSchemaToJsonSchema(value);
      }
      if (schema.required) jsonSchema.required = schema.required;
    }

    // Handle array type
    if (schema.type === 'array' && schema.items) {
      jsonSchema.items = this.convertSchemaToJsonSchema(schema.items);
    }

    return jsonSchema;
  }

  /**
   * Extract security info
   */
  private extractSecurity(security?: Array<Record<string, string[]>>): Array<{ name: string; scopes?: string[] }> | undefined {
    if (!security) return undefined;
    
    const result: Array<{ name: string; scopes?: string[] }> = [];
    for (const requirement of security) {
      for (const [name, scopes] of Object.entries(requirement)) {
        result.push({ name, scopes: scopes.length > 0 ? scopes : undefined });
      }
    }
    
    return result.length > 0 ? result : undefined;
  }

  /**
   * Convert string to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/[_-]+/g, '_')
      .replace(/^_/, '');
  }

  /**
   * Get complete parse result
   */
  getParseResult(): AsyncAPIParseResult {
    if (!this.spec) {
      throw new Error('No spec parsed. Call parse() first.');
    }

    return {
      format: 'asyncapi',
      version: this.spec.asyncapi,
      info: {
        title: this.spec.info.title,
        version: this.spec.info.version,
        description: this.spec.info.description,
      },
      tools: this.toMcpTools(),
      servers: this.spec.servers || {},
      securitySchemes: this.spec.components?.securitySchemes || {},
    };
  }
}

/**
 * Convenience function to parse AsyncAPI spec
 */
export function parseAsyncAPI(input: string | object): AsyncAPIParseResult {
  const parser = new AsyncAPIParser();
  
  if (typeof input === 'string') {
    parser.parse(input);
  } else {
    parser.parseObject(input as AsyncAPISpec);
  }
  
  return parser.getParseResult();
}
