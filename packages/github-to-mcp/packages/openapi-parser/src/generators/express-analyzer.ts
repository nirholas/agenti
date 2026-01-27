/**
 * @fileoverview Express.js route analyzer
 * Parses Express.js routes and extracts API information
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import {
  RouteAnalyzer,
  FileContent,
  AnalysisResult,
  AnalyzedRoute,
  RouteParameter,
  RouteBody,
  RouteResponse,
  JsonSchemaDefinition,
  HttpMethod,
  ParameterLocation,
} from './types.js';
import { OpenAPIV3_1 } from 'openapi-types';

/**
 * Regular expressions for Express.js route detection
 */
const ROUTE_PATTERNS = {
  // app.get('/path', handler)
  appMethod: /(?:app|router)\s*\.\s*(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  
  // router.route('/path').get(handler).post(handler)
  routeChain: /\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)((?:\s*\.\s*(?:get|post|put|patch|delete|head|options)\s*\([^)]*\))+)/gi,
  
  // Router declaration
  routerDeclaration: /(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.)?Router\s*\(\)/gi,
  
  // Middleware with path
  useWithPath: /(?:app|router)\s*\.\s*use\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  
  // Path parameters :param
  pathParam: /:(\w+)(?:\([^)]*\))?/g,
  
  // Query parameters from comments or validation
  queryParam: /@query\s+{(\w+)}\s+(\w+)(?:\s+-\s+(.+))?/gi,
  
  // Body schema from comments
  bodySchema: /@body\s+{(\w+)}\s+(.+)/gi,
  
  // Response from comments
  responseSchema: /@response\s+{(\d+)}\s+(.+)/gi,
  
  // JSDoc comment block
  jsdocComment: /\/\*\*[\s\S]*?\*\//g,
  
  // TypeScript interface
  tsInterface: /interface\s+(\w+)\s*{([^}]+)}/gi,
  
  // Zod schema
  zodSchema: /(?:const|let|var)\s+(\w+)\s*=\s*z\.object\s*\((\{[\s\S]*?\})\)/gi,
  
  // Express validator
  expressValidator: /(?:body|query|param)\s*\(\s*['"`](\w+)['"`]\s*\)(?:\s*\.\s*(\w+)\s*\([^)]*\))*/gi,
};

/**
 * Express.js route analyzer implementation
 */
export class ExpressAnalyzer implements RouteAnalyzer {
  name = 'express';
  
  private schemas: Record<string, JsonSchemaDefinition> = {};
  private warnings: string[] = [];
  private errors: string[] = [];
  private basePaths: Map<string, string> = new Map();

  /**
   * Check if files contain Express.js code
   */
  canAnalyze(files: FileContent[]): boolean {
    return files.some(file => {
      const content = file.content;
      return (
        content.includes("require('express')") ||
        content.includes('require("express")') ||
        content.includes("from 'express'") ||
        content.includes('from "express"') ||
        /(?:app|router)\s*\.\s*(get|post|put|patch|delete)\s*\(/.test(content)
      );
    });
  }

  /**
   * Analyze Express.js files and extract routes
   */
  async analyze(files: FileContent[]): Promise<AnalysisResult> {
    this.schemas = {};
    this.warnings = [];
    this.errors = [];
    this.basePaths.clear();

    const routes: AnalyzedRoute[] = [];
    const filesAnalyzed: string[] = [];

    // First pass: extract schemas and base paths
    for (const file of files) {
      this.extractSchemas(file);
      this.extractBasePaths(file);
    }

    // Second pass: extract routes
    for (const file of files) {
      if (this.isExpressFile(file)) {
        filesAnalyzed.push(file.path);
        const fileRoutes = this.extractRoutes(file);
        routes.push(...fileRoutes);
      }
    }

    return {
      routes,
      schemas: this.schemas,
      securitySchemes: this.detectSecuritySchemes(files),
      warnings: this.warnings,
      errors: this.errors,
      framework: 'express',
      filesAnalyzed,
    };
  }

  /**
   * Check if a file contains Express.js routes
   */
  private isExpressFile(file: FileContent): boolean {
    const content = file.content;
    return (
      /(?:app|router)\s*\.\s*(get|post|put|patch|delete|head|options|use)\s*\(/.test(content) ||
      /\.route\s*\(/.test(content)
    );
  }

  /**
   * Extract base paths from router mounting
   */
  private extractBasePaths(file: FileContent): void {
    const content = file.content;
    const useMatches = content.matchAll(ROUTE_PATTERNS.useWithPath);
    
    for (const match of useMatches) {
      const path = match[1];
      // Try to find the router being mounted
      const beforeUse = content.slice(0, match.index);
      const routerMatch = beforeUse.match(/(\w+)\s*=\s*require\s*\(['"`][^'"`]+['"`]\)/);
      if (routerMatch) {
        this.basePaths.set(routerMatch[1], path);
      }
    }
  }

  /**
   * Extract routes from a file
   */
  private extractRoutes(file: FileContent): AnalyzedRoute[] {
    const routes: AnalyzedRoute[] = [];
    const content = file.content;
    const lines = content.split('\n');

    // Extract routes using app.method() pattern
    const appMethodMatches = content.matchAll(ROUTE_PATTERNS.appMethod);
    for (const match of appMethodMatches) {
      const method = match[1].toLowerCase() as HttpMethod;
      const path = match[2];
      const line = this.getLineNumber(content, match.index!);
      
      const jsDoc = this.findPrecedingJsDoc(lines, line);
      const route = this.createRoute(file, method, path, line, jsDoc);
      routes.push(route);
    }

    // Extract routes using router.route().method() pattern
    const routeChainMatches = content.matchAll(ROUTE_PATTERNS.routeChain);
    for (const match of routeChainMatches) {
      const path = match[1];
      const chainedMethods = match[2];
      const line = this.getLineNumber(content, match.index!);
      
      // Extract each method from the chain
      const methodMatches = chainedMethods.matchAll(/\.(get|post|put|patch|delete|head|options)\s*\(/gi);
      for (const methodMatch of methodMatches) {
        const method = methodMatch[1].toLowerCase() as HttpMethod;
        const jsDoc = this.findPrecedingJsDoc(lines, line);
        const route = this.createRoute(file, method, path, line, jsDoc);
        routes.push(route);
      }
    }

    return routes;
  }

  /**
   * Create an analyzed route
   */
  private createRoute(
    file: FileContent,
    method: HttpMethod,
    path: string,
    line: number,
    jsDoc?: string
  ): AnalyzedRoute {
    const openApiPath = this.convertToOpenApiPath(path);
    const pathParams = this.extractPathParameters(path);
    const { summary, description, tags, queryParams, bodySchema, responses, deprecated, operationId } = 
      this.parseJsDoc(jsDoc);

    // Merge path parameters with any from JSDoc
    const allQueryParams = this.mergeQueryParameters(queryParams, file.content, path);

    const route: AnalyzedRoute = {
      method,
      path,
      openApiPath,
      operationId: operationId || this.generateOperationId(method, path),
      summary,
      description,
      tags: tags.length > 0 ? tags : this.inferTags(path),
      pathParameters: pathParams,
      queryParameters: allQueryParams,
      headerParameters: this.extractHeaderParameters(file.content, path),
      responses: responses.length > 0 ? responses : this.inferResponses(method),
      deprecated,
      sourceFile: file.path,
      sourceLine: line,
    };

    // Add request body for methods that typically have one
    if (['post', 'put', 'patch'].includes(method)) {
      route.requestBody = bodySchema || this.inferRequestBody(file.content, path);
    }

    return route;
  }

  /**
   * Convert Express path to OpenAPI path format
   */
  private convertToOpenApiPath(path: string): string {
    // Convert :param to {param}
    return path.replace(/:(\w+)(?:\([^)]*\))?/g, '{$1}');
  }

  /**
   * Extract path parameters from Express path
   */
  private extractPathParameters(path: string): RouteParameter[] {
    const params: RouteParameter[] = [];
    const matches = path.matchAll(ROUTE_PATTERNS.pathParam);
    
    for (const match of matches) {
      params.push({
        name: match[1],
        location: 'path',
        required: true,
        type: 'string',
        description: `Path parameter: ${match[1]}`,
      });
    }
    
    return params;
  }

  /**
   * Parse JSDoc comment for route metadata
   */
  private parseJsDoc(jsDoc?: string): {
    summary?: string;
    description?: string;
    tags: string[];
    queryParams: RouteParameter[];
    bodySchema?: RouteBody;
    responses: RouteResponse[];
    deprecated: boolean;
    operationId?: string;
  } {
    const result = {
      summary: undefined as string | undefined,
      description: undefined as string | undefined,
      tags: [] as string[],
      queryParams: [] as RouteParameter[],
      bodySchema: undefined as RouteBody | undefined,
      responses: [] as RouteResponse[],
      deprecated: false,
      operationId: undefined as string | undefined,
    };

    if (!jsDoc) return result;

    // Extract summary (first line after /**)
    const summaryMatch = jsDoc.match(/\/\*\*\s*\n?\s*\*\s*([^\n@]+)/);
    if (summaryMatch) {
      result.summary = summaryMatch[1].trim();
    }

    // Extract description (text before @tags)
    const descMatch = jsDoc.match(/\/\*\*[\s\S]*?\*\s+([^@]+?)(?=\s*@|\s*\*\/)/);
    if (descMatch) {
      result.description = descMatch[1]
        .replace(/^\s*\*\s*/gm, '')
        .trim();
    }

    // Extract @tag annotations
    const tagMatches = jsDoc.matchAll(/@tag\s+(\w+)/gi);
    for (const match of tagMatches) {
      result.tags.push(match[1]);
    }

    // Extract @param for query parameters
    const paramMatches = jsDoc.matchAll(/@param\s+{(\w+)}\s+(?:req\.query\.)?(\w+)(?:\s+-\s+(.+))?/gi);
    for (const match of paramMatches) {
      result.queryParams.push({
        name: match[2],
        location: 'query',
        required: !match[0].includes('?'),
        type: this.mapJsDocType(match[1]),
        description: match[3]?.trim(),
      });
    }

    // Extract @deprecated
    if (jsDoc.includes('@deprecated')) {
      result.deprecated = true;
    }

    // Extract @operationId
    const opIdMatch = jsDoc.match(/@operationId\s+(\w+)/i);
    if (opIdMatch) {
      result.operationId = opIdMatch[1];
    }

    // Extract @returns for response
    const returnsMatch = jsDoc.match(/@returns?\s+{(\w+)}\s*(.+)?/i);
    if (returnsMatch) {
      result.responses.push({
        statusCode: 200,
        description: returnsMatch[2]?.trim() || 'Successful response',
        contentType: 'application/json',
        schema: { type: this.mapJsDocType(returnsMatch[1]) },
      });
    }

    return result;
  }

  /**
   * Map JSDoc type to JSON Schema type
   */
  private mapJsDocType(jsDocType: string): 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' {
    const typeMap: Record<string, 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'> = {
      string: 'string',
      number: 'number',
      int: 'integer',
      integer: 'integer',
      boolean: 'boolean',
      bool: 'boolean',
      array: 'array',
      object: 'object',
      any: 'object',
    };
    return typeMap[jsDocType.toLowerCase()] || 'string';
  }

  /**
   * Generate operation ID from method and path
   */
  private generateOperationId(method: HttpMethod, path: string): string {
    const cleanPath = path
      .replace(/[/:{}]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return `${method}_${cleanPath || 'root'}`;
  }

  /**
   * Infer tags from path
   */
  private inferTags(path: string): string[] {
    const parts = path.split('/').filter(p => p && !p.startsWith(':') && !p.startsWith('{'));
    if (parts.length > 0) {
      // Use first path segment as tag
      return [parts[0].charAt(0).toUpperCase() + parts[0].slice(1)];
    }
    return ['Default'];
  }

  /**
   * Infer default responses based on method
   */
  private inferResponses(method: HttpMethod): RouteResponse[] {
    const responses: RouteResponse[] = [];
    
    switch (method) {
      case 'get':
        responses.push({
          statusCode: 200,
          description: 'Successful response',
          contentType: 'application/json',
        });
        break;
      case 'post':
        responses.push({
          statusCode: 201,
          description: 'Resource created',
          contentType: 'application/json',
        });
        break;
      case 'put':
      case 'patch':
        responses.push({
          statusCode: 200,
          description: 'Resource updated',
          contentType: 'application/json',
        });
        break;
      case 'delete':
        responses.push({
          statusCode: 204,
          description: 'Resource deleted',
        });
        break;
      default:
        responses.push({
          statusCode: 200,
          description: 'Successful response',
        });
    }

    // Add common error responses
    responses.push({
      statusCode: 400,
      description: 'Bad request',
      contentType: 'application/json',
    });
    responses.push({
      statusCode: 500,
      description: 'Internal server error',
      contentType: 'application/json',
    });

    return responses;
  }

  /**
   * Extract schemas from TypeScript interfaces and Zod schemas
   */
  private extractSchemas(file: FileContent): void {
    const content = file.content;

    // Extract TypeScript interfaces
    const interfaceMatches = content.matchAll(ROUTE_PATTERNS.tsInterface);
    for (const match of interfaceMatches) {
      const name = match[1];
      const body = match[2];
      this.schemas[name] = this.parseInterfaceBody(body);
    }

    // Extract Zod schemas
    const zodMatches = content.matchAll(ROUTE_PATTERNS.zodSchema);
    for (const match of zodMatches) {
      const name = match[1];
      // Simple Zod parsing - would need more sophisticated parsing in production
      this.schemas[name] = { type: 'object' };
    }
  }

  /**
   * Parse TypeScript interface body to JSON Schema
   */
  private parseInterfaceBody(body: string): JsonSchemaDefinition {
    const properties: Record<string, JsonSchemaDefinition> = {};
    const required: string[] = [];

    const propMatches = body.matchAll(/(\w+)(\?)?:\s*([^;]+);/g);
    for (const match of propMatches) {
      const propName = match[1];
      const isOptional = !!match[2];
      const propType = match[3].trim();

      properties[propName] = this.tsTypeToJsonSchema(propType);
      if (!isOptional) {
        required.push(propName);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Convert TypeScript type to JSON Schema
   */
  private tsTypeToJsonSchema(tsType: string): JsonSchemaDefinition {
    const type = tsType.toLowerCase().trim();
    
    if (type === 'string') return { type: 'string' };
    if (type === 'number') return { type: 'number' };
    if (type === 'boolean') return { type: 'boolean' };
    if (type.endsWith('[]')) {
      const itemType = type.slice(0, -2);
      return { type: 'array', items: this.tsTypeToJsonSchema(itemType) };
    }
    if (type === 'any' || type === 'unknown') return { type: 'object' };
    
    // Check if it's a reference to a known schema
    if (this.schemas[tsType]) {
      return { $ref: `#/components/schemas/${tsType}` };
    }
    
    return { type: 'object' };
  }

  /**
   * Find JSDoc comment preceding a line
   */
  private findPrecedingJsDoc(lines: string[], lineNumber: number): string | undefined {
    let jsDocEnd = -1;
    
    // Search backwards for JSDoc
    for (let i = lineNumber - 2; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.endsWith('*/')) {
        jsDocEnd = i;
      }
      if (line.startsWith('/**') && jsDocEnd !== -1) {
        return lines.slice(i, jsDocEnd + 1).join('\n');
      }
      // Stop searching if we hit a non-comment line before finding start
      if (jsDocEnd === -1 && line && !line.startsWith('//') && !line.startsWith('*')) {
        break;
      }
    }
    
    return undefined;
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
  }

  /**
   * Merge query parameters from multiple sources
   */
  private mergeQueryParameters(
    fromJsDoc: RouteParameter[],
    content: string,
    _path: string
  ): RouteParameter[] {
    const params = [...fromJsDoc];
    const existingNames = new Set(params.map(p => p.name));

    // Look for express-validator usage
    const validatorMatches = content.matchAll(ROUTE_PATTERNS.expressValidator);
    for (const match of validatorMatches) {
      const name = match[1];
      if (!existingNames.has(name)) {
        params.push({
          name,
          location: 'query',
          required: false,
          type: 'string',
        });
        existingNames.add(name);
      }
    }

    return params;
  }

  /**
   * Extract header parameters from code
   */
  private extractHeaderParameters(_content: string, _path: string): RouteParameter[] {
    // Look for common header access patterns
    const params: RouteParameter[] = [];
    
    // Always include authorization header if auth middleware is detected
    // This is a simplified detection
    return params;
  }

  /**
   * Infer request body from code
   */
  private inferRequestBody(_content: string, _path: string): RouteBody | undefined {
    // Default request body for mutation endpoints
    return {
      contentType: 'application/json',
      required: true,
      schema: { type: 'object' },
      description: 'Request body',
    };
  }

  /**
   * Detect security schemes from code
   */
  private detectSecuritySchemes(files: FileContent[]): Record<string, OpenAPIV3_1.SecuritySchemeObject> {
    const schemes: Record<string, OpenAPIV3_1.SecuritySchemeObject> = {};

    for (const file of files) {
      const content = file.content;

      // Check for JWT/Bearer auth
      if (
        content.includes('passport-jwt') ||
        content.includes('jsonwebtoken') ||
        content.includes('Bearer') ||
        content.includes('authorization')
      ) {
        schemes.bearerAuth = {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        };
      }

      // Check for API key auth
      if (content.includes('x-api-key') || content.includes('apiKey')) {
        schemes.apiKey = {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        };
      }

      // Check for basic auth
      if (content.includes('passport-http') || content.includes('basic-auth')) {
        schemes.basicAuth = {
          type: 'http',
          scheme: 'basic',
        };
      }
    }

    return schemes;
  }
}
