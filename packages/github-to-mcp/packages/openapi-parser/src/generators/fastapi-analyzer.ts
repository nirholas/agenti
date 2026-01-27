/**
 * @fileoverview FastAPI/Flask route analyzer
 * Parses Python web framework routes and extracts API information
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
} from './types.js';
import { OpenAPIV3_1 } from 'openapi-types';

/**
 * Regular expressions for FastAPI/Flask route detection
 */
const ROUTE_PATTERNS = {
  // FastAPI decorators: @app.get('/path')
  fastapiDecorator: /@(?:app|router)\s*\.\s*(get|post|put|patch|delete|head|options)\s*\(\s*['"]([^'"]+)['"]/gi,
  
  // Flask decorators: @app.route('/path', methods=['GET'])
  flaskRoute: /@(?:app|blueprint|bp)\s*\.\s*route\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?/gi,
  
  // FastAPI path parameters
  fastapiPathParam: /\{(\w+)(?::\s*\w+)?\}/g,
  
  // Flask path parameters
  flaskPathParam: /<(?:(\w+):)?(\w+)>/g,
  
  // Pydantic model
  pydanticModel: /class\s+(\w+)\s*\(\s*(?:BaseModel|Base)\s*\)\s*:\s*([\s\S]*?)(?=\nclass\s|\n\n\n|$)/gi,
  
  // Type hints
  typeHint: /(\w+)\s*:\s*(\w+(?:\[[\w\[\],\s]+\])?)/g,
  
  // Default values
  defaultValue: /(\w+)\s*:\s*\w+\s*=\s*([^,\n]+)/g,
  
  // Query parameter
  queryParam: /(\w+)\s*:\s*(\w+)\s*=\s*Query\s*\(/gi,
  
  // Path parameter
  pathParam: /(\w+)\s*:\s*(\w+)\s*=\s*Path\s*\(/gi,
  
  // Body parameter
  bodyParam: /(\w+)\s*:\s*(\w+)\s*=\s*Body\s*\(/gi,
  
  // Header parameter
  headerParam: /(\w+)\s*:\s*(\w+)\s*=\s*Header\s*\(/gi,
  
  // Docstring
  docstring: /"""([\s\S]*?)"""|'''([\s\S]*?)'''/g,
  
  // Function definition
  functionDef: /(?:async\s+)?def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[\w\[\],\s]+)?:\s*/g,
  
  // Return type annotation
  returnType: /->\s*([\w\[\],\s]+)/,
  
  // Response model
  responseModel: /response_model\s*=\s*(\w+)/gi,
  
  // Status code
  statusCode: /status_code\s*=\s*(\d+)/gi,
  
  // Tags
  tags: /tags\s*=\s*\[([^\]]+)\]/gi,
  
  // Summary/description
  summary: /summary\s*=\s*['"]([^'"]+)['"]/gi,
  description: /description\s*=\s*['"]([^'"]+)['"]/gi,
  
  // Deprecated
  deprecated: /deprecated\s*=\s*True/gi,
  
  // Optional type
  optionalType: /Optional\[(\w+)\]/,
  
  // List type
  listType: /List\[(\w+)\]|list\[(\w+)\]/,
  
  // Dict type
  dictType: /Dict\[(\w+),\s*(\w+)\]|dict\[(\w+),\s*(\w+)\]/,
};

/**
 * FastAPI/Flask route analyzer implementation
 */
export class FastAPIAnalyzer implements RouteAnalyzer {
  name = 'fastapi';
  
  private schemas: Record<string, JsonSchemaDefinition> = {};
  private warnings: string[] = [];
  private errors: string[] = [];
  private framework: 'fastapi' | 'flask' = 'fastapi';

  /**
   * Check if files contain FastAPI or Flask code
   */
  canAnalyze(files: FileContent[]): boolean {
    return files.some(file => {
      const content = file.content;
      return (
        content.includes('from fastapi import') ||
        content.includes('import fastapi') ||
        content.includes('from flask import') ||
        content.includes('import flask') ||
        content.includes('FastAPI()') ||
        content.includes('Flask(__name__)') ||
        /@(?:app|router)\s*\.\s*(get|post|put|patch|delete)/.test(content)
      );
    });
  }

  /**
   * Analyze FastAPI/Flask files and extract routes
   */
  async analyze(files: FileContent[]): Promise<AnalysisResult> {
    this.schemas = {};
    this.warnings = [];
    this.errors = [];

    const routes: AnalyzedRoute[] = [];
    const filesAnalyzed: string[] = [];

    // Detect framework
    this.detectFramework(files);

    // First pass: extract Pydantic models
    for (const file of files) {
      this.extractPydanticModels(file);
    }

    // Second pass: extract routes
    for (const file of files) {
      if (this.isPythonApiFile(file)) {
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
      framework: this.framework,
      filesAnalyzed,
    };
  }

  /**
   * Detect whether it's FastAPI or Flask
   */
  private detectFramework(files: FileContent[]): void {
    for (const file of files) {
      if (file.content.includes('fastapi') || file.content.includes('FastAPI')) {
        this.framework = 'fastapi';
        return;
      }
      if (file.content.includes('flask') || file.content.includes('Flask')) {
        this.framework = 'flask';
        return;
      }
    }
  }

  /**
   * Check if a file contains Python API routes
   */
  private isPythonApiFile(file: FileContent): boolean {
    const content = file.content;
    return (
      file.path.endsWith('.py') &&
      (ROUTE_PATTERNS.fastapiDecorator.test(content) ||
       ROUTE_PATTERNS.flaskRoute.test(content))
    );
  }

  /**
   * Extract routes from a file
   */
  private extractRoutes(file: FileContent): AnalyzedRoute[] {
    const routes: AnalyzedRoute[] = [];
    const content = file.content;
    const lines = content.split('\n');

    // Reset regex lastIndex
    ROUTE_PATTERNS.fastapiDecorator.lastIndex = 0;
    ROUTE_PATTERNS.flaskRoute.lastIndex = 0;

    if (this.framework === 'fastapi') {
      // Extract FastAPI routes
      let match;
      while ((match = ROUTE_PATTERNS.fastapiDecorator.exec(content)) !== null) {
        const method = match[1].toLowerCase() as HttpMethod;
        const path = match[2];
        const line = this.getLineNumber(content, match.index);
        
        const decoratorLine = lines[line - 1];
        const route = this.createFastAPIRoute(file, method, path, line, content, decoratorLine);
        routes.push(route);
      }
    } else {
      // Extract Flask routes
      let match;
      while ((match = ROUTE_PATTERNS.flaskRoute.exec(content)) !== null) {
        const path = match[1];
        const methodsStr = match[2] || "'GET'";
        const methods = methodsStr
          .replace(/['"]/g, '')
          .split(',')
          .map(m => m.trim().toLowerCase() as HttpMethod);
        
        const line = this.getLineNumber(content, match.index);
        
        for (const method of methods) {
          const route = this.createFlaskRoute(file, method, path, line, content);
          routes.push(route);
        }
      }
    }

    return routes;
  }

  /**
   * Create a FastAPI route
   */
  private createFastAPIRoute(
    file: FileContent,
    method: HttpMethod,
    path: string,
    line: number,
    content: string,
    decoratorLine: string
  ): AnalyzedRoute {
    const openApiPath = this.convertToOpenApiPath(path);
    const pathParams = this.extractFastAPIPathParameters(path);
    
    // Extract metadata from decorator
    const { tags, summary, description, statusCode, responseModel, deprecated } = 
      this.parseDecoratorMetadata(decoratorLine, content, line);

    // Find the function definition and extract parameters
    const funcInfo = this.findFunctionInfo(content, line);
    const { queryParams, headerParams, bodyParam } = this.parseFunctionParameters(funcInfo?.params || '');

    const route: AnalyzedRoute = {
      method,
      path,
      openApiPath,
      operationId: funcInfo?.name || this.generateOperationId(method, path),
      summary: summary || funcInfo?.docSummary,
      description: description || funcInfo?.docDescription,
      tags,
      pathParameters: pathParams,
      queryParameters: queryParams,
      headerParameters: headerParams,
      responses: this.buildResponses(statusCode, responseModel, method),
      deprecated,
      sourceFile: file.path,
      sourceLine: line,
    };

    if (bodyParam) {
      route.requestBody = bodyParam;
    } else if (['post', 'put', 'patch'].includes(method)) {
      // Try to infer body from Pydantic type hint
      const bodyType = this.inferBodyType(funcInfo?.params || '');
      if (bodyType) {
        route.requestBody = {
          contentType: 'application/json',
          required: true,
          schema: { $ref: `#/components/schemas/${bodyType}` },
        };
      }
    }

    return route;
  }

  /**
   * Create a Flask route
   */
  private createFlaskRoute(
    file: FileContent,
    method: HttpMethod,
    path: string,
    line: number,
    content: string
  ): AnalyzedRoute {
    const openApiPath = this.convertFlaskToOpenApiPath(path);
    const pathParams = this.extractFlaskPathParameters(path);
    
    const funcInfo = this.findFunctionInfo(content, line);

    const route: AnalyzedRoute = {
      method,
      path,
      openApiPath,
      operationId: funcInfo?.name || this.generateOperationId(method, path),
      summary: funcInfo?.docSummary,
      description: funcInfo?.docDescription,
      tags: this.inferTags(path),
      pathParameters: pathParams,
      queryParameters: this.extractFlaskQueryParams(content, line),
      headerParameters: [],
      responses: this.buildResponses(200, undefined, method),
      sourceFile: file.path,
      sourceLine: line,
    };

    if (['post', 'put', 'patch'].includes(method)) {
      route.requestBody = {
        contentType: 'application/json',
        required: true,
        schema: { type: 'object' },
      };
    }

    return route;
  }

  /**
   * Convert FastAPI path to OpenAPI format
   */
  private convertToOpenApiPath(path: string): string {
    // FastAPI already uses {param} format
    return path;
  }

  /**
   * Convert Flask path to OpenAPI format
   */
  private convertFlaskToOpenApiPath(path: string): string {
    // Convert <type:param> to {param}
    return path.replace(/<(?:\w+:)?(\w+)>/g, '{$1}');
  }

  /**
   * Extract path parameters from FastAPI path
   */
  private extractFastAPIPathParameters(path: string): RouteParameter[] {
    const params: RouteParameter[] = [];
    ROUTE_PATTERNS.fastapiPathParam.lastIndex = 0;
    
    let match;
    while ((match = ROUTE_PATTERNS.fastapiPathParam.exec(path)) !== null) {
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
   * Extract path parameters from Flask path
   */
  private extractFlaskPathParameters(path: string): RouteParameter[] {
    const params: RouteParameter[] = [];
    ROUTE_PATTERNS.flaskPathParam.lastIndex = 0;
    
    let match;
    while ((match = ROUTE_PATTERNS.flaskPathParam.exec(path)) !== null) {
      const type = match[1] || 'string';
      const name = match[2];
      params.push({
        name,
        location: 'path',
        required: true,
        type: this.mapFlaskType(type),
        description: `Path parameter: ${name}`,
      });
    }
    
    return params;
  }

  /**
   * Map Flask type to JSON Schema type
   */
  private mapFlaskType(flaskType: string): 'string' | 'number' | 'integer' {
    const typeMap: Record<string, 'string' | 'number' | 'integer'> = {
      string: 'string',
      int: 'integer',
      float: 'number',
      path: 'string',
      uuid: 'string',
    };
    return typeMap[flaskType] || 'string';
  }

  /**
   * Parse FastAPI decorator metadata
   */
  private parseDecoratorMetadata(
    decoratorLine: string,
    content: string,
    line: number
  ): {
    tags: string[];
    summary?: string;
    description?: string;
    statusCode?: number;
    responseModel?: string;
    deprecated: boolean;
  } {
    // Get the full decorator including multiple lines
    const lines = content.split('\n');
    let fullDecorator = decoratorLine;
    let i = line;
    
    // Handle multi-line decorators
    while (!fullDecorator.includes(')') && i < lines.length) {
      fullDecorator += lines[i];
      i++;
    }

    const result = {
      tags: [] as string[],
      summary: undefined as string | undefined,
      description: undefined as string | undefined,
      statusCode: undefined as number | undefined,
      responseModel: undefined as string | undefined,
      deprecated: false,
    };

    // Extract tags
    const tagsMatch = fullDecorator.match(/tags\s*=\s*\[([^\]]+)\]/);
    if (tagsMatch) {
      result.tags = tagsMatch[1]
        .split(',')
        .map(t => t.trim().replace(/['"]/g, ''))
        .filter(t => t);
    }

    // Extract summary
    const summaryMatch = fullDecorator.match(/summary\s*=\s*['"]([^'"]+)['"]/);
    if (summaryMatch) {
      result.summary = summaryMatch[1];
    }

    // Extract description
    const descMatch = fullDecorator.match(/description\s*=\s*['"]([^'"]+)['"]/);
    if (descMatch) {
      result.description = descMatch[1];
    }

    // Extract status code
    const statusMatch = fullDecorator.match(/status_code\s*=\s*(\d+)/);
    if (statusMatch) {
      result.statusCode = parseInt(statusMatch[1], 10);
    }

    // Extract response model
    const modelMatch = fullDecorator.match(/response_model\s*=\s*(\w+)/);
    if (modelMatch) {
      result.responseModel = modelMatch[1];
    }

    // Check for deprecated
    if (fullDecorator.includes('deprecated=True')) {
      result.deprecated = true;
    }

    return result;
  }

  /**
   * Find function info after a route decorator
   */
  private findFunctionInfo(content: string, decoratorLine: number): {
    name: string;
    params: string;
    returnType?: string;
    docSummary?: string;
    docDescription?: string;
  } | undefined {
    const lines = content.split('\n');
    
    // Find the function definition after the decorator
    for (let i = decoratorLine; i < Math.min(decoratorLine + 10, lines.length); i++) {
      const line = lines[i];
      const funcMatch = line.match(/(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([\w\[\],\s]+))?/);
      
      if (funcMatch) {
        const name = funcMatch[1];
        const params = funcMatch[2];
        const returnType = funcMatch[3];
        
        // Look for docstring
        const docstring = this.extractDocstring(lines, i + 1);
        
        return {
          name,
          params,
          returnType,
          docSummary: docstring?.summary,
          docDescription: docstring?.description,
        };
      }
    }
    
    return undefined;
  }

  /**
   * Extract docstring from function
   */
  private extractDocstring(lines: string[], startLine: number): {
    summary?: string;
    description?: string;
  } | undefined {
    // Look for docstring start
    for (let i = startLine; i < Math.min(startLine + 3, lines.length); i++) {
      const line = lines[i].trim();
      if (line.startsWith('"""') || line.startsWith("'''")) {
        const quote = line.startsWith('"""') ? '"""' : "'''";
        let docContent = '';
        
        // Single line docstring
        if (line.endsWith(quote) && line.length > 6) {
          docContent = line.slice(3, -3);
        } else {
          // Multi-line docstring
          docContent = line.slice(3);
          for (let j = i + 1; j < lines.length; j++) {
            const docLine = lines[j];
            if (docLine.includes(quote)) {
              docContent += '\n' + docLine.split(quote)[0];
              break;
            }
            docContent += '\n' + docLine;
          }
        }
        
        const parts = docContent.trim().split('\n\n');
        return {
          summary: parts[0]?.trim(),
          description: parts.length > 1 ? parts.slice(1).join('\n\n').trim() : undefined,
        };
      }
    }
    
    return undefined;
  }

  /**
   * Parse function parameters
   */
  private parseFunctionParameters(params: string): {
    queryParams: RouteParameter[];
    headerParams: RouteParameter[];
    bodyParam?: RouteBody;
  } {
    const queryParams: RouteParameter[] = [];
    const headerParams: RouteParameter[] = [];
    let bodyParam: RouteBody | undefined;

    // Split parameters
    const paramList = params.split(',').map(p => p.trim()).filter(p => p);

    for (const param of paramList) {
      // Skip self, request, etc.
      if (['self', 'request', 'db', 'session'].some(skip => param.startsWith(skip))) {
        continue;
      }

      // Check for Query parameter
      if (param.includes('= Query(')) {
        const match = param.match(/(\w+)\s*:\s*(\w+)/);
        if (match) {
          queryParams.push({
            name: match[1],
            location: 'query',
            required: !param.includes('None'),
            type: this.mapPythonType(match[2]),
          });
        }
      }
      // Check for Header parameter
      else if (param.includes('= Header(')) {
        const match = param.match(/(\w+)\s*:\s*(\w+)/);
        if (match) {
          headerParams.push({
            name: match[1],
            location: 'header',
            required: !param.includes('None'),
            type: this.mapPythonType(match[2]),
          });
        }
      }
      // Check for Body parameter
      else if (param.includes('= Body(')) {
        const match = param.match(/(\w+)\s*:\s*(\w+)/);
        if (match) {
          bodyParam = {
            contentType: 'application/json',
            required: !param.includes('None'),
            schema: this.schemas[match[2]] 
              ? { $ref: `#/components/schemas/${match[2]}` }
              : { type: 'object' },
          };
        }
      }
      // Regular type-hinted parameter (likely Pydantic model for body)
      else if (param.includes(':') && !param.includes('=')) {
        const match = param.match(/(\w+)\s*:\s*(\w+)/);
        if (match && this.schemas[match[2]]) {
          // This is likely a request body
          bodyParam = {
            contentType: 'application/json',
            required: true,
            schema: { $ref: `#/components/schemas/${match[2]}` },
          };
        }
      }
    }

    return { queryParams, headerParams, bodyParam };
  }

  /**
   * Infer body type from function parameters
   */
  private inferBodyType(params: string): string | undefined {
    const paramList = params.split(',').map(p => p.trim()).filter(p => p);
    
    for (const param of paramList) {
      if (['self', 'request', 'db', 'session'].some(skip => param.startsWith(skip))) {
        continue;
      }
      
      const match = param.match(/\w+\s*:\s*(\w+)/);
      if (match && this.schemas[match[1]]) {
        return match[1];
      }
    }
    
    return undefined;
  }

  /**
   * Map Python type to JSON Schema type
   */
  private mapPythonType(pythonType: string): 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' {
    const typeMap: Record<string, 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'> = {
      str: 'string',
      int: 'integer',
      float: 'number',
      bool: 'boolean',
      list: 'array',
      List: 'array',
      dict: 'object',
      Dict: 'object',
      Any: 'object',
    };
    return typeMap[pythonType] || 'object';
  }

  /**
   * Extract Flask query parameters
   */
  private extractFlaskQueryParams(content: string, routeLine: number): RouteParameter[] {
    const params: RouteParameter[] = [];
    const lines = content.split('\n');
    
    // Look for request.args usage in the function
    for (let i = routeLine; i < Math.min(routeLine + 50, lines.length); i++) {
      const line = lines[i];
      
      // Check for request.args.get('param')
      const argsMatch = line.match(/request\.args\.get\s*\(\s*['"](\w+)['"]/g);
      if (argsMatch) {
        for (const match of argsMatch) {
          const paramMatch = match.match(/['"](\w+)['"]/);
          if (paramMatch) {
            params.push({
              name: paramMatch[1],
              location: 'query',
              required: false,
              type: 'string',
            });
          }
        }
      }
      
      // Stop at next function definition
      if (i > routeLine && /^def\s+\w+/.test(line)) {
        break;
      }
    }
    
    return params;
  }

  /**
   * Build response definitions
   */
  private buildResponses(
    statusCode?: number,
    responseModel?: string,
    method?: HttpMethod
  ): RouteResponse[] {
    const responses: RouteResponse[] = [];
    
    const defaultStatus = statusCode || this.getDefaultStatus(method);
    
    responses.push({
      statusCode: defaultStatus,
      description: this.getStatusDescription(defaultStatus),
      contentType: 'application/json',
      schema: responseModel && this.schemas[responseModel]
        ? { $ref: `#/components/schemas/${responseModel}` }
        : { type: 'object' },
    });

    // Add error responses
    responses.push({
      statusCode: 422,
      description: 'Validation Error',
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          detail: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                loc: { type: 'array', items: { type: 'string' } },
                msg: { type: 'string' },
                type: { type: 'string' },
              },
            },
          },
        },
      },
    });

    return responses;
  }

  /**
   * Get default status code for method
   */
  private getDefaultStatus(method?: HttpMethod): number {
    switch (method) {
      case 'post': return 201;
      case 'delete': return 204;
      default: return 200;
    }
  }

  /**
   * Get status description
   */
  private getStatusDescription(status: number): string {
    const descriptions: Record<number, string> = {
      200: 'Successful Response',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      422: 'Validation Error',
      500: 'Internal Server Error',
    };
    return descriptions[status] || 'Response';
  }

  /**
   * Extract Pydantic models
   */
  private extractPydanticModels(file: FileContent): void {
    const content = file.content;
    ROUTE_PATTERNS.pydanticModel.lastIndex = 0;
    
    let match;
    while ((match = ROUTE_PATTERNS.pydanticModel.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      this.schemas[name] = this.parsePydanticModel(body);
    }
  }

  /**
   * Parse Pydantic model body to JSON Schema
   */
  private parsePydanticModel(body: string): JsonSchemaDefinition {
    const properties: Record<string, JsonSchemaDefinition> = {};
    const required: string[] = [];

    const lines = body.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    
    for (const line of lines) {
      const match = line.match(/^\s*(\w+)\s*:\s*([^=]+)(?:=\s*(.+))?/);
      if (match) {
        const propName = match[1];
        const propType = match[2].trim();
        const defaultValue = match[3]?.trim();
        
        properties[propName] = this.pythonTypeToJsonSchema(propType);
        
        // If no default value and not Optional, it's required
        if (!defaultValue && !propType.includes('Optional')) {
          required.push(propName);
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
   * Convert Python type annotation to JSON Schema
   */
  private pythonTypeToJsonSchema(pythonType: string): JsonSchemaDefinition {
    const type = pythonType.trim();
    
    // Check for Optional
    const optionalMatch = type.match(/Optional\[(.+)\]/);
    if (optionalMatch) {
      const innerSchema = this.pythonTypeToJsonSchema(optionalMatch[1]);
      return { ...innerSchema, nullable: true };
    }
    
    // Check for List
    const listMatch = type.match(/(?:List|list)\[(.+)\]/);
    if (listMatch) {
      return {
        type: 'array',
        items: this.pythonTypeToJsonSchema(listMatch[1]),
      };
    }
    
    // Check for Dict
    const dictMatch = type.match(/(?:Dict|dict)\[(\w+),\s*(.+)\]/);
    if (dictMatch) {
      return {
        type: 'object',
        additionalProperties: this.pythonTypeToJsonSchema(dictMatch[2]),
      };
    }
    
    // Basic types
    const typeMap: Record<string, JsonSchemaDefinition> = {
      str: { type: 'string' },
      int: { type: 'integer' },
      float: { type: 'number' },
      bool: { type: 'boolean' },
      Any: { type: 'object' },
      None: { type: 'null' },
    };
    
    if (typeMap[type]) {
      return typeMap[type];
    }
    
    // Check if it's a reference to a known schema
    if (this.schemas[type]) {
      return { $ref: `#/components/schemas/${type}` };
    }
    
    return { type: 'object' };
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(method: HttpMethod, path: string): string {
    const cleanPath = path
      .replace(/[/{}]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return `${method}_${cleanPath || 'root'}`;
  }

  /**
   * Infer tags from path
   */
  private inferTags(path: string): string[] {
    const parts = path.split('/').filter(p => p && !p.startsWith('{'));
    if (parts.length > 0) {
      return [parts[0].charAt(0).toUpperCase() + parts[0].slice(1)];
    }
    return ['Default'];
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
  }

  /**
   * Detect security schemes
   */
  private detectSecuritySchemes(files: FileContent[]): Record<string, OpenAPIV3_1.SecuritySchemeObject> {
    const schemes: Record<string, OpenAPIV3_1.SecuritySchemeObject> = {};

    for (const file of files) {
      const content = file.content;

      // OAuth2
      if (content.includes('OAuth2PasswordBearer') || content.includes('oauth2_scheme')) {
        schemes.oauth2 = {
          type: 'oauth2',
          flows: {
            password: {
              tokenUrl: '/token',
              scopes: {},
            },
          },
        };
      }

      // API Key
      if (content.includes('APIKeyHeader') || content.includes('api_key')) {
        schemes.apiKey = {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        };
      }

      // JWT/Bearer
      if (content.includes('HTTPBearer') || content.includes('jwt')) {
        schemes.bearerAuth = {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        };
      }
    }

    return schemes;
  }
}
