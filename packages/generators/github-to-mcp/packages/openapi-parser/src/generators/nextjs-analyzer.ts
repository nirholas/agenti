/**
 * @fileoverview Next.js API route analyzer
 * Parses Next.js API routes from app/api and pages/api directories
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
 * Regular expressions for Next.js route detection
 */
const ROUTE_PATTERNS = {
  // App Router: export async function GET/POST/PUT/PATCH/DELETE
  appRouterHandler: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/gi,
  
  // App Router: export const GET/POST = async (req) =>
  appRouterArrowHandler: /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=\s*(?:async\s*)?\(/gi,
  
  // Pages Router: export default function handler
  pagesRouterDefault: /export\s+default\s+(?:async\s+)?function\s+(\w+)?\s*\(/gi,
  
  // Pages Router: handler with switch on method
  methodSwitch: /(?:req|request)\.method\s*===?\s*['"](\w+)['"]/gi,
  
  // NextRequest/NextResponse imports
  nextImports: /import\s+{[^}]*(?:NextRequest|NextResponse)[^}]*}\s+from\s+['"]next\/server['"]/gi,
  
  // Route segment config
  routeConfig: /export\s+const\s+(dynamic|runtime|revalidate|fetchCache|preferredRegion)\s*=/gi,
  
  // Zod schema
  zodSchema: /(?:const|let|var)\s+(\w+)Schema?\s*=\s*z\.object\s*\((\{[\s\S]*?\})\)/gi,
  
  // Request body parsing
  bodyParsing: /(?:await\s+)?(?:req|request)\.json\s*\(\)/gi,
  
  // URL search params
  searchParams: /(?:searchParams|url\.searchParams)\.get\s*\(\s*['"](\w+)['"]\)/gi,
  
  // Dynamic route params
  dynamicParams: /params\.(\w+)/gi,
  
  // Response with status
  responseStatus: /(?:NextResponse\.json|Response\.json)\s*\([^,]+,\s*\{\s*status:\s*(\d+)/gi,
  
  // TypeScript interface
  tsInterface: /interface\s+(\w+)\s*{([^}]+)}/gi,
  
  // Type annotation
  typeAnnotation: /:\s*(\w+)(?:<[^>]+>)?/g,
  
  // JSDoc comment
  jsdocComment: /\/\*\*[\s\S]*?\*\//g,
};

/**
 * Next.js API route analyzer implementation
 */
export class NextJSAnalyzer implements RouteAnalyzer {
  name = 'nextjs';
  
  private schemas: Record<string, JsonSchemaDefinition> = {};
  private warnings: string[] = [];
  private errors: string[] = [];
  private routerType: 'app' | 'pages' | 'unknown' = 'unknown';

  /**
   * Check if files contain Next.js API routes
   */
  canAnalyze(files: FileContent[]): boolean {
    return files.some(file => {
      const content = file.content;
      const path = file.path.toLowerCase();
      
      return (
        // App Router
        (path.includes('/app/') && path.includes('/api/') && path.includes('route.')) ||
        // Pages Router
        (path.includes('/pages/api/')) ||
        // Next.js imports
        content.includes("from 'next/server'") ||
        content.includes('from "next/server"') ||
        content.includes('NextApiRequest') ||
        content.includes('NextRequest')
      );
    });
  }

  /**
   * Analyze Next.js files and extract routes
   */
  async analyze(files: FileContent[]): Promise<AnalysisResult> {
    this.schemas = {};
    this.warnings = [];
    this.errors = [];

    const routes: AnalyzedRoute[] = [];
    const filesAnalyzed: string[] = [];

    // Detect router type
    this.detectRouterType(files);

    // First pass: extract schemas
    for (const file of files) {
      this.extractSchemas(file);
    }

    // Second pass: extract routes
    for (const file of files) {
      if (this.isApiRouteFile(file)) {
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
      framework: 'nextjs',
      filesAnalyzed,
    };
  }

  /**
   * Detect whether it's App Router or Pages Router
   */
  private detectRouterType(files: FileContent[]): void {
    for (const file of files) {
      const path = file.path.toLowerCase();
      
      if (path.includes('/app/') && path.includes('route.')) {
        this.routerType = 'app';
        return;
      }
      if (path.includes('/pages/api/')) {
        this.routerType = 'pages';
        return;
      }
    }
  }

  /**
   * Check if a file is an API route file
   */
  private isApiRouteFile(file: FileContent): boolean {
    const path = file.path.toLowerCase();
    
    // App Router: route.ts/js in app/api
    if (path.includes('/api/') && /route\.(ts|js|tsx|jsx)$/.test(path)) {
      return true;
    }
    
    // Pages Router: any file in pages/api
    if (path.includes('/pages/api/') && /\.(ts|js|tsx|jsx)$/.test(path)) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract routes from a file
   */
  private extractRoutes(file: FileContent): AnalyzedRoute[] {
    const path = file.path.toLowerCase();
    
    if (path.includes('/app/') && path.includes('route.')) {
      return this.extractAppRouterRoutes(file);
    }
    
    return this.extractPagesRouterRoutes(file);
  }

  /**
   * Extract routes from App Router file
   */
  private extractAppRouterRoutes(file: FileContent): AnalyzedRoute[] {
    const routes: AnalyzedRoute[] = [];
    const content = file.content;
    const apiPath = this.getApiPathFromFilePath(file.path, 'app');
    
    // Find all exported HTTP method handlers
    ROUTE_PATTERNS.appRouterHandler.lastIndex = 0;
    ROUTE_PATTERNS.appRouterArrowHandler.lastIndex = 0;
    
    let match;
    
    // Match function declarations
    while ((match = ROUTE_PATTERNS.appRouterHandler.exec(content)) !== null) {
      const method = match[1].toLowerCase() as HttpMethod;
      const line = this.getLineNumber(content, match.index);
      const jsDoc = this.findPrecedingJsDoc(content, match.index);
      
      routes.push(this.createRoute(file, method, apiPath, line, jsDoc, content));
    }
    
    // Match arrow function exports
    while ((match = ROUTE_PATTERNS.appRouterArrowHandler.exec(content)) !== null) {
      const method = match[1].toLowerCase() as HttpMethod;
      const line = this.getLineNumber(content, match.index);
      const jsDoc = this.findPrecedingJsDoc(content, match.index);
      
      routes.push(this.createRoute(file, method, apiPath, line, jsDoc, content));
    }

    return routes;
  }

  /**
   * Extract routes from Pages Router file
   */
  private extractPagesRouterRoutes(file: FileContent): AnalyzedRoute[] {
    const routes: AnalyzedRoute[] = [];
    const content = file.content;
    const apiPath = this.getApiPathFromFilePath(file.path, 'pages');
    
    // Check for method switch pattern
    ROUTE_PATTERNS.methodSwitch.lastIndex = 0;
    const methods = new Set<HttpMethod>();
    
    let match;
    while ((match = ROUTE_PATTERNS.methodSwitch.exec(content)) !== null) {
      methods.add(match[1].toLowerCase() as HttpMethod);
    }
    
    // If no specific methods found, assume it handles all common methods
    if (methods.size === 0) {
      // Check if there's a default export (handler)
      if (/export\s+default/.test(content)) {
        methods.add('get');
        methods.add('post');
      }
    }
    
    const jsDoc = this.findPrecedingJsDoc(content, 0);
    
    for (const method of methods) {
      routes.push(this.createRoute(file, method, apiPath, 1, jsDoc, content));
    }

    return routes;
  }

  /**
   * Get API path from file path
   */
  private getApiPathFromFilePath(filePath: string, routerType: 'app' | 'pages'): string {
    let path = filePath;
    
    // Normalize path
    path = path.replace(/\\/g, '/');
    
    if (routerType === 'app') {
      // Extract path from app/api/... /route.ts
      const match = path.match(/\/app(\/api\/[^/]+(?:\/[^/]+)*?)\/route\.[^/]+$/i);
      if (match) {
        path = match[1];
      }
    } else {
      // Extract path from pages/api/...
      const match = path.match(/\/pages(\/api\/[^/]+(?:\/[^/]+)*?)\.[^/]+$/i);
      if (match) {
        path = match[1];
      }
    }
    
    // Convert dynamic segments
    // [param] -> {param}
    // [[...slug]] -> {slug}
    // [...slug] -> {slug}
    path = path
      .replace(/\[\[\.\.\.(\w+)\]\]/g, '{$1}')
      .replace(/\[\.\.\.(\w+)\]/g, '{$1}')
      .replace(/\[(\w+)\]/g, '{$1}');
    
    return path;
  }

  /**
   * Create an analyzed route
   */
  private createRoute(
    file: FileContent,
    method: HttpMethod,
    path: string,
    line: number,
    jsDoc: string | undefined,
    content: string
  ): AnalyzedRoute {
    const { summary, description, tags, deprecated } = this.parseJsDoc(jsDoc);
    const pathParams = this.extractPathParameters(path);
    const queryParams = this.extractQueryParameters(content);
    const responses = this.extractResponses(content, method);

    const route: AnalyzedRoute = {
      method,
      path,
      openApiPath: path,
      operationId: this.generateOperationId(method, path),
      summary,
      description,
      tags: tags.length > 0 ? tags : this.inferTags(path),
      pathParameters: pathParams,
      queryParameters: queryParams,
      headerParameters: this.extractHeaderParameters(content),
      responses: responses.length > 0 ? responses : this.inferResponses(method),
      deprecated,
      sourceFile: file.path,
      sourceLine: line,
    };

    // Add request body for mutation methods
    if (['post', 'put', 'patch'].includes(method)) {
      route.requestBody = this.extractRequestBody(content);
    }

    return route;
  }

  /**
   * Extract path parameters from path
   */
  private extractPathParameters(path: string): RouteParameter[] {
    const params: RouteParameter[] = [];
    const matches = path.matchAll(/\{(\w+)\}/g);
    
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
   * Extract query parameters from code
   */
  private extractQueryParameters(content: string): RouteParameter[] {
    const params: RouteParameter[] = [];
    const paramNames = new Set<string>();
    
    // Find searchParams.get() calls
    ROUTE_PATTERNS.searchParams.lastIndex = 0;
    let match;
    
    while ((match = ROUTE_PATTERNS.searchParams.exec(content)) !== null) {
      const name = match[1];
      if (!paramNames.has(name)) {
        paramNames.add(name);
        params.push({
          name,
          location: 'query',
          required: false,
          type: 'string',
        });
      }
    }
    
    return params;
  }

  /**
   * Extract header parameters from code
   */
  private extractHeaderParameters(content: string): RouteParameter[] {
    const params: RouteParameter[] = [];
    
    // Look for header access patterns
    const headerPatterns = [
      /headers\.get\s*\(\s*['"]([^'"]+)['"]\)/gi,
      /request\.headers\.get\s*\(\s*['"]([^'"]+)['"]\)/gi,
    ];
    
    const headerNames = new Set<string>();
    
    for (const pattern of headerPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1].toLowerCase();
        // Skip common headers that shouldn't be in the spec
        if (!['content-type', 'content-length', 'host'].includes(name) && !headerNames.has(name)) {
          headerNames.add(name);
          params.push({
            name: match[1],
            location: 'header',
            required: false,
            type: 'string',
          });
        }
      }
    }
    
    return params;
  }

  /**
   * Extract request body schema from code
   */
  private extractRequestBody(content: string): RouteBody {
    // Look for Zod schema usage
    const zodMatch = content.match(/(\w+)Schema\.parse\s*\(/);
    if (zodMatch && this.schemas[zodMatch[1]]) {
      return {
        contentType: 'application/json',
        required: true,
        schema: { $ref: `#/components/schemas/${zodMatch[1]}` },
        description: 'Request body',
      };
    }
    
    // Look for TypeScript type assertion
    const typeMatch = content.match(/await\s+(?:req|request)\.json\s*\(\)\s*(?:as\s+(\w+))?/);
    if (typeMatch && typeMatch[1] && this.schemas[typeMatch[1]]) {
      return {
        contentType: 'application/json',
        required: true,
        schema: { $ref: `#/components/schemas/${typeMatch[1]}` },
        description: 'Request body',
      };
    }
    
    // Default request body
    return {
      contentType: 'application/json',
      required: true,
      schema: { type: 'object' },
      description: 'Request body',
    };
  }

  /**
   * Extract responses from code
   */
  private extractResponses(content: string, method: HttpMethod): RouteResponse[] {
    const responses: RouteResponse[] = [];
    const statusCodes = new Set<number>();
    
    // Find NextResponse.json with status
    ROUTE_PATTERNS.responseStatus.lastIndex = 0;
    let match;
    
    while ((match = ROUTE_PATTERNS.responseStatus.exec(content)) !== null) {
      const status = parseInt(match[1], 10);
      if (!statusCodes.has(status)) {
        statusCodes.add(status);
        responses.push({
          statusCode: status,
          description: this.getStatusDescription(status),
          contentType: 'application/json',
          schema: { type: 'object' },
        });
      }
    }
    
    // If no explicit status codes found, add defaults
    if (responses.length === 0) {
      return this.inferResponses(method);
    }
    
    return responses;
  }

  /**
   * Infer responses based on method
   */
  private inferResponses(method: HttpMethod): RouteResponse[] {
    const responses: RouteResponse[] = [];
    
    switch (method) {
      case 'get':
        responses.push({
          statusCode: 200,
          description: 'Successful response',
          contentType: 'application/json',
          schema: { type: 'object' },
        });
        break;
      case 'post':
        responses.push({
          statusCode: 201,
          description: 'Resource created',
          contentType: 'application/json',
          schema: { type: 'object' },
        });
        break;
      case 'put':
      case 'patch':
        responses.push({
          statusCode: 200,
          description: 'Resource updated',
          contentType: 'application/json',
          schema: { type: 'object' },
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
      schema: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
    });
    responses.push({
      statusCode: 500,
      description: 'Internal server error',
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
    });

    return responses;
  }

  /**
   * Get status description
   */
  private getStatusDescription(status: number): string {
    const descriptions: Record<number, string> = {
      200: 'Successful response',
      201: 'Resource created',
      204: 'No content',
      400: 'Bad request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not found',
      405: 'Method not allowed',
      422: 'Unprocessable entity',
      429: 'Too many requests',
      500: 'Internal server error',
    };
    return descriptions[status] || `HTTP ${status}`;
  }

  /**
   * Parse JSDoc comment
   */
  private parseJsDoc(jsDoc?: string): {
    summary?: string;
    description?: string;
    tags: string[];
    deprecated: boolean;
  } {
    const result = {
      summary: undefined as string | undefined,
      description: undefined as string | undefined,
      tags: [] as string[],
      deprecated: false,
    };

    if (!jsDoc) return result;

    // Extract summary (first line)
    const summaryMatch = jsDoc.match(/\/\*\*\s*\n?\s*\*\s*([^\n@]+)/);
    if (summaryMatch) {
      result.summary = summaryMatch[1].trim();
    }

    // Extract @tag
    const tagMatches = jsDoc.matchAll(/@tag\s+(\w+)/gi);
    for (const match of tagMatches) {
      result.tags.push(match[1]);
    }

    // Check for @deprecated
    if (jsDoc.includes('@deprecated')) {
      result.deprecated = true;
    }

    return result;
  }

  /**
   * Find preceding JSDoc comment
   */
  private findPrecedingJsDoc(content: string, position: number): string | undefined {
    const before = content.slice(0, position);
    const match = before.match(/\/\*\*[\s\S]*?\*\/\s*$/);
    return match ? match[0] : undefined;
  }

  /**
   * Extract schemas from file
   */
  private extractSchemas(file: FileContent): void {
    const content = file.content;

    // Extract TypeScript interfaces
    ROUTE_PATTERNS.tsInterface.lastIndex = 0;
    let match;
    
    while ((match = ROUTE_PATTERNS.tsInterface.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      this.schemas[name] = this.parseInterfaceBody(body);
    }

    // Extract Zod schemas
    ROUTE_PATTERNS.zodSchema.lastIndex = 0;
    while ((match = ROUTE_PATTERNS.zodSchema.exec(content)) !== null) {
      const name = match[1];
      // Simple Zod parsing
      this.schemas[name] = { type: 'object' };
    }
  }

  /**
   * Parse TypeScript interface body to JSON Schema
   */
  private parseInterfaceBody(body: string): JsonSchemaDefinition {
    const properties: Record<string, JsonSchemaDefinition> = {};
    const required: string[] = [];

    const propMatches = body.matchAll(/(\w+)(\?)?:\s*([^;]+);?/g);
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
    const originalType = tsType.trim();
    if (this.schemas[originalType]) {
      return { $ref: `#/components/schemas/${originalType}` };
    }
    
    return { type: 'object' };
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(method: HttpMethod, path: string): string {
    const cleanPath = path
      .replace(/\/api\//g, '_')
      .replace(/[/{}]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return `${method}_${cleanPath || 'root'}`;
  }

  /**
   * Infer tags from path
   */
  private inferTags(path: string): string[] {
    const parts = path.split('/').filter(p => p && p !== 'api' && !p.startsWith('{'));
    if (parts.length > 0) {
      return [parts[0].charAt(0).toUpperCase() + parts[0].slice(1)];
    }
    return ['API'];
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

      // Check for authorization header usage
      if (content.includes('authorization') || content.includes('Authorization')) {
        schemes.bearerAuth = {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        };
      }

      // Check for API key usage
      if (content.includes('x-api-key') || content.includes('X-API-Key')) {
        schemes.apiKey = {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        };
      }

      // Check for NextAuth
      if (content.includes('next-auth') || content.includes('getServerSession')) {
        schemes.session = {
          type: 'apiKey',
          in: 'cookie',
          name: 'next-auth.session-token',
        };
      }
    }

    return schemes;
  }
}
