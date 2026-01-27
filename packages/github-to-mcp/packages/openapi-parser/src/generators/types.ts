/**
 * @fileoverview Type definitions for OpenAPI generators
 * Reverse engineering: Generate OpenAPI specs from code
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { OpenAPIV3_1 } from 'openapi-types';

/**
 * HTTP methods supported by the analyzers
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

/**
 * Parameter location in the request
 */
export type ParameterLocation = 'path' | 'query' | 'header' | 'cookie';

/**
 * Supported JSON Schema types
 */
export type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

/**
 * Route parameter definition
 */
export interface RouteParameter {
  /** Parameter name */
  name: string;
  
  /** Where the parameter is located */
  location: ParameterLocation;
  
  /** Whether the parameter is required */
  required: boolean;
  
  /** Parameter type */
  type: JsonSchemaType;
  
  /** Parameter description */
  description?: string;
  
  /** Default value */
  defaultValue?: unknown;
  
  /** Format (e.g., 'email', 'uuid', 'date-time') */
  format?: string;
  
  /** Enum values if applicable */
  enum?: unknown[];
  
  /** Example value */
  example?: unknown;
  
  /** For array types, the schema of items */
  items?: JsonSchemaDefinition;
}

/**
 * Request body definition
 */
export interface RouteBody {
  /** Content type (e.g., 'application/json') */
  contentType: string;
  
  /** Whether the body is required */
  required: boolean;
  
  /** JSON Schema definition of the body */
  schema: JsonSchemaDefinition;
  
  /** Description of the body */
  description?: string;
  
  /** Example value */
  example?: unknown;
}

/**
 * Route response definition
 */
export interface RouteResponse {
  /** HTTP status code */
  statusCode: number;
  
  /** Response description */
  description: string;
  
  /** Content type */
  contentType?: string;
  
  /** JSON Schema definition of the response */
  schema?: JsonSchemaDefinition;
  
  /** Example value */
  example?: unknown;
}

/**
 * JSON Schema definition (simplified)
 */
export interface JsonSchemaDefinition {
  type?: JsonSchemaType | JsonSchemaType[];
  properties?: Record<string, JsonSchemaDefinition>;
  required?: string[];
  items?: JsonSchemaDefinition;
  description?: string;
  enum?: unknown[];
  format?: string;
  default?: unknown;
  example?: unknown;
  nullable?: boolean;
  oneOf?: JsonSchemaDefinition[];
  anyOf?: JsonSchemaDefinition[];
  allOf?: JsonSchemaDefinition[];
  $ref?: string;
  additionalProperties?: boolean | JsonSchemaDefinition;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

/**
 * Analyzed route from source code
 */
export interface AnalyzedRoute {
  /** HTTP method */
  method: HttpMethod;
  
  /** Route path (e.g., '/users/:id' or '/users/{id}') */
  path: string;
  
  /** Normalized path in OpenAPI format (e.g., '/users/{id}') */
  openApiPath: string;
  
  /** Operation ID for the route */
  operationId?: string;
  
  /** Route summary */
  summary?: string;
  
  /** Route description */
  description?: string;
  
  /** Route tags for grouping */
  tags?: string[];
  
  /** Path parameters */
  pathParameters: RouteParameter[];
  
  /** Query parameters */
  queryParameters: RouteParameter[];
  
  /** Header parameters */
  headerParameters: RouteParameter[];
  
  /** Request body */
  requestBody?: RouteBody;
  
  /** Response definitions */
  responses: RouteResponse[];
  
  /** Security requirements */
  security?: string[];
  
  /** Whether the route is deprecated */
  deprecated?: boolean;
  
  /** Source file where the route was found */
  sourceFile: string;
  
  /** Line number in the source file */
  sourceLine?: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * File content for analysis
 */
export interface FileContent {
  /** File path (relative or absolute) */
  path: string;
  
  /** File content */
  content: string;
  
  /** File language (auto-detected if not provided) */
  language?: 'typescript' | 'javascript' | 'python' | 'unknown';
}

/**
 * Generator options
 */
export interface GeneratorOptions {
  /** OpenAPI spec title */
  title?: string;
  
  /** OpenAPI spec description */
  description?: string;
  
  /** API version */
  version?: string;
  
  /** Base URL for the API */
  baseUrl?: string;
  
  /** Default tags for routes without tags */
  defaultTags?: string[];
  
  /** Whether to include examples in the spec */
  includeExamples?: boolean;
  
  /** Whether to generate schemas from type annotations */
  inferSchemas?: boolean;
  
  /** Security schemes to include */
  securitySchemes?: Record<string, OpenAPIV3_1.SecuritySchemeObject>;
  
  /** Contact information */
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  
  /** License information */
  license?: {
    name: string;
    url?: string;
  };
  
  /** External documentation */
  externalDocs?: {
    description?: string;
    url: string;
  };
  
  /** Server definitions */
  servers?: Array<{
    url: string;
    description?: string;
    variables?: Record<string, {
      default: string;
      description?: string;
      enum?: string[];
    }>;
  }>;
}

/**
 * Result from analyzing a framework's routes
 */
export interface AnalysisResult {
  /** Analyzed routes */
  routes: AnalyzedRoute[];
  
  /** Detected schemas/models */
  schemas: Record<string, JsonSchemaDefinition>;
  
  /** Detected security schemes */
  securitySchemes: Record<string, OpenAPIV3_1.SecuritySchemeObject>;
  
  /** Warnings during analysis */
  warnings: string[];
  
  /** Errors during analysis */
  errors: string[];
  
  /** Framework detected */
  framework: 'express' | 'fastify' | 'koa' | 'fastapi' | 'flask' | 'nextjs' | 'unknown';
  
  /** Source files analyzed */
  filesAnalyzed: string[];
}

/**
 * Base interface for route analyzers
 */
export interface RouteAnalyzer {
  /** Name of the analyzer */
  name: string;
  
  /** Analyze files and extract routes */
  analyze(files: FileContent[]): Promise<AnalysisResult>;
  
  /** Check if this analyzer can handle the given files */
  canAnalyze(files: FileContent[]): boolean;
}

/**
 * OpenAPI specification (3.1.0)
 */
export type OpenAPISpec = OpenAPIV3_1.Document;
