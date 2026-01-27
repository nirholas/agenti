/**
 * @fileoverview transformer module implementation
 * Enhanced with OpenAPI 3.1 support and example extraction
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { OpenAPIV3 } from 'openapi-types';
import type { EndpointInfo, ParameterInfo, PaginationPattern, OperationExample } from './analyzer.js';

export interface McpToolDefinition {
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
    auth?: {
      type: string;
      required: boolean;
      envVar?: string;
      headerName?: string;
    };
    pagination?: PaginationPattern;
    tags?: string[];
    deprecated?: boolean;
    isWebhook?: boolean;
  };
  examples?: OperationExample[];
}

export interface TransformOptions {
  naming?: {
    prefix?: string;
    style?: 'snake_case' | 'camelCase';
  };
  auth?: {
    type: 'bearer' | 'basic' | 'apiKey' | 'oauth';
    envVar?: string;
    header?: string;
  };
  features?: {
    pagination?: boolean;
    retry?: boolean;
    cache?: boolean;
    validation?: boolean;
    includeExamples?: boolean;
  };
}

/**
 * Transforms OpenAPI endpoints into MCP tool definitions
 * Enhanced for OpenAPI 3.1 support
 */
export class OpenApiTransformer {
  constructor(
    private spec: OpenAPIV3.Document,
    private options: TransformOptions = {}
  ) {}

  /**
   * Transform an endpoint into an MCP tool definition
   */
  transformEndpoint(endpoint: EndpointInfo, pagination?: PaginationPattern): McpToolDefinition {
    const name = this.generateToolName(endpoint);
    const description = this.generateDescription(endpoint);
    const inputSchema = this.generateInputSchema(endpoint);
    
    // Build auth metadata with enhanced info
    let authMeta: McpToolDefinition['metadata']['auth'] | undefined;
    if (endpoint.security && endpoint.security.length > 0) {
      const securityScheme = this.getSecurityScheme(endpoint.security[0].name);
      authMeta = {
        type: securityScheme?.type || endpoint.security[0].name || 'unknown',
        required: true,
        envVar: this.generateEnvVar(endpoint.security[0].name),
        headerName: securityScheme?.name,
      };
    }
    
    return {
      name,
      description,
      inputSchema,
      metadata: {
        endpoint: {
          path: endpoint.path,
          method: endpoint.method,
        },
        auth: authMeta,
        pagination,
        tags: endpoint.tags,
        deprecated: endpoint.deprecated,
        isWebhook: endpoint.isWebhook,
      },
      examples: this.options.features?.includeExamples !== false ? endpoint.examples : undefined,
    };
  }

  /**
   * Get security scheme from spec
   */
  private getSecurityScheme(name: string): any {
    return this.spec.components?.securitySchemes?.[name];
  }

  /**
   * Generate environment variable name for auth
   */
  private generateEnvVar(schemeName: string): string {
    return `${schemeName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_TOKEN`;
  }

  /**
   * Transform multiple endpoints
   */
  transformEndpoints(
    endpoints: EndpointInfo[],
    paginationMap?: Map<string, PaginationPattern>
  ): McpToolDefinition[] {
    return endpoints.map(endpoint => {
      const key = `${endpoint.method}:${endpoint.path}`;
      const pagination = paginationMap?.get(key);
      return this.transformEndpoint(endpoint, pagination);
    });
  }

  /**
   * Generate MCP tool name from endpoint
   */
  private generateToolName(endpoint: EndpointInfo): string {
    let name: string;

    // Use operationId if available
    if (endpoint.operationId) {
      name = endpoint.operationId;
    } else {
      // Generate from method + path
      const pathParts = endpoint.path
        .split('/')
        .filter(Boolean)
        .filter(part => !part.startsWith('{')) // Remove path parameters
        .join('_');

      const method = endpoint.method.toLowerCase();
      name = `${method}_${pathParts}`;
    }

    // Apply naming style
    if (this.options.naming?.style === 'camelCase') {
      name = this.toCamelCase(name);
    } else {
      name = this.toSnakeCase(name);
    }

    // Add prefix
    if (this.options.naming?.prefix) {
      name = `${this.options.naming.prefix}_${name}`;
    }

    return name;
  }

  /**
   * Generate description from endpoint info
   */
  private generateDescription(endpoint: EndpointInfo): string {
    if (endpoint.description) {
      return endpoint.description;
    }

    if (endpoint.summary) {
      return endpoint.summary;
    }

    // Generate basic description
    const action = this.getActionWord(endpoint.method);
    const resource = this.getResourceName(endpoint.path);
    return `${action} ${resource}`;
  }

  /**
   * Generate JSON Schema for tool inputs
   */
  private generateInputSchema(endpoint: EndpointInfo): McpToolDefinition['inputSchema'] {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add path parameters
    for (const param of endpoint.parameters.filter(p => p.in === 'path')) {
      properties[param.name] = this.convertSchemaToJsonSchema(param.schema, param.description);
      if (param.required) {
        required.push(param.name);
      }
    }

    // Add query parameters
    for (const param of endpoint.parameters.filter(p => p.in === 'query')) {
      properties[param.name] = this.convertSchemaToJsonSchema(param.schema, param.description);
      if (param.required) {
        required.push(param.name);
      }
    }

    // Add header parameters (except auth headers)
    for (const param of endpoint.parameters.filter(p => p.in === 'header')) {
      if (!this.isAuthHeader(param.name)) {
        properties[param.name] = this.convertSchemaToJsonSchema(param.schema, param.description);
        if (param.required) {
          required.push(param.name);
        }
      }
    }

    // Add request body
    if (endpoint.requestBody) {
      const jsonContent = endpoint.requestBody.content['application/json'];
      if (jsonContent?.schema) {
        // Flatten request body into parameters or nest it
        if (this.shouldFlattenRequestBody(jsonContent.schema)) {
          const bodySchema = this.convertSchemaToJsonSchema(jsonContent.schema);
          if (bodySchema.properties) {
            Object.assign(properties, bodySchema.properties);
            if (bodySchema.required) {
              required.push(...bodySchema.required);
            }
          }
        } else {
          properties.body = this.convertSchemaToJsonSchema(
            jsonContent.schema,
            endpoint.requestBody.description
          );
          if (endpoint.requestBody.required) {
            required.push('body');
          }
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Convert OpenAPI schema to JSON Schema
   * Enhanced to support OpenAPI 3.1 features
   */
  private convertSchemaToJsonSchema(schema: any, description?: string): any {
    if (!schema) {
      return { type: 'string' };
    }

    if ('$ref' in schema) {
      // $ref should be resolved by parser
      return { type: 'object' };
    }

    const jsonSchema: any = {};

    // Handle OpenAPI 3.1 type arrays (e.g., ["string", "null"])
    if (Array.isArray(schema.type)) {
      // Check if it's nullable
      if (schema.type.includes('null')) {
        const types = schema.type.filter((t: string) => t !== 'null');
        if (types.length === 1) {
          jsonSchema.type = types[0];
          jsonSchema.nullable = true;
        } else {
          jsonSchema.type = types;
        }
      } else {
        jsonSchema.type = schema.type;
      }
    } else {
      jsonSchema.type = schema.type;
    }

    // Description
    if (description || schema.description) {
      jsonSchema.description = description || schema.description;
    }

    // Copy common properties
    if (schema.format) jsonSchema.format = schema.format;
    if (schema.enum) jsonSchema.enum = schema.enum;
    if (schema.default !== undefined) jsonSchema.default = schema.default;
    if (schema.example !== undefined) jsonSchema.example = schema.example;
    if (schema.minimum !== undefined) jsonSchema.minimum = schema.minimum;
    if (schema.maximum !== undefined) jsonSchema.maximum = schema.maximum;
    if (schema.exclusiveMinimum !== undefined) jsonSchema.exclusiveMinimum = schema.exclusiveMinimum;
    if (schema.exclusiveMaximum !== undefined) jsonSchema.exclusiveMaximum = schema.exclusiveMaximum;
    if (schema.minLength !== undefined) jsonSchema.minLength = schema.minLength;
    if (schema.maxLength !== undefined) jsonSchema.maxLength = schema.maxLength;
    if (schema.pattern) jsonSchema.pattern = schema.pattern;
    if (schema.minItems !== undefined) jsonSchema.minItems = schema.minItems;
    if (schema.maxItems !== undefined) jsonSchema.maxItems = schema.maxItems;
    if (schema.uniqueItems !== undefined) jsonSchema.uniqueItems = schema.uniqueItems;
    if (schema.minProperties !== undefined) jsonSchema.minProperties = schema.minProperties;
    if (schema.maxProperties !== undefined) jsonSchema.maxProperties = schema.maxProperties;

    // OpenAPI 3.1 / JSON Schema 2020-12 support
    if (schema.const !== undefined) jsonSchema.const = schema.const;
    if (schema.$id) jsonSchema.$id = schema.$id;
    if (schema.$anchor) jsonSchema.$anchor = schema.$anchor;
    if (schema.$comment) jsonSchema.$comment = schema.$comment;
    if (schema.contentEncoding) jsonSchema.contentEncoding = schema.contentEncoding;
    if (schema.contentMediaType) jsonSchema.contentMediaType = schema.contentMediaType;
    if (schema.deprecated !== undefined) jsonSchema.deprecated = schema.deprecated;
    if (schema.readOnly !== undefined) jsonSchema.readOnly = schema.readOnly;
    if (schema.writeOnly !== undefined) jsonSchema.writeOnly = schema.writeOnly;

    // Handle nullable (OpenAPI 3.0 style)
    if (schema.nullable === true && !Array.isArray(schema.type)) {
      jsonSchema.nullable = true;
    }

    // Handle object type
    const typeVal = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (typeVal === 'object' && schema.properties) {
      jsonSchema.properties = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        jsonSchema.properties[key] = this.convertSchemaToJsonSchema(value);
      }
      if (schema.required) {
        jsonSchema.required = schema.required;
      }
      if (schema.additionalProperties !== undefined) {
        if (typeof schema.additionalProperties === 'boolean') {
          jsonSchema.additionalProperties = schema.additionalProperties;
        } else {
          jsonSchema.additionalProperties = this.convertSchemaToJsonSchema(schema.additionalProperties);
        }
      }
    }

    // Handle array type
    if (typeVal === 'array' && schema.items) {
      jsonSchema.items = this.convertSchemaToJsonSchema(schema.items);
    }
    // Handle prefixItems (OpenAPI 3.1 / JSON Schema 2020-12)
    if (schema.prefixItems) {
      jsonSchema.prefixItems = schema.prefixItems.map((s: any) => this.convertSchemaToJsonSchema(s));
    }
    if (schema.contains) {
      jsonSchema.contains = this.convertSchemaToJsonSchema(schema.contains);
    }

    // Handle oneOf, anyOf, allOf
    if (schema.oneOf) {
      jsonSchema.oneOf = schema.oneOf.map((s: any) => this.convertSchemaToJsonSchema(s));
    }
    if (schema.anyOf) {
      jsonSchema.anyOf = schema.anyOf.map((s: any) => this.convertSchemaToJsonSchema(s));
    }
    if (schema.allOf) {
      jsonSchema.allOf = schema.allOf.map((s: any) => this.convertSchemaToJsonSchema(s));
    }
    if (schema.not) {
      jsonSchema.not = this.convertSchemaToJsonSchema(schema.not);
    }

    // Handle if/then/else (JSON Schema 2020-12)
    if (schema.if) jsonSchema.if = this.convertSchemaToJsonSchema(schema.if);
    if (schema.then) jsonSchema.then = this.convertSchemaToJsonSchema(schema.then);
    if (schema.else) jsonSchema.else = this.convertSchemaToJsonSchema(schema.else);

    // Handle dependentSchemas and dependentRequired (JSON Schema 2020-12)
    if (schema.dependentSchemas) {
      jsonSchema.dependentSchemas = {};
      for (const [key, value] of Object.entries(schema.dependentSchemas)) {
        jsonSchema.dependentSchemas[key] = this.convertSchemaToJsonSchema(value);
      }
    }
    if (schema.dependentRequired) {
      jsonSchema.dependentRequired = schema.dependentRequired;
    }

    return jsonSchema;
  }

  /**
   * Determine if request body should be flattened
   */
  private shouldFlattenRequestBody(schema: any): boolean {
    // Flatten if it's a simple object with properties
    if (schema.type === 'object' && schema.properties) {
      const propCount = Object.keys(schema.properties).length;
      // Flatten if <= 5 properties
      return propCount <= 5;
    }
    return false;
  }

  /**
   * Check if header is authentication header
   */
  private isAuthHeader(name: string): boolean {
    const authHeaders = ['authorization', 'x-api-key', 'api-key', 'apikey'];
    return authHeaders.includes(name.toLowerCase());
  }

  /**
   * Get action word from HTTP method
   */
  private getActionWord(method: string): string {
    const actions: Record<string, string> = {
      GET: 'Get',
      POST: 'Create',
      PUT: 'Update',
      PATCH: 'Modify',
      DELETE: 'Delete',
    };
    return actions[method.toUpperCase()] || method;
  }

  /**
   * Extract resource name from path
   */
  private getResourceName(path: string): string {
    const parts = path.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    
    // If last part is a parameter, use second to last
    if (lastPart?.startsWith('{')) {
      return parts[parts.length - 2] || 'resource';
    }
    
    return lastPart || 'resource';
  }

  /**
   * Convert string to camelCase
   */
  private toCamelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[_-](.)/g, (_, char) => char.toUpperCase());
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
}
