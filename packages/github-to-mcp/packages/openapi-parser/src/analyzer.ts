/**
 * @fileoverview analyzer module implementation
 * Enhanced with OpenAPI 3.1 support, example extraction, and smart grouping
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

export interface EndpointInfo {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters: ParameterInfo[];
  requestBody?: RequestBodyInfo;
  responses: ResponseInfo[];
  security?: SecurityRequirement[];
  deprecated?: boolean;
  isWebhook?: boolean;
  examples?: OperationExample[];
}

export interface ParameterInfo {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema: any;
  example?: any;
  examples?: Record<string, any>;
}

export interface RequestBodyInfo {
  required: boolean;
  description?: string;
  content: Record<string, {
    schema: any;
    example?: any;
    examples?: Record<string, any>;
  }>;
}

export interface ResponseInfo {
  statusCode: string;
  description?: string;
  content?: Record<string, {
    schema: any;
    example?: any;
    examples?: Record<string, any>;
  }>;
}

export interface SecurityRequirement {
  name: string;
  scopes?: string[];
}

export interface PaginationPattern {
  type: 'offset' | 'cursor' | 'page';
  limitParam?: string;
  offsetParam?: string;
  cursorParam?: string;
  pageParam?: string;
  hasMoreField?: string;
  nextCursorField?: string;
}

export interface OperationExample {
  name?: string;
  input?: any;
  output?: any;
  description?: string;
}

export interface GroupingOptions {
  groupBy: 'tags' | 'paths' | 'none';
  includeDeprecated?: boolean;
  operationFilter?: (endpoint: EndpointInfo) => boolean;
}

export interface AuthDetectionResult {
  type: 'apiKey' | 'bearer' | 'basic' | 'oauth2' | 'openIdConnect' | 'unknown';
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  headerName?: string;
  envVar?: string;
  flows?: Record<string, any>;
}

/**
 * Analyzes OpenAPI specs to extract endpoint information
 * Enhanced with OpenAPI 3.1 support
 */
export class OpenApiAnalyzer {
  constructor(private spec: OpenAPIV3.Document | OpenAPIV3_1.Document) {}

  /**
   * Extract all endpoints from the spec (including webhooks for 3.1)
   */
  extractEndpoints(filters?: {
    tags?: string[];
    paths?: string[];
    methods?: string[];
    includeWebhooks?: boolean;
  }): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];
    
    // Extract from paths
    const paths = this.spec.paths || {};
    for (const [path, pathItem] of Object.entries(paths)) {
      if (!pathItem) continue;

      // Apply path filter
      if (filters?.paths && !this.matchesPathFilter(path, filters.paths)) {
        continue;
      }

      const pathEndpoints = this.extractPathEndpoints(path, pathItem, filters, false);
      endpoints.push(...pathEndpoints);
    }

    // Extract from webhooks (OpenAPI 3.1)
    if (filters?.includeWebhooks !== false) {
      const webhooks = (this.spec as any).webhooks || {};
      for (const [webhookName, pathItem] of Object.entries(webhooks)) {
        if (!pathItem) continue;
        const webhookEndpoints = this.extractPathEndpoints(
          `webhook:${webhookName}`,
          pathItem as any,
          filters,
          true
        );
        endpoints.push(...webhookEndpoints);
      }
    }

    return endpoints;
  }

  /**
   * Extract endpoints from a path item
   */
  private extractPathEndpoints(
    path: string,
    pathItem: OpenAPIV3.PathItemObject,
    filters?: { tags?: string[]; methods?: string[] },
    isWebhook: boolean = false
  ): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      // Apply method filter
      if (filters?.methods && !filters.methods.includes(method.toUpperCase())) {
        continue;
      }

      // Apply tag filter
      if (filters?.tags && operation.tags) {
        const hasMatchingTag = operation.tags.some(tag => filters.tags!.includes(tag));
        if (!hasMatchingTag) continue;
      }

      const endpoint = this.extractEndpoint(path, method, operation, pathItem, isWebhook);
      endpoints.push(endpoint);
    }

    return endpoints;
  }

  /**
   * Extract single endpoint info
   */
  private extractEndpoint(
    path: string,
    method: string,
    operation: OpenAPIV3.OperationObject,
    pathItem: OpenAPIV3.PathItemObject,
    isWebhook: boolean = false
  ): EndpointInfo {
    return {
      path,
      method: method.toUpperCase(),
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags,
      parameters: this.extractParameters(operation, pathItem),
      requestBody: this.extractRequestBody(operation),
      responses: this.extractResponses(operation),
      security: this.extractSecurity(operation),
      deprecated: operation.deprecated,
      isWebhook,
      examples: this.extractExamples(operation),
    };
  }

  /**
   * Extract parameters from operation
   */
  private extractParameters(
    operation: OpenAPIV3.OperationObject,
    pathItem: OpenAPIV3.PathItemObject
  ): ParameterInfo[] {
    const params: ParameterInfo[] = [];

    // Combine path-level and operation-level parameters
    const allParams = [
      ...(pathItem.parameters || []),
      ...(operation.parameters || []),
    ];

    for (const param of allParams) {
      if ('$ref' in param) {
        // Skip unresolved refs (should be resolved by parser)
        continue;
      }

      const paramObj = param as OpenAPIV3.ParameterObject;
      params.push({
        name: param.name,
        in: param.in as any,
        required: param.required || param.in === 'path',
        description: param.description,
        schema: paramObj.schema,
        example: paramObj.example,
        examples: paramObj.examples ? this.normalizeExamples(paramObj.examples) : undefined,
      });
    }

    return params;
  }

  /**
   * Extract request body info
   */
  private extractRequestBody(operation: OpenAPIV3.OperationObject): RequestBodyInfo | undefined {
    if (!operation.requestBody || '$ref' in operation.requestBody) {
      return undefined;
    }

    const requestBody = operation.requestBody;
    const content: Record<string, { schema: any; example?: any; examples?: Record<string, any> }> = {};

    for (const [mediaType, mediaTypeObj] of Object.entries(requestBody.content || {})) {
      content[mediaType] = {
        schema: mediaTypeObj.schema,
        example: mediaTypeObj.example,
        examples: mediaTypeObj.examples ? this.normalizeExamples(mediaTypeObj.examples) : undefined,
      };
    }

    return {
      required: requestBody.required || false,
      description: requestBody.description,
      content,
    };
  }

  /**
   * Extract response info
   */
  private extractResponses(operation: OpenAPIV3.OperationObject): ResponseInfo[] {
    const responses: ResponseInfo[] = [];

    for (const [statusCode, response] of Object.entries(operation.responses || {})) {
      if ('$ref' in response) continue;

      const content: Record<string, { schema: any; example?: any; examples?: Record<string, any> }> = {};

      if (response.content) {
        for (const [mediaType, mediaTypeObj] of Object.entries(response.content)) {
          content[mediaType] = {
            schema: mediaTypeObj.schema,
            example: mediaTypeObj.example,
            examples: mediaTypeObj.examples ? this.normalizeExamples(mediaTypeObj.examples) : undefined,
          };
        }
      }

      responses.push({
        statusCode,
        description: response.description,
        content: Object.keys(content).length > 0 ? content : undefined,
      });
    }

    return responses;
  }

  /**
   * Normalize examples object (handle ExampleObject vs ReferenceObject)
   */
  private normalizeExamples(examples: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    for (const [name, example] of Object.entries(examples)) {
      if ('$ref' in example) continue;
      normalized[name] = example.value !== undefined ? example.value : example;
    }
    return normalized;
  }

  /**
   * Extract examples from operation for tool metadata
   */
  extractExamples(operation: OpenAPIV3.OperationObject): OperationExample[] {
    const examples: OperationExample[] = [];

    // Get request body examples
    const requestExamples: Map<string, any> = new Map();
    if (operation.requestBody && !('$ref' in operation.requestBody)) {
      const jsonContent = operation.requestBody.content?.['application/json'];
      if (jsonContent) {
        if (jsonContent.example) {
          requestExamples.set('default', jsonContent.example);
        }
        if (jsonContent.examples) {
          for (const [name, ex] of Object.entries(jsonContent.examples)) {
            if ('$ref' in ex) continue;
            requestExamples.set(name, ex.value);
          }
        }
      }
    }

    // Get response examples (from 200/201 responses)
    const responseExamples: Map<string, any> = new Map();
    for (const [statusCode, response] of Object.entries(operation.responses || {})) {
      if ('$ref' in response) continue;
      if (!statusCode.startsWith('2')) continue;

      const jsonContent = response.content?.['application/json'];
      if (jsonContent) {
        if (jsonContent.example) {
          responseExamples.set('default', jsonContent.example);
        }
        if (jsonContent.examples) {
          for (const [name, ex] of Object.entries(jsonContent.examples)) {
            if ('$ref' in ex) continue;
            responseExamples.set(name, ex.value);
          }
        }
      }
    }

    // Combine request and response examples
    if (requestExamples.size > 0 || responseExamples.size > 0) {
      // Try to match by name
      for (const [name, input] of requestExamples) {
        const output = responseExamples.get(name) || responseExamples.get('default');
        examples.push({ name, input, output });
      }

      // Add any unmatched response examples
      for (const [name, output] of responseExamples) {
        if (!requestExamples.has(name) && name !== 'default') {
          examples.push({ name, output });
        }
      }

      // If we only have a default response example, add it
      if (requestExamples.size === 0 && responseExamples.has('default')) {
        examples.push({ name: 'default', output: responseExamples.get('default') });
      }
    }

    return examples;
  }

  /**
   * Extract security requirements
   */
  private extractSecurity(operation: OpenAPIV3.OperationObject): SecurityRequirement[] | undefined {
    const security = operation.security || this.spec.security;
    if (!security) return undefined;

    const requirements: SecurityRequirement[] = [];

    for (const requirement of security) {
      for (const [name, scopes] of Object.entries(requirement)) {
        requirements.push({ name, scopes });
      }
    }

    return requirements.length > 0 ? requirements : undefined;
  }

  /**
   * Detect pagination pattern in endpoint
   */
  detectPagination(endpoint: EndpointInfo): PaginationPattern | null {
    const params = endpoint.parameters;

    // Check for common pagination parameters
    const limitParam = params.find(p => 
      ['limit', 'per_page', 'page_size', 'size', 'count', 'max_results'].includes(p.name.toLowerCase())
    );

    const offsetParam = params.find(p =>
      ['offset', 'skip', 'start', 'from'].includes(p.name.toLowerCase())
    );

    const cursorParam = params.find(p =>
      ['cursor', 'next_cursor', 'starting_after', 'after', 'page_token', 'continuation_token'].includes(p.name.toLowerCase())
    );

    const pageParam = params.find(p =>
      ['page', 'page_number', 'page_num', 'p'].includes(p.name.toLowerCase())
    );

    // Determine pagination type
    if (cursorParam) {
      return {
        type: 'cursor',
        limitParam: limitParam?.name,
        cursorParam: cursorParam.name,
      };
    } else if (offsetParam) {
      return {
        type: 'offset',
        limitParam: limitParam?.name,
        offsetParam: offsetParam.name,
      };
    } else if (pageParam) {
      return {
        type: 'page',
        limitParam: limitParam?.name,
        pageParam: pageParam.name,
      };
    }

    return null;
  }

  /**
   * Smart operation grouping with multiple strategies
   */
  groupEndpoints(
    endpoints: EndpointInfo[],
    options: GroupingOptions = { groupBy: 'tags' }
  ): Record<string, EndpointInfo[]> {
    let filtered = endpoints;

    // Apply deprecated filter
    if (!options.includeDeprecated) {
      filtered = filtered.filter(e => !e.deprecated);
    }

    // Apply custom filter
    if (options.operationFilter) {
      filtered = filtered.filter(options.operationFilter);
    }

    const groups: Record<string, EndpointInfo[]> = {};

    if (options.groupBy === 'none') {
      groups['all'] = filtered;
      return groups;
    }

    for (const endpoint of filtered) {
      let groupKey: string;

      if (options.groupBy === 'tags') {
        // Use first tag or 'default'
        groupKey = endpoint.tags?.[0] || 'default';
      } else {
        // Smart path grouping: detect resource names
        groupKey = this.getResourceGroupFromPath(endpoint.path);
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(endpoint);
    }

    return groups;
  }

  /**
   * Extract resource group from path (for CRUD detection)
   */
  private getResourceGroupFromPath(path: string): string {
    const segments = path.split('/').filter(Boolean);
    
    // Find the first non-parameter segment
    for (const segment of segments) {
      if (!segment.startsWith('{') && !segment.startsWith(':')) {
        // Skip common API prefixes
        if (['api', 'v1', 'v2', 'v3', 'rest', 'graphql'].includes(segment.toLowerCase())) {
          continue;
        }
        return segment;
      }
    }
    
    return 'default';
  }

  /**
   * Detect CRUD pattern for an endpoint
   */
  detectCrudOperation(endpoint: EndpointInfo): 'list' | 'get' | 'create' | 'update' | 'delete' | 'other' {
    const method = endpoint.method.toUpperCase();
    const hasPathParam = endpoint.path.includes('{') || endpoint.path.includes(':');

    switch (method) {
      case 'GET':
        return hasPathParam ? 'get' : 'list';
      case 'POST':
        return 'create';
      case 'PUT':
      case 'PATCH':
        return 'update';
      case 'DELETE':
        return 'delete';
      default:
        return 'other';
    }
  }

  /**
   * Generate smart tool name based on CRUD patterns
   */
  generateSmartToolName(endpoint: EndpointInfo): string {
    const crud = this.detectCrudOperation(endpoint);
    const resource = this.getResourceGroupFromPath(endpoint.path);
    
    // Use singular form for single-resource operations
    const resourceName = crud === 'list' ? resource : this.singularize(resource);
    
    return `${resource}_${crud}`;
  }

  /**
   * Simple singularize (remove trailing 's')
   */
  private singularize(word: string): string {
    if (word.endsWith('ies')) {
      return word.slice(0, -3) + 'y';
    }
    if (word.endsWith('es')) {
      return word.slice(0, -2);
    }
    if (word.endsWith('s') && !word.endsWith('ss')) {
      return word.slice(0, -1);
    }
    return word;
  }

  /**
   * Detect authentication requirements with enhanced info
   */
  detectAuthentication(): AuthDetectionResult[] {
    const securitySchemes = this.spec.components?.securitySchemes || {};
    const results: AuthDetectionResult[] = [];

    for (const [name, scheme] of Object.entries(securitySchemes)) {
      if ('$ref' in scheme) continue;

      const result: AuthDetectionResult = {
        type: 'unknown',
        name,
      };

      switch (scheme.type) {
        case 'apiKey':
          result.type = 'apiKey';
          result.in = scheme.in as any;
          result.headerName = scheme.name;
          result.envVar = this.generateEnvVarName(name, 'API_KEY');
          break;
        case 'http':
          if (scheme.scheme === 'bearer') {
            result.type = 'bearer';
            result.envVar = this.generateEnvVarName(name, 'TOKEN');
          } else if (scheme.scheme === 'basic') {
            result.type = 'basic';
            result.envVar = this.generateEnvVarName(name, 'AUTH');
          }
          break;
        case 'oauth2':
          result.type = 'oauth2';
          result.flows = scheme.flows;
          result.envVar = this.generateEnvVarName(name, 'OAUTH_TOKEN');
          break;
        case 'openIdConnect':
          result.type = 'openIdConnect';
          result.envVar = this.generateEnvVarName(name, 'OIDC_TOKEN');
          break;
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Generate environment variable name
   */
  private generateEnvVarName(schemeName: string, suffix: string): string {
    return `${schemeName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_${suffix}`;
  }

  /**
   * Get authentication info (legacy method for compatibility)
   */
  getAuthenticationInfo() {
    const securitySchemes = this.spec.components?.securitySchemes || {};
    const auth: {
      type: string;
      scheme?: string;
      in?: string;
      name?: string;
      flows?: any;
    }[] = [];

    for (const [name, scheme] of Object.entries(securitySchemes)) {
      if ('$ref' in scheme) continue;

      auth.push({
        type: scheme.type,
        scheme: 'scheme' in scheme ? scheme.scheme : undefined,
        in: 'in' in scheme ? scheme.in : undefined,
        name: 'name' in scheme ? scheme.name : undefined,
        flows: 'flows' in scheme ? scheme.flows : undefined,
      });
    }

    return auth;
  }

  /**
   * Match path against filter patterns
   */
  private matchesPathFilter(path: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      // Convert glob-like pattern to regex
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$'
      );
      return regex.test(path);
    });
  }

  /**
   * Get analytics about the endpoints
   */
  getEndpointStats(endpoints: EndpointInfo[]) {
    const methods = new Map<string, number>();
    const tags = new Map<string, number>();
    const crudOps = new Map<string, number>();
    let withPagination = 0;
    let withAuth = 0;
    let deprecated = 0;
    let webhooks = 0;
    let withExamples = 0;

    for (const endpoint of endpoints) {
      // Count methods
      methods.set(endpoint.method, (methods.get(endpoint.method) || 0) + 1);

      // Count tags
      endpoint.tags?.forEach(tag => {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      });

      // Count CRUD operations
      const crud = this.detectCrudOperation(endpoint);
      crudOps.set(crud, (crudOps.get(crud) || 0) + 1);

      // Check features
      if (this.detectPagination(endpoint)) withPagination++;
      if (endpoint.security && endpoint.security.length > 0) withAuth++;
      if (endpoint.deprecated) deprecated++;
      if (endpoint.isWebhook) webhooks++;
      if (endpoint.examples && endpoint.examples.length > 0) withExamples++;
    }

    return {
      total: endpoints.length,
      byMethod: Object.fromEntries(methods),
      byTag: Object.fromEntries(tags),
      byCrud: Object.fromEntries(crudOps),
      withPagination,
      withAuth,
      deprecated,
      webhooks,
      withExamples,
    };
  }
}
